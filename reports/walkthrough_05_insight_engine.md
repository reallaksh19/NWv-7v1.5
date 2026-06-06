# Walkthrough Unit 5 — Insight Engine

**Date:** 2026-05-30
**Auditor:** Claude (module-wise walkthrough)
**Scope:** The TypeScript insight pipeline (fetch→merge→dedup→cluster→rank→tree→quality), embeddings/NLP adapters, slot cache
**Files deep-read (5):**
`insight/src/pipeline/pipeline.ts`, `insight/src/tree/treeBuilder.ts`, `insight/src/cache/cacheManager.ts`, `adapters/embeddingsAdapter.js`, `adapters/nlpAdapter.js`
**Inventoried, deferred to a follow-up deep pass:** `dedup/dedup.ts`, `ranking/ranking.ts`, `cluster/cluster.ts`, `pipeline/normalize.ts`, `tree/{angleDiverseChildSelection,sourceDiverseChildSelection,usefulVariantRescue,angleDiversityRecovery}.ts`, `ranking/postTreeParentRerank.ts`, `diagnostics/*`, `quality/*`, insight snapshot adapters

---

## Verdict

🟢 **This is the most carefully-engineered subsystem in the app.** Greedy child selection driven by normalized information-gain and child-score formulas (weights sum to 1.0), explicit angle/source diversity, weak-tree detection and demotion, incremental updates, and *pervasive* diagnostics/explainability. It carries visible scars of prior hardening (`FIX H-2`, `M-5`, `H-4`) and even documents a previously-catastrophic embedding bug that it fixed.

🟠 Real findings are narrow: a **fixed-vocabulary embedding gap** that under-serves hyperlocal stories (notably **Trichy, which is missing from the 200-term vocab**), a **silent drop of new-event clusters in the incremental path**, and a **mutate-shared-objects** style that's fragile for React.

---

## Findings

| ID | Lens | Severity | Location | Finding |
|----|------|----------|----------|---------|
| F5-1 | Data integrity / Quality | Medium | `adapters/embeddingsAdapter.js:19-77` | **Fixed 200-term vocabulary → degenerate embeddings for out-of-vocab stories.** Vectors are TF-IDF projected onto a hardcoded 200-word list. Stories whose distinguishing terms aren't in the vocab produce near-/all-zero vectors, so cosine similarity is meaningless for them → weaker clustering, dedup, and information-gain. **`trichy`/`tiruchirappalli` are absent from the vocab** (though present in `nlpAdapter` `KNOWN_PLACES`) — directly weakens a flagship local section. Also, two unrelated stories sharing generic terms (`india`, `government`, `minister`) get spurious similarity. |
| F5-2 | Workflow gap | Medium | `pipeline/pipeline.ts:351-355` | **Incremental updates silently drop new-event clusters.** When a fresh "now" story matches no existing parent, the code comment says "Tag for next full run" but **nothing is actually tagged or stored** — it's a no-op. New breaking stories that form a *new* cluster won't surface via `applyIncrementalUpdate`; they wait for the next full `runInsightPipeline`. If full runs are infrequent, genuinely new events are invisible in between. |
| F5-3 | Bug risk (React) | Medium | `tree/treeBuilder.ts:590-594,652-654,789-791`; `pipeline.ts:331-333` | **Mutation of shared `InsightStory`/`InsightParent` objects as the API.** `buildChildTree` writes `s.angle`, `s.parentId`, `admittedBecause`, `childScore` onto the live story objects (and `applyIncrementalUpdate` pushes into `parent.clusterStoryIds` then returns a shallow `{...existingResult}`). Works today, but mutating objects held in React state and returning a shallow copy is fragile (stale-closure / missed-render hazards) and contrasts with `cacheManager`'s clean non-mutating spread. |
| F5-4 | Performance | Low | `pipeline.ts:246-292` | **Full child-tree construction for every ranked parent before slicing to `TOP_PARENTS`.** `selectTopParentsWithWeakTreeCheck` runs `buildChildTree` + source-diversity repair + quality scoring on *all* ranked parents, then keeps the top N. Weak-tree demotion needs some look-ahead, but this over-computes when `ranked ≫ TOP_PARENTS`. |
| F5-5 | Bug risk | Low | `treeBuilder.ts:491-494,666` (depends on `dedup.ts`) | **Zero-vector cosine similarity.** With F5-1, OOV stories yield zero vectors; `cosineSimilarity(0,0)` is `0/0`. If `dedup.ts` doesn't guard this, it returns `NaN`, which would poison `redundancyPenalty`/downgrade logic. Verify the guard in the deferred `dedup.ts` read. |
| F5-6 | Duplication | Info | `insight/src/dedup/dedup.ts` (`cosineSimilarity`, `eventSimilarity`) | **Third similarity/dedup engine** in the codebase (after `utils/similarity.js` and `intelligence/deDuplication.js`). Different inputs (embeddings vs tokens) justify some separation, but it compounds the "which dedup is authoritative?" problem (cross-ref F4-2). |
| F5-7 | Caching | Info | `insight/src/cache/cacheManager.ts:15` | **Fourth cache layer** (in-process `Map`, per-slot TTL + tolerance + stale penalty). It is *lost on reload* (browser SPA), rebuilt from snapshot JSON. Good design — but adds to the four-layer cache stack (F4-12). |

