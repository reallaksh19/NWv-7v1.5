# Hardening Changelog

This document records every out-of-manifest file modification made during the
Professional Data Platform hardening plan (v6.3). Each entry lists the file
path, the reason for the change, risk level, rollback note, and the covering test.

---

## Release 6A — Editorial Audit-Only (2026-05-29)

No out-of-manifest changes. All new files are listed in the manifest below.

**New files:**
- `src/intelligence/sourceDominancePolicy.js` — audit + apply for source dominance
- `src/intelligence/staleStoryPolicy.js` — audit + apply for stale stories
- `src/intelligence/sourceDominancePolicy.cert.test.js`
- `src/intelligence/staleStoryPolicy.cert.test.js`
- `scripts/benchmark_editorial_policies.mjs`
- `docs/HARDENING_CHANGELOG.md` (this file)

**Modified files:**

| File | Change | Risk | Rollback | Test |
|---|---|---|---|---|
| `src/services/rssAggregator.js` | Added editorial audit calls after dedup/cluster sort. Audit-only by default (no item removal). | Low — no items removed unless `editorialPolicies.enabled=true` | Delete the 3 import lines and the `runEditorialAudit` block after `clustered.sort`. | `src/intelligence/sourceDominancePolicy.cert.test.js`, `staleStoryPolicy.cert.test.js` |
| `src/pages/SettingsPage.jsx` | Added "Editorial Policies" toggle (default off). | None — purely additive UI. | Delete the `SettingItem` block for "Editorial Policies". | Visual inspection. |

---

## Release 6 Upcoming

- 6B: `editorialPolicies.enabled = true` enables `.apply()` (item removal)
- 6C: Benchmark gate — human review before enabling by default
- 6.4: Certification profiles (`--profile smoke/data-platform/editorial/workflow/full`)
