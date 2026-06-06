# Source And Proxy Matrix

Date: 2026-05-30
Scope: Deep-Dive B RSS inventory, proxy chain, timeout coverage, and resilience gaps.

## Proxy Architecture

| Stack | Used by | Transport ladder | Timeout | Health behavior |
|---|---|---|---:|---|
| `proxyManager` | Main RSS, section RSS, Up Ahead | allorigins -> corsproxy -> codetabs -> rss2json | 8 s | Per-proxy cooldown and `getProxyHealth()` |
| Market stable service | Market Yahoo chart/quote | direct -> allorigins -> corsproxy -> codetabs | 8 s per transport, 12 s live bundle cap | Abort-backed per request; no cooldown pool |
| Weather service | Open-Meteo weather models | direct model endpoints | 15 s per request | New abort-backed timeout with stale cache/snapshot fallback |

## News Section Feed Inventory

| Section | Feed count | Primary source style | Proxy | SPOF risk |
|---|---:|---|---|---|
| world | 5 | BBC, Al Jazeera, Google News | `proxyManager` | Low |
| india | 4 | Google TN, NDTV, The Hindu, TOI | `proxyManager` | Low |
| chennai | 2 | Google Chennai, The Hindu Chennai | `proxyManager` | Medium |
| trichy | 3 | The Hindu, DT Next, Google Trichy | `proxyManager` | Medium |
| local Muscat/Oman | 5 | Times of Oman, Muscat Daily, Oman Observer, Google | `proxyManager` | Low |
| business | 6 | Google Business, ET, Moneycontrol, Livemint, BBC, CNBC | `proxyManager` | Low |
| technology | 4 | Google Tech, Gadgets360, TechCrunch, The Verge | `proxyManager` | Low |
| sports | 1 | ESPN | `proxyManager` | High |
| entertainment | 5 | BollywoodHungama, BBC, HT, PinkVilla | `proxyManager` | Low |
| social | 2 | Google News searches | `proxyManager` | Medium quality risk |

## Up Ahead Governance

`src/intelligence/feedSourceRegistry.js` ranks sources by trust/source type and trims static-host plans to the top three sources. It consults `feedHealthMonitor.getFeedWeight(url)` and skips sources with weight `0`.

Added certification:

- `src/intelligence/feedSourceRegistry.feedDepleted.cert.test.js` verifies a category returns an empty plan when every candidate source is demoted.

Follow-up: `intelligentUpAheadFetcher` should explicitly surface or fallback when a category plan is empty after health demotion.

## Implemented Resilience Fixes

| Area | File | Change | Cert |
|---|---|---|---|
| Weather Open-Meteo fetches | `src/services/weatherService.js` | Uses shared `fetchWithTimeout(..., { timeoutMs: 15000 })` for model and geocoding calls | `src/services/weatherServiceTimeout.cert.test.js` |
| Market proxy timeout coverage | `src/services/indianMarketStableService.js` | Exposed `fetchJsonDirectOrProxy` for direct certification of abort-backed transport attempts | `src/services/marketServiceTimeout.cert.test.js` |
| Up Ahead depleted source plan | `src/intelligence/feedSourceRegistry.js` | Existing behavior certified; empty plan is now locked by test | `src/intelligence/feedSourceRegistry.feedDepleted.cert.test.js` |

## Ranked Resilience Gaps

1. Sports remains a single-feed section. Add at least two more sports feeds before treating section health as production-grade.
2. Social uses broad Google News searches and lacks editorially curated alternatives.
3. Market direct/proxy transport aborts are now covered, but the market proxy stack still lacks per-proxy cooldown.
4. Weather has request timeouts now, but no endpoint health metric equivalent to RSS proxy health.
5. Up Ahead empty feed plans are certified, but the user-facing fallback path should be made explicit.

