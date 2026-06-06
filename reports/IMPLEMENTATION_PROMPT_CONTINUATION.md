# Implementation Agent — Continuation Brief (v2, authoritative)

You are continuing an in-progress remediation of the News & Weather app at `C:\Code1\NWv-7`.
A prior agent completed several findings (logged in `reports/IMPLEMENTATION_LOG.md`). **This brief
supersedes `IMPLEMENTATION_PROMPT.md` for ordering and process.** Read `reports/BUG_LEDGER.md`,
the per-unit reports `reports/walkthrough_*.md`, and `reports/IMPLEMENTATION_LOG.md` before touching code.

You will be judged on **discipline, not speed.** Poor coding, skipped tests, suppressed lint, or
broken existing gates are failures even if the feature "works".

---

## 0. Verified current state (2026-05-30)
- **Done & committed:** A-13/W8-1 (weather automation + freshness guard), B-1 (planner export), B-2 (settings hooks), B-3 (upahead reload), lint-cleanup, S-1 (weather active-city site).
- **Baseline now:** `npm run build` green · `npm run test:unit` = **127 files / 765 tests pass** · `npm run lint` = **10 errors / 14 warnings** (8× `react-refresh/only-export-components`; 2× `set-state-in-effect` at `useDataset.js:98`, `useMyPlannerPageViewModel.js:132`).
- **⚠ TWO UNFIXED REGRESSIONS the prior agent introduced and left red:**
  - `npm run test:weather-trust` → **FAIL**
  - `npm run test:weather-location-customization` → **FAIL** (14/15; one static-token assertion)
  These broke during the A-13 `WeatherPage.jsx` edits: the `scripts/test_*_static.mjs` cert checkers **grep source for required tokens**, and a token was removed/renamed.

---

## 1. STOP — Regression-first rule (Phase R, do before any new finding)
**R-0:** Make `npm run test:weather-trust` and `npm run test:weather-location-customization` green again.
- These are **static-token certs** — open the failing `scripts/test_*_static.mjs`, see which token/string it requires, and **restore the wiring** in `WeatherPage.jsx` (preferred) so behavior is preserved. Only edit the cert's expected token if the token is *provably obsolete* AND user-facing behavior is intact AND you justify it in the log.
- **Iron rule for the entire effort:** *You may not begin a new finding while any test or cert that was green is red.* Green-to-green only. If you break something, you fix it before anything else.

---

## 2. Per-finding workflow — mandatory, every finding, no exceptions
1. **Branch** `fix/<ID>-<slug>` from the latest all-green tip.
2. **Red first:** write a failing test (`*.cert.test.*` / `*.test.*`) that encodes the bug. Run it, confirm it FAILS, paste the red output into the log. *No test → no fix.*
3. **Minimal implementation.** Touch only the files the finding requires. No drive-by refactors, no reformatting unrelated code.
4. **Full gate (ALL must pass before commit):**
   - `npm run test:unit` — full suite green; **test count must be ≥ the previous run** (never delete/disable tests to pass).
   - `npm run build` — green.
   - `npx eslint <every file you touched>` — **zero errors** on touched files.
   - **Every `scripts/test_*_static.mjs` that references a file/token you touched** — green. (Find them: search `scripts/` for the filename/symbol you changed.)
   - The matching cert profile if the domain has one (`npm run test:certify:smoke` at minimum; `:data-platform` / `:editorial` / `:workflow` if relevant).
   - `git diff --check` — no whitespace/conflict markers.
5. **Lint ratchet:** record the global `npm run lint` error count before and after. It must **decrease or stay equal — never increase.**
6. **Log it:** append a section to `reports/IMPLEMENTATION_LOG.md` (red evidence, commit hash, every gate run + result, any newly-observed failures).
7. **One commit** per finding: `fix(<ID>): <summary>` (or `chore`/`feat`). No `--no-verify`, no amend/force-push of shared history, no squashing across findings.

---

## 3. Forbidden — any of these = the change is rejected
- Adding `eslint-disable`, `// @ts-ignore`, `/* eslint-disable */`, or `--no-verify` to pass a gate. **Fix the root cause.**
- Deleting, skipping (`.skip`), or weakening an existing test/static-cert assertion to go green — unless it is provably obsolete and you replace it with an equal-or-stronger check, justified in the log.
- Removing a source token that a `*_static.mjs` cert greps for (this caused R-0). If you must rename, update the wiring so the token's intent is preserved, or update the cert deliberately.
- Decreasing the `test:unit` count; widening a fix beyond its finding; refactoring unrelated modules.
- Editing the large `*.txt`/`*.zip`/`zip_extracted/`/`backup file/` artifacts; committing `dist/` or `node_modules/`.
- Marking a finding "done" while any gate is red.

---

## 4. Execution order — follow exactly; do not jump ahead

### Phase R — regressions (now)
- **R-0** fix the two weather static certs → all-green.

### Phase A — drive the lint gate to zero (mechanical, low risk)
- **A-a — `set-state-in-effect` ×2.** `useDataset.js:98` (dataset auto-load) and `useMyPlannerPageViewModel.js:132` (one-time plan load). Apply the same treatment as S-1: compute/derive or schedule without a synchronous `setState` in the effect body (guarded ref, lazy init, or event-driven load). Add a test each.
- **A-b — `react-refresh/only-export-components` ×8.** For each flagged file, move the `__…InternalsForTest` exports / shared constants into a sibling `*.internals.js` and re-import; the component file exports only its component. Existing tests must still pass (update their import path). **After Phase A, `npm run lint` must show 0 errors.**

