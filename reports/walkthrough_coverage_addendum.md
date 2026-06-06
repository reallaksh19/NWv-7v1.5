# Coverage Addendum — Deferred Deep-Read (Units 4 & 5 follow-up)

**Date:** 2026-05-30 · **Mode:** Auditor
**Purpose:** Close the coverage gaps flagged in Units 4/5. Two earlier findings are **corrected** here.
**Files deep-read now:** `insight/src/dedup/dedup.ts`, `insight/src/cluster/cluster.ts`, `insight/src/ranking/ranking.ts`, `intelligence/classification.js`, `intelligence/sourceTrust.js`, `services/googleNewsService.js` (+ `upAheadService` categorizer grep)

---

## Corrections to prior findings

| Prior | Status now | Evidence |
|-------|-----------|----------|
| **F5-5** (zero-vector cosine → NaN risk) | ❌ **NOT A BUG — closed** | `dedup.ts:220` guards `a.length !== b.length \|\| a.length === 0 → 0`; `:228` `denom === 0 ? 0 : …`. Zero vectors return 0, never NaN. |
| **U9-2** ("No movies listed" / `detectCategory`) | ⬇️ **Largely already fixed — downgrade** | `detectCategory` **no longer exists** in `upAheadService.js` (grep: only `categorySectionKey` remains). Categorization now flows through `classification.classifyItemCategory`, which uses **word-boundary regex** (`\b…\b`, `classification.js:18,34`) and Python prefetch. "Leo releasing on Oct 25" → `movies` (positive 'releasing', no offsetting negatives). **Residual work is only F2-7** (the negative-keyword lists still subtract in scoring) — tune + add the AUDIT cases as tests; the substring-vs-word-boundary fix is already done. |

## New (minor) findings

| ID | Sev | Finding | Instruction |
|----|-----|---------|-------------|
| **DA-1** | Low | **`opinion_editorial` angle missing from `ANGLE_DISPLAY_ORDER`.** `classifyAngle` (`dedup.ts:781,823`) can return `opinion_editorial`, but `treeBuilder.ANGLE_DISPLAY_ORDER` (Unit 5) doesn't list it → `indexOf` returns −1 → such children sort to the **front** (before `base_report`). | Add `opinion_editorial` to `ANGLE_DISPLAY_ORDER` at the intended position. |
| **DA-2** | Low | **Redundant `classifyAngle` calls.** Angle is classified in `removeHardDuplicates`, again in `cluster.createCanonicalParent`, and again in `treeBuilder.buildChildTree` (per story, per run). | Classify once during normalization and reuse `story.angle`. Minor perf + avoids drift. |
| **DA-3** | Low | **Fragile external Google topic hashes.** `googleNewsService.TOPICS` are hardcoded Base64 Google-internal topic IDs that Google can rotate, silently breaking `WORLD_IN`/`TAMIL_NADU`/`CHENNAI` feeds. (Business/Tech already use `*_SEARCH` fallbacks.) | Prefer `…/search?q=` URLs (robust) over topic-hash URLs, or add a health check that falls back when a topic feed returns 0 items. |
| **DA-4** | Low | **Substring matching in trust/region signals.** `sourceTrust.scoreSignals` and `ranking.computeRegionBoost` use `.includes()` (e.g., `'tickets'` matches `'ticketshop'`, `'tn'` over-matches). | Use word-boundary matching (the `classification.js` helper is the model) where false hits matter. |

## Confirmed high quality (no bugs found)
- **`dedup.ts`** — 3-layer hard-dedup (URL → text-hash → same-group title-sim → embedding-sim) with cross-source **useful-variant rescue** and full decision diagnostics; `pickWinner` = authority→earliest; guarded cosine; normalized `eventSimilarity` (weights sum to 1.0).
- **`cluster.ts`** — greedy single-pass with **centroid tracking** (incremental re-normalized mean, FIX M-1), ambiguous-range multi-story check (samples 5, avoids O(n²)), clickbait-penalized editorial clarity, normalized seed/representative scores.
- **`ranking.ts`** — 8-factor parent score (weights sum to 1.0), log-scaled source diversity, sigmoid momentum (FIX M-2), and **per-factor contribution diagnostics** (fully explainable "why this ranked here").
- **`classification.js`** — word-boundary keyword scoring with category/global negatives, source-type bonuses, confidence floors, decision trace.
- **`sourceTrust.js`** — curated domain-rule trust map (IMD/BookMyShow/OTT/airlines…) + keyword source-typing + signal scoring; conservative unknown-domain default.

## Second deep-read batch — normalize, locationAware, feed registries

