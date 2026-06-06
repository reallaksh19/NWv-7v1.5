# Insight Behavior Tuning Plan

**Slice:** 11 — Behavior tuning plan only (no production behavior change)

**Production behavior changed:** No

---

## Current Insight problem statement

The insight pipeline produces trees with suboptimal child grouping, duplicate stories, and unclear ranking reasons. Before tuning any behavior, we must gather real diagnostics to understand root causes.

---

## Current relevant contracts

Key configuration constants that must NOT be changed until diagnostics are reviewed:

- `MIN_CHILD_INFO_GAIN` — minimum information gain for a child to be included in a tree
- `MAX_PER_SOURCE_GROUP` — maximum stories per source group in a tree
- `MAX_PER_ANGLE` — maximum stories per angle classification
- `MIN_SOURCES_PER_TREE` — minimum distinct sources required per tree
- `WEAK_TREE_CHILD_MIN` — minimum children for a weak tree to be kept
- `SAME_EVENT_THRESHOLD` — threshold for classifying two stories as the same event
- `POSSIBLE_EVENT_THRESHOLD` — threshold for classifying two stories as possibly the same event

Debug fields that must remain stable:
- `parent.debug.scoreBreakdown` — per-story score components
- `parent.debug.hiddenCount` — count of hidden/filtered stories
- `parent.debug.replacements` — replacement decisions log
- `capturedAtSnapshot` — snapshot timestamp for diagnostics

---

## Required diagnostic review before behavior tuning

Before any behavior change is made in Slice 15:
1. Collect a real snapshot using `capturedAtSnapshot`
2. Analyse `parent.debug.scoreBreakdown` to identify scoring anomalies
3. Analyse `parent.debug.hiddenCount` for over-filtering
4. Analyse `parent.debug.replacements` for incorrect replacement decisions
5. Report findings in the checkpoint below

---

## Behavior tuning sequence

### Slice 12 — Insight child-tree tuning only

Scope: adjust child-tree inclusion logic only. No dedup, ranking, or source changes.

### Slice 13 — Insight duplicate diagnostics hardening only

Scope: harden duplicate detection diagnostics. No tree selection or ranking changes.

### Slice 14 — Insight ranking reason clarity only

Scope: improve `scoreBreakdown` clarity for ranking reasons. No behavior changes.

### Slice 15 — First actual behavior tuning

Scope: One behavior change only. Must be justified by real diagnostics from Slices 12–14.

---

## Explicit non-goals

- Do not change DEFAULT_CONFIG before Slice 15 diagnostic review is complete
- Do not change dedup thresholds without confirmed diagnostic evidence
- Do not change ranking weights without a full scoreBreakdown analysis
- Do not change child tree selection until Slice 12 diagnostics are reviewed
- Do not change source fetching — source fetching is stable and out of scope
- Do not claim behavior is improved until real diagnostics prove it

---

## Review checklist before Slice 12

- [ ] Real snapshot collected via `capturedAtSnapshot`
- [ ] `parent.debug.scoreBreakdown` reviewed for at least 20 trees
- [ ] `parent.debug.hiddenCount` spike investigated
- [ ] `parent.debug.replacements` anomalies documented
- [ ] Checkpoint report filled in below

---

## Mandatory checkpoint report for executing agent

```
CHECKPOINT RESULT: [PASS|FAIL]
Snapshot reviewed: [yes/no]
scoreBreakdown anomalies: [description or none]
hiddenCount spikes: [description or none]
replacement anomalies: [description or none]
Recommended behavior change for Slice 15: [description or HOLD]
```
