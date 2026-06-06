# Action Plan — 3 Deep-Dives
**Date:** 2026-05-30 | **Mode:** Auditor — identify, instruct, measure; no code changes unless noted
**Reference data used:** `public/newsdata/real_insight_quality_report.json` (regenerated 2026-05-30), all 14 walkthrough reports, coverage addendum, implementation log (19 commits, 141 tests, 0 lint errors, 363 kB bundle).

---

## Baseline sanity (verify before starting each dive)

```bash
npm.cmd run test:unit      # must be 141 files / 787 tests — PASS
npm.cmd run lint           # must be 0 errors / 14 warnings
npm.cmd run build          # must pass; index chunk ≤ 365 kB
npm.cmd run test:certify:smoke  # must pass
```

If any baseline is red, **stop and restore green before proceeding.**

---

## Deep-Dive A — GitHub Workflow / LIVE Modes × Every Tab

### Purpose
Produce a definitive Tab × Mode matrix: which workflow feeds what, the full source ladder per tab, where static-host and live-runtime diverge, and which tabs have coverage gaps.

### Background: the two runtimes
`runtimeCapabilities.js` (`src/runtime/runtimeCapabilities.js`) computes a single object at boot that every dataset, context, and service reads:

```js
// The key flags consumed app-wide:
isStaticHost        // true → GitHub Pages / Netlify / Vercel
preferSnapshots     // same as isStaticHost
allowWideFeedFetch  // !isStaticHost
canUseBackendApi    // configuredBackendUrl OR (!isStaticHost && isBrowser)
weatherMode         // 'cache-or-snapshot' | 'live'
marketMode          // 'snapshot-first' | 'live'
upAheadMode         // 'limited-live' | 'full-live'
plannerSyncMode     // 'local-only' | 'remote-capable'
```

Static-host = GitHub Pages (production). Live = localhost dev + any non-static host.

### Workflows that produce static snapshots

| Workflow | File | Cron (UTC → IST) | Writes to |
|----------|------|------------------|-----------|
| `news_prefetch.yml` | 14 steps | `30 1-13 * * *` + nights | `public/newsdata/insight_latest.json`, `sections_latest.json`, quality reports |
| `market_refresh.yml` | Python worker | `*/30 3-10 * * 1-5` (market hours) + weekends | `public/data/market_snapshot.json`, `market_metrics.json`, `mutual_fund_snapshot.json`, `fx_snapshot.json`, `source_health.json` |
| `daily_brief.yml` | Python script | `0 1,7,13 * * *` | `public/data/epaper_data.json` |
| `upahead_refresh.yml` | Python/Node | `30 0-16 * * *` | `public/data/` Up Ahead items |
| `travel-local-news.yml` | Node | `0 */6 * * *` | `public/data/travel-local-*.json` |
| `weather_refresh.yml` (**NEW A-13**) | Python | `0 */3 * * *` | `public/data/weather_snapshot.json` |
| `insight-real-snapshot-quality.yml` | Node | `41 2,14 * * *` | Quality reports only |
| `ci.yml` | Node | on push | Lint, build, tests — no data written |
| `certification.yml` | Node | on push | Cert gates — no data written |

**Gap confirmed:** No weather workflow existed before A-13 → weather_snapshot.json was 13 months stale.

### Audit tasks for Deep-Dive A

#### A-1. Map every tab to its source ladder
For each route read the relevant dataset loader + context + view-model and determine:

