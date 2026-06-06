# RCA — "God of War" trailer outranking an active war in Top Stories

**Date:** 2026-06-03
**Reporter:** observed on `reallaksh19.github.io/NWv-7/` (Top Stories, snapshot updated 03 Jun 07:13 pm)
**Severity:** High (editorial credibility) — a game-trailer "reveal" was ranked **#1**, above
*"West Asia war LIVE: U.S. military says it has 'defeated' Iran missile, drone attacks in Gulf"*.

---

## 1. Verdict

No — a *God of War: Laufey* gameplay-trailer reveal does **not** belong above a live regional war
with missile/drone strikes. The ranking is not a data glitch; it is the **designed behaviour** of the
scoring stack. The system has no concept of *public interest / severity / hard news*, and — the smoking
gun — it literally mistakes the **video-game franchise "God of War" for actual war news** and applies the
high-impact "War" boost intended for geopolitical conflict.

---

## 2. How "Top Stories" is produced

Even on the static GitHub Pages host, the prefetched snapshot is **re-scored in the browser** — the
snapshot does not carry a final rank.

```
prefetched section JSON
  → fetchSectionNews()                       src/services/rssAggregator.js:549
  → rankAndFilter() → computeImpactScore()    src/services/rssAggregator.js:942 / :288
  → deduplicateAndCluster() (consensus boost) src/utils/similarity.js:305
  → composeBalancedFeed() (freshness + diversity) src/services/frontPageComposer.js:8
  → filterLatestStories() RE-SORTS by raw impactScore  src/viewModels/useMainTabViewModel.js:45
  → NewsSection renders ★ rating + 🔥 TRENDING  src/components/NewsSection.jsx:127/170
```

Defaults that are active (`src/utils/storage.js:51-71`, `src/config/settings_news.js:2`):
`enableNewScoring:true`, `rankingMode:'smart'`, `customSortTopStories:true`,
`entertainmentBoost:2.5`, `weekendBoost:2.0`, `trending.threshold:12`, `viewedPenalty:0.4`,
`highImpactKeywords:['Budget','Election','Summit','Treaty','War','Crash','Landfall','Verdict','Resigns','Assassination']`.

---

## 3. Root causes (ranked)

### RC-1 (smoking gun) — "God of War" is scored as high-impact WAR news
The word **"War"** ships in two hard-coded relevance lists:

- `calculateImpactScore` high-impact keywords (`src/utils/storage.js:141`) → word-boundary match on
  `\bWar\b` applies a **2.5× `highImpactBoost`** (`src/utils/impactScorer.js:38-49`).
- `checkKeywords` `KEYWORDS` array (`src/services/rssAggregator.js:121-136`) contains `"war"`, matched
  as a **bare substring** (no word boundary) → adds **+2.0 `keywordBoost`** to core relevance
  (`rssAggregator.js:326-327`).

So *"**God of War** Laufey Revealed…"* receives the exact 2.5× multiplier **and** +2.0 boost that were
designed for *"West Asia **war**…"*. A games headline and a geopolitical-conflict headline get identical
"importance" credit. The scorer cannot tell a franchise title from a war.

### RC-2 — Final ordering throws away newsworthiness and section diversity
`filterLatestStories` (`useMainTabViewModel.js:39-64`, default `customSortTopStories:true`) re-sorts the
composed front page by **raw `impactScore` descending**, discarding the composer's freshness-decay rank
*and* its topic/geo diversity balancing (`frontPageComposer.js:30-83`). Whatever has the biggest multiplier
product wins slot #1 — full stop.

### RC-3 — `impactScore` is a content-agnostic product of multipliers with no severity axis
`computeImpactScore` (`rssAggregator.js:288-471`) multiplies:
`freshness × source × novelty × visual × humanInterest × proximity × entertainment/weekend × sectionPriority × breaking × live`.
There is **no factor** for casualties, conflict, governance, public safety, or "hard news." "Seven killed",
"missile", "drone attacks" carry **zero** dedicated weight. A war and a trailer are ranked on the same soft
axes (is it fresh? does it have a picture? does it use unusual words?).

### RC-4 — The geographic "impact" detector is India-centric and conflict-blind
`calculateImpactScore` scale regex only knows
`world|international|global|un|india|nation|state|tamil nadu…` (`impactScorer.js:12-18`). The headline
*"West Asia war … U.S. military … Iran missile, drone attacks in Gulf"* matches **none** of them →
`scaleScore = 1.0` (the floor). The magnitude detector only matches the literal words
`billions/millions/thousands/lakhs/crores` (`impactScorer.js:24-34`) → `magnitudeScore = 1.0`. A
Middle-East war is invisible to the very function named "impact."

