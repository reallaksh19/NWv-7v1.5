# Walkthrough Unit 4 — Ingestion & Editorial Intelligence

**Date:** 2026-05-30
**Auditor:** Claude (module-wise walkthrough)
**Scope:** News fetch/normalize/rank pipeline, canonical item building, date extraction, deduplication, editorial policies, ingestion ledger
**Files deep-read (11):**
`services/newsService.js`, `services/rssAggregator.js`, `intelligence/canonicalItemBuilder.js`, `intelligence/dateAware.js`, `intelligence/deDuplication.js`, `intelligence/eligibilityWindowing.js`, `intelligence/sourceDominancePolicy.js`, `intelligence/staleStoryPolicy.js`, `intelligence/ingestionCheckpointLedger.js`, `utils/similarity.js`, `utils/dateExtractor.js`
**Inventoried, deferred to a follow-up deep pass (8):** `classification.js`, `sourceTrust.js`, `feedHealthMonitor.js`, `feedSourceRegistry.js`, `locationAware.js`, `explainabilityAudit.js`, `services/googleNewsService.js`, `services/entertainmentService.js`

---

## Verdict

🟢 The ingestion spine is **sophisticated and largely resilient**: stable content-hash IDs on the main feed path, a prefetch-first static-host strategy with graceful live-RSS fallback, per-feed retry, pure/audit-safe editorial policies, and a rich explainability trace (`decisionTrace`/`dropReason`) through the canonical pipeline.

🔴 The dominant theme is **duplication of critical logic across parallel implementations** — two dedup engines, two date engines, two ID schemes — plus a **systemic timezone date-key bug** replicated in four files. These create divergence risk exactly where correctness matters most (dates and identity in a planner app).

---

## Findings

| ID | Lens | Severity | Location | Finding |
|----|------|----------|----------|---------|
| F4-1 | Bug (timezone) | **High** | `dateAware.js:18`, `canonicalItemBuilder.js:29-34`, `deDuplication.js:41-47`, `dateExtractor.js:252` | **Systemic date-key off-by-one.** All four compute keys as `setHours(0,0,0,0)` (**local**) then `toISOString().slice(0,10)` (**UTC**). For the app's target IST (+5:30), local midnight serializes to the *previous* UTC day → date keys are shifted −1. Internally consistent (so in-app comparisons mostly survive), but **breaks against UTC-generated prefetch snapshots** (GitHub Actions run in UTC) and **displays the wrong day** to users. Use local `YYYY-MM-DD` formatting (or compute everything in a fixed TZ). |
| F4-2 | Duplication / Integrity | **High** | `utils/similarity.js` vs `intelligence/deDuplication.js` | **Two independent dedup engines** with different algorithms and thresholds. `similarity.deduplicateAndCluster` (string-similarity + fingerprint + token overlap) serves the main RSS feed; `deDuplication.deduplicateCanonicalItems` (category+location+date-gated fuzzy title) serves canonical/Up-Ahead. The same two articles can be merged in one path and kept separate in the other. Consolidate to one engine. |
| F4-3 | Duplication / Bug | Medium | `intelligence/dateAware.js` wraps `utils/dateExtractor.js` | **Two date engines with divergent "next week" math.** `dateExtractor.extractRelative` (`:170`) computes next-Monday as `+(7 - getDay() + 1)` → **+8 days when today is Sunday** (off-by-7); `dateAware.parseRelativeWeekWindow` uses `((8-getDay())%7)||7` (correct). The buggy path is *shadowed* in the canonical pipeline (dateAware parses first) but live if `extractDate` is called directly. Reconcile and delete one. |
| F4-4 | Data integrity | Medium | `services/newsService.js:106,152` | **Ephemeral IDs** `rss-${idx}` / `ddg-${idx}` on the DuckDuckGo/Bing and Google-search news paths — positional, non-stable across fetches (complements F3-2). *Note:* the main `rssAggregator.normalizeItem` path **does** use a stable `hash(link\|guid\|title)` ID, so seen/dedup works there; the gap is the search/DDG path and the insight fetcher. |
| F4-5 | Data integrity | Medium | `services/rssAggregator.js:752` | **Undated items are treated as brand-new.** `normalizeItem` does `Date.parse(pubDateStr) || Date.now()`; an unparseable/missing pubDate becomes "now", so the freshness filter (`hideOlderThanHours`) **never drops it**. Stale-but-undated content leaks into "fresh" feeds — consistent with the AUDIT_REPORT "stale news ranking" complaint. |
| F4-6 | Workflow (priority inversion) | Medium | `services/newsService.js:46-87` | **Stated source priority is inverted.** The docstring says "NewsData.io (Priority)" but the code tries **DuckDuckGo/Bing first** and returns on any non-empty result, so the "HIGH confidence" NewsData.io path is skipped whenever Bing returns anything. The `confidence: 'HIGH'/'MEDIUM'` labels are therefore misleading. |
| F4-7 | Workflow / Integrity | Medium | `services/newsService.js:216-224` | **Unknown sources are dropped entirely** when settings are provided: `isSourceAllowed` returns `false` for any source not in the ~16-entry `SOURCE_MAPPINGS`. Combined with high-impact-only sort and `.slice(0,10)`, this can starve sections of content (regional/smaller outlets vanish). Consider allow-by-default with explicit blocklist. |
| F4-8 | Integrity (latent) | Low | `intelligence/staleStoryPolicy.js:37` | **Field-name coupling.** Reads `item.publishedAt`; canonical items expose `publishTs` (not `publishedAt`). Works today because the only caller (`rssAggregator`) passes `normalizeItem` output (has `publishedAt`); would silently no-op (all "fresh") if ever fed canonical items. |
| F4-9 | Config (dormant) | Low | `rssAggregator.js:942`, `intelligence/*Policy.js` | **Editorial `apply()` never runs.** `settings.editorialPolicies` is absent from `DEFAULT_SETTINGS` (Unit 2), so only `audit()` executes (recording diagnostics). Source-dominance and stale-story filtering are effectively **off** for end users by default — intentional per docstrings, but worth a conscious decision. |
| F4-10 | Integrity | Low | `rssAggregator.js:194` vs `canonicalItemBuilder.js:13-21` | **Divergent hash formats.** `rssAggregator.hash` → signed base-10 (`h.toString()`, can be negative); `canonicalItemBuilder.hash` → `Math.abs(h).toString(36)`. The same article gets different IDs in the two subsystems. |
| F4-11 | Design smell | Low | `rssAggregator.js:549-553,721` | **Arrays carrying attached properties** (`rankedItems.health`, `.prefetched`, `.sectionQuality`). Any `.map()`/spread silently drops them; fragile contract for consumers. |
| F4-12 | Caching | Low | `proxyManager` (10 min) · `rssAggregator.memoryCache` (5 min) · `useDataset.envelopeCache` (no TTL) | **Three independent cache layers** with different TTLs. A user "refresh" must bust all three or risk serving stale data from a lower layer (cross-ref F1-1). |
| F4-13 | Bug (minor) | Low | `rssAggregator.js:261,818` | `generateCriticsOneLiner` is **called with 3 args** (`title, desc, source`) but **defined with 2** — the source arg is silently ignored. |
| F4-14 | Integrity | Info | `canonicalItemBuilder.js:36-43` | **Weak link normalization** — `normalizeLink` keeps the full URL incl. query string, so `?utm=…` variants produce different `canonicalId`s. `deDuplication.canonicalLink` *does* strip query — so dedup catches them but the canonical IDs still diverge. |