| Tab / Route | Static-host path | Live path | Workflow | Fallback if both fail |
|-------------|-----------------|-----------|----------|-----------------------|
| Main (`/`) | `mainDataset` → `sectionsDataset` → `public/newsdata/sections_latest.json` | `rssAggregator.fetchSectionNews` → live RSS | `news_prefetch.yml` | Empty state |
| Insight (`/insight`) | `insightDataset` → `public/newsdata/insight_latest.json` (≤8 h old) | `insightFetcher` → live pipeline | `news_prefetch.yml` | Empty state |
| Market (`/markets`) | `MarketContext` → `public/data/market_snapshot.json` | `indianMarketStableService` → Yahoo Finance | `market_refresh.yml` | `MARKET_SEED` |
| Weather (`/weather`) | `WeatherContext` → `public/data/weather_snapshot.json` (≤48 h guard) | `weatherService` → Open-Meteo | `weather_refresh.yml` | Stale-cache then empty |
| Up Ahead (`/up-ahead`) | `upAheadDataset` → prefetched JSON | `intelligentUpAheadFetcher` + `feedSourceRegistry` | `upahead_refresh.yml` | Empty state |
| Newspaper (`/newspaper`) | `newspaperDataset` → `public/data/epaper_data.json` | `virtualPaperService` → live RSS | `daily_brief.yml` | Live RSS |
| Planner (`/my-planner`) | `plannerDataset` → `localStorage` | `plannerStorage.sync()` | None (local-only) | localStorage read |
| Following (`/following`) | `followingDataset` → settings/localStorage | `topicService` → RSS | None (local-only) | Last seen articles |
| Buzz/Tech (`/tech-social`) | `buzzDataset` → prefetched sections | `rssAggregator` social | `news_prefetch.yml` | Empty state |
| Refresh (`/refresh`) | N/A | Force-triggers all loaders | None | N/A |
| DataHealth (`/data-health`) | Reads `diagnosticsStore` | Reads `diagnosticsStore` | None | N/A |
| Settings (`/settings`) | `localStorage` | `localStorage` + optional `/api/settings` | None | Defaults |

**Files to read deeply:**
- `src/viewModels/useInsightTabViewModel.js` — full loader decision tree
- `src/adapters/insightSnapshotFetcher.js` — snapshot age guard logic
- `src/data/datasets/insightDataset.js` — which path is chosen
- `src/data/datasets/sectionsDataset.js` — prefetch vs live branch
- `src/services/intelligentUpAheadFetcher.js` — Up Ahead live path

#### A-2. Map where static-host and live diverge (data-integrity risk)
**Known divergences to verify:**
1. **Categorizer** — static-host uses Python prefetch categories; live uses JS `classification.classifyItemCategory`. Must match (F2-7 fixed JS; check Python parity).
2. **Date keys** — A-4 fixed JS; verify Python workers use the same `YYYY-MM-DD` local convention.
3. **Story IDs** — A-5 fixed JS stable FNV IDs; verify snapshot IDs are stable across regenerations.
4. **Insight age-slotting** — `insightSnapshotFetcher` re-slots stories by `Date.now() - publishedAt` (not by Python fetch slot). This is by design but means slot boundaries drift with time since last snapshot.
5. **Freshness guard** — `allowStale=false` in snapshot fetcher rejects snapshots >8 h old. On static-host, if the workflow fails, the tab goes empty rather than showing stale. Is this the right UX?

**Test to add for A-2:**
```js
// src/adapters/insightSnapshotFetcher.liveVsStatic.cert.test.js
it('uses age-based slotting not Python slot metadata', () => {
  // Story with publishedAt = 3h ago → slot 'minus4h'
  // Story with publishedAt = 10h ago → slot 'minus12h'
  // Story with publishedAt = 20h ago → slot 'minus24h'
  // Story with publishedAt = 50h ago → excluded (> MAX_STORY_AGE_HOURS=48)
});
```

#### A-3. Identify remaining workflow gaps
- **Planner/Following sync** — no server-side workflow; data is localStorage-only on static host (`plannerSyncMode: 'local-only'`). If user clears storage, all custom data is lost. No backup mechanism.
- **Topic news** — `TopicContext` fetches live RSS every 15 min regardless of mode. No prefetch. On a slow/offline connection the Following tab will show no content.
- **No CI freshness gate** — there's no workflow step that fails if any `public/data/*.json` snapshot exceeds its domain max-age. Recommend adding a nightly staleness check (mirrors what A-13 added for weather).

