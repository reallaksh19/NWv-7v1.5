# Implementation Log

## A-13 / W8-1 - Weather Snapshot Automation And Freshness

- Branch: `fix/A-13-W8-1-weather-freshness`
- Commit: `c1ada2c` - `fix(A-13 W8-1): guard stale weather snapshots`
- Added tests:
  - `src/services/weatherSnapshotFreshness.cert.test.js`
  - `scripts/test_public_snapshot_freshness_static.mjs`
- Added automation:
  - `.github/workflows/weather_refresh.yml`
  - `scripts/weather_snapshot_worker.py`
- Local verification:
  - Red before fix: `npm run test:unit -- src/services/weatherSnapshotFreshness.cert.test.js` rejected stale snapshots only after the guard was added.
  - Red before refresh: `npm run test:snapshot-freshness` failed on `weather_snapshot.json.chennai` at ~9935 h old with a 48 h limit.
  - Pass: `python scripts/weather_snapshot_worker.py`
  - Pass: `npm run test:snapshot-freshness`
  - Pass: `npm run test:unit -- src/services/weatherSnapshotFreshness.cert.test.js`
  - Pass: `npm run test:weather-integration-hardening`
  - Pass: `npm run test:weather-signal-precision`
  - Pass: `npm run test:weather-weekly-planning`
  - Pass: `python -m py_compile scripts/weather_snapshot_worker.py`
  - Pass: `npm run build`
  - Pass: `npm run test:unit` (123 files / 760 tests)
  - Pass: touched-file lint via `npx eslint src/services/weatherService.js src/services/weatherSnapshotFreshness.cert.test.js scripts/test_public_snapshot_freshness_static.mjs`
- Existing failures observed:
  - `npm run lint` still reports the repo baseline: 24 errors / 15 warnings.
  - `npm run test:weather-trust` fails because `WeatherPage.jsx` lacks the stale static token `auditWeatherTabQuality`.
  - `npm run test:weather-location-customization` fails because `WeatherPage.jsx` lacks the stale static token `getConfiguredWeatherCities`.

## B-1 - Planner Per-Item Calendar Export

- Branch: `fix/B-1-planner-calendar-export`
- Commit: `d3be67a` - `fix(B-1): wire planner item calendar export`
- Added test:
  - `src/pages/MyPlannerPageCalendarExport.cert.test.jsx`
- Local verification:
  - Red before fix: `npm run test:unit -- src/pages/MyPlannerPageCalendarExport.cert.test.jsx` failed after clicking `Add to Calendar`; React raised `ReferenceError: exportPlannerItem is not defined`.
  - Red before fix: `npx eslint src/pages/MyPlannerPage.jsx src/pages/MyPlannerPageCalendarExport.cert.test.jsx` reported `no-undef` for `exportPlannerItem` and unused destructuring at the ViewModel binding.
  - Pass: `npm run test:unit -- src/pages/MyPlannerPageCalendarExport.cert.test.jsx`
  - Pass: touched-file lint via `npx eslint src/pages/MyPlannerPage.jsx src/pages/MyPlannerPageCalendarExport.cert.test.jsx`
  - Pass: `npm run build`
  - Pass: `npm run test:unit` (124 files / 761 tests)
- Existing failures observed:
  - `npm run lint` still fails, now at 22 errors / 15 warnings. The B-1 `MyPlannerPage.jsx` `no-undef` and unused binding errors are gone; remaining errors are unrelated baseline items.

## B-3 - UpAhead Fallback Reload Wiring

- Branch: `fix/B-3-upahead-fallback-reload`
- Commit: `935fba5` - `fix(B-3): simplify upahead fallback reload wiring`
- Added test:
  - `src/pages/UpAheadPageFallbackReload.cert.test.jsx`
- Updated stale migration cert:
  - `src/pages/UpAheadPage.release5E.cert.test.jsx`
- Local verification:
  - Red before fix: `npm run test:unit -- src/pages/UpAheadPageFallbackReload.cert.test.jsx` failed because `UpAheadPage.jsx` still imported `useUpAheadTabViewModel` and kept the dead fallback wrapper.
  - Red before fix: `npx eslint src/pages/UpAheadPage.jsx src/pages/UpAheadPageFallbackReload.cert.test.jsx` reported unused `useUpAheadTabViewModel` and `no-unreachable`.
  - Pass: `npm run test:unit -- src/pages/UpAheadPageFallbackReload.cert.test.jsx src/pages/UpAheadPage.release5E.cert.test.jsx src/pages/UpAheadPage.release6R.cert.test.jsx`
  - Pass: touched-file lint via `npx eslint src/pages/UpAheadPage.jsx src/pages/UpAheadPageFallbackReload.cert.test.jsx src/pages/UpAheadPage.release5E.cert.test.jsx src/pages/UpAheadPage.release6R.cert.test.jsx`
  - Pass: `npm run build`
  - Pass: `npm run test:unit` (125 files / 762 tests)
