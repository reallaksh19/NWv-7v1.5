# Walkthrough Unit 12 — ViewModels, Pages & Shell UI

**Date:** 2026-05-30 · **Mode:** Auditor (identify & instruct)
**Scope:** App shell/routing/providers, error boundary, degraded-state UI components, the lint-confirmed VM/page issues, bundle
**Files deep-read:** `App.jsx` (Unit 1), `components/ErrorBoundary.jsx`, `components/data-state/DataStateBanner.jsx`, `DataFreshnessBadge.jsx` + the lint cluster across `viewModels/*` and `pages/*`

> Many granular items here are already in the **ledger** (B-1, B-2, S-1, S-2, A-9, GlobalLoader). This report confirms the shell-level picture and consolidates.

---

## Verdict

🟢 **The shell is well-structured.** Per-route `ErrorBoundary` with `resetKeys`/Retry, clean nested providers, and a genuinely good, accessible **degraded-state UI vocabulary** (`DataStateBanner`/`DataFreshnessBadge` handle `fresh/stale/empty/fallback/error` with proper `role`/`aria`).

🔴 The recurring theme: **good UI starved by the data layer, and a cluster of React-hook correctness issues.** The "may be stale" UX is ready but never fed (only Insight emits `STALE`), `SettingsPage` has rules-of-hooks violations, and the whole app ships in one 985 kB chunk.

---

## Findings & Instructions

| ID | Sev | Finding | Instruction |
|----|-----|---------|-------------|
| **V12-1** | High | **Degraded-state UI is ready but starved (UI half of F6-3/F6-4).** `DataStateBanner`/`DataFreshnessBadge` correctly render `stale → "may be stale" (warning)` and `empty/fallback/error`, but per Unit 6 **only `insightDataset` emits `STALE`**. So users see "fresh" or nothing; the honest "stale, last updated…" affordance never appears for 12/13 datasets. | No new UI needed — **fix the data layer (F6-3/F6-4)** so datasets emit `STALE` with an age, and this UI lights up automatically. Add `lastGoodAt`/age to the badge text. |
| **V12-2** | High | **985 kB single chunk (A-9).** `App.jsx` statically imports all 14 page components, so there's no route-level code-splitting (Vite explicitly warns). | `React.lazy()` + `<Suspense>` per route in `App.jsx`; keep vendor chunks. Expect a large first-load reduction. |
| **V12-3** | High | **`SettingsPage` rules-of-hooks ×2 (B-2).** `useState` inside `renderMainContent` (:679) and `renderBuzzContent` (:794). | Hoist those `useState`s to the `SettingsPage` component body (or extract real child components `MainTab`/`BuzzTab`). |
| **V12-4** | Medium | **`GlobalLoader` timer leak (Unit 1).** The `setVisible`/`setProgress` `setTimeout`s in `App.jsx` aren't captured/cleared; rapid loading toggles can land stale state. | Capture both timeouts in refs and clear them in the effect cleanup. |
| **V12-5** | Medium | **Hook-correctness cluster (S-1/S-2).** `set-state-in-effect` (`useDataset:98`, `useWeatherTabViewModel:111`, `useMyPlannerPageViewModel:132`) and ~10 `exhaustive-deps` warnings across VMs (`useShellRuntimeProps` missing `runtime`, `useMarketPageViewModel`, `useUpAheadTabViewModel`, `SettingsPage safeSettings ×4`). | Triage per site: convert derived-state-in-effect (weather active city) to render-time computation; wrap unstable `safeSettings`/`data` expressions in `useMemo`; fix or justify each dep array. |
| **V12-6** | Medium | **ErrorBoundary doesn't cover handler/async errors.** Per-route boundaries catch render/lifecycle only — so the B-1 planner-button `ReferenceError` (an `onClick`) crashes silently instead of showing the boundary. | Add a global `window.onerror`/`unhandledrejection` reporter (to `diagnosticsStore` + a toast) so handler/async failures are visible, not swallowed. |
| **V12-7** | Low | **Four files blanket-`/* eslint-disable */`** (`App.jsx`, `utils/dateExtractor.js`, `services/weatherService.js`, `components/ErrorBoundary.jsx`). The ErrorBoundary one is now **stale** (lint reports "unused directive"). | Remove blanket disables; the lint baseline (now clean-scoped) will show what's real. |
| **V12-8** | Low | **`react-refresh/only-export-components` ×8** on data-state/settings/weather components — they export `__…InternalsForTest` next to the component. Dev fast-refresh only. | Move test-internals to a sibling `*.internals.js`, or accept (no runtime impact). |

## What's good (keep)
- **`ErrorBoundary`** — `getDerivedStateFromError` + `componentDidCatch` logging + `resetKeys`-driven auto-reset + `onReset` + a real Retry button, applied **per route** with a `label`. Strong containment for render crashes.
- **`DataStateBanner`/`DataFreshnessBadge`** — small, accessible (`role=alert/status`, `aria-hidden` icons, `data-testid`), pure tone/message helpers with test internals. The right vocabulary — it just needs data (V12-1).
- **Provider composition** in `App.jsx` is clean and ordered; `pageAuditGrading` observability is wired into the VMs (in-app quality badges).
- **ViewModel pattern** (page/tab split) cleanly separates data shaping from rendering and is heavily cert-tested per release (6A→6T).

## Evidence to run
`npm run test:page-orchestration-closeout` (6T), `test:data-state-components`, `test:main-migration`, `test:settings-preference-binding`, and the per-page `release6*` binding suites. After V12-2, re-run `npm run build` to confirm the chunk drop.

## Cross-references
- V12-1 → **Unit 6** F6-3/F6-4, **Unit 7** M7-1, **Unit 8** W8-4 (the data-side fixes that feed this UI).
- V12-2 → Ledger **A-9**. V12-3 → **B-2**. V12-4 → **Unit 1**. V12-5 → **S-1/S-2**. V12-6 → **B-1**.