**Deliverable:** `reports/MODE_MATRIX.md` — Tab × Mode table with source ladder, workflow, cadence, freshness guard, live/static divergences. Ranked gap list.

---

## Deep-Dive B — RSS / Proxy / Alternatives Per Section

### Purpose
Inventory every feed URL, proxy chain, and fallback for every tab/section. Surface single-points-of-failure, duplicate proxy pools, sections with no alternatives.

### The three proxy stacks (already confirmed, needs matrix)

| Stack | Used by | Proxies | Timeout | Cooldown | Health |
|-------|---------|---------|---------|----------|--------|
| `proxyManager` | Main/News RSS, Up Ahead | allorigins → corsproxy → codetabs → rss2json | 8 s (AbortController ✅ A-10) | 5–60 min per proxy | `getProxyHealth()` |
| Market proxy pool | `indianMarketStableService` | allorigins → corsproxy → codetabs | 12 s (AbortController — check!) | None (no cooldown) | None |
| Direct fetch | `weatherService` | None (Open-Meteo direct) | No timeout! | N/A | None |

**Critical gap:** `weatherService.fetchSingleModel` calls `fetch(url)` with **no timeout and no abort**. If Open-Meteo is slow, the weather tab hangs indefinitely. A-10 fixed `fetchClient` but `weatherService` has its own fetch calls.

**Fix instruction for an implementing agent:**
```js
// src/services/weatherService.js
// BEFORE (line ~134):
const response = await fetch(`${baseUrl}?${params}`);

// AFTER — add timeout:
import { fetchWithTimeout } from '../utils/withTimeout.js';
const response = await fetchWithTimeout(`${baseUrl}?${params}`, { timeoutMs: 15000 });
```
**Test:** `src/services/weatherServiceTimeout.cert.test.js` — assert that a hanging Open-Meteo fetch is aborted after 15 s and triggers stale-cache fallback.

### News section feed inventory

| Section | Feed URLs | Count | Proxy | If all fail |
|---------|-----------|-------|-------|-------------|
| world | BBC top, BBC world, Al Jazeera, Google News IN, Google News US | 5 | proxyManager | Empty |
| india | Google TN, NDTV, The Hindu national, TOI | 4 | proxyManager | Empty |
| chennai | Google Chennai, The Hindu Chennai | 2 | proxyManager | **SPOF risk** |
| trichy | The Hindu Trichy, DT Next, Google Trichy | 3 | proxyManager | Empty |
| local (Muscat/Oman) | Times of Oman, Muscat Daily, Oman Observer, Google Muscat EN+OM | 5 | proxyManager | Empty |
| business | Google Business search, ET, Moneycontrol, Livemint, BBC Business, CNBC | 6 | proxyManager | Empty |
| technology | Google Tech search, Gadgets360, TechCrunch, The Verge | 4 | proxyManager | Empty |
| sports | ESPN | **1** | proxyManager | **SPOF — single feed** |
| entertainment | BollywoodHungama, BBC Entertainment, HT Tamil, HT Telugu, PinkVilla | 5 | proxyManager | Empty |
| social | 2 Google News searches | 2 | proxyManager | Empty |

**Highest-risk:** sports = 1 feed. If ESPN is down or rate-limited, sports section is empty. Recommend 2 more feeds (e.g., CricBuzz RSS, Sportskeeda).

**Lowest quality:** social = 2 generic Google searches with no editorial curation.

### Up Ahead feed governance
`feedSourceRegistry.js` has a per-category × per-location map with health-demotion (>50% failures → weight 0). On static host, feeds are trimmed to top 3 by priority score. The `intelligentUpAheadFetcher` calls `recordFeedResult` → feeds health monitor correctly.