- Existing failures observed:
  - `npm run lint` still fails, now at 20 errors / 15 warnings. The B-3 `UpAheadPage.jsx` unused import and unreachable-code errors are gone; remaining errors are unrelated baseline items.

## B-2 - Settings Ranking Hook Boundaries

- Branch: `fix/B-2-settings-hooks`
- Commit: `c09e9ba` - `fix(B-2): move settings ranking hooks into components`
- Added test:
  - `src/pages/SettingsPageHooks.cert.test.jsx`
- Local verification:
  - Red before fix: `npm run test:unit -- src/pages/SettingsPageHooks.cert.test.jsx` failed because `MainRankingContent` and `BuzzRankingContent` did not exist and the stateful sections were nested render functions.
  - Red before fix: `npx eslint src/pages/SettingsPage.jsx src/pages/SettingsPageHooks.cert.test.jsx` reported two `react-hooks/rules-of-hooks` errors in `renderMainContent` and `renderBuzzContent`.
  - Pass: `npm run test:unit -- src/pages/SettingsPageHooks.cert.test.jsx src/pages/SettingsPage.release6M.cert.test.jsx`
  - Pass: touched-file lint via `npx eslint src/pages/SettingsPage.jsx src/pages/SettingsPageHooks.cert.test.jsx src/pages/SettingsPage.release6M.cert.test.jsx`
  - Pass: `npm run build`
  - Pass: `npm run test:unit` (126 files / 763 tests)
- Existing failures observed:
  - `npm run lint` still fails, now at 18 errors / 15 warnings. The B-2 Settings `rules-of-hooks` errors are gone; remaining errors are unrelated baseline items.

## Lint Gate Cleanup - Unused Bindings

- Branch: `chore/lint-cleanup-unused-bindings`
- Commit: `ea89dc4` - `chore(lint): remove unused cleanup blockers`
- Scope:
  - Removed stale blanket lint disable from `src/components/ErrorBoundary.jsx`.
  - Removed unused test imports/destructures from `src/data/loadWithPolicy.cert.test.js` and `src/pages/WeatherPage.release6K.cert.test.jsx`.
  - Removed unused `_force` parameter from `src/viewModels/useNewspaperPageViewModel.js`.
  - Kept `QuickMarket`'s prop-driven refresh contract live by wiring `onRefreshMarket` to a compact header action.
- Local verification:
  - Red before cleanup: `npm run lint` failed at 18 errors / 15 warnings after the B-2 commit.
  - Pass: touched-file lint via `npx.cmd eslint src/components/QuickMarket.jsx src/components/ErrorBoundary.jsx src/data/loadWithPolicy.cert.test.js src/pages/WeatherPage.release6K.cert.test.jsx src/viewModels/useNewspaperPageViewModel.js`
  - Pass: `npm.cmd run test:unit -- src/pages/MarketPage.release6J.cert.test.jsx src/data/loadWithPolicy.cert.test.js src/pages/WeatherPage.release6K.cert.test.jsx` (3 files / 27 tests)
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:unit` (126 files / 763 tests)
  - Pass: `git diff --check`
- Existing failures observed:
  - `npm.cmd run lint` still fails, now at 11 errors / 14 warnings.
  - Remaining errors are unrelated `react-refresh/only-export-components` export-shape issues and `react-hooks/set-state-in-effect` findings in `useDataset`, `useMyPlannerPageViewModel`, and `useWeatherTabViewModel`.

## S-1 - Weather Active City Derived State

- Branch: `fix/S-1-weather-active-city-derived-state`
- Commit: `8643b3c` - `fix(S-1): derive weather active city during render`
- Added test:
  - `src/viewModels/useWeatherTabViewModelS1.cert.test.js`
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/viewModels/useWeatherTabViewModelS1.cert.test.js` failed because `useWeatherTabViewModel.js` repaired invalid active city via `setActiveCityState` inside an effect and did not expose `resolveActiveWeatherCity`.
  - Pass: `npm.cmd run test:unit -- src/viewModels/useWeatherTabViewModelS1.cert.test.js src/pages/WeatherPage.release6K.cert.test.jsx` (2 files / 13 tests)
  - Pass: touched-file lint via `npx.cmd eslint src/viewModels/useWeatherTabViewModel.js src/viewModels/useWeatherTabViewModelS1.cert.test.js`
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:unit` (127 files / 765 tests)
  - Pass: `git diff --check`
- Existing failures observed:
  - `npm.cmd run lint` still fails, now at 10 errors / 14 warnings. The `useWeatherTabViewModel.js` `react-hooks/set-state-in-effect` error is gone.
  - Remaining errors are the two other S-1 sites (`useDataset`, `useMyPlannerPageViewModel`) plus deferred React Refresh export-boundary issues.

## R-0 - Weather Static Cert Regression Repair

- Branch: `fix/R-0-weather-static-certs`
- Commit: `08af5cb` - `fix(R-0): repair weather static certs`
- Scope:
  - Updated stale weather static cert assertions to follow Release 6K ownership: `WeatherPage.jsx` remains render-focused, while `useWeatherTabViewModel.js` owns `getConfiguredWeatherCities`, `auditWeatherTabQuality`, active-city resolution, and detailed-card props.
  - Did not reintroduce duplicate weather audit/settings wiring into `WeatherPage.jsx`; the older source-token expectations were obsolete after the view-model migration.
- Local verification:
  - Red before fix: `npm.cmd run test:weather-trust` failed with `WeatherPage missing token: auditWeatherTabQuality`.
  - Red before fix: `npm.cmd run test:weather-location-customization` failed with `WeatherPage uses getConfiguredWeatherCities`.
  - Pass: `npm.cmd run test:weather-trust`
  - Pass: `npm.cmd run test:weather-location-customization`
  - Pass: touched-file lint via `npx.cmd eslint scripts/test_weather_trust_static.mjs scripts/test_weather_location_customization_static.mjs`
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:unit` (127 files / 765 tests)
  - Pass: `git diff --check` (line-ending warnings only)
