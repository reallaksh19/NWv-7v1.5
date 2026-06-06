# Insight Angle RCA

Date: 2026-05-30
Scope: Deep-Dive C fixes for low visible angle diversity in real Insight snapshot output.

## Baseline

Input report: `public/newsdata/real_insight_quality_report.json`

| Metric | Baseline |
|---|---:|
| Grade | C |
| Parent clusters | 10 |
| Total stories | 703 |
| Average visible angles | 1.5 |
| Multi-angle parents | 5 |
| Strong-angle parents | 0 |
| Weak parents | 0 |

The main failure mode is not child capacity. The tree allows up to 7 children and 3 children per angle, but many candidate pools collapse into `base_report` or near-duplicate vectors before recovery can add new perspectives.

## Root Causes

| Cause | Evidence | Fix in this pass |
|---|---|---|
| Angle classifier threshold and narrow signals | Real parents often have only one visible angle even when multiple child stories exist | Lowered `classifyAngle` threshold from 1.3 to 0.9 and expanded regional bureau/government patterns |
| Fixed vocabulary misses Indian/local terms | Indian political/local stories had sparse vectors | Added India/Gulf/civic/legal/sports/aviation terms plus lightweight token expansions for abbreviations and inflections |
| Info-gain gate was too high for useful same-source updates | One new numeric fact from same source/angle landed around 0.10 and was rejected at 0.16 | Lowered default `MIN_CHILD_INFO_GAIN` to 0.10 and rounded computed gain to stable thousandths |
| Recovery pool can be exhausted | Recovery cannot add angles that classifier/vectors never expose | Added tests around classifier, embeddings, and info-gain prerequisites |

## Implemented Changes

| File | Change |
|---|---|
| `src/adapters/embeddingsAdapter.js` | Added India-specific vocabulary and domain token expansions such as `cm -> chief, minister` |
| `src/insight/src/dedup/dedup.ts` | Lowered classifier threshold to `0.9`; added bureau/local government signals |
| `src/insight/src/types/index.ts` | Lowered default `MIN_CHILD_INFO_GAIN` to `0.10` |
| `src/insight/src/tree/treeBuilder.ts` | Exported and rounded `computeInformationGain` for stable certification |
| `src/insight/src/dedup/dedup.angleClassifier.cert.test.ts` | Added official response and expert analysis coverage |
| `src/adapters/embeddingsAdapterVocab.cert.test.js` | Added India coverage and unrelated-event similarity coverage |
| `src/insight/src/tree/treeBuilderInfoGain.cert.test.ts` | Added 0.10 same-source update gate coverage |
| `src/adapters/insightSnapshotFetcher.liveVsStatic.cert.test.js` | Certified age-based snapshot slotting and >48 h exclusion |

## Measurement Notes

Post-fix measurement:

```bash
npm.cmd run test:real-insight-snapshot-quality
```

Result: PASS. The real snapshot improved from `avgAngles = 1.5` to `avgAngles = 1.8`, with multi-angle parents increasing from `5` to `8`. The ratchet threshold was tightened to `avgAngles >= 1.8` in `src/insight/src/quality/insightRealSnapshotQualityRatchet.ts`.

## Expected Outcome

| Metric | Baseline | Target after classifier/vocab | Target after info-gain |
|---|---:|---:|---:|
| Average visible angles | 1.5 | >= 1.8 | >= 2.2 |
| Strong-angle parents | 0 | >= 2 | >= 4 |
| Grade | C | B candidate | A/B candidate |
