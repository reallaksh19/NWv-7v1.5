# Walkthrough Unit 9 — Up Ahead + Planner

**Date:** 2026-05-30 · **Mode:** Auditor (identify & instruct)
**Scope:** Event categorization, date handling, planner persistence/merge, the known AUDIT_REPORT bugs, the lint-confirmed page bugs
**Files deep-read:** `utils/plannerStorage.js`, `services/upAheadService.js` (categorizer + python-transform regions), `viewModels/useMyPlannerPageViewModel.js` (load effect) + `MyPlannerPage.jsx`/`UpAheadPage.jsx` (lint-confirmed)

---

## Verdict

🟢 **Planner persistence is robust** — `plannerStorage` does normalize→dedup→merge→prune, blacklist handling, and remote+static sync correctly (matching the AUDIT_REPORT "items survive reload" result). The Python-prefetch transform path is clean.

🔴 **This unit carries the most user-visible bugs**, and most trace to two roots already in the ledger: the **A-4 timezone date-key bug** (which plausibly *is* the "Plan My Week doesn't show" cause) and **fragile substring categorization** (the "No movies listed" cause). Plus two lint-confirmed page bugs (B-1, B-3).

---

## Findings & Instructions

| ID | Sev | Finding | Instruction |
|----|-----|---------|-------------|
| **U9-1** | High | **B-1: "Add to Calendar" button is dead.** `MyPlannerPage.jsx:454` calls `exportPlannerItem` inside `PlannerItem`, but it's only destructured in `MyPlannerPage` (:490) and not passed down → `no-undef` → `ReferenceError` on click (silent; event-handler errors bypass ErrorBoundary). | Pass `exportPlannerItem` (and `onInspect` etc.) into `PlannerItem` as a prop, or lift the export to a module-scope import. Add a click test. |
| **U9-2** | High | **"No movies listed" — fragile categorization.** Live categorization uses substring `.includes()` over large keyword lists with **contradictory positive/negative entries** (F2-7: `'launches'` is both a signal and a negative; `'releasing'` is a movie keyword but broad negatives can net it out). "Leo releasing on Oct 25" → misclassified. *Also* there are **two categorizers**: JS (live) and the Python prefetch (`transformPythonItemsToDisplay`, used on static host). | (1) Switch to **word-boundary regex** matching. (2) Reconcile the positive/negative keyword lists (F2-7). (3) Add the failing AUDIT cases as cert tests. (4) Verify the **Python** pipeline categorizer matches (Unit 13) so static-host and live agree. |
| **U9-3** | High | **A-4 timezone date keys pervade the planner _and_ disagree with the canonical pipeline.** `plannerStorage` uses UTC `toISOString().slice(0,10)` in `normalizeDateKey`, `pruneStaleEntries`, and `getUpcomingDays` (`date >= today`), while `canonicalItemBuilder`/`dateAware` use local-`setHours`+UTC. An Up Ahead item's `eventDateKey` can therefore land in a **different date bucket** than the planner computes for "today"/the target day → "I added it for Saturday but it's not there." This is the most likely **"Plan My Week doesn't show"** mechanism. | Adopt the shared **local-date helper** (A-4 fix) everywhere date keys are produced/compared — `canonicalItemBuilder`, `dateAware`, `plannerStorage`. Add a test that an item saved for a given local day appears under that day. |
| **U9-4** | Medium | **Silent save failure on quota.** `writeLocalPlan` (and blacklist writes) call raw `localStorage.setItem` with **no try/catch** (F1-6). A large plan throws → caught one level up in `addItem` → returns `false` → user sees "nothing happened." | Route planner writes through `safeStorage.safeSetJson` and surface a real "couldn't save (storage full)" message instead of a silent false. |
| **U9-5** | Medium | **`addItem` returns `false` on dedup-skip** (existing similar item) — indistinguishable from a real failure. Callers may show "save failed" when the item is simply already present. | Return a richer result (`{saved:true}` / `{skipped:'duplicate'}`); update callers to show "already in your plan" rather than an error. |
| **U9-6** | Medium | **B-3: dead/unreachable code in Up Ahead.** `UpAheadPage.jsx:444` `no-unreachable`; `useUpAheadTabViewModel` imported but unused (:12); "awkward fallback reload wiring." | Remove the unreachable branch and unused import; straighten the fallback-reload path and cover it with a test. |
| **U9-7** | Low | **Two categorization implementations** (JS live + Python prefetch) — divergence risk; static-host users and local-dev users can see different categories for the same item. | Treat the Python output as canonical and have the JS path defer to prefetched categories when present (it partly does via `transformPythonItemsToDisplay`); document the contract. |

## Detailed notes

### U9-3 — why this is probably "Plan My Week doesn't save"
The AUDIT_REPORT proved the *storage* layer persists and merges correctly, and hypothesized a UI `useEffect` race. I checked: `useMyPlannerPageViewModel.loadPlan` is a benign one-time mount load (the `set-state-in-effect` lint flag is technically true but harmless). The more likely culprit is **date-key mismatch**: the item is saved (storage works) but under a date key that differs by one day from where the planner UI looks for it, so it appears "lost." Fixing A-4 consistently should resolve both the planner and the timeline-bucketing edge cases.

### What's good (keep)
- **`plannerStorage`** — thorough `normalizePlanData`/`mergePlans`/`deduplicatePlanItems`, blacklist pruning, 30-day auto-prune, and a correct static-host-vs-API split. Persistence itself is reliable.
- **`transformPythonItemsToDisplay`** cleanly adapts the prefetched Python pipeline output, deferring categorization to the (richer) Python side on static host.
- **Stable canonical IDs** (`generateCanonicalId` = hash(slug + dateKey)) — the right pattern (unlike the news ephemeral IDs, A-5).
- Strong cert coverage (`test:planner-*`, `test:upahead-*`).

## Evidence to run
`npm run test:planner-state-hygiene`, `test:planner-bulk-actions`, `test:planner-evidence`, `test:upahead-briefing`, `test:upahead-evidence`, `test:travel-location-priority`. **Add**: movie-category cases from AUDIT_REPORT §3; a save→display same-day test (U9-3); a planner-button click test (U9-1).

## Cross-references
- U9-1/U9-6 → Ledger **B-1/B-3** (lint-confirmed).
- U9-2 → **Unit 2** F2-7 (keyword contradictions), **Unit 13** (Python categorizer).
- U9-3 → **Unit 4** A-4 (the shared root), AUDIT_REPORT §3.
- U9-4 → **Unit 1** F1-6 (silent `safeStorage` write failure).