**Gap to verify:** Does `buildFeedFetchPlan` always produce ≥1 source per category even after health-demotion? If all 3 trimmed sources have weight=0, the plan for that category is empty and Up Ahead silently shows nothing.

**Test instruction:**
```js
// src/intelligence/feedSourceRegistry.feedDepleted.cert.test.js
it('returns empty plan when all sources for a category are demoted', () => {
  // All sources health-weight = 0 → plan is []
  // The calling code should then fall back to prefetch
});
```

### Market feed resilience
`indianMarketStableService` has its own 3-proxy array but **no `AbortController` on the Yahoo Finance calls**. Each `fetch(proxyUrl + yahooUrl)` can hang. The 12-second `LIVE_MARKET_BUNDLE_TIMEOUT_MS` is in a `Promise.race` but the underlying socket is never aborted. This is the same bug A-10 fixed for `fetchClient` but this file was not touched.

**Fix instruction:**
```js
// src/services/indianMarketStableService.js
// Line ~180 (inside fetchWithProxy):
// BEFORE:
const response = await fetch(proxyUrl + encodedUrl);

// AFTER:
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 12000);
try {
  const response = await fetch(proxyUrl + encodedUrl, { signal: controller.signal });
  // ... rest of code
} finally {
  clearTimeout(timeoutId);
}
```

**Test:** `src/services/marketServiceTimeout.cert.test.js` — stale-cache fallback fires when proxy fetch is aborted.

### Deliverable
`reports/SOURCE_PROXY_MATRIX.md` — Section × Sources table (primary feeds, count, proxy path, alternatives, SPOF flag) + proxy-architecture diagram + ranked resilience-gap list.

---

## Deep-Dive C — Insight Quality: Why ≤2 Angles?

### Measured data (real_insight_quality_report.json — 2026-05-30)

```
Grade:          C  (signal score 54/100)
Parents:        10 clusters
Stories:        703 total, 652 after dedup
avgAngles:      1.5  ← the problem
avgChildren:    2.2
multiAngle:     5/10 parents have ≥2 visible angles
strongAngle:    0/10 have ≥3 visible angles
lowAngle:       5/10 have only 1 visible angle
weakParents:    0  (none flagged weak)
```

**Angle distribution per parent (from report):**
| Parent | angles array | childCount |
|--------|-------------|-----------|
| Air India San Francisco | [base_report, fact_update] | 3 |
| Delhi dowry death | [base_report, fact_update] | 2 |
| Israel strike | [base_report, official_response] | 2 |
| Siddaramaiah resign | [base_report, fact_update] | 2 |
| Russian lawmakers/banks | [official_response, fact_update] | 2 |
| Belgium bus-train | [base_report] | 3 — **3 children, only 1 angle** |
| Iran nuclear deal | [fact_update] | 2 |
| TN CM Mekedatu | [regional_followup] | 2 |
| PM Modi heatwave | [base_report] | 2 |
| Karnataka Congress | [base_report] | 2 |

**Recovery attempt:** The runtime quality gate relaxed `MIN_CHILD_INFO_GAIN` from 0.16→0.08 and tried to recover — result: **same grade C, same avgAngles 1.5.** The recovery didn't help.

### Root-cause analysis

The system has `MAX_CHILDREN_PER_PARENT: 7`, `MAX_PER_ANGLE: 3`, recovery targeting **4** visible angles — yet 5/10 parents show only 1 angle. Here is the causal chain:

#### Cause 1 (Primary): Angle classifier assigns `base_report` to ~70-80% of stories

The `classifyAngle` function in `dedup.ts` assigns a specific angle only when signal-score ≥ 1.3. Most Indian news RSS headlines lack the specific signal phrases (e.g., "spokesperson said", "shares rose 3%", "according to leaked documents") that trigger official_response, market_reaction, investigative_detail etc.