- Existing failures observed:
  - `npm.cmd run lint` remains at the expected continuation baseline: 10 errors / 14 warnings.
  - `npm.cmd run test:certify:smoke` fails at its first lint step because the baseline lint gate is still red; Phase A is the planned lint-zero remediation.

## A-a - Deferred Initial Loads For Hook Lint

- Branch: `fix/A-a-set-state-in-effect`
- Commit: `69605c6` - `fix(A-a): defer initial hook loads`
- Added tests:
  - `src/data/orchestrator/useDatasetS1.cert.test.js`
  - `src/viewModels/useMyPlannerPageViewModelS1.cert.test.js`
- Scope:
  - Deferred `useDataset` auto-load with `queueMicrotask` so `reload(false)` is not invoked synchronously in the effect body.
  - Deferred the one-time planner `loadPlan()` call with `queueMicrotask` while keeping explicit user-triggered planner reloads synchronous.
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/data/orchestrator/useDatasetS1.cert.test.js` failed on the direct `reload(false)` effect call.
  - Red before fix: `npm.cmd run test:unit -- src/viewModels/useMyPlannerPageViewModelS1.cert.test.js` failed on the direct `loadPlan()` mount-effect call.
  - Pass: `npm.cmd run test:unit -- src/data/orchestrator/useDatasetS1.cert.test.js src/viewModels/useMyPlannerPageViewModelS1.cert.test.js src/data/orchestrator/useDataset.cert.test.js src/pages/MyPlannerPage.release6S.cert.test.jsx` (4 files / 19 tests)
  - Pass: touched-file lint via `npx.cmd eslint src/data/orchestrator/useDataset.js src/data/orchestrator/useDatasetS1.cert.test.js src/viewModels/useMyPlannerPageViewModel.js src/viewModels/useMyPlannerPageViewModelS1.cert.test.js`
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:unit` (129 files / 767 tests)
  - Pass: `git diff --check` (line-ending warnings only)
- Existing failures observed:
  - `npm.cmd run lint` now fails at 8 errors / 14 warnings, down from 10 errors / 14 warnings. Remaining errors are the React Refresh export-boundary findings scheduled for A-b.

## A-b - React Refresh Component Export Boundaries

- Branch: `fix/A-b-react-refresh-internals`
- Commit: `b040cbb` - `fix(A-b): split component test internals`
- Added test:
  - `src/components/reactRefreshInternals.cert.test.js`
- Scope:
  - Moved data-state, data-boundary, travel-location, and weather-location test internals into sibling `*.internals.js` modules so component files export only components.
  - Updated direct unit/static imports to use the new internals modules.
  - Updated the stale `test:lint-hotfix` cert to follow the current Up Ahead page-view-model location for `formatConciseDate`.
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/components/reactRefreshInternals.cert.test.js` failed because component files still exported `InternalsForTest`.
  - Pass: `npm.cmd run test:unit -- src/components/reactRefreshInternals.cert.test.js src/components/DataStateBoundary.cert.test.jsx src/components/data-state/dataStateComponents.cert.test.jsx src/pages/WeatherPage.release6K.cert.test.jsx src/pages/SettingsPage.release6M.cert.test.jsx` (5 files / 35 tests)
  - Pass: touched-file lint via `npx.cmd eslint ...` on all moved component, internals, and updated cert files (0 errors; existing WeatherLocationManager hook warnings only).
  - Pass: `npm.cmd run lint` (0 errors / 14 warnings)
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:unit` (130 files / 768 tests)
  - Pass: `npm.cmd run test:lint-hotfix`
  - Pass: `npm.cmd run test:certify:smoke`
  - Pass: `git diff --check` (line-ending warnings only)
