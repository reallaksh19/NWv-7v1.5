# Consolidated Bug Ledger & Baseline

**Date:** 2026-05-30
**Owner:** module-wise walkthrough
**Purpose:** Single prioritized ledger merging (a) the depth-first architectural findings from the per-unit reports, (b) the breadth-first empirical findings, and (c) the lint/build baseline. Detail for each architectural item lives in `reports/walkthrough_0X_*.md`.

> Repo is **not a git repository** — this ledger *is* the tracking system. Restore git to enable diffs/blame.

---

## Empirical baseline (measured 2026-05-30)

| Gate | Command | Result |
|------|---------|--------|
| Build | `npm run build` | ✅ Pass (6.78 s, 326 modules) |
| Bundle | — | ⚠️ **`index-*.js` 985.43 kB** (gzip 300 kB); Vite warns >500 kB → wants `dynamic import()` code-split |
| Lint (before) | `npm run lint` | ❌ 43 problems (**26 errors, 17 warnings**) — *included `zip_extracted/` archive noise* |
| Lint (after scope fix) | `npm run lint` | ❌ 39 problems (**24 errors, 15 warnings**) — **all in live `src/`** |
| Unit tests | `npm run test:unit` | ✅ **122 files / 758 tests pass** (110 s) |

**Action taken:** `eslint.config.js` `globalIgnores` extended from `['dist']` → `['dist', 'zip_extracted', 'backup file', 'insight_files']`. This removed 2 errors + 2 warnings of pure archive noise so the lint signal now reflects live code only. *(Zero behavior change.)*

---

## Lint triage (the 24 live errors are NOT uniform — do not blanket-suppress)

| Bucket | Count (approx) | Nature | Action |
|--------|----------------|--------|--------|
| **Functional bugs** | ~4 errors | `no-undef`, `rules-of-hooks`, `no-unreachable` | Fix as bugs (B-1..B-3 below) |
| **Hook-correctness smells** | ~4 errors + ~10 warns | `set-state-in-effect`, `exhaustive-deps` | Triage per call site (S-1, S-2) |
| **Dev-DX noise** | ~8 errors | `react-refresh/only-export-components` | Low priority; split constants into own files |
| **Cleanup** | ~7 errors | `no-unused-vars`, stray `eslint-disable` | Safe cleanup |

---

## Priority 1 — Functional bugs (confirmed by lint AND read)

| ID | Sev | File:line | Bug | Effect | Gating test to add |
|----|-----|-----------|-----|--------|--------------------|
| **B-1** | High | [MyPlannerPage.jsx:454](src/pages/MyPlannerPage.jsx) | `exportPlannerItem` used in `PlannerItem`, only destructured in `MyPlannerPage` (:490), **not passed as prop** → `no-undef` | 📅 "Add to Calendar" throws `ReferenceError` on click; button is silently dead (event-handler errors bypass ErrorBoundary) | Click handler invokes export with item |
| **B-2** | High | [SettingsPage.jsx:679](src/pages/SettingsPage.jsx), :794 | `useState` called inside nested render fns `renderMainContent` & `renderBuzzContent` → `rules-of-hooks` ×2 | Unstable hook order; tab state can desync/throw when conditionally rendered | Render Settings, toggle tabs, assert no hook warning/crash |
| **B-3** | Medium | [UpAheadPage.jsx:444](src/pages/UpAheadPage.jsx) | `Unreachable code` in fallback-reload wiring; `useUpAheadTabViewModel` imported but unused (:12) | Fallback path doesn't execute as written | Exercise the reload fallback branch |

## Priority 2 — Hook-correctness smells