**How to verify:**
```js
// Run this against insight_latest.json to measure the real base_report rate
const stories = require('./public/newsdata/insight_latest.json').stories;
const angleDist = {};
stories.forEach(s => {
  const a = s.angleHints?.[0]?.angle || s.storySignals?.angleHints?.[0]?.angle || 'no_hint';
  angleDist[a] = (angleDist[a] || 0) + 1;
});
console.log(angleDist);
```

**Expected finding:** >70% of stories have no angle hint → all become `base_report` → all children compete for 1 slot (`MAX_PER_ANGLE: 3` caps at 3 per angle, but if all are `base_report`, only `base_report` fills the tree).

**Fix instruction — lower the angle classifier threshold and expand signal lists:**
```ts
// src/insight/src/dedup/dedup.ts  classifyAngle()
// Line 807: if (best && best.score >= 1.3)
// CHANGE TO:
if (best && best.score >= 0.9)  // was 1.3; lowering admits softer signals

// Also expand REGIONAL_SIGNALS to include Indian bureau names:
const REGIONAL_SIGNALS = [
  // ... existing ...
  /chennai bureau/i, /trichy correspondent/i, /muscat desk/i,
  /state government of/i, /tamil nadu government/i,
  /oman gov/i, /district collector/i,
];
```

**Test requirement (Red before fix, Green after):**
```ts
// src/insight/src/dedup/insightAngleClassifier.cert.test.ts
it('classifies official bureau statement as official_response at score 0.9', () => {
  const story = makeStory({ title: 'Oman government said new infrastructure plan announced' });
  expect(classifyAngle(story)).toBe('official_response');
});
it('classifies expert commentary as expert_analysis', () => {
  const story = makeStory({ title: 'Analysts warn India inflation may hit 6% next quarter' });
  expect(classifyAngle(story)).toBe('expert_analysis');
});
it('avgAngles rises above 1.5 after threshold change (regression gate)', () => {
  // Run full pipeline on insight_latest.json stories
  // Assert avgAngles >= 1.8 (a reachable target)
});
```

#### Cause 2: Fixed 200-term embedding vocabulary (F5-1) — weak for Indian news

The `embeddingsAdapter` projects onto a 200-term TF-IDF vocabulary. Indian political names (Modi, Siddaramaiah, Vijay etc.), Tamil cinema, and local civic terms are almost all OOV → near-zero vectors → cosine similarity cannot distinguish Indian stories → dedup over-merges OR information-gain is computed as near-zero (new source, but embedding says "same story").

**How to verify:**
```js
// Check vocab coverage for a typical Indian story:
const { getEmbeddings } = require('./src/adapters/embeddingsAdapter.js');
const testText = 'CM Siddaramaiah resigns Congress supports DK Shivakumar Bengaluru';
const [vec] = await getEmbeddings([testText]);
const nonZero = vec.filter(v => v > 0).length;
console.log('Non-zero dimensions:', nonZero, '/ 200');
// Expected: 3-5 non-zero (only 'congress' and 'support*' match vocab)
```

**Fix instruction — add 30-50 India-specific terms to FIXED_VOCAB:**
```js
// src/adapters/embeddingsAdapter.js  FIXED_VOCAB
// Add to the array (keeping total ≤250 for perf):
'modi', 'bjp', 'congress', 'siddaramaiah', 'kolkata', 'bengaluru', 'chennai',
'tamil', 'kollywood', 'bollywood', 'ipl', 'bcci', 'sensex', 'nifty',
'tangedco', 'tneb', 'civic', 'corporation', 'municipality', 'cyclone',
'monsoon', 'pongal', 'diwali', 'eid', 'protest', 'bandh', 'strike',
'verdict', 'petition', 'bail', 'chargesheet', 'fir',
'muscat', 'oman', 'dubai', 'gulf', 'rupee', 'crore', 'lakh'
```

