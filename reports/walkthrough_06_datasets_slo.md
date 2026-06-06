# Walkthrough Unit 6 — Datasets + SLO Contract Layer

**Date:** 2026-05-30
**Auditor:** Claude (module-wise walkthrough)
**Scope:** The 13 dataset loaders, the 13 SLO evaluators, the SLO application layer, and how they connect the envelope spine to the services
**Files deep-read:** `data/datasets/index.js`, `data/datasets/marketDataset.js`, `data/datasets/sectionsDataset.js`, `data/slo/applyDatasetSlo.js`, `data/slo/marketSlo.js` + repo-wide grep survey of `loadWithPolicy`, `applyDatasetSlo`, and `FRESHNESS.STALE/EXPIRED` usage
**Characterized via grep (not individually deep-read):** the other 11 datasets and 11 SLO evaluators — each follows one of the two patterns documented below

---

## Verdict

🔴 **The elegant data spine from Unit 1 is only half-wired.** The `Envelope` contract is universal and good. But `loadWithPolicy` — the documented live→snapshot→cache→seed→failed cascade — is **used by zero datasets** (dead, like `crawlerService`). SLO application is split across **two incompatible patterns**, and the stricter pattern (used by Market/Weather) is the **root cause of the "market data vanishes" complaint**.

🟢 Where wired, `applyDatasetSlo` is genuinely good (required-aware graceful degradation), and `sectionsDataset` demonstrates correct partial-failure tolerance.

---

## Findings

| ID | Lens | Severity | Location | Finding |
|----|------|----------|----------|---------|
| F6-1 | Dead code / Architecture | **High** | `data/loadWithPolicy.js` (whole) | **The fallback cascade is orphaned.** Repo-wide grep: `loadWithPolicy` appears only in its own file + cert test. **No dataset, service, or adapter uses it.** The praised SWR cascade (Unit 1) is aspirational; actual fallback is implemented ad-hoc *inside services* (e.g., `indianMarketStableService`) with no shared contract. Either route datasets through it or delete it. |
| F6-2 | Consistency / Fallback | **High** | `datasets/*` (two patterns) | **SLO is applied two incompatible ways.** Six datasets (`buzz`, `insight`, `newspaper`, `planner`, `following`, `sections`) call `applyDatasetSlo` → *required-aware, graceful* (non-required failure keeps `ok:true` + warnings). Six (`market`, `weather`, `qualityDashboard`, `sourceHealth`, `upAhead`, `main`) **embed SLO inline** and set `ok = slo.passed` → *all-or-nothing*. So Market/Weather **hide all data on any SLO miss** while Sections/Buzz **degrade gracefully**. Same platform, opposite resilience. |
| F6-3 | Data integrity / UX | **High** | `marketDataset.js:51-58` + `marketSlo.js:65` | **Root cause of "market data vanishes."** `marketSlo` is `required:true`; `marketDataset` sets `ok = slo.passed` and freshness **only `FRESH` or `EMPTY`**. So when the market fetch returns empty (e.g., all proxies failed — see F3-3), SLO fails → `ok:false` → envelope unusable → **UI shows nothing**. There is no "stale-but-visible-with-warning" path. The exact user complaint, reproduced from the data layer. |
| F6-4 | Dead UI | Medium | grep: only `insightDataset.js:110` emits `STALE` | **The freshness taxonomy is mostly unused.** `ENVELOPE_FRESHNESS.STALE`/`EXPIRED` exist and the UI has badges for them, but **only `insightDataset` ever emits `STALE`**; every other dataset uses `FRESH`/`EMPTY` (or failed). The `DataFreshnessBadge` "stale/expired" states are effectively dead for 12 of 13 datasets. |
| F6-5 | Data integrity | Medium | `data/slo/marketSlo.js:46-51` | **Market SLO validates timestamp *validity* but not *recency*.** It checks `fetchedAt` is a finite number > 0, not whether it's recent. So genuinely old market data (hours stale) **passes SLO and is labeled `FRESH`** with no age warning. Combined with F6-3: stale data is either mislabeled fresh or hidden — never shown honestly as stale. |
| F6-6 | Architecture | Low | `orchestrator/useDataset.js:24` | **No central SLO guarantee.** The orchestrator (`loadDataset`) does *not* call `applyDatasetSlo`; each dataset must remember to self-apply (inline or via wrapper). A newly added dataset that forgets gets *no* SLO. Centralizing SLO in the orchestrator would remove the F6-2 inconsistency and this gap at once. |
| F6-7 | Integrity | Low | `sectionsDataset.js:106-124` | `normalizeSectionBuckets` re-buckets items by their (possibly *reclassified*) `item.section`. A 'chennai'-fetched item reclassified to 'india' leaves the 'chennai' bucket — the requested section can end up emptier than its fetch suggests. Minor, but affects per-section counts. |