- Existing failures observed:
  - No lint errors remain after Phase A. The 14 remaining lint warnings are the planned S-2/exhaustive-deps cleanup later in Phase D.

## A-4 - Shared Local Date-Key Helper

- Branch: `fix/A-4-local-date-key-continuation`
- Commit: `7b75080` - `fix(A-4): use local date keys`
- Added tests:
  - `src/utils/dateKey.cert.test.js`
  - `src/utils/plannerStorageDateKey.cert.test.js`
- Scope:
  - Added `src/utils/dateKey.js` with `toLocalDateKey`, using local `getFullYear()` / `getMonth()` / `getDate()` parts rather than UTC ISO slicing.
  - Replaced UTC-slice date-key generation in `dateAware`, `canonicalItemBuilder`, `deDuplication`, `dateExtractor.expandDateKeys`, `weatherService.buildDailyConsensus`, and `plannerStorage`.
  - Checked Python generators; weather worker uses provider daily date keys, and remaining `isoformat()` usages are timestamps rather than planner/event date keys.
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/utils/plannerStorageDateKey.cert.test.js` failed with `2026-05-29` instead of `2026-05-30` for an Asia/Kolkata local-midnight event.
  - Pass: `npm.cmd run test:unit -- src/utils/dateKey.cert.test.js src/utils/plannerStorageDateKey.cert.test.js src/services/weatherFinalClosure.cert.test.js src/services/weatherIntegrationHardening.cert.test.js` (4 files / 15 tests)
  - Pass: touched-file lint via `npx.cmd eslint src/utils/dateKey.js src/utils/dateKey.cert.test.js src/utils/plannerStorage.js src/utils/plannerStorageDateKey.cert.test.js src/intelligence/dateAware.js src/intelligence/canonicalItemBuilder.js src/intelligence/deDuplication.js src/utils/dateExtractor.js src/services/weatherService.js`
  - Pass: specified-site grep found no remaining `toISOString().slice(0, 10)` / `toISOString().split('T')[0]`.
  - Pass: `npm.cmd run test:weather-weekly-planning`
  - Pass: `npm.cmd run lint` (0 errors / 14 warnings)
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:unit` (132 files / 771 tests)
  - Pass: `npm.cmd run test:certify:smoke`
  - Pass: `git diff --check` (line-ending warnings only)
- Existing failures observed:
  - None. Lint remains at 0 errors; the known 14 warnings are unchanged.

## W8-2 - Weather Location-Local Now Hour

- Branch: `fix/W8-2-weather-local-now`
- Commit: `50bd662` - `fix(W8-2): use weather location local hour`
- Added test:
  - `src/services/weatherLocalHour.cert.test.js`
- Scope:
  - Added `getLocationLocalHour(locationName, now)` to derive the current hour from `WEATHER_LOCATION_REGISTRY[locationName].timezone` using `Intl.DateTimeFormat`.
  - Replaced browser-local `new Date().getHours()` usage for the weather "Now" hourly strip and current icon hour.
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/services/weatherLocalHour.cert.test.js` failed because `getLocationLocalHour` did not exist.
  - Pass: `npm.cmd run test:unit -- src/services/weatherLocalHour.cert.test.js src/services/weatherIntegrationHardening.cert.test.js` (2 files / 6 tests)
  - Pass: touched-file lint via `npx.cmd eslint src/services/weatherService.js src/services/weatherLocalHour.cert.test.js`
  - Pass: `npm.cmd run test:weather-weekly-planning`
  - Pass: `npm.cmd run lint` (0 errors / 14 warnings)
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:unit` (133 files / 772 tests)
  - Pass: `npm.cmd run test:certify:smoke`
  - Pass: `git diff --check` (line-ending warnings only)
- Existing failures observed:
  - None. Lint remains at 0 errors; the known 14 warnings are unchanged.

## A-5 / A-18 - Stable News Content IDs And Topic Notifications

- Branch: `fix/A-5-stable-content-ids`
- Commit: this finding commit
- Added tests:
  - `src/services/newsStableIds.cert.test.js`
  - `src/context/TopicContextNotifications.cert.test.jsx`
