# Walkthrough Unit 2 — Config & Defaults

**Date:** 2026-05-30
**Auditor:** Claude (module-wise walkthrough)
**Scope:** Default settings, user-settings persistence/merge, runtime capability gating, JSON source policies, location config
**Files (read line-by-line):**
`src/config/settings_news.js`, `settings_market.js`, `settings_weather.js`, `settings_upahead.js`, `src/config/locationLibrary.js`, `src/runtime/runtimeCapabilities.js`, `src/context/SettingsContext.jsx`, `src/utils/storage.js`, `config/insight_sources.json`, `config/section_sources.json`

---

## Verdict

🟢 Defaults are **comprehensive and sane**, persistence **degrades safely** (corrupt blob → fall back to defaults), and `deepMerge`-on-load backfills missing keys so schema growth mostly "just works."

🟠 The main risks are **config drift / multiple sources of truth** (dedup thresholds, location sets, backend URL, two write paths to the settings key) and **no validation/clamping of user-supplied values**. Two **dated time-bombs**: trading holidays end at 2026, and array-valued defaults never reach existing users.

---

## Findings

| ID | Lens | Severity | Location | Finding |
|----|------|----------|----------|---------|
| F2-1 | Config evolution | **High** | `utils/storage.js:312-324` | **`deepMerge` replaces arrays wholesale** (`!Array.isArray(val)` → else-branch overwrite). Correct for user intent, but means **new default array entries never reach existing users** once they've saved. Adding a news source to `sources.enabled`, a `highImpactKeywords` term, or a section source silently won't appear for anyone with stored settings. |
| F2-2 | Config (time-bomb) | **High** | `config/settings_market.js:15-28` | **`tradingHolidays` hardcoded only through 2026.** Any "is market open / holiday" logic will be wrong from 2027-01-01. Today is 2026-05-30 → ~7 months of runway. Needs an annual refresh process or a generated calendar. |
| F2-3 | Data integrity | Medium | `utils/storage.js` (whole) | **No validation/clamping of user/stored values.** `freshnessLimitHours`, `fontSize`, `sections.*.count`, `market.cacheMinutes`, dedup thresholds are deep-merged as-is. A corrupt or hand-edited blob with `count: -5` / `fontSize: 9999` / `similarityThreshold: 5` flows straight into ranking/render. Settings bypass the envelope `validation` discipline used everywhere else. |
| F2-4 | Config drift | Medium | `runtimeCapabilities.js:14-20` vs `storage.js:17,188` | **Split-brain backend URL.** `runtimeCapabilities` reads `VITE_API_BASE_URL`/`VITE_BACKEND_URL`, but `storage.js` hardcodes `API_BASE='/api'` and ignores them. The configurable backend URL is effectively dead for settings sync. (Relates to H0-7 dead `VITE_*` keys.) |
| F2-5 | Config drift / Bug | Medium | `context/SettingsContext.jsx:56-66` | **Second write path to `dailyEventAI_settings`** bypasses `saveSettings()` — skips `lastUpdated` stamping and API persistence, and uses a **shallow** merge (`{...remote, ...current, upAhead:{...}}`) vs `storage.js`'s **deep** merge. Nested keys outside `upAhead` can be lost/clobbered during remote sync. Two merge strategies for one key. |
| F2-6 | Config drift | Medium | multiple | **Dedup config duplicated verbatim** in `DEFAULT_SETTINGS.storyDeduplication` (storage.js:53-62) and `DEFAULT_UPAHEAD_SETTINGS.deduplication` (settings_upahead.js:35-43) — identical thresholds **and** identical 80-token `ignoredTokens` list. Two copies to keep in sync. |
| F2-7 | Config contradiction | Medium | `settings_upahead.js:47,66` | **`'launches'` is both a positive `signal` and in the global `negative` keyword list**; similarly `'fog'`/`'mist'`/`'deal'`/`'talks'`/`'warns'` sit in `negative` while being plausible event/alert content. Over-broad negatives likely cause false-negative categorization — **directly relevant to the known "No movies listed" bug** (re-verify in Unit 9). |
| F2-8 | Config drift | Low | `settings_upahead.js:45` vs `storage.js:117` | **Location sets disagree:** Up Ahead defaults to `['Chennai','Muscat']` (no Trichy) while weather defaults to `['chennai','trichy','muscat']`. Plus three separate location modules (`geolocation.js`, `locationLibrary.js`, `weatherLocations.js`). Consolidate (cross-ref F1-8, Unit 8). |
| F2-9 | Bug (race) | Low | `utils/storage.js:211-221,326-345` | **Read-modify-write races on localStorage.** `updateSetting`, `addFollowedTopic`, `addReadArticle`, `updateTopicLastFetched` each do `getSettings()` → mutate → `saveSettings()`. Concurrent calls (e.g., rapid follows + a settings save) are last-writer-wins and can drop the other's change. |
| F2-10 | Migration | Low | `utils/storage.js:21-33` | **`migrateSettings` is a version-stamp stub** — bumps `schemaVersion` 1→2 with no field transform and no pruning of removed/renamed keys. Stale keys linger indefinitely after a real schema change. |
| F2-11 | UX / Integrity | Low | `utils/storage.js:158-168` | **Silent full reset on corrupt settings.** `JSON.parse` failure logs to console and returns defaults — the user's entire customization vanishes with no surfaced notice or backup. Consider a one-time backup-on-parse-failure. |
| F2-12 | Hygiene | Info | grep result | A **stale duplicate** `zip_extracted/r6R_upahead/src/viewModels/useUpAheadPageViewModel.js` also matches `DEFAULT_*_SETTINGS` searches — confirms H0-3 (extracted copies pollute search/audit). |

