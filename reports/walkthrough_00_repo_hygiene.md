# Walkthrough Unit 0 — Repo Hygiene & Secrets Sweep

**Date:** 2026-05-30
**Auditor:** Claude (module-wise walkthrough)
**Scope:** Top-level working tree, loose artifacts, secret exposure, VCS state
**Method:** Directory inventory + targeted secret-pattern scan (deep, pre-pass before code units)

---

## Verdict

🟢 **No secret leakage found.** `.env.example` is clean (empty placeholders) and no Google/OpenAI/NewsData key patterns (`AIzaSy…`, `sk-…`, `pub_…`) appear in the loose dumps, scripts, config, or `src/`.

🟠 **Significant working-tree clutter** that will impede a clean audit and bloats the deliverable. Recommend a quarantine pass before/while we proceed. None of it blocks the walkthrough, but it raises noise and the (small) risk that a future dump *does* contain a secret.

---

## Findings

| ID | Lens | Severity | Location | Finding | Recommendation |
|----|------|----------|----------|---------|----------------|
| H0-1 | Hygiene | Medium | repo root | ~30+ one-off scripts (`fix_*.py`, `extract*.py`, `fixer.py`, `fix_*.cjs`) committed at root | Move to `/archive/` or delete; they are not part of the app or its build |
| H0-2 | Hygiene / Integrity | Medium | repo root | Large raw dumps committed: `code update v2_2.txt` (477 KB), `code update v2_3.txt` (236 KB), `code update v2_1/_4.txt`, `DebugConsole.jsx46 [RSS] Prefetched.txt` (410 KB), `fixes.txt` (142 KB), `6T.txt`, `before 6p.txt` | These are transcripts/console dumps, not source. Quarantine. They also slow down repo-wide `grep` (the secret scan timed out until scoped). |
| H0-3 | Hygiene | Low | repo root | Multiple archive blobs: `nwv-7.zip` (431 KB), `release6P/6Q/6R/6S_*.zip`, plus `zip_extracted/`, `backup file/`, `insight_files/` | Redundant with `src/`; remove or move out of tree |
| H0-4 | Bug (build artifact) | Low | repo root | Zero-byte files `node` and `news-weather-app@1.0.0` — almost certainly accidental shell redirects (`… > node`) | Delete |
| H0-5 | Hygiene | Low | repo root | Near-duplicate images: `UIupdate.jpg`, `UIupdate (1).jpg`, `UIupdate1.jpg` all 422,351 bytes (byte-identical); `UIupdate3.jpg` == `UIupdate3 and logiccheck.jpg` (556,066) | De-dupe; keep one canonical copy |
| H0-6 | Hygiene | Low | repo root | Build/verify logs committed: `vite-verify.log`, `vite-verify-5174.log`, `*.err.log` | Add to ignore; not source |
| H0-7 | Config (dead) | Medium | `.env.example` vs `src/` | `VITE_NEWS_API_KEY`, `VITE_WEATHER_API_KEY`, `VITE_DDG_API_KEY` are declared but **never read in `src/`** (no `import.meta.env.VITE_*` references exist). Either dead config or keys consumed only by Python/Actions. | Confirm in **Unit 2 / Unit 13**; remove if dead or document where consumed |
| H0-8 | Process | Info | repo root | **Not a git repository** locally (`.git` absent) though README documents GitHub Actions + Pages deploy | The walkthrough cannot use `git blame`/history as evidence. Recommend `git init` + first commit to enable diff-based review and the `/code-review` tooling |

## What's good

- `.env.example` documents required keys with **empty values** — no real secrets committed.
- `.gitignore` and `.prettierrc` present; ESLint flat config (`eslint.config.js`) present.
- No secret patterns in `src/`; all `import.meta.env` usage is limited to `BASE_URL`, `DEV`, `PROD` (safe, build-time).

## Scan coverage / limitations

- Secret regex (`AIzaSy[…]`, `sk-[…]`, `api_key=…`, `GEMINI_API_KEY=…`, `pub_…`) run across `*.txt/.py/.json/.md/.cjs/.mjs` and `src/`. **Clean.**
- A full entropy-based secret scan (e.g., `gitleaks`/`trufflehog`) was **not** run — recommended as a CI gate once the repo is under git.
- The big `.txt` dumps were not read line-by-line for secrets beyond the regex pass; if any will be retained, scan them explicitly.

## Cross-references

- H0-7 → **Unit 2 (Config & defaults)** and **Unit 13 (Automation/CI)** to confirm where (if anywhere) the `VITE_*` keys are consumed.
- The 3 overlapping market services and multiple "location" sources of truth noted during mapping are tracked in **Unit 7** and **Unit 8** respectively.

## Suggested cleanup (non-destructive first)

```
mkdir archive
move *.txt, fix_*.py, extract*.py, *.zip, "backup file", zip_extracted, vite-verify*.log  -> archive\
del node, "news-weather-app@1.0.0"   # zero-byte artifacts
```
*(Do not delete `requirements.txt`, `package*.json`, `README.md`, or anything under `src/`, `scripts/`, `config/`, `public/`.)*