| ID | Sev | Sites | Issue |
|----|-----|-------|-------|
| **S-1** | Medium | `useDataset.js:98`, `useWeatherTabViewModel.js:111`, `useMyPlannerPageViewModel.js:132` | `set-state-in-effect` → cascading renders. The weather case (`setActiveCityState` when `activeCity` not in `cities`) is **derived state** that should be computed during render, not in an effect. |
| **S-2** | Low–Med | `useShellRuntimeProps.js:18` (missing `runtime`), `useUpAheadTabViewModel`, `useNewspaperTabViewModel`, `useMarketPageViewModel`, `SettingsPage` (`safeSettings` ×4) | `exhaustive-deps` — memo/callback deps recomputed every render or stale closures; can cause refetch loops or stale data |

## Priority 3 — Data / fallback integrity (verified)

| ID | Sev | Location | Finding |
|----|-----|----------|---------|
| **D-1** | High | [public/data/weather_snapshot.json](public/data/weather_snapshot.json) | `fetchedAt: 1744348800000` = **2025-04-11 (~13.5 months stale)**. The shipped weather fallback is over a year old. Combined with the inline-SLO market/weather pattern (A-3), it's shown as `FRESH` or hidden — never honestly "stale". → **Unit 8** |

---

## Priority 1/2 — Architectural findings (from per-unit reports)

| ID | Sev | Theme | Where | Report |
|----|-----|-------|-------|--------|
| **A-1** | High | **`loadWithPolicy` is dead** — the documented live→snapshot→cache→seed fallback cascade is used by no dataset/service | `data/loadWithPolicy.js` | [Unit 6](reports/walkthrough_06_datasets_slo.md) |
| **A-2** | High | **`crawlerService` is dead** — 631 LOC of API rate-limit/budget/key governance, unreferenced → no enforced API protection | `services/crawlerService.js` | [Unit 3](reports/walkthrough_03_transport_resilience.md) |
| **A-3** | High | **SLO applied two incompatible ways** → Market/Weather hide all data on any SLO miss; root cause of "market vanishes" | `datasets/*`, `marketDataset.js`, `marketSlo.js` | [Unit 6](reports/walkthrough_06_datasets_slo.md) |
| **A-4** | High | **TZ date-key off-by-one replicated in 4 files** (`setHours` local + `toISOString` UTC); breaks vs UTC prefetch, misdates UI | `dateAware`, `canonicalItemBuilder`, `deDuplication`, `dateExtractor` | [Unit 4](reports/walkthrough_04_ingestion_editorial.md) |
| **A-5** | High | **Ephemeral story IDs** (`Date.now()`/`idx`) on insight & DDG/search paths defeat dedup/seen-penalty/read-history | `adapters/newsFetcher.js`, `services/newsService.js` | [Unit 3](reports/walkthrough_03_transport_resilience.md) |
| **A-6** | High | **Cache has no TTL/invalidation** — long-open session serves frozen data; freshness computed once | `data/orchestrator/useDataset.js` | [Unit 1](reports/walkthrough_01_data_foundation.md) |
| **A-7** | High | **Array-merge freezes defaults** — new default list entries never reach existing users after first save | `utils/storage.js` (`deepMerge`) | [Unit 2](reports/walkthrough_02_config_defaults.md) |
| **A-8** | High | **Trading holidays hardcoded only to 2026** — market open/closed logic wrong from 2027 | `config/settings_market.js` | [Unit 2](reports/walkthrough_02_config_defaults.md) |
| **A-9** | Med | **Bundle 985 kB, no route code-splitting** — `App.jsx` statically imports all 14 pages | `src/App.jsx` | [Unit 0](reports/walkthrough_00_repo_hygiene.md) |
| **A-10** | Med | **`withTimeout` doesn't abort** the fetch; proxy already has the correct AbortController pattern to lift | `utils/withTimeout.js`, `fetchClient.js` | [Unit 1](reports/walkthrough_01_data_foundation.md) |
| **A-11** | Med | **Duplication**: 3 dedup engines, 2 date engines, 3 location sources, 4 cache layers, dedup config ×2 | multiple | Units 1/4/5/6/8 |
| **A-12** | Med | **Embedding vocab gap** — fixed 200-term TF-IDF omits hyperlocal terms (no Trichy) → weak insight clustering locally | `adapters/embeddingsAdapter.js` | [Unit 5](reports/walkthrough_05_insight_engine.md) |

