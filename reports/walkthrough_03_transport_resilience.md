# Walkthrough Unit 3 — Transport & Resilience

**Date:** 2026-05-30
**Auditor:** Claude (module-wise walkthrough)
**Scope:** Outbound fetch path, proxy failover, AI calls, API governance, story-fetch normalization
**Files (read line-by-line):**
`src/services/proxyManager.js`, `src/services/geminiService.js`, `src/services/crawlerService.js`, `src/adapters/newsFetcher.js` (+ usage grep across `src/`)

---

## Verdict

🟢 **`proxyManager` is genuinely resilient** — 4-proxy failover, per-proxy cooldowns keyed to error type, in-memory success cache, AbortController-based timeouts (the correct pattern `fetchClient` is missing — see F1-3).

🔴 **Two high-severity issues:** (1) the entire `crawlerService` governance layer is **dead code** — nothing imports it, so the app has **no enforced API rate-limit/budget/key protection**; (2) `newsFetcher` mints **non-deterministic story IDs** (`Date.now()`), which silently defeats dedup, "seen" penalties, and read-history downstream.

---

## Findings

| ID | Lens | Severity | Location | Finding |
|----|------|----------|----------|---------|
| F3-1 | Dead code / Resilience | **High** | `services/crawlerService.js` (entire file) | **631-line module is unreferenced.** Grep across `src/` for `crawlerService`, `canFetchWithApis`, `getAutoCrawlConfig`, `_checkRateLimit`, `handleFailure`, `validateGeminiResponse` returns **only the file itself**. The leaky-bucket rate limiter (`_checkRateLimit`) isn't even called internally. Result: the designed protections (daily budgets, per-minute limits, key validation, hallucination guard, failure taxonomy) are **not in effect anywhere**. `settings.crawlerMode:'auto'` implies it was meant to be wired. Either wire it or delete it. |
| F3-2 | Data integrity | **High** | `adapters/newsFetcher.js:43` | **Non-deterministic story IDs.** `id = \`${slot}-${idx}-${Date.now()}\`` changes every fetch for the *same* article. Anything keyed on `id` — dedup maps, `incrementViewCount`/`getViewCount`, `isArticleRead`/`addReadArticle`, and the ranking "seen penalty" — **cannot match the same story across refreshes**. This plausibly explains the AUDIT_REPORT "Seen Penalty appeared ineffective" anomaly. IDs should be a stable hash of `url`/`title`. |
| F3-3 | Resilience (dead path) | Medium | `services/proxyManager.js:144-145,197-199` | **Stale-cache-on-total-failure is unreachable.** The post-loop `if (cached) return cached` can never fire: `cached` was read before the loop and, if present, already returned at line 145; `getCached` also *deletes* entries past TTL. So when all proxies fail, the manager **throws instead of serving slightly-stale data** — the opposite of the intended fallback. Keep a separate `lastKnownGood` (ignoring TTL) for this path. |
| F3-4 | Bug (rotation) | Medium | `services/proxyManager.js:154,184` | **`currentIndex` is an index into a filtered list, reused against a differently-filtered list.** On success it stores the position within `proxiesToTry` (which excludes cooling-down proxies); next call that list may differ in length/order, so the modulo math points at an unrelated proxy. Sticky "last-good-first" rotation is therefore unreliable (best-effort only; not crashing). |
| F3-5 | Resilience / Concurrency | Medium | `services/geminiService.js:9-10,41,75` | **No timeout/abort on Gemini calls** — `model.generateContent(prompt)` can hang indefinitely. Also `genAI`/`model` are **module-level singletons re-assigned on every `initializeAI` call**; concurrent `generateSummary`/`translateTexts` (or different keys) race on the shared `model`. |
| F3-6 | Bug (quota) | Medium | `services/crawlerService.js:130,140` | `initUsage`/`trackUsage` call `localStorage.setItem` **without try/catch** → can throw `QuotaExceededError` to callers. (Currently moot because the module is dead — but a trap if it's wired in per F3-1.) Most sibling functions here *do* guard their writes. |
| F3-7 | Data integrity | Low | `services/proxyManager.js:29-32,17-45` | RSS `<media:content>` fallback selector `querySelector('content')` can match an Atom/`content:encoded` node and grab the wrong URL. Item fields are raw `textContent` (entities/CDATA/HTML) — confirm sanitization happens downstream (Unit 4). |
| F3-8 | Config (dead) | Low | `crawlerService.js:531-564` | `validateApiKeys` reads `settings.googleApiKey`/`duckDuckGoApiKey`/`geminiApiKey` — fields that don't exist in `DEFAULT_SETTINGS` (Unit 2). Another sign this governance layer was never integrated. |

## Detailed notes

### F3-1 — the orphaned governance layer
`crawlerService` is the most thoughtfully-designed file in the transport area: explicit API-key *roles* and *risk budgets*, "Gemini never fetches / only reads sealed snapshots", "DuckDuckGo requires corroboration", a hallucination-phrase validator, a leaky-bucket limiter, per-key health tracking, and a failure-response taxonomy with user-facing messages. **None of it runs.** This is the highest-leverage decision in the unit: the design is good enough to wire in (it would give the live-API paths real budget/rate protection), but as-is it's pure liability — readers assume protection that doesn't exist. Recommend: wire `canFetchWithApis` + `_checkRateLimit` into the actual fetch entry points, *or* delete and capture the design in a doc.

### F3-2 — the ID instability bug (highest data-integrity impact in the unit)
Stable identity is a precondition for every "remember what the user saw" feature. Because `newsFetcher` regenerates IDs per fetch, the insight pipeline's stories are effectively new entities each cycle. Recommend `id = \`${slot}-${fnv1aHex(url||title)}\`` (reuse `fnv1aHex` from `dataEnvelope.js`). Then re-test the seen-penalty case from AUDIT_REPORT §2.

### What's good (keep)
- **`proxyManager` AbortController timeout** (`:159-170`) — the correct cancel-on-timeout pattern; lift this into `fetchClient`/`withTimeout` (fixes F1-3).
- **Error-type-aware cooldowns** — CORS → 1 h, 429 → 5 min, else 5 min; and "all cooling down → try all anyway" avoids deadlock.
- **In-memory success cache** (10 min TTL) reduces proxy load and smooths transient failures.
- **`getProxyHealth()`** exposes per-proxy failure/last-success/cooldown for the Data Health page.
- **`crawlerService` design** (if salvaged) is a strong template for API governance.
- **`newsFetcher` timestamp coercion** (number/ISO/Schema.org/NaN-guard) is careful and correct.

## Recommended fixes (priority order)
1. **F3-2** stable, content-derived story IDs (then re-verify seen-penalty).
2. **F3-1** wire or remove `crawlerService` (decide deliberately).
3. **F3-3** real stale-cache fallback in `proxyManager` on total failure.
4. **F3-5** add timeout/abort to `geminiService`; stop sharing mutable `model`.
5. **F3-4** fix `currentIndex` rotation semantics.

## Evidence to run
`npm run test:hardening:release1A/1B` (transport hardening) and the proxy/market smoke tests — check whether any cert asserts the stale-cache fallback (F3-3) or ID stability (F3-2); if not, these are untested.

## Cross-references
- F3-1 → **Unit 2** F2 (dead `crawlerMode`, missing key fields), **Unit 13** (does a real backend/API path exist?).
- F3-2 → **Unit 4** (dedup keys), **Unit 5** (insight pipeline identity), AUDIT_REPORT §2 seen-penalty.
- F3-3/F3-4 → **Unit 7** (market "vanishing data" user complaint may share this all-proxies-failed throw path).
- "Lift AbortController into fetchClient" → **Unit 1** F1-3.
