# Release 6T — Page-Orchestration Closeout Certification

## Purpose

Release 6T is a closeout certification phase. It does not change application behavior.

It verifies that active production pages no longer own data/context/service orchestration directly after the prior ViewModel-binding releases.

## Certified page set

- `src/pages/MainPage.jsx`
- `src/pages/InsightPage.jsx`
- `src/pages/WeatherPage.jsx`
- `src/pages/MarketPage.jsx`
- `src/pages/RefreshPage.jsx`
- `src/pages/TechSocialPage.jsx`
- `src/pages/NewspaperPage.jsx`
- `src/pages/UpAheadPage.jsx`
- `src/pages/MyPlannerPage.jsx`
- `src/pages/SettingsPage.jsx`
- `src/pages/FollowingPage.jsx`
- `src/pages/TopicDetail.jsx`
- `src/pages/MorePage.jsx`

## Certification rules

| Gate | Expected |
|---|---:|
| Active pages with direct context imports | 0 |
| Active pages with direct data service imports | 0 |
| Active pages with direct `fetch()` | 0 |
| Active pages with direct storage writes | 0 |
| Active pages with direct planner storage calls | 0 |
| Migrated pages using explicit ViewModel bindings | YES |
| Production pages modified in 6T | 0 |
| Service changes in 6T | 0 |
| Context changes in 6T | 0 |
| Dataset changes in 6T | 0 |
| New dependencies | 0 |
| Vite build | PASS |

## Required scripts

```json
"test:hardening:release6T": "node scripts/test_hardening_release6T_static.mjs",
"test:page-orchestration-closeout": "vitest run --config vitest.config.js src/pages/PageOrchestration.release6T.cert.test.jsx"
```

## Required commands

```bash
npm run test:hardening:release6T
npm run test:page-orchestration-closeout
npx vite build
npm run test:unit
git diff --name-only
git diff package.json
```

## Notes

`App.jsx` is treated as a provider shell. It may import provider components, but it must not own direct fetch/storage orchestration.

Page-specific fetch/cache/storage logic belongs in ViewModels, contexts, services, or adapters, not in production page components.