**Test requirement:**
```js
// src/adapters/embeddingsAdapterVocab.cert.test.js
it('Indian political story has ≥10 non-zero embedding dimensions', async () => {
  const text = 'CM Siddaramaiah resigns Congress supports new CM Bengaluru';
  const [vec] = await getEmbeddings([text]);
  const nonZero = vec.filter(v => v > 0).length;
  expect(nonZero).toBeGreaterThanOrEqual(10);
});
it('two Indian stories about different events have cosine similarity < 0.7', async () => {
  const [v1] = await getEmbeddings(['CM Siddaramaiah resigns Congress party Bengaluru']);
  const [v2] = await getEmbeddings(['Air India flight returns Delhi technical snag']);
  const sim = cosineSimilarity(v1, v2);  // import from dedup.ts
  expect(sim).toBeLessThan(0.7);
});
```

#### Cause 3: `MIN_CHILD_INFO_GAIN: 0.16` gates out legitimate 2nd-angle stories

`computeInformationGain` formula (weights: 0.3 newFacts + 0.4 newAngle + 0.3 newSource):
- If a story brings a **new angle** but same source and no new numbers → gain = 0.4
- If a story brings **same angle, same source, but new numbers** → gain = 0.3 + smallFacts score

A `fact_update` story from the same outlet as `base_report` scores ~0.3 × (newFacts/3) + 0 (same angle) + 0 (same source) ≈ 0.05–0.15 → **below the 0.16 threshold → rejected**.

This explains the Belgium bus story: 3 children admitted, all `base_report`, because other-angle stories from the same small source pool couldn't pass the info-gain gate.

**Fix instruction:**
```ts
// src/insight/src/tree/treeBuilder.ts  DEFAULT_CONFIG
// CHANGE: MIN_CHILD_INFO_GAIN: 0.16 → 0.10
// (still above zero; won't admit pure duplicates, just removes the over-aggressive gate)
// Also in types/index.ts DEFAULT_CONFIG:
MIN_CHILD_INFO_GAIN: 0.10,  // was 0.16
```

**Also expose this as a tunable in the quality recovery config:**
```ts
// src/insight/src/diagnostics/insightRuntimeQualityGate.ts
// Already uses MIN_CHILD_INFO_GAIN: 0.08 in recovery config → confirm 0.10 is the right default
```

**Test requirement:**
```ts
// src/insight/src/tree/treeBuilderInfoGain.cert.test.ts
it('admits fact_update story from same source at gain 0.10 threshold', () => {
  // Base story already selected as base_report
  // Candidate: same source, new numbers (e.g. "death toll rises to 5")
  // At threshold 0.16: rejected. At 0.10: admitted.
  const gain = computeInformationGain(candidate, [baseChild], parent);
  expect(gain).toBeGreaterThan(0.10);
});
```

#### Cause 4: `angleDiversityRecovery` target is 4 but pool is exhausted

`recoverAngleDiversity` tries to add children until `MAX_CHILDREN_PER_PARENT` (7) is reached, filtering to stories with **new angles not already in `selected`**. But if:
- All remaining stories are `base_report` (Cause 1), or
- All remaining stories have embedding similarity >0.85 to already-selected children (downgraded in the selection loop), or
- All remaining stories have score ≤0 from `scoreAngleRecoveryCandidate` (because same-angle story scores −2)

→ Recovery exits without adding any new angles.

**This is confirmed by the quality report:** recovery config relaxed `MIN_CHILD_INFO_GAIN: 0.08`, and **still no improvement** — because the pool itself has no diverse-angle stories to recover from.

**Conclusion:** Fixes must happen at Causes 1+2 (classifier threshold + vocab). Fix 3 (info-gain gate) and Fix 4 (recovery config) are amplifiers. The right order is:

```
Priority 1: Expand embedding vocab (Cause 2) — unblocks good similarity scores
Priority 2: Lower classifier threshold to 0.9 (Cause 1) — admits more specific angles
Priority 3: Lower info-gain gate to 0.10 (Cause 3) — allows 2nd story per angle
Priority 4: Update recovery config default to match (Cause 4)
```