- Scope:
  - Added stable FNV-based IDs for RSS/DDG news items and slot stories using article URL/link/title/headline seeds instead of fetch-order indexes or `Date.now()`.
  - Extracted topic-refresh notification comparison into `notifyTopicUpdates` / `getTopicUpdateSummary` so unchanged refreshed article IDs do not trigger notifications.
  - Repaired stale `test:following` static cert to follow the current Following page/view-model ownership after the Release 5F-C migration.
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/services/newsStableIds.cert.test.js` failed because `makeStableNewsId` / `makeStableSlotStoryId` did not exist.
  - Red before fix: `npm.cmd run test:unit -- src/context/TopicContextNotifications.cert.test.jsx` failed because `notifyTopicUpdates` did not exist.
  - Pass: `npm.cmd run test:unit -- src/services/newsStableIds.cert.test.js src/context/TopicContextNotifications.cert.test.jsx` (2 files / 3 tests)
  - Pass: touched-file lint via `npx.cmd eslint src/adapters/newsFetcher.js src/services/newsService.js src/services/newsStableIds.cert.test.js src/context/TopicContext.jsx src/context/TopicContextNotifications.cert.test.jsx`
  - Pass: `npm.cmd run test:unit` (135 files / 775 tests)
  - Pass: `npm.cmd run lint` (0 errors / 14 warnings)
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:following-migration` (2 files / 31 tests)
  - Pass: `npm.cmd run test:certify:smoke`
  - Pass after stale-cert repair: `npm.cmd run test:following`
- Existing failures observed:
  - `npm.cmd run test:following` initially failed because the static cert still expected `getTopicStats` and raw `topicNews` access in `FollowingPage.jsx`; that ownership now lives in `useFollowingTabViewModel.js`. The cert now checks the current page/view-model contract and passes.
  - No lint errors. The known 14 hook warnings remain unchanged for Phase D.

## U9-4 / F1-6 - Explicit Storage Write Failures

- Branch: `fix/U9-4-storage-failures`
- Commit: this finding commit
- Added tests:
  - `src/utils/storageWriteFailures.cert.test.js`
  - `src/hooks/useWatchlistStorageFailure.cert.test.jsx`
- Scope:
  - Routed planner, watchlist, followed-topic, and read-history writes through `safeStorage.safeSetJson`.
  - Added explicit `{ ok: false, reason: 'storage-write-failed' }` outcomes for quota/unavailable storage instead of silent `false`, `undefined`, or thrown watchlist writes.
  - Made topic/history settings updates copy-on-write so a failed save does not mutate in-memory default arrays.
  - Surfaced storage failures through `TopicContext` messages, watchlist hook state, Up Ahead save controls, and planner view-model result handling.
  - Repaired stale static certs whose source-token assumptions predated later view-model migrations or the manifest-v2 workflow state.
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/utils/storageWriteFailures.cert.test.js src/hooks/useWatchlistStorageFailure.cert.test.jsx` failed because planner returned plain `false`, topic writes returned `undefined`, and watchlist threw `QuotaExceededError`.
  - Pass: `npm.cmd run test:unit -- src/utils/storageWriteFailures.cert.test.js src/hooks/useWatchlistStorageFailure.cert.test.jsx` (2 files / 3 tests)
  - Pass: affected cert/unit bundle via `npm.cmd run test:unit -- src/utils/storageWriteFailures.cert.test.js src/hooks/useWatchlistStorageFailure.cert.test.jsx src/data/safeStorage.cert.test.js src/utils/plannerStorageDateKey.cert.test.js src/viewModels/usePlannerTabViewModel.cert.test.js src/pages/UpAheadPage.release6R.cert.test.jsx src/pages/MyPlannerPage.release6S.cert.test.jsx src/viewModels/useUpAheadTabViewModel.cert.test.js src/context/TopicContextNotifications.cert.test.jsx` (9 files / 54 tests)
  - Pass: touched-file lint via `npx.cmd eslint ...` on changed JS/JSX files (0 errors; existing Up Ahead hook warnings only).
  - Pass: static certs: `test:hardening:release1B`, `test:hardening:release2`, `test:hardening:release5E`, `test:hardening:release5FB`, `test:hardening:release6R`, `test:hardening:release6S`, `test:hardening:release6T`, `test:lint-hotfix`, `test:upahead-evidence`, `test:upahead-briefing`, `test:following`, `test:certification-manifest`.
  - Pass: `npm.cmd run test:planner-migration`
  - Pass: `npm.cmd run test:myplanner-binding`
  - Pass: `npm.cmd run test:unit` (137 files / 778 tests)
  - Pass: `npm.cmd run lint` (0 errors / 14 warnings)
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:certify:smoke`
  - Pass: `npm.cmd run test:certify:workflow` after installing missing local Python `pytest`.
  - Pass: `git diff --check` (line-ending warnings only)