| ID | Sev | Finding | Instruction |
|----|-----|---------|-------------|
| **DA-5** | Low | **URL canonicalization is inconsistent across subsystems (confirms F4-14).** `insight/normalize.canonicalizeUrl` correctly **strips tracking params** (`utm_*`, `fbclid`, `gclid`, `ref`…) and lowercases/trims — the *right* model. `intelligence/canonicalItemBuilder.normalizeLink` keeps the full URL incl. query, so `?utm=` variants get different `canonicalId`s. | Have `canonicalItemBuilder` reuse `normalize.canonicalizeUrl`'s logic (one shared URL canonicalizer). |
| **DA-6** | Info | **Registry fragmentation, quantified.** Source-quality lives in **4** places (`data/sourceMetrics`, `intelligence/sourceTrust.domainRules`, `insight/normalize.TIER_MAP`, `feedSourceRegistry.trust`); canonical-location lives in **5** (`services/weatherLocations` 300-city, `data/geolocation` 5-city, `config/locationLibrary` 3-city, `feedSourceRegistry.normalizeLocationKey`, `adapters/nlpAdapter.KNOWN_PLACES`). | Consolidate to one source-quality registry and one geo registry (W8-5); derive subsystem views from them. |
| **DA-7** | Good | **`feedSourceRegistry` uses a dynamic `CURRENT_YEAR`** in its search queries (no hardcoded year to rot). **This is exactly the pattern the hardcoded `tradingHolidays` (A-8/F2-2, ends 2026) should adopt.** | Model the holidays/calendar fix on this. |
| **DA-8** | Low | **`feedHealthMonitor` dead conditionals** — `loadStore`/`saveStore` `catch (e) { if (e) { … } … }` where `if (e)` is always true (cosmetic; looks like an unused-var workaround). | Simplify the catch blocks. |
| **DA-9** | Low | **`postTreeParentRerank.ts` is orphaned _and_ latently buggy.** Referenced only by its own cert test (not wired into `pipeline.ts`). It reads `(parent as any).score` but parents expose `finalParentScore`, so `baseScore` is always 0 — if ever wired in, it would **discard the 8-factor ranking** and sort by diversity alone. A cert test green-lights this dead, would-be-buggy code. | Either wire it correctly (use `finalParentScore`) or delete it + its test. Flags the "cert tests certifying unused code" smell. |
| **DA-10** | Low | **`entertainmentService` issues:** (1) `mixedArticles.sort(() => Math.random() - 0.5)` is a **biased, non-uniform shuffle** (use Fisher–Yates); (2) `filterNoise` (horoscope/astrology) is applied **only to the Tamil feed**, not hindi/hollywood/ott; (3) `loadEntertainmentCache`/`saveEntertainmentCache` appear **unused** (the fetch path never calls them). | Fisher–Yates shuffle; apply `filterNoise` to all regions; wire or remove the cache helpers. |

**Confirmed live (not dead):** `feedSourceRegistry` + `feedHealthMonitor` are wired through `services/intelligentUpAheadFetcher.js` (which calls `recordFeedResult`), so the >50%-failure auto-demotion loop is real for the Up Ahead live path.

**Confirmed high quality (no bugs):** `normalize.ts` (fnv1a hashing consistent with `dataEnvelope`, tier/clickbait/age filtering, normalized score fields, `applyTierCFallback`); `locationAware.js` (word-boundary alias matching, online-bypass for offers, decision-traced — note its offline planner geo is restricted to the 3-city library, tying to W8-5); `feedSourceRegistry`/`feedHealthMonitor` (24h rolling health window, fail-open, capped storage).

## Coverage status
Deep-read: the insight pipeline core (pipeline, **normalize**, tree builder, dedup, cluster, ranking, embeddings, nlp, cache) and the intelligence spine (canonical, dateAware, deDuplication, classification, sourceTrust, **locationAware**, **feedSourceRegistry**, **feedHealthMonitor**, editorial policies, eligibility, ingestion ledger). **Still not individually read** (consistent with the established quality pattern; recommend a final pass before formal sign-off, but no blocking risk observed): the 4 `tree/*` variant selectors, `ranking/postTreeParentRerank.ts`, `insight/diagnostics/*`, `insight/quality/*`, `intelligence/explainabilityAudit.js`, `services/entertainmentService.js`, `services/intelligentUpAheadFetcher.js` (full), insight snapshot adapters.

## Net effect on the audit
The insight engine and editorial intelligence are **stronger than the mid-audit reports implied** — one flagged risk (F5-5) was a non-bug, and the headline "movie" bug is mostly already fixed. The High-severity backlog is unchanged and concentrated where it was: **weather automation/freshness, the timezone date-key helper, identity stability, and SLO/freshness convergence.**