## Detailed notes

### F6-1 / F6-2 / F6-3 — the spine is half-wired (the central architectural story)
Unit 1 praised three things: the `Envelope` contract, the `loadWithPolicy` cascade, and the SLO scorer. Reality after tracing the dataset layer:
- **Envelope** — universal and consistently shaped. ✅
- **`loadWithPolicy`** — **dead.** Fallback lives wherever each service decides. ❌
- **SLO** — applied two ways, with opposite failure semantics. ⚠️

The practical consequence is uneven resilience that users *feel*: News/Buzz/Following keep showing whatever loaded; Market/Weather blink out entirely on a bad fetch. The fix is convergent: route every dataset through one path (ideally `loadWithPolicy` for the source cascade **and** a centrally-applied `applyDatasetSlo` with correct `required` flags), and let SLO failures **downgrade freshness** (`STALE`) and add warnings rather than nulling `ok`.

### F6-3 — concrete repro chain for the market complaint
`indianMarketStableService` stale cache expires → returns empty/`indices:[]` → `evaluateMarketSlo` → `market_indices_empty`, `passed:false` → `marketDataset` `ok:false`, `freshness:EMPTY` → `useDataset` exposes `error`, no data → `MarketPage` renders empty. Two upstream fixes (F3-3 stale-cache fallback in `proxyManager`; a "stale-visible" market path here) would resolve it. Re-verify against AUDIT_REPORT §4.

### What's good (keep)
- **`applyDatasetSlo`** is well-designed: `required:true && !passed` → fail envelope; otherwise keep `ok:true`, downgrade to warnings, preserve diagnostics. This is the correct graceful-degradation primitive — it just isn't used everywhere.
- **`sectionsDataset`** is a model dataset: `Promise.allSettled` per section, partial failures become warnings, rich per-section health metadata, lenient `ok` (`any content → ok`).
- **`marketSlo` plausibility checks** — rejects non-positive index values and flags `|change%| > 20` as warnings (good anomaly detection).
- **Envelope conformance** — every dataset returns a well-formed envelope with diagnostics, even on the catch path.
- **Frozen dataset registry** (`DATASET_LOADERS`) with a clean `getDatasetLoader` lookup.

## Recommended fixes (priority order)
1. **F6-2 / F6-6** centralize SLO application in the orchestrator; converge the two patterns on the graceful `applyDatasetSlo` semantics.
2. **F6-3 / F6-5** give Market (and Weather) a stale-but-visible path; add a recency check that downgrades freshness to `STALE` instead of nulling `ok`.
3. **F6-1** wire datasets through `loadWithPolicy` (so the source cascade is uniform and testable) — or delete it and document the per-service fallback reality.
4. **F6-4** once datasets emit `STALE`, the existing freshness badges become meaningful.

## Coverage note
The registry, the SLO application layer, the market SLO, and one dataset of *each* pattern (market = inline; sections = wrapped) were deep-read. The two-pattern split across the remaining datasets is established by the import grep (definitive: exactly which 6 import `applyDatasetSlo`). A confirming read of the other 11 datasets/SLOs is worthwhile before sign-off but will not change the architectural findings.

## Evidence to run
`npm run test:data-foundation`, `test:slo`, `test:slo-release5`, `test:envelope`, `test:r4-cert`. Note whether any cert asserts a *stale-visible* market path (F6-3) — almost certainly not, since the code can't produce one.

## Cross-references
- F6-1 → **Unit 1** F1-5 (cascade deadline — moot if cascade unused), **Unit 3** F3-1 (`crawlerService` also orphaned).
- F6-3 → **Unit 3** F3-3 (proxy stale-cache), **Unit 7** (Market module — the user-facing manifestation), AUDIT_REPORT §4.
- F6-4 → **Unit 12** (`DataFreshnessBadge` dead states).
