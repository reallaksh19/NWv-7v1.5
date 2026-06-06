# Implementation Agent — Task Brief (News & Weather App)

You are an implementing engineer for a React 19 + Vite static-host app at `C:\Code1\NWv-7`
(news / weather / market / "insight" dashboard, IST-centric). A full module-wise audit has
already been done. Your job is to **fix the findings below, smallest-risk first, each behind a
test** — not to re-audit.

## Read first
- `reports/BUG_LEDGER.md` — the prioritized master list (IDs A-*, B-*, S-*, D-*, F*, U9-*, M7-*, W8-*…).
- `reports/walkthrough_00..13_*.md` — per-module detail; every finding has file:line + a fix instruction + "Evidence to run".

## Ground rules (do not skip)
1. **Not a git repo yet.** Run `git init`, commit the current tree as a baseline, then branch per fix. (Confirm with the user before the first commit.)
2. **Baseline you must not regress:** `npm run build` passes (bundle ~985 kB); `npm run test:unit` = **122 files / 758 tests pass**; `npm run lint` = 24 errors / 15 warnings (already scoped to live `src/`). Re-run all three after each change.
3. **Test before fix.** For each finding, add or extend a `*.cert.test.js`/`*.test.jsx` that *fails* on current behavior, then make it pass. The repo has a strong cert culture (`scripts/test_*`, `npm run test:certify`); follow it.
4. **Do not blanket-suppress lint.** Several of the 24 errors are real bugs (B-1/B-2/B-3). Fix root causes; remove the 4 stale `/* eslint-disable */` file headers (`App.jsx`, `utils/dateExtractor.js`, `services/weatherService.js`, `components/ErrorBoundary.jsx`).
5. **Preserve the architecture patterns:** the `Envelope` contract (`src/data/dataEnvelope.js`), `applyDatasetSlo` graceful degradation, diagnostics (`recordDiagnostic`), and `marketTrust`'s honest-staleness model are the references to follow/extend.
6. One finding → one focused branch/commit with the finding ID in the message.

## Fix order (highest ROI first)

### P1 — Data freshness & timezone (highest user impact)
- **A-13 / W8-1 — Weather has no automation.** Add `.github/workflows/weather_refresh.yml` + `scripts/weather_snapshot_worker.py` (mirror `market_refresh.yml` + `scripts/market_snapshot_worker.py`) that pulls Open-Meteo for `DEFAULT_WEATHER_CITIES` and `git add public/data/weather_snapshot.json`. **Until it runs,** add a recency guard in `src/services/weatherService.js` `fetchWeatherSnapshot`/`fetchWeather` that rejects snapshots/caches older than ~48 h (reuse the `marketTrust.isMarketPayloadDisplayable` pattern). *Accept:* a stale (>48 h) snapshot is not displayed as current; a CI freshness check fails if any `public/data/*snapshot*.json` exceeds its domain max-age.
- **A-4 — Timezone date-key off-by-one in 5+ sites + Python.** Create one helper `toLocalDateKey(date) → 'YYYY-MM-DD'` (using `getFullYear/getMonth/getDate`, not `toISOString`). Replace every `setHours(0,0,0,0)…toISOString().slice(0,10)` in `intelligence/dateAware.js`, `intelligence/canonicalItemBuilder.js`, `intelligence/deDuplication.js`, `utils/dateExtractor.js (expandDateKeys)`, `services/weatherService.js (buildDailyConsensus)`, `utils/plannerStorage.js`. Apply the same convention in the Python generators. *Accept:* an item saved for a given local day appears under that day; server-generated keys round-trip on the client (add a contract test).
- **W8-2 — Cross-TZ "Now".** In `weatherService.processMultiModelData`, compute the current hour from `WEATHER_LOCATION_REGISTRY[key].timezone` (via `Intl.DateTimeFormat`), not `new Date().getHours()`.