---

## Batch 2 — domain findings (Units 7–13)

| ID | Sev | Finding | Report |
|----|-----|---------|--------|
| **A-13** | **High** | **No weather workflow or generator exists** → `weather_snapshot.json` orphaned since 2025-04-11 (definitive root cause of D-1/W8-1). | [Unit 13](reports/walkthrough_13_automation_ci_pwa.md) |
| **A-14** | High | **Weather snapshot fallback has no recency guard** — serves year-old data as merely "stale" (unlike `marketTrust`). | [Unit 8](reports/walkthrough_08_weather.md) |
| **A-15** | High | **Market/Weather split-brain**: dedicated tab (Context, graceful) vs Main-page widget (`*Dataset`, binary-vanish). | [Unit 7](reports/walkthrough_07_market.md) / [8](reports/walkthrough_08_weather.md) |
| **A-16** | High | **Cross-TZ "Now" bug** — `weatherService` indexes location-local hourly with browser-local hour; registry timezones unused. | [Unit 8](reports/walkthrough_08_weather.md) |
| **A-17** | Med | **Two dead market services** (`marketService`, `indianMarketService`) — orphan pattern (with `crawlerService`, `loadWithPolicy`). | [Unit 7](reports/walkthrough_07_market.md) |
| **A-18** | Med | **False topic notifications every 15 min** — `checkForUpdates` keys on ephemeral `articles[0].id` (A-5). | [Unit 11](reports/walkthrough_11_following_buzz_topic.md) |
| **A-19** | Med | **Two categorizers (Python prefetch + JS live)** must both get the movie/word-boundary fix or diverge. | [Unit 9](reports/walkthrough_09_upahead_planner.md) / [13](reports/walkthrough_13_automation_ci_pwa.md) |
| **A-20** | Med | **Gemini AI summaries off in prod** — `daily_brief.py` falls back to headlines (no `GEMINI_API_KEY`). | [Unit 10](reports/walkthrough_10_newspaper.md) / [13](reports/walkthrough_13_automation_ci_pwa.md) |
| **A-21** | Med | **Degraded-UI starved**: `DataStateBanner`/`Badge` handle `stale` but only Insight emits it (F6-4); 985 kB single bundle (A-9). | [Unit 12](reports/walkthrough_12_viewmodels_pages_ui.md) |

## Prior AUDIT_REPORT complaints — status from this walkthrough (all 4 root-caused)

| Complaint | Root cause found | Status |
|-----------|------------------|--------|
| "Market data vanishes after 2 hours" | A-3 (envelope binary freshness on **Main widget**) + proxy stale-cache discard (F3-3). The dedicated **Market tab is already fixed** by `marketTrust`. | **Root-caused** (A-15) |
| "Seen penalty ineffective" | A-5 ephemeral IDs (insight/DDG paths; main feed is stable). | **Root-caused** |
| "No movies listed" (`detectCategory`) | substring `includes()` + contradictory pos/neg keywords (F2-7); **two** categorizers (A-19). | **Root-caused** (U9-2) |
| "Plan My Week doesn't save" | most likely **A-4 date-key mismatch** (item saved under a different day key than the UI reads); storage layer itself is sound; + silent quota failure (U9-4). | **Root-caused** (U9-3) |

---

## Recommended sequencing (fundamentals first, per request)
1. ✅ Lint scope fix (done) — clean baseline.
2. **Triage, don't suppress** the 24 lint errors: fix B-1/B-2/B-3 as bugs; address S-1 weather derived-state; defer N-1 react-refresh.
3. Then the High architectural items, starting with the market-vanish chain (A-3 + F3-3) and the TZ date-key helper (A-4), each behind a new test.
4. Continue Batch 2 walkthrough (Units 7–13) to complete coverage and the `FALLBACK_MATRIX` / `DEFAULTS_MATRIX`.