### Expected outcome after fixes (measurable targets)

| Metric | Current | Target after P1+P2 | Target after P3+P4 |
|--------|---------|-------------------|-------------------|
| avgAngles | 1.5 | ≥ 1.8 | ≥ 2.2 |
| strongAngleCount (≥3 angles) | 0 | ≥ 2 | ≥ 4 |
| Grade | C | C→B | B→A |

**How to measure after each fix:**
```bash
# 1. Regenerate real quality report (uses live snapshot):
npm.cmd run test:real-insight-snapshot-quality

# 2. The report is written to public/newsdata/real_insight_quality_report.json
# 3. Check avgAngles in that file
# 4. The ratchet gate (already in CI) fails if avgAngles < 1.4 — tighten to 1.8 after P2 lands:
```

**Ratchet tightening instruction** (after fixes verified):
```ts
// src/insight/src/quality/insightRealSnapshotQualityRatchet.cert.test.ts
// Find: required: ">= 1.4"
// Change: required: ">= 1.8"   // tighten after vocab + classifier fixes
```

### Full testing sequence for Deep-Dive C (implement in this order)

```bash
# 1. Vocab fix (embeddingsAdapter):
npm.cmd run test:unit -- src/adapters/embeddingsAdapterVocab.cert.test.js
npm.cmd run test:insight-e2e-quality

# 2. Classifier threshold (dedup.ts classifyAngle):
npm.cmd run test:unit -- src/insight/src/dedup/insightAngleClassifier.cert.test.ts
npm.cmd run test:certify:editorial

# 3. Info-gain gate (DEFAULT_CONFIG):
npm.cmd run test:unit -- src/insight/src/tree/treeBuilderInfoGain.cert.test.ts
npm.cmd run test:real-insight-snapshot-quality

# 4. Measure overall outcome:
cat public/newsdata/real_insight_quality_report.json | python -c "
import json, sys
r = json.load(sys.stdin)
print(f'avgAngles: {r[\"avgAngles\"]}')
print(f'strongAngle: {r[\"ratchetGate\"][\"summary\"][\"multiAngleCount\"]}')
print(f'grade: {r[\"grade\"]}')
"

# 5. Full suite must be green:
npm.cmd run test:unit   # count must not drop below 787
npm.cmd run lint        # 0 errors
npm.cmd run build       # pass
npm.cmd run test:certify:smoke
npm.cmd run test:certify:editorial
npm.cmd run test:real-insight-snapshot-quality
```

### What NOT to do
- Do **not** remove the `MIN_CHILD_INFO_GAIN` gate entirely (would admit true duplicates)
- Do **not** raise `MAX_PER_ANGLE` above 3 without testing (inflates parent with redundant stories)
- Do **not** lower the `HARD_DUP_EMBED_SIM` threshold (0.985) — dedup would stop catching actual duplicates
- Do **not** change `SAME_EVENT_THRESHOLD` (0.88) — clustering would break

---

## Remaining Phase D items (for implementing agent)

These three items from the original plan are **not yet started**. They should be done in order after the Deep-Dives above.

### D-10: De-orphan dead modules
**Files to delete (confirmed: zero imports in `src/`)**
- `src/services/crawlerService.js` (631 LOC, unreferenced)
- `src/data/loadWithPolicy.js` (133 LOC, unreferenced)
- `src/services/marketService.js` (dead market service)
- `src/services/indianMarketService.js` (dead market service)

**Process:**
```bash
# 1. Confirm zero imports:
grep -rn "crawlerService\|from.*loadWithPolicy\|from.*marketService['\"]" src/ --include="*.js" --include="*.jsx"
# Expected: 0 matches (excluding the files themselves and their cert tests)

# 2. Delete files and their cert tests:
rm src/services/crawlerService.js
rm src/data/loadWithPolicy.js  # keep loadWithPolicy.cert.test.js? → delete cert too since module gone
rm src/services/marketService.js
rm src/services/indianMarketService.js

# 3. Verify:
npm.cmd run test:unit  # count may decrease by cert tests deleted
npm.cmd run lint       # 0 errors
npm.cmd run build      # pass
```