- Existing failures observed:
  - Initial `test:certify:workflow` failed because the local Python environment lacked `pytest`; installing `pytest` allowed the Python workflow certs to run.
  - Workflow cert then exposed stale validators: benchmark observability is now unconditional by design, while only commits are gated by `should_commit`; certification manifest static/validator expected v1 while the live manifest is v2. These static checks were updated to current repo contracts and now pass.
  - No lint errors. The known 14 hook warnings remain unchanged for Phase D.

## F6-2 / F6-3 / A-15 - Stale Visible Market And Weather Widgets

- Branch: `fix/A-15-stale-widget-freshness`
- Commit: this finding commit
- Added test:
  - `src/data/datasets/marketWeatherStaleVisibility.cert.test.js`
- Scope:
  - Updated `marketDataset` to reuse `marketTrust` freshness/displayability semantics, set the market SLO as non-required in the envelope path, and emit `ENVELOPE_FRESHNESS.STALE` plus `market_stale_data:<hours>h` for displayable-but-old market data.
  - Updated `weatherDataset` to mark usable stale city data as `ENVELOPE_FRESHNESS.STALE` with `weather_stale_data:<city>` warnings.
  - Propagated stale market/weather input freshness through `mainDataset` so the Main page `DataStateBoundary` can render the existing stale banner/badge path instead of presenting stale widgets as fresh.
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/data/datasets/marketWeatherStaleVisibility.cert.test.js` failed because stale market/weather payloads were labeled `fresh`.
  - Pass: `npm.cmd run test:unit -- src/data/datasets/marketWeatherStaleVisibility.cert.test.js src/data/datasets/marketDataset.cert.test.js src/data/datasets/weatherDataset.cert.test.js src/components/data-state/dataStateComponents.cert.test.jsx` (4 files / 24 tests)
  - Pass: touched-file lint via `npx.cmd eslint src/data/datasets/marketDataset.js src/data/datasets/weatherDataset.js src/data/datasets/mainDataset.js src/data/datasets/marketWeatherStaleVisibility.cert.test.js`
  - Pass: `npm.cmd run test:weather-trust`
  - Pass: `npm.cmd run test:weather-weekly-planning`
  - Pass: `npm.cmd run test:unit` (138 files / 780 tests)
  - Pass: `npm.cmd run lint` (0 errors / 14 warnings)
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:certify:smoke`
  - Pass: `git diff --check` (line-ending warnings only)
- Existing failures observed:
  - `npm.cmd run test:market-trust` is stale against the current Market page/view-model migration and expects page-level `MarketTrustPanel` wiring.
  - `npm.cmd run test:market-snapshot` is time-sensitive and currently fails because `public/data/market_snapshot.json` is about 70h old while the cert's max age is 48h.
  - No lint errors. The known 14 hook warnings remain unchanged for Phase D.

## F1-3 / A-10 - Abort Timed-Out Fetches

- Branch: `fix/A-10-abortable-timeout`
- Commit: this finding commit
- Added test:
  - `src/data/fetchClient.cert.test.js`
- Scope:
  - Updated `withTimeout` to abort an owned `AbortController` with the `TimeoutError` reason when the timeout fires.
  - Wrapped `fetchJson` requests in an internal abort controller, relayed caller cancellation while a fetch is active, and cleaned up the relay listener after completion.
  - Normalized timeout-triggered fetch aborts back to the user-facing `TimeoutError` envelope even when the underlying fetch rejects with `AbortError`.
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/data/fetchClient.cert.test.js` failed because the timeout path did not provide/abort the underlying fetch signal.
  - Pass: `npm.cmd run test:unit -- src/data/fetchClient.cert.test.js` (1 file / 6 tests)
  - Pass: touched-file lint via `npx.cmd eslint src/utils/withTimeout.js src/data/fetchClient.js src/data/fetchClient.cert.test.js`
  - Pass: `npm.cmd run test:hardening:release1B`
  - Pass: `npm.cmd run test:hardening:release2`
  - Pass: `npm.cmd run test:unit` (138 files / 781 tests)
  - Pass: `npm.cmd run lint` (0 errors / 14 warnings)
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:certify:smoke`
  - Pass: `git diff --check` (line-ending warnings only)
- Existing failures observed:
  - None in this phase. Lint remains at 0 errors; the known 14 hook warnings are unchanged for Phase D.

## F2-7 - Categorizer Negative Keyword Reconciliation

- Branch: `fix/F2-7-categorizer-negatives`
- Commit: this finding commit
- Added tests:
  - `src/intelligence/classificationF2Negatives.cert.test.js`
  - `scripts/test_upahead_fallback_categorization.py`
