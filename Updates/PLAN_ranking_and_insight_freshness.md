# Implementation Plan — Top Stories ranking (RC‑1…RC‑7) + Insight freshness

> **Audience:** an implementing agent who has NOT seen the earlier analysis.
> Follow phases **in order**. Every change is **config‑driven** (one policy file),
> **traceable** (every decision shows in the 📊 Story Intelligence modal), and
> **test‑gated** (each step ships a passing test). Do not invent new behavior —
> implement exactly what is written. All paths are repo‑relative.

---

## Context

Two production defects, both already root‑caused (see `Updates/RCA_top_stories_ranking.md`):

- **Top Stories** ranked a *"God of War" game‑trailer reveal* above a live war. The
  scorer mistakes the franchise word "War" for high‑impact news (RC‑1), the final
  sort throws away freshness/diversity (RC‑2), there is no severity axis (RC‑3), the
  geo detector is India‑centric (RC‑4), soft boosts inflate fluff (RC‑5), the 12 h
  freshness cliff is near‑binary (RC‑6), and the TRENDING badge is a bare score
  threshold (RC‑7).
- **Insight** served ~750‑min‑old "stale snapshot / fallback" data because the
  quality validator hard‑fails the publish job (INS‑1), the commit gate never
  advances `fetchedAt` when content is unchanged (INS‑2), and staleness uses a
  hidden hardcoded 8 h file‑age threshold (INS‑3).

**Goal:** make ranking and freshness *robust* (degrade gracefully, no silent drops),
*explicit* (all knobs in `config/ranking_policy.json` + `config/insight_policy.json`),
and *traceable* (Story Intelligence modal + Insight signal panel show the exact inputs,
weights, and decision for every item).

**Test commands used throughout**
```bash
python3 scripts/test_breaking_news_core.py          # existing, must stay green
npx vitest run <file>                                # JS unit/cert tests
npx eslint <changed files>                           # lint gate (must exit 0)
npm run build                                        # integration gate
```

---

## Phase 0 — Shared foundation (do this first; everything depends on it)

### 0.1 Single explicit policy file — `config/ranking_policy.json` (NEW)

This is the one place every ranking knob lives. Create it verbatim:

```json
{
  "version": 1,
  "freshness": { "model": "exponential", "halfLifeHours": 10, "longFormHalfLifeHours": 36 },
  "weights": {
    "freshnessMaxBoost": 3.0,
    "tier1Boost": 0.5, "localTierBoost": 0.25,
    "keywordMatchBoost": 2.0,
    "sentiment": { "positiveBoost": 0.5, "negativeBoost": 0.3 },
    "visual": { "videoBoost": 1.3, "imageBoost": 1.15 },
    "viewedPenalty": 0.4,
    "softBoostCap": 2.0
  },
  "highImpactKeywords": [
    { "term": "War", "requireSeverityContext": true },
    { "term": "Budget" }, { "term": "Election" }, { "term": "Summit" },
    { "term": "Treaty" }, { "term": "Crash" }, { "term": "Landfall" },
    { "term": "Verdict" }, { "term": "Resigns" }, { "term": "Assassination" }
  ],
  "severityLexicon": [
    "killed","dead","death toll","casualt","injured","wounded","strike","airstrike",
    "missile","drone attack","attack","explosion","blast","bombing","shooting",
    "earthquake","tsunami","cyclone","flood","wildfire","evacuat","outbreak",
    "invasion","ceasefire","coup","assassinat","resigns","impeach","verdict","derail","collapse"
  ],
  "entertainmentGuard": [
    "god of war","call of duty","state of play","gameplay","trailer","teaser",
    "box office","web series","season","episode","streaming","ott release"
  ],
  "geoScale": {
    "global": ["world","international","global","un","united nations","iran","gaza","israel",
               "ukraine","russia","gulf","west asia","middle east","u.s.","united states","china","nato"],
    "national": ["india","modi","parliament","nationwide","central govt","supreme court"],
    "regional": ["tamil nadu","kerala","karnataka","chennai","district","state"]
  },
  "severityBoost": 1.6,
  "trending": { "minDecayedScore": 12.0, "minSourceCount": 2 },
  "pins": { "breakingAlwaysTop": true, "breakingBypassMinImpact": true }
}
```