## Detailed notes

### F5-1 — the embedding vocabulary gap
The fixed-vocab approach is a deliberate, sound choice for static hosting (no embedding API, guaranteed 200-dim vectors so `cosineSimilarity`'s length check passes). The file's own header explains it replaced a version where *every* pair scored ~0.99 (which deleted everything during dedup) — so this is already a hard-won improvement. The residual issue is **coverage**: 200 curated terms can't represent hyperlocal or long-tail stories, and the vocab omits terms the rest of the app treats as first-class (Trichy). Practical effect: the Insight tab's clustering/diversity quality is best for national/business/markets stories and weakest for the local sections the product otherwise prioritizes. Options: expand/category-balance the vocab, add a hashing-trick fallback dimension for OOV tokens, or fall back to token-Jaccard when both vectors are near-zero.

### F5-2 — the incremental no-op
This is a genuine functional gap, not a style issue. The intent ("don't disrupt current output; pick it up next full run") is reasonable, but because nothing is recorded, there's no guarantee the next full run is triggered promptly, and no "N new stories pending" signal for the UI. At minimum, push unmatched stories to a `pendingNewParents` list on the result and surface a "new stories available" affordance.

### What's good (keep)
- **Embedding dimension safety + documented prior-bug fix** — the header comment is exemplary institutional memory.
- **Normalized scoring** — `computeInformationGain` (0.3/0.4/0.3 − 0.1) and `computeChildScore` (sums to 1.0) are clean and tunable.
- **`cacheManager` graceful staleness** — per-slot `TTL + tolerance`, with a freshness penalty applied (non-mutatingly) to stories in the tolerance band, plus `needsPrewarm` background refresh. **This is the exact pattern the data-foundation cache (F1-1) should adopt.**
- **Explainability everywhere** — `childSelectionDiagnostics`, `rejectionCounts`, `admittedBecause`, `diversityTieBreaks`, `weakTreeMetrics`, `postTreeQualityDiagnostics`. Auditing ranking decisions is first-class.
- **`nlpAdapter`** dictionary/regex NER is a pragmatic, API-free fit for static hosting and *does* include Trichy/Tamil Nadu places.

## Recommended fixes (priority order)
1. **F5-2** make the incremental new-cluster path record pending stories (and surface them).
2. **F5-1** close the embedding vocab gap (esp. local terms) or add an OOV fallback.
3. **F5-5** confirm/guard zero-vector cosine in `dedup.ts`.
4. **F5-3** move toward immutable story/parent updates in the pipeline.
5. **Lift `cacheManager`'s TTL+tolerance model into the data-foundation cache (F1-1).**

## Coverage note
Deep-read the orchestrator, tree builder, embeddings/NLP adapters, and slot cache — enough to validate the architecture and answer the central "do the embeddings/similarity actually work?" question (they do, with the vocab caveat). The ranking, dedup, cluster, normalize, tree-variant, post-tree-rerank, and quality-gate modules are inventoried and flagged for a dedicated follow-up pass before sign-off; they are extensively cert-tested (`test:insight-*`, `test:real-insight-snapshot-quality`), which lowers their risk.

## Evidence to run
`npm run test:real-insight-snapshot-quality`, `test:insight-e2e-quality`, `test:insight-source-diversity-guard`, `test:insight-runtime-quality-gate`. These exercise the deferred modules and would catch regressions in the formulas above.

## Cross-references
- F5-1 → **Unit 8** (Trichy is a first-class location elsewhere), **Unit 2** F2-8 (location set drift).
- F5-6 → **Unit 4** F4-2 (now three dedup engines total).
- F5-7 / cacheManager → **Unit 1** F1-1 (adopt this TTL model).
