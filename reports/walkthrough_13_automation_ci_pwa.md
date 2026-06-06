# Walkthrough Unit 13 — Automation, CI & PWA

**Date:** 2026-05-30 · **Mode:** Auditor (identify & instruct)
**Scope:** GitHub Actions workflows, prefetch→publish→ingest pipeline, Python brief, service worker / PWA, web worker
**Evidence:** `.github/workflows/*` (9), `scripts/daily_brief.py` (Gemini branch), `scripts/market_snapshot_worker.py` (ref), `public/sw.js`/`manifest.json`, `registerSW.js`, snapshot freshness from Units 7–10

---

## Verdict

🟢 **The prefetch automation is real and mostly healthy.** Per-domain scheduled workflows (market every 30 min weekdays, news hourly, up-ahead hourly, e-paper 3×/day, insight, travel-local) generate JSON into `public/data`/`public/newsdata` with IST-aware crons, plus CI + a certification workflow. The fresh market/news/epaper snapshots prove it works.

🔴 **The decisive finding: there is no weather automation at all.** No `weather_refresh.yml` and no weather generator script exist — so `weather_snapshot.json` is **orphaned data**, frozen at its April-2025 creation. This is the definitive root cause of D-1 / W8-1.

---

## Findings & Instructions

| ID | Sev | Finding | Instruction |
|----|-----|---------|-------------|
| **A13-1** | **High** | **No weather workflow or generator.** The 9 workflows cover market/news/up-ahead/e-paper/insight/travel — **weather has none**, and `scripts/` has no `weather_snapshot_worker.py` (only weather *test*/*apply-slice* files). So `public/data/weather_snapshot.json` (2025-04-11) is never regenerated. Every static-host weather fallback serves year-old data. | Add `weather_refresh.yml` + a `weather_snapshot_worker.py` that pulls Open-Meteo for the default cities and `git add public/data/weather_snapshot.json` (mirror `market_refresh.yml`/`market_snapshot_worker.py`). **Until then**, add the W8-1 recency guard so stale snapshots are rejected, not displayed. |
| **A13-2** | Medium | **Gemini summarization is off in production (N10-1 root).** `daily_brief.py:47` prints "GEMINI_API_KEY not found. Will use free summarization fallback" and emits `method:"headlines"` (tier-3). The repo's "AI Summarization (Gemini 1.5 Flash)" claim isn't met. | Add `GEMINI_API_KEY` to repo Actions secrets (then verify tier-1 path), or update README/UI to describe the headline fallback honestly. |
| **A13-3** | Medium | **Two categorizers can diverge.** Up Ahead categorization runs **server-side in Python** (prefetch) and **client-side in JS** (`upAheadService`, U9-2). The "No movies listed" fix must land in **both**, or static-host and local-dev disagree. | Share one keyword policy (the `config/*.json` style) consumed by both Python and JS; apply the word-boundary fix in both; cert-test the same cases on both sides. |
| **A13-4** | Medium | **Cross-environment date-key risk (A-4 at the pipeline boundary).** Workflows run in **UTC**; the client computes date keys in **IST** with the off-by-one `setHours`+`toISOString` pattern. Server-generated `eventDateKey`/`date` fields and client-derived keys can disagree by a day. | Define the date-key convention **once** (local-`YYYY-MM-DD`) and apply it identically in the Python generators and the JS readers (the A-4 fix must span both). Add a contract test that a server key round-trips on the client. |
| **A13-5** | Low | **Hand-rolled `sw.js`, no `vite-plugin-pwa`/Workbox.** `sw.js` exists and registers in prod (good), but there's no automated precache/cache-versioning, so a deploy can serve **stale cached assets** unless `sw.js`'s cache name is manually bumped each release. | Verify `sw.js` busts its cache on version change; ideally adopt `vite-plugin-pwa` for hashed-precache + auto-update, which also fixes the offline story the README promises. |
| **A13-6** | Low | **Orphaned-module pattern reaches scripts too.** Dozens of `apply_slice*.mjs` codegen scripts and one-off generators sit alongside live workers (compounding H0 clutter). | Move codegen/one-off scripts to an `scripts/archive/` (or delete); keep only the live workers + tests that workflows invoke. |

## What's good (keep)
- **Per-domain scheduled prefetch** with **IST-documented UTC crons** (`market_refresh` every 30 min on weekday market hours; `news_prefetch` hourly; `upahead_refresh` hourly + weekly festival pass; `daily_brief` 3×/day).
- **`market_snapshot_worker.py`** writes 5 coordinated sidecars (snapshot, metrics, source_health, mutual_fund, fx) — the reason the market tab is reliably fresh.
- **Quality gates in CI** — `insight-real-snapshot-quality.yml` runs the strict insight ratchet and publishes quality reports; `certification.yml` runs profile gates.
- **`registerSW`** correctly **unregisters** SWs in dev (avoids stale-SW dev pain) and registers only in prod; `sw.js` + `manifest.json` are present (PWA install works).
- **3-tier summarization** in `daily_brief.py` (Gemini → … → headlines "always works") degrades gracefully.

## Evidence to run
`npm run test:news-prefetch-workflow-orchestration` + `validate_news_prefetch_workflow.mjs`, `test:certification-manifest` + `validate_certification_manifest.mjs`, `test:pages-data-publish`. **Add**: a freshness-budget check that fails CI if any `public/data/*snapshot*.json` is older than its domain's max age (would have caught A13-1 a year ago).

## Cross-references
- A13-1 → **Unit 8** W8-1 / Ledger **D-1** (the definitive root cause).
- A13-2 → **Unit 10** N10-1, **Unit 3** F3-5.
- A13-3 → **Unit 9** U9-2/U9-7.
- A13-4 → **Unit 4** A-4 (now spans Python + JS).
- A13-6 → **Unit 0** H0 clutter, the orphan pattern (F3-1/F6-1/M7-2).