### P2 — Identity & state correctness
- **A-5 — Ephemeral story IDs.** Replace `id = \`${slot}-${idx}-${Date.now()}\`` (`adapters/newsFetcher.js`) and `rss-${idx}`/`ddg-${idx}` (`services/newsService.js`) with stable `fnv1aHex(url||title)` (reuse `dataEnvelope.fnv1aHex`). *Accept:* the same article keeps its ID across fetches → seen-penalty works (re-test AUDIT_REPORT §2) and topic notifications stop firing falsely (A-18 / `TopicContext.checkForUpdates`).
- **B-1 (U9-1) — Dead "Add to Calendar".** `MyPlannerPage.jsx:454`: pass `exportPlannerItem` into `PlannerItem` as a prop (it's only in `MyPlannerPage` scope at :490). *Accept:* clicking 📅 exports; `no-undef` gone.
- **B-2 (V12-3) — SettingsPage rules-of-hooks.** Hoist `useState` out of `renderMainContent` (:679) and `renderBuzzContent` (:794), or extract real child components.
- **B-3 (U9-6) — UpAhead dead code.** Remove unreachable branch at `UpAheadPage.jsx:444` and the unused `useUpAheadTabViewModel` import; straighten the fallback-reload.
- **U9-4 / F1-6 — Silent save failures.** Route `utils/plannerStorage.js` (and `useWatchlist`, topic writes) through `safeStorage.safeSetJson`; surface "storage full" instead of returning a silent `false`.

### P3 — Convergence & resilience
- **F6-2 / F6-3 / A-15 — Converge SLO/freshness.** Make `marketDataset`/`weatherDataset` reuse `marketTrust` semantics and emit `ENVELOPE_FRESHNESS.STALE` (with age) instead of `EMPTY` for displayable-but-old data; set those SLOs `required:false`. *Accept:* the Main-page market/weather widgets show stale data with a warning (don't vanish); the existing `DataStateBanner`/`DataFreshnessBadge` "stale" path now renders.
- **F1-3 / A-10 — Abortless timeout.** Wire an `AbortController` into `utils/withTimeout.js` / `data/fetchClient.js` (the pattern already exists in `services/proxyManager.js`).
- **U9-2 / A-19 — Categorization.** Switch category keyword matching to word-boundary regex (JS `upAheadService` **and** the Python prefetch); reconcile the contradictory pos/neg keyword lists (F2-7, e.g. `'launches'`). Add the AUDIT_REPORT §3 movie cases as cert tests on both sides.
- **A-20 / N10-1 — Gemini summaries.** Either add `GEMINI_API_KEY` to Actions secrets (verify `daily_brief.py` tier-1 path) or update README/UI to stop promising AI summaries.

### P4 — Hygiene & cleanup (low risk)
- **F2-1 / F2-2 — Config evolution:** array-merge strategy for additive default lists (`utils/storage.js deepMerge`); replace hardcoded `tradingHolidays` (ends 2026) with a generated/maintained calendar + "unknown year" guard.
- **De-orphan:** delete or wire `services/crawlerService.js`, `data/loadWithPolicy.js`, `services/marketService.js`, `services/indianMarketService.js`. Add a `knip`/`ts-prune` CI step to catch future orphans.
- **A-9 / V12-2 — Code-split:** `React.lazy()` + `<Suspense>` per route in `App.jsx` (currently static-imports all 14 pages → 985 kB chunk).
- **H0 cleanup:** quarantine top-level cruft (`fix_*.py`, `code update v2_*.txt`, `*.zip`, `zip_extracted/`, `backup file/`); delete zero-byte `node` / `news-weather-app@1.0.0`.
- **S-1 / S-2 — Hook hygiene:** fix the `set-state-in-effect` (derive weather active-city during render) and `exhaustive-deps` warnings per site.

## Definition of done
- All targeted findings fixed with a test each; `test:unit` still green (count ≥ 758); lint errors reduced (target 0 in `src/`); build passes with a smaller main chunk after code-split.
- A short `reports/IMPLEMENTATION_LOG.md` mapping each finding ID → commit + test added.
