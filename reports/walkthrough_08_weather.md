# Walkthrough Unit 8 — Weather Module

**Date:** 2026-05-30 · **Mode:** Auditor (identify & instruct)
**Scope:** Weather fetch + multi-model consensus, context state, location registry, snapshot fallback, dataset path
**Files deep-read:** `services/weatherService.js`, `context/WeatherContext.jsx`, `services/weatherLocations.js` + `weatherDataset`/`weatherInsights` consumer greps + snapshot freshness check

---

## Verdict

🟢 **Strong forecasting engine.** 3-model consensus (ECMWF/GFS/ICON via Open-Meteo) with per-hour averaging, rainfall consensus, 7-day build, and a **governed 300-city registry** that carries correct IANA timezones, aliases, and a versioned migration. Heavy cert coverage.

🔴 **One serious data-integrity issue and one real timezone bug.** The shipped snapshot fallback is **~13.5 months stale** *and* has **no recency guard** (unlike `marketTrust`), so stale weather can render as merely "stale". And the registry's correct timezones are **ignored** by the service, so "Now" is computed in the *browser's* timezone.

---

## Findings & Instructions

| ID | Sev | Finding | Instruction |
|----|-----|---------|-------------|
| **W8-1** | **High** | **Stale snapshot + no recency guard (D-1).** `public/data/weather_snapshot.json` `fetchedAt = 2025-04-11` (~13.5 mo old) while `market_snapshot.json` is 3 days fresh → the **weather prefetch workflow is the broken one**. Worse, `weatherService.fetchWeatherSnapshot` returns *any-age* snapshot as `{...snapshot, isStale:true}`, and `hasUsableWeatherCity` accepts it (it has a `temp`). So a year-old forecast can display. | (1) Add a max-age guard to the snapshot/cache path — **reuse `marketTrust.isMarketPayloadDisplayable`'s pattern** (reject >24–48 h, label honestly). (2) Fix/verify the weather GitHub Action so the snapshot regenerates (Unit 13). (3) Surface a clear "data unavailable" state rather than ancient numbers. |
| **W8-2** | **High** | **Cross-timezone "Now" misalignment.** `processMultiModelData` uses `new Date().getHours()` (browser local) to index Open-Meteo's `timezone:auto` (location-local) hourly arrays. The registry **has** `entry.timezone` (e.g., `Asia/Muscat`) but the service never uses it. Viewing Muscat from IST (or any cross-TZ/travel use) shows the wrong current hour and shifted hourly strip. | Compute the location-local current hour from `WEATHER_LOCATION_REGISTRY[key].timezone` (e.g., via `Intl.DateTimeFormat(..., {timeZone}).format`) and index the hourly arrays with that, not `new Date().getHours()`. |
| **W8-3** | Medium | **A-4 timezone date-key instance.** `buildDailyConsensus` builds `dateStr = date.toISOString().slice(0,10)` (UTC) after `date.setDate()` (local) → weekly-forecast dates off-by-one in IST, and `dayLabel` (local weekday) can disagree with `dateStr` (UTC). | Use the shared local-date helper (A-4 fix) for `dateStr`; derive `dayLabel` from the same value. |
| **W8-4** | Medium | **Split-brain second surface (mirrors M7-1).** The Weather **tab** uses `WeatherContext` (graceful cascade). The **Main page** weather widget uses `mainDataset → weatherDataset` (inline-SLO, `FRESH/EMPTY`-only). Same opposite-resilience problem as market. | Apply the same fix as M7-1: make `weatherDataset` emit `STALE` (not `EMPTY`) for displayable-but-old data and not null `ok`; ideally share `WeatherContext`'s loader. |
| **W8-5** | Medium | **Three location registries + four default city sets.** Weather uses the 300-city `weatherLocations` (with TZ); news proximity uses `data/geolocation.js` `LOCATIONS` (5 cities + `boost`); news annotation uses `config/locationLibrary.js` (3 cities + aliases). Chennai/Trichy/Muscat coords are duplicated across all three. Defaults drift: weather defaults `[chennai,trichy,muscat,colombo]`, settings `[chennai,trichy,muscat]`, Up Ahead `[Chennai,Muscat]`. | Make `weatherLocations` (most complete, has TZ) the canonical geo registry; derive the news `boost`/alias views from it. Reconcile the default city sets (cross-ref F2-8). |
| **W8-6** | Low | **`/* eslint-disable */` over the whole `weatherService.js`** (3rd such file after `App.jsx`, `dateExtractor.js`). Masks real issues (e.g., W8-2 would surface). | Remove the blanket disable; fix or narrowly-disable specific lines. |
| **W8-7** | Low | **Dead config check** — `WeatherContext` guards on `settings.sections.weather === false`, but `DEFAULT_SETTINGS.sections` has no `weather` key, so the guard never fires (weather can't be disabled this way). | Either add the setting + UI, or remove the dead branch. |
| **W8-8** | Low | **`loadWeather` dependency churn** — `useCallback` deps include `weatherData` & `lastFetch`, so the function identity changes on every data update and the `[booted, loadWeather]` effect re-runs (saved only by the 15-min early-return). Fragile. | Use a ref for last-data/last-fetch or a reducer so `loadWeather` is stable; cross-ref the `exhaustive-deps`/`set-state-in-effect` lint cluster (S-1/S-2). |

## What's good (keep)
- **Multi-model consensus** with graceful `Promise.allSettled` per model and per-city failure isolation (keeps previous city data on failure).
- **`weatherLocations` registry** — 300 governed cities, IANA timezones, alias resolution (`resolveRegistryKey`), versioned migration (`getConfiguredWeatherCities`). This is the **canonical geo source** the rest of the app should adopt (W8-5).
- **Lazy boot** (`WeatherProvider lazy`) avoids fetching weather until the tab is used.
- **Rainfall consensus + wide-spread handling** (the AUDIT_REPORT "weather consensus" path) is implemented.
- Extensive cert suites (`weatherSignalPrecision`, `weatherIntegrationHardening`, `weatherFinalClosure`).

## Evidence to run
`npm run test:weather-trust`, `test:weather-signal-precision`, `test:weather-integration-hardening`, `test:weather-weekly-planning`, `test:weather-location-customization`. **Add** a test that the snapshot path rejects/labels >48 h data (W8-1) and that "Now" uses location TZ (W8-2) — almost certainly missing.

## Cross-references
- W8-1 → **Unit 13** (broken weather workflow), **Unit 7** (`marketTrust` is the recency-guard model), Ledger **D-1**.
- W8-2/W8-3 → **Unit 4** A-4 (timezone handling).
- W8-4 → **Unit 6** F6-3, **Unit 7** M7-1, **Unit 12** (Main page widgets).
- W8-5 → **Unit 1** F1-8, **Unit 2** F2-8, **Unit 5** F5-1 (Trichy in nlp/registry but not embeddings).
