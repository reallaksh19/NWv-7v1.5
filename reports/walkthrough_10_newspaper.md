# Walkthrough Unit 10 — Newspaper / Daily Brief

**Date:** 2026-05-30 · **Mode:** Auditor (identify & instruct)
**Scope:** E-paper data + freshness, virtual-paper fallback, front-page composer, newspaper dataset/VM
**Files deep-read:** `services/frontPageComposer.js`, `services/virtualPaperService.js`, `public/data/epaper_data.json` (head) + dataset/VM context

---

## Verdict

🟢 **Small and healthy.** The e-paper JSON is **fresh** (`lastUpdated: 2026-05-27`, 3 days old → the `daily_brief.yml` workflow is running), `newspaperDataset` uses the *graceful* `applyDatasetSlo` path (degrades, doesn't vanish), `virtualPaperService` is a clean section-aggregation fallback, and `frontPageComposer` is a sound round-robin diversity selector (reused by sections).

🟠 The notable item is a **feature that's quietly off**: the advertised Gemini AI summarization isn't producing AI summaries in production.

---

## Findings & Instructions

| ID | Sev | Finding | Instruction |
|----|-----|---------|-------------|
| **N10-1** | Medium | **AI summarization is effectively disabled.** E-paper sections show `"summary_method": "headlines"` (bulleted headlines), not Gemini output — i.e. `GEMINI_API_KEY` isn't configured in Actions, so `daily_brief.py` takes its documented "skip summarization" branch. The README/feature list promises "AI Summarization (Gemini 1.5 Flash)." | Decide: either add `GEMINI_API_KEY` to repo secrets (and verify the Python path) **or** update the README/UI so it doesn't promise AI summaries. Surface `summary_method` in the UI so the mode is honest. (Confirm the Python branch in Unit 13.) |
| **N10-2** | Low | **Virtual-paper fallback misrepresents Tamil papers.** When static e-paper is unavailable, `virtualPaperService` builds Dinamani/Daily Thanthi from **English** sections (`chennai`/`entertainment`/`local`) — the code itself comments "Approximation." Users see English content under a Tamil masthead. | Either map these to Tamil-specific feeds or clearly label the fallback as "auto-composed (English sources)". |
| **N10-3** | Low | **`frontPageComposer.extractGeography`** uses a hardcoded mini geo list with a fragile `'tn '` trailing-space match (misses "TN.", "TN,"). It's a 5th location classifier. | Reuse the canonical location registry (W8-5) for geo extraction; fix the `tn` boundary. |
| **N10-4** | Low | **Composer can under-fill** when topic/geo caps are tight (skipped articles are `shift`-ed out and discarded, so a capped section's overflow is lost rather than deferred). Returns `< limit` by design. | Acceptable (diversity > fill); if fuller pages are wanted, keep a spillover pass that re-admits skipped high-scorers after a first round. |

## What's good (keep)
- **Fresh data + graceful dataset** — `epaper_data.json` is current and `newspaperDataset` follows the `applyDatasetSlo` (degrade-not-vanish) pattern. This is the model the inline-SLO datasets (market/weather Main widgets) should adopt.
- **`virtualPaperService`** — `Promise.all` per section with per-section error capture and an "only non-empty pages" filter; a tidy live fallback when the snapshot is missing.
- **`frontPageComposer`** — `MIN_IMPACT` quality gate with a safety fallback (never returns empty), round-robin section spreading, and configurable topic/geo caps.

## Evidence to run
`npm run test:newspaper-migration`, `test:hardening:release6Q` (NewspaperPage binding). For the summarization gap, see Unit 13's `daily_brief.yml`/`daily_brief.py` review. Confirm `epaper_data.json` schema has the fields the VM expects.

## Cross-references
- N10-1 → **Unit 13** (`daily_brief.py` Gemini branch, Actions secrets), **Unit 3** F3-5 (`geminiService` client path).
- N10-2/N10-3 → **Unit 8** W8-5 (canonical location registry).
- "graceful dataset" → **Unit 6** F6-2 (the pattern market/weather Main widgets lack).