**Test:** No new test needed — verify `grep` finds zero references. If any test fails, it was importing the dead module and needs to be updated.

### D-11: H0 root cleanup
Move to `archive/` (do not delete — may contain historical notes):
```
fix_*.py, extract*.py, fixer.py
code update v2_*.txt (4 files)
DebugConsole.jsx46 [RSS] Prefetched.txt
nwv-7.zip, release6P/Q/R/S_*.zip
zip_extracted/, backup file/, insight_files/
vite-verify*.log, *.err.log
UIupdate*.jpg (keep 1, remove dupes)
```
Delete (zero-byte garbage):
```
node (zero-byte)
"news-weather-app@1.0.0" (zero-byte)
```
**Then add to `.gitignore`:**
```
archive/
*.err.log
```

### D-12: S-2 exhaustive-deps (14 warnings)
**Files + sites (from current `npm run lint` output):**

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `DataHealthPanel.jsx` | 41 | `cacheVersion` unnecessary dep | Remove from deps array |
| `WeatherLocationManager.jsx` | 39,40 | `safeCities/safeOptions` conditionals | Wrap in own `useMemo` |
| `useMainTabViewModel.js` | 304 ×4 | `safeSettings` logical expr | `const safeSettings = useMemo(() => settings || {}, [settings])` |
| `useMainTabViewModel.js` | 305 | `sections` logical expr | Wrap in `useMemo` |
| `useMarketPageViewModel.js` | 125 | `marketSettings` logical expr | Wrap in `useMemo` |
| `useNewspaperTabViewModel.js` | 266 | `data` logical expr | Wrap in `useMemo` |
| `useShellRuntimeProps.js` | 18 | missing `runtime` dep | Add `runtime` to deps |
| `useUpAheadTabViewModel.js` | 235 ×2 | `settings` logical expr | Wrap in `useMemo` |
| `useUpAheadTabViewModel.js` | 239 | `data` logical expr | Wrap in `useMemo` |

**Pattern for all "logical expression" warnings:**
```js
// BEFORE (causes warning — object identity changes every render):
const safeSettings = settings || {};
const result = useMemo(() => compute(safeSettings), [safeSettings]);

// AFTER:
const safeSettings = useMemo(() => settings || {}, [settings]);
const result = useMemo(() => compute(safeSettings), [safeSettings]);
```

**Test:** After each file: `npx.cmd eslint <file>` → 0 errors. Final `npm.cmd run lint` → 0 warnings in addition to 0 errors.

---

## Deliverables checklist

| # | Item | Output file |
|---|------|-------------|
| DA-1 | `opinion_editorial` in ANGLE_DISPLAY_ORDER | ✅ committed `1f92ae7` |
| DA-8 | feedHealthMonitor dead conditionals | ✅ committed `1f92ae7` |
| DA-9 | postTreeParentRerank uses correct field names | ✅ committed `1f92ae7` |
| DA-10 | entertainmentService Fisher-Yates, filterNoise all regions, no unused cache | ✅ committed `1f92ae7` |
| A | Mode matrix | `reports/MODE_MATRIX.md` |
| B | Source/proxy matrix | `reports/SOURCE_PROXY_MATRIX.md` |
| C | Insight angle RCA + measured run | `reports/INSIGHT_ANGLE_RCA.md` |
| D-10 | De-orphan dead modules | In IMPLEMENTATION_LOG |
| D-11 | H0 root cleanup | In IMPLEMENTATION_LOG |
| D-12 | S-2 exhaustive-deps → 0 warnings | In IMPLEMENTATION_LOG |