## Detailed notes

### F2-1 — the array-merge evolution trap (highest impact)
`deepMerge(target=defaults, source=stored)` recurses only into plain objects; arrays in `stored` overwrite arrays in `defaults`. So the *first* time a user saves, their `sources.enabled`, `highImpactKeywords`, `newsSources`-adjacent arrays, etc. are frozen to that snapshot. Future releases that extend these defaults reach **only new users**. This is a silent, growing divergence between "intended defaults" and "what shipped users actually run." Options: (a) version-keyed array migrations, (b) union-merge for designated "additive" arrays, or (c) move additive lists server-side / into JSON policy files that aren't snapshotted into user storage.

### F2-3 — settings are the unvalidated edge of an otherwise-validated app
Everywhere else the app wraps data in envelopes with `validation: {passed, errors, warnings}`. User settings — which drive ranking weights, dedup thresholds, freshness windows, and counts — get **none** of that. A schema (even a lightweight clamp table: numeric ranges, enum checks for `theme`/`rankingMode`/`filteringMode`/`tempUnit`) applied inside `getSettings()` after `deepMerge` would close the gap.

### What's good (keep)
- `getSettings()` is SSR-safe (`typeof localStorage === 'undefined'` guard) and **fails closed to defaults**.
- `deepMerge` correctly **backfills newly-added object keys** for existing users (the object case is the common one).
- Cross-tab consistency via the `storage` event listener (`SettingsContext.jsx:76-86`).
- JSON source policies (`insight_sources.json`, `section_sources.json`) are **versioned** (`schemaVersion`, `policyVersion`) and **tiered/time-slotted** (`tier A/B`, `now/minus4h/...`) — a clean, auditable source-of-truth for prefetch.
- `runtimeCapabilities` cleanly centralizes static-host vs full-runtime gating and drives per-feature modes (`weatherMode`, `marketMode`, `plannerSyncMode`…) — good single decision point.
- `readingHistory` is capped (50); IDs for followed topics are unique.

## Recommended fixes (priority order)
1. **F2-2** replace hardcoded `tradingHolidays` with a generated/refreshed calendar (and a guard for "unknown year").
2. **F2-1** decide an array-merge evolution strategy for additive default lists.
3. **F2-3** add post-merge validation/clamping in `getSettings()`.
4. **F2-4/F2-5** unify the backend URL source and the single settings write path.
5. **F2-6/F2-7** de-duplicate dedup config; resolve the `'launches'`/negative contradictions (feeds Unit 9).

## Evidence to run
`npm run test:settings-preference-binding` (release6M), `test:weather-settings-onthisday`, and `test:hardening:release1C` (runtime capabilities) — confirm none already assert the gaps above.

## Cross-references
- F2-4 → H0-7 (dead `VITE_*` keys), **Unit 13** (does the Python `/api` backend exist?).
- F2-7 → **Unit 9** (movie `detectCategory` re-verification).
- F2-8 → **Unit 8** (location source-of-truth reconciliation).
