# Walkthrough Unit 1 — Data Foundation Spine

**Date:** 2026-05-30
**Auditor:** Claude (module-wise walkthrough)
**Scope:** The shared data contract every dataset flows through
**Files (read line-by-line):**
`src/data/dataEnvelope.js`, `src/data/loadWithPolicy.js`, `src/data/orchestrator/useDataset.js`, `src/data/safeStorage.js`, `src/data/fetchClient.js`, `src/utils/withTimeout.js`, `src/data/diagnosticsStore.js`, `src/data/healthScore.js`, `src/data/geolocation.js`

---

## Verdict

🟢 **The spine is well-designed and mature.** A frozen, hashed `Envelope` contract; an SWR-style fallback cascade (`live → snapshot → cache → seed → failed`); centralized diagnostics; and a composite health/SLO scorer. This is a strong foundation and most domain risk will live in the *loaders* that sit on top (Unit 6), not here.

🟠 Findings are mostly **edge-cases and two design-level concerns**: (1) the global dataset cache has **no TTL/invalidation**, so a long-lived session can serve frozen data, and (2) `withTimeout` **does not abort** the underlying fetch.

---

## Findings

| ID | Lens | Severity | Location | Finding |
|----|------|----------|----------|---------|
| F1-1 | Data integrity / Fallback | **High** | `orchestrator/useDataset.js:6,16` | **Module-global `envelopeCache` Map with no TTL or eviction.** Once a dataset is loaded, `loadDataset(id, force=false)` returns the cached envelope for the entire app lifetime. `useDataset` calls `reload(false)` on mount, so remounting a page does **not** re-evaluate freshness. A session left open serves data whose `freshness` field is frozen at first fetch. Refresh only happens via explicit `force` (RefreshPage / pull-to-refresh / worker). |
| F1-2 | Bug (concurrency) | Medium | `orchestrator/useDataset.js:42-47` | **`inFlight` dedup races on concurrent force + non-force.** A `force=true` load ignores an in-flight non-forced promise (cache/inFlight checks are skipped) and overwrites `inFlight.set(id, promise2)`. Both loads run; `.finally(() => inFlight.delete(id))` deletes **by key, not identity**, so whichever settles first clears the other's in-flight entry. Result: possible duplicate loader runs and last-writer-wins on `envelopeCache`. |
| F1-3 | Resilience | Medium | `utils/withTimeout.js:8-22`, `data/fetchClient.js:42` | **Timeout does not abort the request.** `withTimeout` only `Promise.race`s a timer; it never calls `AbortController.abort()`. On timeout the underlying `fetch` keeps running (wasted bandwidth; late response is discarded). The internal timer and the caller-supplied `signal` are unrelated — only an externally passed `signal` can actually cancel. |
| F1-4 | Bug (data integrity) | Medium | `data/healthScore.js:41-49` | **NaN score propagates past the clamp.** If any SLO `score` is a non-numeric value, `Number(score)` → `NaN`; the average → `NaN`; `Math.round(NaN)` → `NaN`; `Math.max(0, Math.min(100, NaN))` → `NaN`. The 0–100 bound is silently bypassed and the UI can render `score: NaN`. (`passed`/`status` still degrade to failed, so it's safe-but-ugly.) Guard with `Number.isFinite`. |
| F1-5 | Resilience / Latency | Medium | `data/loadWithPolicy.js:41-105` | **No global deadline across cascade steps.** Steps run sequentially with their own timeouts. Worst case latency = sum of all step timeouts (e.g. live 12s + snapshot 12s + … ≈ 36–48s) before reaching `seed`/`failed`. There is no overall budget that short-circuits to a fast fallback. |
| F1-6 | Data integrity | Medium | `data/safeStorage.js:31-45` | **Silent write failure.** `safeSetJson` returns `false` on `QuotaExceededError`/serialization failure but only `console.warn`s. Callers that ignore the boolean (to be confirmed in Unit 9 Planner) will believe a save succeeded → silent data loss. Also: no key namespacing or stored-schema version → old localStorage shapes can deserialize into new code. |
| F1-7 | Observability | Low | `data/diagnosticsStore.js:1,29` | **Ring buffer is severity-blind.** `slice(-500)` drops oldest regardless of severity, so a burst of `info` events can evict `error` records before they're seen. Consider severity-aware retention or a separate error channel. |
| F1-8 | Config (hardcoded) | Low | `data/geolocation.js:2-8` | **Proximity `LOCATIONS` table is hardcoded** (5 cities with `lat/lon/boost`). User-added custom cities (README advertises city customization) get no coordinates → no proximity boost. Also a **third** location source of truth alongside `src/config/locationLibrary.js` and `services/weatherLocations.js` — reconcile in Unit 8. |
| F1-9 | Performance | Low | `data/dataEnvelope.js:52` | `makeEnvelope` recomputes `payloadHash = fnv1aHex(stableStringify(data))` when absent. For large payloads this is a full re-serialize. `loadWithPolicy` re-wraps an already-built envelope (`makeEnvelope({...env})`), but since `payloadHash` is already present it is preserved — so no double-hash in practice. Confirm no loader calls `makeEnvelope` twice on raw data. |
| F1-10 | Resilience | Low | `data/fetchClient.js:35` | `cache: 'no-cache'` is hardcoded default → no HTTP-cache reuse for static snapshot JSON served from Pages. Intentional for freshness, but removes an offline/perf cushion the PWA could use. Note for Unit 13. |

## Detailed notes

### F1-1 — the staleness design concern (most important here)
`useDataset` returns the cached envelope synchronously on mount and only fetches when the cache is empty. There is no `maxAge`, no background revalidation, and no cross-tab invalidation. The envelope's `freshness` (`fresh/stale/expired`) is computed **once** by the loader and then frozen in the cache. So the UI's freshness badge can read `fresh` indefinitely even hours later.
**To verify next:** which surfaces call `reload(true)` (RefreshPage, `usePullToRefresh`, `useFreshDataAlert`, `priceAlertWorker`) and whether any timer re-evaluates freshness. **Recommendation:** add a `maxAgeMs` to `loadDataset` that treats cache as a miss past TTL, or a lightweight interval that recomputes `freshness` from `generatedAt`/`fetchedAt` and re-renders badges.

### F1-2 — the inFlight identity bug
Reproduction sketch: component A mounts → `loadDataset(id, false)` sets `inFlight[id]=P1`. User hits Refresh → `loadDataset(id, true)` sets `inFlight[id]=P2` (P1 still pending). P1 resolves first → its `.finally` runs `inFlight.delete(id)`, removing P2's entry. A later `loadDataset(id,false)` no longer dedups against P2 and may start P3. Low frequency, but it undermines the dedup guarantee. **Fix:** store `{promise, token}` and delete only if the current entry's token matches; or skip creating a new promise when one is already in flight unless `force` *and* none in flight.

### F1-3 — abortless timeout
`withTimeout(fetch(...), 12000)` rejects with `TimeoutError` after 12s but the socket stays open. Under proxy slowness (this app rotates RSS proxies — Unit 3) timed-out requests pile up. **Fix:** create an `AbortController` inside `fetchJson`, abort it in the timeout path, and combine with any caller `signal`.

### What's good (keep)
- **Immutability:** `makeEnvelope` returns `Object.freeze(...)` — envelopes can't be mutated downstream.
- **Deterministic hashing:** `stableStringify` sorts keys recursively before `fnv1aHex` → stable `payloadHash` for change detection / dedup.
- **Honest failure:** every failure path returns a structured `failed` envelope with diagnostics rather than throwing — `loadWithPolicy` and `fetchJson` never leak exceptions to the UI.
- **Diagnostics discipline:** every load records a diagnostic with `freshness/source/payloadHash`; listeners are wrapped in try/catch.
- **SLO semantics:** `computeHealthScore` correctly makes a *required* SLO failure dominate the numeric score (`healthy ≥85 / degraded 70–84 / failed <70 or required-fail`).
- **`safeStorage`** correctly degrades to a fallback value when `localStorage` is unavailable (private mode / SSR) instead of throwing.

## Recommended fixes (priority order)
1. **F1-1** add TTL/`maxAge` to the dataset cache (or background freshness re-eval). *Highest user-visible impact.*
2. **F1-3** wire `AbortController` into `withTimeout`/`fetchJson`.
3. **F1-4** `Number.isFinite` guard in `computeHealthScore`.
4. **F1-2** make `inFlight` deletion identity-aware.
5. **F1-5** add a global cascade deadline to `loadWithPolicy`.
6. **F1-6** make `safeSetJson` failures visible to callers (and audit Planner callers in Unit 9).

## Evidence to run (next session start)
`npm run test:data-foundation` and `npm run test:slo` — confirm current green baseline and whether any existing cert encodes the TTL/abort behavior (if not, these findings are untested gaps).

## Cross-references
- F1-6 → **Unit 9** (Planner persistence callers of `safeSetJson`).
- F1-8 → **Unit 8** (reconcile 3 location sources of truth).
- F1-1, F1-10 → **Unit 12/13** (refresh surfaces, PWA offline cache).