## Detailed notes

### F4-1 — the timezone date-key bug (highest-priority correctness issue)
Dates are the backbone of Up Ahead and Planner. The pattern `new Date(x); d.setHours(0,0,0,0); d.toISOString().slice(0,10)` takes a *local* midnight and reads back a *UTC* calendar date. In IST that's the previous day. Because every in-app producer does the same thing, intra-app key matching usually still lines up — but the **prefetch snapshots are produced by GitHub Actions in UTC** (Unit 13), so server keys and client keys can disagree by a day, and any key shown to the user is off. Fix centrally with a `toLocalDateKey(d)` helper (`getFullYear()/getMonth()+1/getDate()` zero-padded) and replace all four sites.

### F4-2 / F4-3 — parallel implementations
There are two of everything that matters here: dedup (similarity.js vs deDuplication.js) and date parsing (dateExtractor.js vs dateAware.js). Each pair overlaps ~80% and diverges in edge cases (the Sunday "next week" bug; different similarity thresholds). This is the classic "which one is authoritative?" hazard. Recommend designating one canonical implementation per concern and deleting/wrapping the other.

### What's good (keep)
- **`resolveDedupeOptions`** (similarity.js:24) robustly accepts *either* a numeric threshold *or* a full options object — I suspected a type bug at the `rssAggregator` call site and **verified it is handled correctly**.
- **Stable content-hash IDs** on the main `normalizeItem` path enable seen-penalty/dedup to actually work there.
- **Prefetch-first static-host strategy** (`rssAggregator.js:518-592`) with explicit stale/empty/disabled branches and live-RSS fallback gated on `allowWideFeedFetch` — genuinely robust.
- **Editorial policies are pure, side-effect-free, audit-by-default** with stats + diagnostics — safe to enable incrementally.
- **Canonical pipeline explainability** — `decisionTrace`, `dropReason`, `routeTarget`, `windowStatus` make routing decisions auditable.
- **`normalizeSourceText`** defensively handles RSS source fields that arrive as objects.
- **`ingestionCheckpointLedger`** uses stable guid→link-hash→title+date keys (the right pattern).

## Recommended fixes (priority order)
1. **F4-1** central `toLocalDateKey` helper; replace all four sites; re-test against UTC prefetch keys.
2. **F4-2 / F4-3** consolidate to one dedup engine and one date engine.
3. **F4-5 / F4-6 / F4-7** fix freshness-of-undated, source priority order, and over-aggressive source filtering in `newsService`.
4. **F4-4** stable IDs on the DDG/search path (reuse `fnv1aHex`).
5. **F4-9** decide whether editorial `apply()` should ship enabled.

## Coverage note
This unit's data-integrity/date/dedup/ranking spine was deep-read (11 files). Eight lower-risk intelligence helpers (`classification`, `sourceTrust`, `feedHealthMonitor`, `feedSourceRegistry`, `locationAware`, `explainabilityAudit`, `googleNewsService`, `entertainmentService`) are inventoried and flagged for a dedicated follow-up pass — none are on the critical correctness path surfaced above, but completeness warrants reading them before sign-off.

## Evidence to run
`npm run test:editorial`, `test:certify:editorial`, `test:sections-source-policy`, `test:news-prefetch-workflow-orchestration`. Check whether any cert pins date-key TZ behavior (F4-1) — almost certainly not.

## Cross-references
- F4-1 → **Unit 9** (Up Ahead/Planner date windows), **Unit 13** (UTC prefetch generation).
- F4-4 → **Unit 3** F3-2, **Unit 5** (insight identity).
- F4-2 → **Unit 5** (insight has its *own* dedup too — a third engine).
- F4-9 → **Unit 2** (`editorialPolicies` missing from defaults).
