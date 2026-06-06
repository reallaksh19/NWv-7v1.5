# Walkthrough Unit 11 — Following / Buzz / Topic

**Date:** 2026-05-30 · **Mode:** Auditor (identify & instruct)
**Scope:** Followed-topics state + notifications, watchlist, buzz ranking surface
**Files deep-read:** `context/TopicContext.jsx`, `hooks/useWatchlist.js` (+ buzz coverage carried from Units 2/4: `buzzRankingWeights`, `rssAggregator` social path, `buzzDataset` uses graceful `applyDatasetSlo`)

---

## Verdict

🟢 Topic refresh is **defensively coded** — `unwrapTopicEnvelope` accepts either an array or an envelope, errors keep the previous articles, dedup is canonicalized, and Buzz rides the (graceful) `applyDatasetSlo` dataset path.

🔴 The standout is a **false-notification engine**: update detection keys on `articles[0].id`, but topic news carries **ephemeral IDs (A-5)**, so every 15-minute auto-refresh looks like "new content" → spurious push notifications. Plus a state-timing race in `addTopic` and more `safeStorage`-bypassing writes.

---

## Findings & Instructions

| ID | Sev | Finding | Instruction |
|----|-----|---------|-------------|
| **T11-1** | Medium | **False "new update" notifications.** `checkForUpdates` decides a topic changed when `newArticles[0].id !== oldArticles[0].id`. Topic news comes through the news fetch path whose IDs are **ephemeral** (A-5: `rss-${idx}`/`Date.now()`), so the top ID changes on *every* fetch → the 15-min interval fires `sendNotification` for topics that didn't actually change. | Fix A-5 (stable content-hash IDs) **or** change detection to compare a set/hash of article URLs (not `[0].id`), and only notify when genuinely new URLs appear. |
| **T11-2** | Medium | **`addTopic` state-timing race.** After `setFollowedTopics(nextTopics)` it does `setTimeout(() => refreshTopics(false), 50)`. `refreshTopics` closes over the *old* `followedTopics` state, relying on a 50 ms guess that the re-render landed; the just-added topic can be missing from the closure → not fetched on first refresh. | Pass the new topic list explicitly: `refreshTopics(false, nextTopics)` instead of depending on closure + magic delay. |
| **T11-3** | Medium | **Read-modify-write race on settings (F2-9).** `addTopic` calls `getSettings()` → `addFollowedTopic()` (which itself `getSettings`→push→`saveSettings`) → `getSettings()` again — three round-trips; concurrent follows are last-writer-wins. | Make follow/unfollow a single atomic settings update (functional update against the latest stored value). |
| **T11-4** | Low | **Stale-closure effect.** The refresh effect deps on `[followedTopics.length]` with an `eslint-disable react-hooks/exhaustive-deps`. Replacing a topic (same count) won't re-trigger; the interval closes over a possibly-stale list. | Depend on a stable signature of the topic set (e.g., joined ids) and remove the disable; capture topics via ref if needed. |
| **T11-5** | Low | **`safeStorage` bypass (F1-6).** `useWatchlist` and the topic/history writes use raw `localStorage.setItem` with no quota guard, and `useWatchlist` has no cross-tab `storage` listener. | Route through `safeStorage.safeSetJson`; add a `storage`-event sync for the watchlist (Settings already does this). |

## What's good (keep)
- **`unwrapTopicEnvelope`** tolerantly accepts array-or-envelope and **preserves prior articles on failure** (graceful) — surfaces "some topic refreshes failed" without blanking the UI.
- **`topicNewsRef`** mirrors state so notification comparison reads a consistent snapshot.
- **Canonical topic dedup** (`canonicalTopicText` with Unicode-aware stripping) prevents duplicate follows.
- **Buzz** rides `buzzDataset` (graceful `applyDatasetSlo`) and the configurable `buzzRankingWeights`/`buzz` keyword scoring (Units 2/4) — degrades rather than vanishing.

## Evidence to run
`npm run test:following`, `test:following-migration`, `test:buzz-migration`, `test:hardening:release6P` (TechSocial binding), `test:hardening:release5FC` (Following binding). **Add**: a test that an unchanged topic refresh does **not** notify (T11-1).

## Cross-references
- T11-1 → **Unit 3** A-5 (ephemeral IDs — the root) and `utils/notifications.js`.
- T11-3 → **Unit 2** F2-9 (settings RMW race).
- T11-5 → **Unit 1** F1-6 (silent write failure).
- Buzz → **Unit 4** (social ranking), **Unit 6** F6-2 (graceful dataset).