### Phase B — systemic high-impact (one finding per commit, in this order)
1. **A-4 — single date-key helper.** Add `src/utils/dateKey.js` → `toLocalDateKey(d)` built from `getFullYear()/getMonth()+1/getDate()` zero-padded (**never** `toISOString().slice(0,10)`). Replace every offending site: `intelligence/dateAware.js`, `intelligence/canonicalItemBuilder.js`, `intelligence/deDuplication.js`, `utils/dateExtractor.js` (`expandDateKeys`), `services/weatherService.js` (`buildDailyConsensus`), `utils/plannerStorage.js`. Apply the same convention in the Python generators that emit date keys. **Do one file at a time; run the full suite green after each.** Tests: (a) an item saved for a given *local* day appears under that day in the planner; (b) a server-UTC-generated key round-trips to the same local key on the client.
2. **W8-2 — cross-TZ "Now".** In `weatherService.processMultiModelData`, derive the current hour from `WEATHER_LOCATION_REGISTRY[key].timezone` via `Intl.DateTimeFormat(..., { timeZone, hour:'numeric', hour12:false })`, not `new Date().getHours()`. Test a non-local-TZ city (e.g., Muscat) shows the correct "Now" slot.
3. **A-5 — stable content IDs.** Replace ephemeral IDs in `adapters/newsFetcher.js` (`${slot}-${idx}-${Date.now()}`) and `services/newsService.js` (`rss-${idx}`/`ddg-${idx}`) with `fnv1aHex(url || title)` (reuse `data/dataEnvelope.js`). Tests: same article → same ID across two fetches. **Then A-18:** add a `TopicContext` test that an *unchanged* refresh does **not** call `sendNotification`.
4. **U9-4 / F1-6 — no silent save loss.** Route `utils/plannerStorage.js`, `hooks/useWatchlist.js`, and topic/history writes through `safeStorage.safeSetJson`; surface a visible "storage full" outcome. Test: a quota-exceeded write returns a real failure, not a silent `false`/dedup-skip.
5. **F6-2 / F6-3 / A-15 — SLO/freshness convergence.** Make `marketDataset`/`weatherDataset` reuse `marketTrust` semantics, emit `ENVELOPE_FRESHNESS.STALE` (with age) instead of `EMPTY` for displayable-but-old data, and set those SLOs `required:false`. Test: the Main-page market/weather widgets render stale data + a warning (do **not** vanish), and the existing `DataStateBanner`/`DataFreshnessBadge` "stale" path renders.
6. **F1-3 / A-10 — abortable timeout.** Wire an `AbortController` into `utils/withTimeout.js` / `data/fetchClient.js` (the working pattern is in `services/proxyManager.js`). Test: on timeout the underlying fetch is aborted.

### Phase C — tuning & config
7. **F2-7 — categorizer negatives.** Reconcile the contradictory positive/negative keyword lists (e.g. `'launches'`); add the AUDIT_REPORT §3 movie cases as cert tests on **both** the JS `intelligence/classification.js` and the Python categorizer. *Do not re-introduce substring matching — `classification.js` already uses word boundaries, and `detectCategory` is already removed; verify, don't redo.*
8. **F2-1 / F2-2 — config evolution.** Add an additive-array merge strategy to `storage.deepMerge` for designated default lists; replace the hardcoded `tradingHolidays` (ends 2026) with a generated/maintained calendar + an "unknown year → weekday rules" guard.

### Phase D — hygiene (last)
9. **A-9 / V12-2 — code-split** routes in `App.jsx` with `React.lazy()` + `<Suspense>`; verify the main chunk shrinks materially (`npm run build`).
10. **De-orphan** — after confirming zero imports, delete `services/crawlerService.js`, `data/loadWithPolicy.js`, `services/marketService.js`, `services/indianMarketService.js`; add a `knip`/`ts-prune` CI step to prevent recurrence.
11. **H0 cleanup** — quarantine root cruft (`fix_*.py`, `code update v2_*.txt`, `*.zip`, `zip_extracted/`, `backup file/`); delete zero-byte `node` / `news-weather-app@1.0.0`.
12. **S-2 — exhaustive-deps** warnings: fix per site (wrap unstable `safeSettings`/`data` in `useMemo`, etc.).

---

## 5. Repo-specific footguns (read once)
- **Static-token certs:** dozens of `scripts/test_*_static.mjs` assert that specific symbols/strings exist in specific source files. Renaming/removing a symbol silently breaks them (this is what R-0 is). Before renaming any exported symbol, grep `scripts/` for it.
- **Windows:** use `npm.cmd`/`npx.cmd`; the suite is heavy (`test:unit` ~110 s).
- **Cert profiles:** `test:certify:smoke|data-platform|editorial|workflow` are the umbrella gates.
- **Monotonic invariants:** `test:unit` count only goes up; `lint` error count only goes down. If either moves the wrong way, you broke something.

---

## 6. Final acceptance (the effort is complete when ALL hold)
- `npm run lint` → **0 errors** in `src/` (warnings minimized or justified in the log).
- `npm run test:unit` green, **count ≥ 765 plus one new test per finding** above.
- `npm run build` green, with a **smaller main chunk** than 985 kB after Phase D #9.
- `npm run test:certify:smoke` green (+ `data-platform`/`editorial`/`workflow` where touched).
- Every `scripts/test_*_static.mjs` touched by your changes is green — **including the two R-0 certs.**
- `reports/IMPLEMENTATION_LOG.md` maps **every** finding ID → branch + commit + tests added + gates passed.
- **Zero regressions:** every test/cert green at the start of your work is green at the end.