### RC-5 — Soft-signal boosts inflate entertainment/visual/novel content
- **Visual** (`src/utils/visualScorer.js`): +15% image / +30% video. Trailers always ship art; the war
  card had **no image** → 1.0. The story with a picture wins purely for having a picture.
- **Novelty** (`src/utils/noveltyScorer.js`): up to **+50%** for "rare" tokens. *Laufey, Gameplay,
  Protagonist, Combat, Showcasing* are all novel → near-max boost. Importance ≠ rarity of wording.
- **Entertainment/weekend** (`rssAggregator.js:423-433`): 2.5× / 2.0× for entertainment/social/movies.

### RC-6 — Freshness is near-binary around the 12h inflection
Smart logistic decay holds full freshness until ~12h, then drops fast (`rssAggregator.js:300-302`). The
trailer (11h) sits **above** the inflection; the war (13h) **below** — a structural freshness edge unrelated
to importance. The composer's separate 6h-half-life re-rank (`temporalScorer.js`) is then **discarded** by
RC-2.

### RC-7 — Badges reinforce the error
"🔥 TRENDING" is merely `impactScore > 12` (`NewsSection.jsx:170`); the inflated soft score trivially earns
it. `breakingDetector` only fires for **<60-min-old, multi-source** items (`breakingNewsDetector.js:55-66`),
so a 13h war LIVE-blog never gets "⚡ Breaking" precedence over a high-scoring trailer.

---

## 4. Worked trace (why the trailer edged ahead)

| Signal | God of War (Gadgets360, tech, 11h, has image) | West Asia war (Hindu, world, 13h, no image) |
|---|---|---|
| `calculateImpactScore` scale | 1.0 (no scale word) | 1.0 (no scale word — **war/Iran/Gulf unknown**) |
| high-impact keyword (`\bWar\b`) | **2.5×** ("God of **War**") | 2.5× ("West Asia **war**") |
| `checkKeywords` (+2.0) | **yes** (substring "war") | yes ("war") |
| freshness (logistic, 12h half-life) | ~1.87 (above inflection) | ~1.13 (below inflection) |
| visual | ~1.15 (image) | **1.00 (no image)** |
| novelty | ~1.4–1.5 (Laufey/Gameplay/…) | ~1.1–1.25 |
| live boost | 1.0 | 1.5 ("LIVE") |
| sectionPriority | 1.0 (technology) | 1.5 (world) |

Both clear the 5-star threshold (`impactScore ≥ 18`) **because both get the 2.5× War boost**. The war's
`world`+`live` advantages are cancelled by its **missing image, lower novelty, and worse freshness**, so the
trailer wins the tie — and RC-2 makes that raw-score tie the final, visible order.

**Net:** the trailer didn't beat the war on merit; it tied it on the "War" keyword and then won on
freshness + a thumbnail + novel wording.

---

## 5. Recommended fixes (prioritized)

1. **Disambiguate franchise titles from real events (RC-1).** Word-boundary the `KEYWORDS` regex; add a
   small entity guard so known entertainment IPs ("God of War", "Call of Duty", "State of Play") don't
   trigger conflict keywords, or require a corroborating conflict token (killed/strike/military/missile) for
   the War boost.
2. **Stop discarding the composer's work (RC-2).** Make `customSortTopStories` rank by the
   freshness-decayed score (and keep diversity), not raw `impactScore`.
3. **Add a hard-news / severity signal (RC-3, RC-4).** Score casualty/conflict/governance terms
   (killed, dead, strike, attack, missile, war, election, court, evacuat*, outbreak) and known geographies
   (Iran, Gaza, Ukraine, Gulf, U.S., …) so geopolitical news isn't pinned at the 1.0 floor.
4. **Cap soft boosts for hard-news slots (RC-5).** Don't let visual/novelty/entertainment multipliers alone
   promote a story above severity-bearing news on the main Top Stories rail.
5. **Soften the 12h freshness cliff (RC-6)** and gate "🔥 TRENDING" on consensus/source-count, not a bare
   score threshold (RC-7).

---

## Appendix — final score shape
`total = (baseScore + buzzBoost) × impact × proximity × novelty × currency × humanInterest × visual ×
temporal × sectionPriority × breaking × live × seenPenalty × buzzFilterPenalty`
where `baseScore = (freshness + keywordBoost + sentimentBoost) × (1 + sourceScore·categoryWeight·tierBoost)`
(`src/services/rssAggregator.js:355-448`). None of these terms encode *importance to the reader*.
