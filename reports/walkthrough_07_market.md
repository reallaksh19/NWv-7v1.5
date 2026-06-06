# Walkthrough Unit 7 — Market Module

**Date:** 2026-05-30 · **Mode:** Auditor (identify & instruct)
**Scope:** Market data fetch, trust/freshness, context state, tab view-model, the 3 service files, snapshot freshness
**Files deep-read:** `context/MarketContext.jsx`, `services/marketTrust.js`, `services/indianMarketStableService.js` (head + seed), `viewModels/useMarketTabViewModel.js`, `data/datasets/marketDataset.js` (Unit 6) + import/freshness greps
**Confirmed live vs dead:** `indianMarketStableService` + `marketTrust` = **live**; `marketService.js` + `indianMarketService.js` = **imported by nobody (dead)**

---

## Verdict

🟢 The **Market tab is one of the better-built modules.** `marketTrust` is a genuinely good, stale-aware trust layer (tiered TTLs, a 24 h "displayable" window, honest `Live/Snapshot/Stale/Seed` labels), and `MarketContext` implements a full graceful cascade (fresh-cache → live → stale-cache → static snapshot → seed) with a distinct user message at each level. The "market vanishes after 2 h" complaint appears **largely fixed** in this path (the `market-v3` trust work post-dates the Feb-2025 audit). The snapshot is **fresh** (2026-05-27, 3 days old).

🟠 The problems are **structural duplication and a split-brain second surface**: two dead service files, a *second* market path (`marketDataset`→Main page) with the opposite (binary) failure behavior, and fallback/cache/proxy logic duplicated between the service and the context.

---

## Findings & Instructions

| ID | Sev | Finding | Instruction |
|----|-----|---------|-------------|
| **M7-1** | High | **Two market surfaces, opposite resilience.** The Market **tab** uses `MarketContext` (graceful, 24 h stale-visible). The **Main page** market widget uses `mainDataset → marketDataset`, whose inline `ok = slo.passed` + `FRESH/EMPTY`-only freshness (F6-3) makes it **vanish** on any SLO miss. Same data, two code paths. | Make `marketDataset` reuse `marketTrust.shouldRejectMarketPayload`/`isMarketPayloadDisplayable` and emit `STALE` (not `EMPTY`) for displayable-but-old data; set `marketSlo.required=false` so the Main widget degrades instead of disappearing. Long-term: have `marketDataset` wrap `MarketContext`'s loader so there's one market source of truth. |
| **M7-2** | High | **Two dead service files** — `marketService.js` and `indianMarketService.js` are imported nowhere (only `indianMarketStableService` is live). ~hundreds of LOC of misleading parallel implementations. | Delete both (after confirming no dynamic import). Add a CI check or `knip`/`ts-prune` pass to catch orphaned modules (also catches `crawlerService`, `loadWithPolicy`). |
| **M7-3** | Medium | **Double cascade + double IndexedDB cache.** `indianMarketStableService` runs its own live→cache→snapshot→seed cascade *and its own* IndexedDB cache (`MARKET_SERVICE_CACHE_KEY`), then `MarketContext` runs *another* cascade + IndexedDB cache (`MARKET_CONTEXT_CACHE_KEY`). Two seeds, two snapshot fetches, two trust checks per load. | Collapse to one cascade. Let the service own fetch+trust+cache; let the context be a thin React wrapper (state + `ensureBoot` + `refresh`). Removes redundant fetches and conflicting fallbacks. |
| **M7-4** | Medium | **Separate proxy pool.** Market uses its own hardcoded 3-proxy rotation (`allorigins`/`corsproxy`/`codetabs`), *not* `proxyManager` (which has 4 proxies, cooldowns, health, AbortController timeouts). Duplicated, weaker logic; no shared cooldown/health. | Route market's Yahoo fetches through `proxyManager` (extend it to handle JSON-quote endpoints), so cooldown/health/timeout are shared and observable on the Data Health page. |
| **M7-5** | Medium | **Holiday time-bomb is consumed here.** `useMarketTabViewModel` → `getMarketSessionState({ tradingHolidays })` uses the hardcoded `tradingHolidays` that end at 2026 (A-8). From 2027 the open/closed/"next session" logic is wrong. | Replace the static list with a generated/maintained calendar (or fetch from a sidecar JSON refreshed by the market workflow); add a guard for "year beyond known holidays → unknown, assume weekday rules." |
| **M7-6** | Low | **`MARKET_SEED` values are frozen** (NIFTY 22,340 etc. — ~2024 levels). Honestly labeled `sourceMode:'seed'`, so not a correctness bug, but visually misleading if the seed ever shows. | Keep the label; consider stamping the seed with "indicative levels" in the UI so users don't read frozen numbers as current. |
| **M7-7** | Low | **`ensureBoot` perpetual-loading risk.** `loading: booted ? loading : true` — if the page that calls `ensureBoot` is changed/removed, the market UI shows loading forever with no fetch. | Add a safety: auto-boot on a short timer if `ensureBoot` hasn't fired, or surface a "tap to load" state instead of indefinite spinner. |

## Detailed notes

### M7-1 — the split-brain surface (most important)
This is the correct attribution of the Unit 6 "market vanishes" flaw: the dedicated **Market tab is fine**; the **Main page's** embedded market widget is the one that can blink out, because it flows through the envelope/`marketSlo` (`required:true`) path. The fix is to make the two surfaces share the trust semantics — the good ones already exist in `marketTrust`; the envelope path just doesn't use them.

### What's good (keep / replicate elsewhere)
- **`marketTrust`** is the **reference implementation** for honest staleness: `isMarketPayloadDisplayable` (rejects 900 h+ junk, allows labeled seed, requires finite age), tiered TTLs, and `summarizeMarketSourceHealth` → `Live/Snapshot/Stale/Seed/Limited` badges. **Lift this pattern into `marketDataset`/`weatherDataset` (F6-3) and into the envelope freshness states (F6-4).**
- **`MarketContext` cascade** surfaces a distinct, honest message per fallback level (live → "cached" → ">4h expired" → "offline snapshot" → "bundled seed").
- **`useMarketTabViewModel`** is defensively coded (`asArray`/`asRecord`/`getFloat` coerce everything), with index alias maps (`^NSEI`↔`NIFTY 50`) and `auditMarketTabQuality` observability.
- **Yahoo query1/query2 failover** + multi-sidecar snapshots (market/mutual-fund/fx/metrics) are robust.

## Evidence to run
`npm run test:market-snapshot` (snapshot integrity), `test:market-trust`, `test:hardening:release6J` (MarketPage binding), `test:weather-trust` (shares the trust pattern). Add a test asserting the **Main page** market widget shows stale data rather than vanishing (M7-1).

## Cross-references
- M7-1 → **Unit 6** F6-3 (envelope binary freshness), **Unit 12** (Main page market widget).
- M7-2 → **Unit 3** F3-1 / **Unit 6** F6-1 (orphan pattern: `crawlerService`, `loadWithPolicy`).
- M7-3/M7-4 → cache-layer proliferation (F4-12) and **Unit 3** `proxyManager`.
- M7-5 → **Unit 2** F2-2 (holiday time-bomb).
- `marketTrust` → the model to fix **D-1** (Unit 8 weather staleness) and **F6-4** (dead freshness states).
