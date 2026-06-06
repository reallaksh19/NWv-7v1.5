# Mode Matrix

Date: 2026-05-30
Scope: tab source ladders, runtime mode divergence, workflow ownership, and gaps verified during the Deep-Dive A pass.

## Runtime Capability Switches

`src/runtime/runtimeCapabilities.js` computes the app-wide mode once at boot.

| Flag | Static host behavior | Live behavior |
|---|---|---|
| `isStaticHost` | True on GitHub Pages, Netlify, Vercel, Pages | False on localhost and non-static hosts |
| `preferSnapshots` | True | False |
| `allowWideFeedFetch` | False | True |
| `canUseBackendApi` | Only when configured backend URL exists | True in browser runtime or with configured backend |
| `weatherMode` | `cache-or-snapshot` | `live` |
| `marketMode` | `snapshot-first` | `live` |
| `upAheadMode` | `limited-live` | `full-live` |
| `plannerSyncMode` | `local-only` | `remote-capable` |

## Tab Source Ladder

| Tab / Route | Static-host path | Live path | Snapshot workflow | Fallback |
|---|---|---|---|---|
| Main `/` | `mainDataset` -> `sectionsDataset` -> `public/newsdata/sections_latest.json` | `rssAggregator.fetchSectionNews` via live RSS | `news_prefetch.yml` | Empty section state |
| Insight `/insight` | `insightDataset` -> `public/newsdata/insight_latest.json`, rejected when snapshot age exceeds 8 h unless stale is allowed | `insightFetcher` live pipeline | `news_prefetch.yml` | Empty state |
| Market `/markets` | `MarketContext` -> `public/data/market_snapshot.json` | `indianMarketStableService` Yahoo chart/quote ladder | `market_refresh.yml` | Stale cache, stale snapshot, then `MARKET_SEED` |
| Weather `/weather` | `WeatherContext` -> `public/data/weather_snapshot.json` with 48 h display guard | `weatherService` -> Open-Meteo models | `weather_refresh.yml` | Stale cache, snapshot, then error |
| Up Ahead `/up-ahead` | `upAheadDataset` prefetched JSON | `intelligentUpAheadFetcher` plus `feedSourceRegistry` | `upahead_refresh.yml` | Empty state |
| Newspaper `/newspaper` | `newspaperDataset` -> `public/data/epaper_data.json` | `virtualPaperService` live RSS | `daily_brief.yml` | Live RSS or empty source |
| Planner `/my-planner` | `plannerDataset` -> localStorage | `plannerStorage.sync()` when runtime supports remote | None | localStorage |
| Following `/following` | settings/localStorage topic state | `topicService` RSS | None | Last seen local articles |
| Buzz/Tech `/tech-social` | `buzzDataset` from prefetched sections | `rssAggregator` social/tech feeds | `news_prefetch.yml` | Empty state |
| Refresh `/refresh` | Not a data source | Force reloads registered loaders | None | N/A |
| Data Health `/data-health` | `diagnosticsStore` | `diagnosticsStore` | None | N/A |
| Settings `/settings` | localStorage | localStorage plus optional backend | None | Defaults |

## Workflows

| Workflow | Cadence | Writes |
|---|---:|---|
| `news_prefetch.yml` | Hourly/daytime plus night windows | `public/newsdata/insight_latest.json`, `sections_latest.json`, quality reports |
| `market_refresh.yml` | Every 30 min during weekday market hours | `public/data/market_snapshot.json`, metrics, mutual funds, FX, source health |
| `daily_brief.yml` | 01:00, 07:00, 13:00 UTC | `public/data/epaper_data.json` |
| `upahead_refresh.yml` | Hourly daytime | Up Ahead JSON under `public/data/` |
| `travel-local-news.yml` | Every 6 h | `public/data/travel-local-*.json` |
| `weather_refresh.yml` | Every 3 h | `public/data/weather_snapshot.json` |
| `insight-real-snapshot-quality.yml` | Twice daily | Quality reports only |
| `ci.yml` / `certification.yml` | Push | Verification only |

## Divergence Risks

| Area | Static-host behavior | Live behavior | Risk |
|---|---|---|---|
| Categorization | Python prefetch categories | JS `classification.classifyItemCategory` | Drift if Python and JS keyword tables diverge |
| Date keys | Worker-generated local date strings | JS `toLocalDateKey` | Must stay on `YYYY-MM-DD` local convention |
| Story IDs | Snapshot IDs from workers | JS stable IDs | Regeneration stability must be monitored |
| Insight slots | Re-slotted by current story age | Live fetcher slot timing | Intended drift as snapshots age |
| Freshness guard | Insight rejects snapshots older than 8 h | Live can fetch again | Static Insight can empty out after workflow failure |

## Ranked Gaps

1. Following topic news has no static prefetch, so slow/offline static-host users can see no topic content.
2. Planner and Following data remain localStorage-only on static host; clearing browser storage loses custom data.
3. No single CI freshness gate checks all `public/data/*.json` domain max-age limits.
4. Insight static-host UX is harsh when a snapshot is older than 8 h; consider stale-but-labelled display.
5. Workflow ownership is spread across tabs; this report should be kept current when datasets migrate.