- Scope:
  - Kept JS category matching word-boundary based, while excluding Up Ahead schedule-signal words such as `launches` from global-negative scoring when they appear in persisted/default settings.
  - Added JS certification coverage for the AUDIT movie/planner cases and a release-date/trailer-launch case that previously collapsed to `general`.
  - Added explicit Python fallback categorization and suppression helpers for `scripts/up_ahead.py`, including optional `google-generativeai` import handling so fallback helpers can be tested without the AI package installed.
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/intelligence/classificationF2Negatives.cert.test.js` failed because `Leo locks release date on Oct 25; trailer launches today` classified as `general`.
  - Red before fix: `python -m pytest scripts/test_upahead_fallback_categorization.py` failed because `scripts/up_ahead.py` had no importable fallback classifier and required missing `google.generativeai`.
  - Pass: `npm.cmd run test:unit -- src/intelligence/classificationF2Negatives.cert.test.js` (1 file / 2 tests)
  - Pass: `python -m pytest scripts/test_upahead_fallback_categorization.py` (2 tests)
  - Pass: touched-file lint via `npx.cmd eslint src/intelligence/classification.js src/intelligence/classificationF2Negatives.cert.test.js`
  - Pass: `python -m py_compile scripts/up_ahead.py scripts/test_upahead_fallback_categorization.py`
  - Pass: `npm.cmd run test:upahead-smoke`
  - Pass: `npm.cmd run test:unit` (139 files / 783 tests)
  - Pass: `npm.cmd run lint` (0 errors / 14 warnings)
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:certify:smoke`
  - Pass: `npm.cmd run test:certify:editorial`
  - Pass: `git diff --check` (line-ending warnings only)
- Existing failures observed:
  - None in this phase. Lint remains at 0 errors; the known 14 hook warnings are unchanged for Phase D.

## F2-1 / F2-2 - Config Evolution And Market Holiday Guard

- Branch: `fix/F2-1-config-evolution`
- Commit: this finding commit
- Added test:
  - `src/utils/configEvolution.cert.test.js`