### 0.2 Policy loader — `src/config/rankingPolicy.js` (NEW)

Bundled defaults (no runtime fetch → works on static host + node tests). User
`settings.rankingWeights` still override at the leaf level.

```js
// src/config/rankingPolicy.js
import RAW from '../../config/ranking_policy.json';

export const DEFAULT_RANKING_POLICY = Object.freeze(RAW);

/** Merge user settings over the policy file. Settings win at the leaf. */
export function getRankingPolicy(settings = {}) {
  const w = settings.rankingWeights || {};
  return {
    ...DEFAULT_RANKING_POLICY,
    freshness: { ...DEFAULT_RANKING_POLICY.freshness, ...(w.freshness || {}) },
    trending: { ...DEFAULT_RANKING_POLICY.trending, ...(w.trending || {}) },
    // leaf overrides for the rest stay shallow on purpose (keep it simple)
    weights: { ...DEFAULT_RANKING_POLICY.weights },
  };
}

const norm = (s) => ` ${String(s || '').toLowerCase()} `;
const hasWord = (text, term) =>
  new RegExp(`\\b${String(term).toLowerCase().replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(text);

export function matchesEntertainmentGuard(text) {
  const low = norm(text);
  return DEFAULT_RANKING_POLICY.entertainmentGuard.some((g) => low.includes(` ${g} `) || low.includes(g));
}
export function severityHits(text) {
  const low = norm(text);
  return DEFAULT_RANKING_POLICY.severityLexicon.filter((t) => low.includes(t));
}
export function geoScaleScore(text) {
  const low = norm(text);
  const g = DEFAULT_RANKING_POLICY.geoScale;
  if (g.global.some((k) => low.includes(k))) return 1.5;
  if (g.national.some((k) => low.includes(k))) return 1.3;
  if (g.regional.some((k) => low.includes(k))) return 1.1;
  return 1.0;
}
export { hasWord };
```

> **Vite note:** importing JSON works out of the box. If `eslint` complains about the
> JSON import, add nothing — the repo already imports JSON (`section_sources` via Python only,
> but Vite handles JS‑side JSON). If a lint rule fires, change the import to
> `import RAW from '../../config/ranking_policy.json' assert { type: 'json' };` only if needed.

### 0.3 Always‑on, richer score breakdown (traceability backbone)

**File:** `src/services/rssAggregator.js`, `computeImpactScore` (~L451). Today the
breakdown is attached only when `debugLogs || overrideSettings`. Make it **always**
attach, and add the new factors so the modal can explain every decision.

```js
// REPLACE the `if (scoringSettings.debugLogs || overrideSettings) { item._scoreBreakdown = {...} }` block with:
item._scoreBreakdown = {
  freshness, sourceScore, categoryWeight, keywordBoost, sentimentBoost,
  impact: impactMultiplier, proximity: proximityMultiplier, novelty: noveltyMultiplier,
  currency: currencyMultiplier, visual: visualMultiplier, humanInterest: humanInterestMultiplier,
  severity: severityMultiplier,            // added in Phase 3
  sectionPriority, breakingBoost, liveBoost, seenPenalty, temporalMultiplier,
  total,
  decisions: item._rankDecisions || [],    // human-readable reasons, pushed by Phases 1/3/4
};
```

**File:** `src/utils/storyMeta.js`, `buildStoryInfoText`. Render the full breakdown +
the explicit formula + decision lines:

```js
if (includeScoreBreakdown && item?._scoreBreakdown) {
  const b = item._scoreBreakdown;
  const f = (x, d = 2) => Number(x ?? 0).toFixed(d);
  lines.push('');
  lines.push(`Ranking Score: ${f(item.impactScore)}`);
  lines.push(`Formula: (freshness + keyword + sentiment) x sourceMult x [impact*severity*novelty*visual*humanInterest] x section x breaking x live x seen`);
  lines.push(`Freshness: ${f(b.freshness)}`);
  lines.push(`Source Tier: ${f(b.sourceScore)} (cat ${f(b.categoryWeight)})`);
  lines.push(`Impact/Geo: ${f(b.impact)}`);
  lines.push(`Severity: ${f(b.severity, 2)}`);
  lines.push(`Novelty: ${f(b.novelty)}  Visual: ${f(b.visual)}  HumanInterest: ${f(b.humanInterest)}`);
  lines.push(`Section x: ${f(b.sectionPriority)}  Breaking x: ${f(b.breakingBoost)}  Live x: ${f(b.liveBoost)}  Seen x: ${f(b.seenPenalty)}`);
  if (Array.isArray(b.decisions) && b.decisions.length) {
    lines.push('');
    lines.push('Why this rank:');
    b.decisions.forEach((d) => lines.push(`• ${d}`));
  }
}
```

**Also** flip the call site so the breakdown shows for Top Stories by default.
**File:** `src/components/NewsSection.jsx` (~L113): it already sets
`hasScoreBreakdown = title === 'Top Stories' && Boolean(item._scoreBreakdown)`. With the
always‑on breakdown this now works without debug mode. No change needed beyond Phase 0.3.

**Test — `src/utils/storyMeta.breakdown.cert.test.js` (NEW):**
```js
import { describe, expect, it } from 'vitest';
import { buildStoryInfoText } from './storyMeta.js';
it('renders the score breakdown and decisions', () => {
  const text = buildStoryInfoText(
    { title: 'X', impactScore: 7.5, _scoreBreakdown: { freshness: 1.2, severity: 1.6, decisions: ['war boost suppressed: entertainment guard (god of war)'] } },
    { includeScoreBreakdown: true },
  );
  expect(text).toContain('Ranking Score: 7.50');
  expect(text).toContain('Severity: 1.60');
  expect(text).toContain('entertainment guard');
});
```
**Acceptance:** `npx vitest run src/utils/storyMeta.breakdown.cert.test.js` green.

---

## Phase 1 — RC‑1: stop scoring the game "God of War" as a war

**Root cause:** `KEYWORDS` (`rssAggregator.js:121`) matches `"war"` as a bare substring,
and `highImpactKeywords` (`storage.js:141`) matches `\bWar\b` → 2.5× boost. Both fire on
"God of **War**".

**Fix A — word‑boundary the static KEYWORDS regex.**
`src/services/rssAggregator.js:136`
```js
// BEFORE
const KEYWORDS_REGEX = new RegExp(KEYWORDS.join('|'), 'i');
// AFTER
const KEYWORDS_REGEX = new RegExp(`\\b(${KEYWORDS.join('|')})\\b`, 'i');
```

**Fix B — severity‑gate the high‑impact keyword in `calculateImpactScore`.**
`src/utils/impactScorer.js` — replace the keyword block so a guarded term ("War")
only boosts when real conflict context is present and the title is not an
entertainment IP.

```js
import { matchesEntertainmentGuard, severityHits, DEFAULT_RANKING_POLICY } from '../config/rankingPolicy.js';

// inside calculateImpactScore, replacing the settings.highImpactKeywords block:
let keywordMultiplier = 1.0;
const decisions = [];
const guarded = matchesEntertainmentGuard(text);
for (const entry of DEFAULT_RANKING_POLICY.highImpactKeywords) {
  const term = (entry.term || '').toLowerCase();
  if (!term) continue;
  const re = new RegExp(`\\b${term}\\b`, 'i');
  if (!re.test(text)) continue;
  if (entry.requireSeverityContext) {
    if (guarded) { decisions.push(`high-impact '${term}' suppressed: entertainment guard`); continue; }
    if (severityHits(text).length === 0) { decisions.push(`high-impact '${term}' suppressed: no severity context`); continue; }
  }
  keywordMultiplier = settings?.rankingWeights?.impact?.highImpactBoost || 2.5;
  decisions.push(`high-impact keyword '${term}' x${keywordMultiplier}`);
  break;
}
calculateImpactScore._lastDecisions = decisions; // surfaced by computeImpactScore (Phase 0.3)
return scaleScore * magnitudeScore * keywordMultiplier;
```
In `computeImpactScore` (rssAggregator), after calling `calculateImpactScore`, append:
```js
item._rankDecisions = [...(item._rankDecisions || []), ...(calculateImpactScore._lastDecisions || [])];
```

**Test — `src/utils/impactScorer.cert.test.js` (NEW):**
```js
import { describe, expect, it } from 'vitest';
import { calculateImpactScore } from './impactScorer.js';
it('does NOT apply the War boost to a game trailer', () => {
  const s = calculateImpactScore('God of War Laufey Revealed With Gameplay Trailer', 'Revealed at State of Play', {});
  expect(s).toBeCloseTo(1.0, 5);   // scale 1 * magnitude 1 * keyword 1
});
it('DOES apply the War boost to a real conflict headline', () => {
  const s = calculateImpactScore('West Asia war: Iran missile strike kills dozens in Gulf', '', { rankingWeights: { impact: { highImpactBoost: 2.5 } } });
  expect(s).toBeGreaterThanOrEqual(2.5);   // global geo 1.5 * keyword 2.5 (see Phase 4) ≥ 2.5
});
```
**Acceptance:** both cases pass; `npx vitest run src/utils/impactScorer.cert.test.js` green.

---

## Phase 2 — RC‑2: rank by decayed score + keep diversity (don't discard the composer)

**Root cause:** `filterLatestStories` (`useMainTabViewModel.js`) re‑sorts the composed
feed by **raw `impactScore`**, discarding freshness decay and section diversity.

**Fix:** rank by the temporal‑decayed score using the existing `temporalScorer`.
Breaking stays pinned (already implemented in Phase prior / current code).

`src/viewModels/useMainTabViewModel.js`
```js
import { temporalScore } from '../services/temporalScorer.js';
// inside filterLatestStories, replace the raw-impact sort:
const now = Date.now();
const decayed = (a) => temporalScore(a.impactScore || 0, a.publishedAt, now);
const sorted = [...stories].sort((a, b) => decayed(b) - decayed(a));
// (breaking pin + seen-demotion logic stays exactly as currently implemented)
```

**Test — `src/viewModels/useMainTabViewModel.rank.cert.test.js` (NEW):**
```js
import { describe, expect, it } from 'vitest';
import { __mainViewModelInternalsForTest } from './useMainTabViewModel.js';
const { filterLatestStories } = __mainViewModelInternalsForTest;
it('a slightly-lower-impact but much fresher story can outrank a stale one', () => {
  const now = Date.now();
  const stories = [
    { id: 'stale', impactScore: 20, publishedAt: now - 30 * 3600e3 },
    { id: 'fresh', impactScore: 16, publishedAt: now - 1 * 3600e3 },
  ];
  const out = filterLatestStories(stories, true);
  expect(out[0].id).toBe('fresh');
});
```
**Acceptance:** green; existing `useMainTabViewModel.cert.test.js` + `*.breaking.cert.test.js` stay green.

---

## Phase 3 — RC‑3 + RC‑4: add a severity axis + fix the conflict‑blind geo detector

**Root cause:** `impactScore` has no severity term, and the geo scale regex in
`impactScorer.js` is India‑centric → a Middle‑East war scores at the 1.0 floor.

**Fix A — geo from policy.** In `src/utils/impactScorer.js`, replace the hardcoded
scale regex with the policy lexicon:
```js
import { geoScaleScore } from '../config/rankingPolicy.js';
// replace the `let scaleScore = 1.0; if (/world|.../) ...` block with:
const scaleScore = geoScaleScore(text);
```

**Fix B — severity multiplier in `computeImpactScore`** (`rssAggregator.js`). Add a new
factor and fold it into `multipliers`:
```js
import { severityHits, matchesEntertainmentGuard, DEFAULT_RANKING_POLICY } from '../config/rankingPolicy.js';
// after the other multipliers:
const sevHits = matchesEntertainmentGuard(`${item.title} ${item.description}`)
  ? [] : severityHits(`${item.title} ${item.description}`);
const severityMultiplier = sevHits.length
  ? Math.min(DEFAULT_RANKING_POLICY.severityBoost ** Math.min(sevHits.length, 3), 5)
  : 1.0;
if (sevHits.length) item._rankDecisions = [...(item._rankDecisions || []), `severity: ${sevHits.join(',')} x${severityMultiplier.toFixed(2)}`];
// fold into the product:
const multipliers = impactMultiplier * proximityMultiplier * noveltyMultiplier *
  currencyMultiplier * humanInterestMultiplier * visualMultiplier * severityMultiplier;
```
(Expose `severityMultiplier` in `_scoreBreakdown.severity` — Phase 0.3 already lists it.)

**Test — `src/services/computeImpactScore.severity.cert.test.js` (NEW):**
```js
import { describe, expect, it } from 'vitest';
import { computeImpactScore } from './rssAggregator.js';
const base = (title) => ({ id: title, title, description: '', publishedAt: Date.now(), source: 'BBC' });
it('a casualty war story outranks a same-age game trailer', () => {
  const war = computeImpactScore(base('Iran missile strike kills dozens in Gulf'), 'world', 0, { enableNewScoring: true, rankingMode: 'smart' });
  const game = computeImpactScore(base('God of War Laufey gameplay trailer revealed'), 'technology', 0, { enableNewScoring: true, rankingMode: 'smart' });
  expect(war).toBeGreaterThan(game);
});
```
**Acceptance:** green. (This is the headline regression test for the whole RCA.)

---

## Phase 4 — RC‑5: cap soft boosts so fluff can't out‑climb hard news

**Root cause:** visual+novelty+humanInterest+entertainment multipliers can stack
without bound.

**Fix:** clamp the *soft* product (novelty × visual × humanInterest × entertainment
temporal) to `weights.softBoostCap` (default 2.0) in `computeImpactScore`:
```js
import { DEFAULT_RANKING_POLICY } from '../config/rankingPolicy.js';
const SOFT_CAP = DEFAULT_RANKING_POLICY.weights.softBoostCap || 2.0;
const softProduct = noveltyMultiplier * visualMultiplier * humanInterestMultiplier * temporalMultiplier;
const cappedSoft = Math.min(softProduct, SOFT_CAP);
if (softProduct > SOFT_CAP) item._rankDecisions = [...(item._rankDecisions || []), `soft boosts capped ${softProduct.toFixed(2)}→${SOFT_CAP}`];
// recompute total using cappedSoft instead of the raw soft factors:
const total = (baseScore + buzzBoost) * impactMultiplier * proximityMultiplier *
  currencyMultiplier * severityMultiplier * cappedSoft * sectionPriority *
  breakingBoost * liveBoost * seenPenalty * buzzFilterPenalty;
```
**Test — `src/services/computeImpactScore.softcap.cert.test.js` (NEW):** assert that a
story with image+video+novel words can never exceed `SOFT_CAP×` its no‑boost baseline.
**Acceptance:** green.

---

## Phase 5 — RC‑6: soften the 12 h freshness cliff (config‑driven half‑life)

**Root cause:** logistic decay in `computeImpactScore` is near‑binary at 12 h; the
composer's 6 h half‑life is separate and discarded.

**Fix:** drive both from `freshness.halfLifeHours` in policy. In `temporalScorer.js`
replace the constant with the policy value:
```js
import { DEFAULT_RANKING_POLICY } from '../config/rankingPolicy.js';
const HALF_LIFE_HOURS = DEFAULT_RANKING_POLICY.freshness.halfLifeHours;          // 10
const LONG_FORM_HALF_LIFE_HOURS = DEFAULT_RANKING_POLICY.freshness.longFormHalfLifeHours; // 36
```
And in `computeImpactScore`, swap the logistic block for the same exponential model so
there is **one** decay curve (no cliff, no double model):
```js
import { temporalScore } from './temporalScorer.js';
const freshness = temporalScore(maxBoost, item.publishedAt, Date.now()); // smooth half-life decay
```
**Test — `src/services/temporalScorer.cert.test.js` (NEW):** assert monotonic decay and
that 11 h vs 13 h differ by < 15% (no cliff). **Acceptance:** green.

---

## Phase 6 — RC‑7: TRENDING requires consensus + decayed score

**Root cause:** `NewsSection.jsx:170` shows 🔥 when `impactScore > 12` — raw, single‑source.

**Fix:** `src/components/NewsSection.jsx` — gate on policy.trending:
```js
import { getRankingPolicy } from '../config/rankingPolicy.js';
import { temporalScore } from '../services/temporalScorer.js';
const policy = getRankingPolicy(settings);
// replace the trending span condition:
const decayed = temporalScore(item.impactScore || 0, item.publishedAt, Date.now());
const isTrending = !item.isBreaking
  && decayed > policy.trending.minDecayedScore
  && (item.sourceCount || 1) >= policy.trending.minSourceCount;
{isTrending && <span className="mnc-badge mnc-badge--trending">🔥 Trending</span>}
```
**Test — `src/components/NewsSection.trending.cert.test.js` (NEW):** render‑free unit on a
small exported helper `computeTrending(item, policy, now)` (extract the boolean into a
pure function in `NewsSection.jsx` and export it) — assert single‑source high score is
NOT trending; 2‑source fresh high score IS. **Acceptance:** green.

---

## Phase 7 — Insight freshness (INS‑1, INS‑2, INS‑3)

### 7.1 INS‑1 — quality validation must NOT block the publish
**File:** `.github/workflows/news_prefetch.yml`. Add `continue-on-error: true` to the two
validate steps (mirror the existing benchmark step). Data always publishes; quality
reports remain artifacts.
```yaml
      - name: Validate Insight prefetch quality
        continue-on-error: true        # observability, NOT a deploy gate
        run: python scripts/validate_insight_prefetch_output.py
      - name: Validate Sections prefetch quality
        continue-on-error: true
        run: python scripts/validate_sections_prefetch_output.py
```

### 7.2 INS‑2 — heartbeat republish so `fetchedAt` advances
**New config — `config/insight_policy.json`:**
```json
{ "freshMaxAgeHours": 8, "staleMaxAgeHours": 48, "heartbeatMaxAgeHours": 3, "freshnessBasis": "maxStoryPublishedAt" }
```
**File:** `scripts/prefetch_commit_decision.py`. After computing `should_commit` from the
meaningful‑payload diff, OR‑in a heartbeat: if the on‑disk `insight_latest.json`
`fetchedAt` is newer than the last committed one by ≥ `heartbeatMaxAgeHours`, commit
anyway. Snippet (add near the final decision):
```python
import json, pathlib, subprocess
def _committed_fetched_at(path="public/newsdata/insight_latest.json"):
    try:
        blob = subprocess.run(["git","show",f"HEAD:{path}"],capture_output=True,text=True,check=True).stdout
        return int(json.loads(blob).get("fetchedAt",0))
    except Exception:
        return 0
def _disk_fetched_at(path="public/newsdata/insight_latest.json"):
    try: return int(json.loads(pathlib.Path(path).read_text()).get("fetchedAt",0))
    except Exception: return 0
HEARTBEAT_MS = 3*3600*1000
if not should_commit and (_disk_fetched_at() - _committed_fetched_at()) >= HEARTBEAT_MS:
    should_commit = True   # freshness heartbeat: republish even if clusters unchanged
```

### 7.3 INS‑3 — config‑driven, story‑based freshness + UI traceability
**File:** `src/adapters/insightSnapshotFetcher.js`. Replace the hidden constant and base
"fresh" on the **newest story**, not file write time. Fix the JSDoc drift.
```js
import POLICY from '../../config/insight_policy.json';
const H = 3_600_000;
const FRESH_MAX_AGE_MS = (POLICY.freshMaxAgeHours || 8) * H;
// inside loadInsightSnapshot, compute story-based age:
const newest = Math.max(0, ...(snapshot.stories || []).map(s => Number(s.publishedAt || 0)));
const fileAge = Date.now() - Number(snapshot.fetchedAt || 0);
const storyAge = newest ? Date.now() - newest : fileAge;
const effectiveAge = Math.min(fileAge, storyAge);      // fresh if EITHER file or stories are recent
if (!allowStale && effectiveAge > FRESH_MAX_AGE_MS) return null;
snapshot.freshnessMs = effectiveAge;                    // surfaced to UI
```
**File:** `src/pages/InsightPage.jsx:1267` already renders `Data from ~${freshnessMinutes} min ago`.
Add the source + threshold next to it (traceability):
```jsx
<span>{freshnessMinutes == null ? 'Freshness unknown'
  : `Data from ~${freshnessMinutes} min ago · source ${sourceLabel} · fresh<${POLICY.freshMaxAgeHours}h`}</span>
```
**Tests:**
- `src/adapters/insightSnapshotFreshness.cert.test.js` (NEW): a snapshot with old
  `fetchedAt` but a story published 20 min ago is **fresh**; all‑old → stale.
- `scripts/test_prefetch_commit_decision.py` (EXTEND existing): add a heartbeat case
  (unchanged clusters + `fetchedAt` advanced > 3 h → `should_commit == True`).
**Acceptance:** both green; `python3 scripts/test_prefetch_commit_decision.py` green.

---

## Phase order & dependencies
1. **Phase 0** (config + loader + breakdown) — blocks everything.
2. **Phase 1, 3, 4, 5** touch `impactScorer.js` / `rssAggregator.js` — do in this order
   to avoid merge churn (1 → 3 → 4 → 5).
3. **Phase 2, 6** consume the decay model from Phase 5 — do after 5.
4. **Phase 7** is independent of 0–6; can be done in parallel by a second agent.

## Verification (run before committing each phase)
```bash
npx vitest run src/utils/impactScorer.cert.test.js \
  src/services/computeImpactScore.severity.cert.test.js \
  src/services/computeImpactScore.softcap.cert.test.js \
  src/services/temporalScorer.cert.test.js \
  src/viewModels/useMainTabViewModel.rank.cert.test.js \
  src/components/NewsSection.trending.cert.test.js \
  src/utils/storyMeta.breakdown.cert.test.js \
  src/adapters/insightSnapshotFreshness.cert.test.js
python3 scripts/test_prefetch_commit_decision.py
python3 scripts/test_breaking_news_core.py        # must remain green
npx eslint <all changed files>                     # exit 0
npm run build                                      # exit 0
```

## Done‑definition (acceptance checklist)
- [ ] `config/ranking_policy.json` + `config/insight_policy.json` exist; **no scoring magic numbers remain** in `impactScorer.js`, `temporalScorer.js`, `NewsSection.jsx`, `insightSnapshotFetcher.js` (all read policy).
- [ ] Story Intelligence (ⓘ) on a Top Story shows freshness, geo/impact, **severity**, soft‑cap note, and "Why this rank" decision lines.
- [ ] Regression test (Phase 3) proves a casualty war story outranks a same‑age game trailer.
- [ ] "God of War" never receives the War boost (Phase 1 test).
- [ ] Insight publishes even when quality dips (INS‑1) and `fetchedAt` advances ≥3 h via heartbeat (INS‑2); UI shows age + source + threshold (INS‑3).
- [ ] All existing tests stay green; lint + build clean.
```