- Scope:
  - Added path-aware additive array merging for designated settings arrays (`sources.enabled`, `highImpactKeywords`) so existing saved settings receive new shipped defaults without losing user additions.
  - Reworked market trading holidays into a maintained calendar map that generates `tradingHolidays` and exposes maintained years.
  - Added an explicit `unknown_year_weekday_rules` market-session status when the active year is outside the maintained holiday calendar, so market state falls back to weekday/session rules with a visible diagnostic.
  - Updated the Release 3 static cert to recognize the current A-15 stale-visible market dataset contract (`displayable`, non-required SLO envelope, `passed: ok`).
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/utils/configEvolution.cert.test.js` failed because saved arrays overwrote default arrays and market session returned no unknown-year holiday-calendar status.
  - Pass: `npm.cmd run test:unit -- src/utils/configEvolution.cert.test.js` (1 file / 2 tests)
  - Pass: touched-file lint via `npx.cmd eslint src/utils/storage.js src/config/settings_market.js src/utils/marketSession.js src/utils/configEvolution.cert.test.js`
  - Pass: affected bundle via `npm.cmd run test:unit -- src/utils/configEvolution.cert.test.js src/utils/storageWriteFailures.cert.test.js src/pages/MarketPage.release6J.cert.test.jsx` (3 files / 11 tests)
  - Pass: `npm.cmd run test:marketpage-binding`
  - Pass after stale-cert repair: `npm.cmd run test:hardening:release3`
  - Pass: `npm.cmd run test:unit` (140 files / 785 tests)
  - Pass: `npm.cmd run lint` (0 errors / 14 warnings)
  - Pass: `npm.cmd run build`
  - Pass: `npm.cmd run test:certify:smoke`
  - Pass: `git diff --check` (line-ending warnings only)
- Existing failures observed:
  - `npm.cmd run test:hardening:release6J` is stale for this dirty continuation worktree: it rejects unrelated changed files before behavior checks; `npm.cmd run test:marketpage-binding` passed.
  - `npm.cmd run test:certify:data-platform` now passes through Release 3 after the cert repair, then fails at stale Release 4 assertions that still forbid later dataset loaders/view-model migrations.
  - No lint errors. The known 14 hook warnings remain unchanged for Phase D.

## A-9 / V12-2 - Route Code Splitting

- Branch: `fix/A-9-route-code-split`
- Commit: this finding commit
- Added test:
  - `src/AppCodeSplit.cert.test.jsx`
- Scope:
  - Converted route page imports in `src/App.jsx` to `React.lazy(() => import(...))`.
  - Wrapped the route table in `<Suspense>` with a non-text loading status element while keeping providers, navigation, debug shell, and visibility controls eager.
  - Preserved all existing route paths and `ErrorBoundary` labels.
- Local verification:
  - Red before fix: `npm.cmd run test:unit -- src/AppCodeSplit.cert.test.jsx` failed because `App.jsx` had static page imports and no `React.lazy` / `<Suspense>` route boundary.
  - Pass: `npm.cmd run test:unit -- src/AppCodeSplit.cert.test.jsx` (1 file / 2 tests)
  - Pass: touched-file lint via `npx.cmd eslint src/App.jsx src/AppCodeSplit.cert.test.jsx`
  - Pass: `npm.cmd run test:hardening:release1C`
  - Pass: `npm.cmd run test:desktop-polish`
  - Pass: `npm.cmd run test:weather-professional-theme`
  - Pass: `npm.cmd run test:hardening:release6T`
  - Pass: `npm.cmd run test:page-orchestration-closeout`
  - Pass: `npm.cmd run build`; main app chunk shrank from the prior `index-D5g9EZua.js` 991.66 kB to `index-BzsVFlPv.js` 363.47 kB.
  - Pass: `npm.cmd run test:unit` (141 files / 787 tests)
  - Pass: `npm.cmd run lint` (0 errors / 14 warnings)
  - Pass: `npm.cmd run test:certify:smoke`
  - Pass: `git diff --check` (line-ending warnings only)
- Existing failures observed:
  - `npm.cmd run test:weather-settings-onthisday` fails on stale `DisplayPreferencesPanel.jsx` copy/token text unrelated to route splitting.
  - `npm.cmd run test:hardening:release6N` and `npm.cmd run test:hardening:release6O` reject the pre-existing dirty `reports/walkthrough_coverage_addendum.md` before behavior checks.
  - `npm.cmd run test:weather-final-closure` fails on stale `.qw-config-bar input` CSS-token expectations unrelated to route splitting.
  - No lint errors. The known 14 hook warnings remain unchanged for Phase D.

## Deep-Dive A/B/C + Phase D Hygiene

- Branch: local implementation pass from `reports/action_3_deep.md`
- Commit: pending
- Added reports:
  - `reports/MODE_MATRIX.md`
  - `reports/SOURCE_PROXY_MATRIX.md`
  - `reports/INSIGHT_ANGLE_RCA.md`
- Added tests:
  - `src/services/weatherServiceTimeout.cert.test.js`
  - `src/services/marketServiceTimeout.cert.test.js`
  - `src/adapters/embeddingsAdapterVocab.cert.test.js`
  - `src/adapters/insightSnapshotFetcher.liveVsStatic.cert.test.js`
  - `src/insight/src/tree/treeBuilderInfoGain.cert.test.ts`
  - `src/intelligence/feedSourceRegistry.feedDepleted.cert.test.js`
- Scope:
  - Added 15 s abort-backed Open-Meteo/geocoding timeouts in `weatherService`.
  - Certified market stable service direct/proxy abort behavior and exposed `fetchJsonDirectOrProxy` for testability.
  - Expanded fixed embedding vocabulary and domain token expansions for Indian/local stories.
  - Lowered Insight angle classifier threshold to `0.9`, expanded regional/official/fact-update signals, and stopped treating collector `base_report` hints as high-confidence overrides.
  - Lowered default `MIN_CHILD_INFO_GAIN` to `0.10` and rounded gain to stable thousandths.
  - Updated the real snapshot quality benchmark to use the fixed-vocabulary embedding adapter instead of synthetic one-hot vectors.
  - Tightened the real snapshot ratchet to `avgAngles >= 1.8` after the measured run reached that target.
  - Certified snapshot slotting by current story age rather than Python slot metadata.
  - Cleared all 14 React hook exhaustive-deps lint warnings.
  - Archived root historical files under `archive/root-cleanup`, removed zero-byte `node` and `news-weather-app@1.0.0`, and ignored `archive/` plus `*.err.log`.
  - Removed truly unreferenced dead modules `src/services/crawlerService.js` and `src/services/marketService.js`.
- Notes:
  - `src/data/loadWithPolicy.js` and `src/services/indianMarketService.js` were not removed because this checkout still references them from package/scripts (`test:slo`, hardening fixtures, benchmark runner). Removing them would break existing verification paths.
- Local verification:
  - Pass: focused cert set for weather timeout, market timeout, embeddings vocab, angle classifier, info gain, snapshot slotting, feed depletion, and ratchet tightening (8 files / 23 tests).
  - Pass: `npm.cmd run lint` (0 errors / 0 warnings).
  - Pass: `npm.cmd run test:real-insight-snapshot-quality` with post-fix metrics `avgAngles=1.8`, `multiAngleCount=8`, grade `C`.
  - Pass: `npm.cmd run test:unit` (147 files / 799 tests).
  - Pass: `npm.cmd run build` (main index chunk `364.28 kB`, under the 365 kB target).
  - Pass: `npm.cmd run test:certify:smoke`.
  - Pass: `npm.cmd run test:certify:editorial`.
  - Pass: `git diff --check` (line-ending warnings only).
