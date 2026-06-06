/* eslint-disable */
import React, { useState } from 'react';
import Header from '../components/Header.jsx';
import { useShellRuntimeProps } from '../viewModels/useShellRuntimeProps';
// getRuntimeCapabilities is consumed via useShellRuntimeProps (showStaticHostBadge === isStaticHost)
import DataStateBoundary from '../components/DataStateBoundary.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import NewsdataRuntimeStatusPanel from '../components/NewsdataRuntimeStatusPanel.jsx';
import { getInsightBehaviorEvidence } from '../insight/src/diagnostics/insightBehaviorEvidence.ts';
import { DEFAULT_CONFIG } from '../insight/src/index.ts';
import { getInsightCoreQualityDiagnostics } from '../insight/src/diagnostics/insightCoreQuality.ts';
import '../styles/InsightPage.css';
import GradeBadge from '../components/audit/GradeBadge.jsx';
import { auditInsightTabQuality } from '../services/pageAuditGrading.js';
import { useInsightTabViewModel } from '../viewModels/useInsightTabViewModel.js';
import INSIGHT_POLICY from '../../config/insight_policy.json';

// ── Sub-components ────────────────────────────────────────────────────────────

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStoriesById(storiesById) {
  if (storiesById instanceof Map) return storiesById;
  if (storiesById && typeof storiesById === 'object') {
    return new Map(Object.entries(storiesById));
  }
  return new Map();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getInsightSourceLabel(source) {
  if (source === 'stale-snapshot') return 'Stale snapshot';
  if (source === 'snapshot') return 'Snapshot';
  if (source === 'cached') return 'Cached';
  if (source === 'dataset') return 'Dataset';
  if (source === 'unavailable') return 'Unavailable';
  if (source === 'failed') return 'Failed';
  return 'Live';
}

function formatInsightAge(timestamp) {
  if (!timestamp) return 'unknown age';

  const ageMs = Date.now() - Number(timestamp);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'unknown age';

  const hours = Math.max(0, Math.round(ageMs / (60 * 60 * 1000)));
  return `${hours}h ago`;
}

function getInsightEmptyStateMessage(result, source) {
  const runtimeReason = String(result?.runtimeQualityGate?.reason || '').trim();
  if (runtimeReason) return runtimeReason;

  if (source === 'unavailable') return 'No snapshot data is available and live feeds are not accessible on this host.';
  if (source === 'failed') return 'The data source failed to load. Check the diagnostics panel for details.';

  const diagnostics = result?.diagnostics || result?.coreDiagnostics || {};
  const storyCount = Number(diagnostics.storyCount || result?.storiesById?.size || 0);
  const sourceGroups = Number(diagnostics.sourceGroupCount || 0);
  const angleTypes = Number(diagnostics.visibleAngleTypeCount || diagnostics.angleTypeCount || 0);

  if (storyCount === 0) return 'No usable stories were available from the latest feed snapshot.';
  if (sourceGroups <= 1) return 'Insight clustering needs more source diversity; only one source group is currently available.';
  if (angleTypes <= 1) return 'Stories are available, but angle diversity is too low to build reliable insight clusters.';
  if (source === 'stale-snapshot') return 'Only stale snapshot data is available right now; retry after the next feed refresh.';

  return "Couldn't generate clusters from the latest news right now.";
}

const INSIGHT_SNAPSHOT_SLOTS = ['now', 'minus4h', 'minus12h', 'minus24h', 'minus36h', 'minus48h'];

function getStoryFromMap(storiesById, storyId) {
  return storiesById instanceof Map ? storiesById.get(storyId) : null;
}

function getStorySourceKey(story) {
  return story?.sourceGroup || story?.source || 'Unknown';
}

function getStoryAngleLabel(story) {
  return story?.angle || 'unknown';
}

const ANGLE_DISPLAY_LABELS = {
  base_report: 'Base report',
  official_response: 'Official response',
  market_reaction: 'Market reaction',
  fact_update: 'Fact update',
  expert_analysis: 'Expert analysis',
  regional_followup: 'Regional follow-up',
  correction: 'Correction',
  background_context: 'Background context',
  reaction_public: 'Public reaction',
  investigative_detail: 'Investigative detail',
  opinion_editorial: 'Opinion/editorial',
  unknown: 'Unknown angle'
};

function getAngleIcon(angle) {
  const key = String(angle || 'unknown').trim();
  const icons = {
    base_report: '📄',
    official_response: '📣',
    market_reaction: '📈',
    fact_update: '✅',
    expert_analysis: '🧠',
    regional_followup: '🗺️',
    correction: '✏️',
    background_context: '📚',
    reaction_public: '👥',
    investigative_detail: '🕵️',
    opinion_editorial: '✍️',
    unknown: '❓'
  };
  return icons[key] || '📝';
}

const SNAPSHOT_DISPLAY_LABELS = {
  now: 'Now',
  minus4h: '−4h',
  minus12h: '−12h',
  minus24h: '−24h'
};

function toSafeCssToken(value) {
  return String(value || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function formatAngleLabel(angle) {
  const key = String(angle || 'unknown').trim();
  return ANGLE_DISPLAY_LABELS[key] ||
    key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
}

function getStorySnapshotLabel(story) {
  const snapshot = story?.capturedAtSnapshot || 'unknown';
  return SNAPSHOT_DISPLAY_LABELS[snapshot] || 'Snapshot unknown';
}

function getStoryPublishedAtMs(story) {
  const value = story?.publishedAt || story?.timestamp || story?.date || story?.pubDate;

  if (value == null) return 0;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }

  const numeric = Number(value);

  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getStoryTimeLabel(story) {
  const publishedAt = getStoryPublishedAtMs(story);

  if (!publishedAt) return 'Live';

  const minutes = Math.max(0, Math.round((Date.now() - publishedAt) / 60000));

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function getStorySourceLabel(story) {
  return story?.source || story?.sourceGroup || 'Unknown source';
}

function getChildStoryDisplay(childId, child, index) {
  const angleRaw = getStoryAngleLabel(child);
  const angleLabel = formatAngleLabel(angleRaw);
  const snapshotLabel = getStorySnapshotLabel(child);
  const publishedLabel = getStoryTimeLabel(child);
  const sourceLabel = getStorySourceLabel(child);

  return {
    id: childId,
    index,
    title: child?.title || child?.summary || childId,
    sourceLabel,
    sourceTitle: child?.sourceGroup
      ? `${child?.source || 'Unknown source'} · ${child.sourceGroup}`
      : sourceLabel,
    url: child?.url || null,
    angleRaw,
    angleLabel,
    angleKey: toSafeCssToken(angleRaw),
    snapshotLabel,
    publishedLabel
  };
}

function getParentSnapshotMatches(parent, clusterStories) {
  const presence = parent?.snapshotPresence || {};

  return INSIGHT_SNAPSHOT_SLOTS.filter(slot => {
    if (presence[slot]) return true;
    return clusterStories.some(story => story?.capturedAtSnapshot === slot);
  });
}

function getParentAuditReason({
  childCount,
  angleCount,
  sourceGroupCount,
  snapshotCount,
  hiddenDuplicateCount,
  weakTree
}) {
  const reasons = [];

  if (childCount < DEFAULT_CONFIG.WEAK_TREE_CHILD_MIN) {
    reasons.push(`Child count ${childCount} is below weak-tree minimum ${DEFAULT_CONFIG.WEAK_TREE_CHILD_MIN}.`);
  }

  if (sourceGroupCount < DEFAULT_CONFIG.MIN_SOURCES_PER_TREE) {
    reasons.push(`Source diversity ${sourceGroupCount} is below minimum ${DEFAULT_CONFIG.MIN_SOURCES_PER_TREE}.`);
  }

  if (angleCount < 2) {
    reasons.push('Only one distinct angle is visible from selected child stories.');
  }

  if (snapshotCount < 2) {
    reasons.push('Story is not strongly represented across multiple snapshot windows.');
  }

  if (hiddenDuplicateCount > 0) {
    reasons.push(`${hiddenDuplicateCount} duplicate/near-duplicate item(s) were hidden.`);
  }

  if (weakTree) {
    reasons.push('Pipeline marked this cluster as a weak tree.');
  }

  if (reasons.length === 0) {
    reasons.push('No obvious audit blocker detected from the current output contract.');
  }

  return reasons;
}

function getInsightAuditRows(result) {
  const parents = safeArray(result?.parents);
  const storiesById = normalizeStoriesById(result?.storiesById);

  return parents.map((parent, index) => {
    const clusterStoryIds = safeArray(parent.clusterStoryIds);
    const childStoryIds = safeArray(parent.childStoryIds);
    const hiddenDuplicateIds = safeArray(parent.hiddenDuplicateIds);

    const clusterStories = clusterStoryIds
      .map(id => getStoryFromMap(storiesById, id))
      .filter(Boolean);

    const childStories = childStoryIds
      .map(id => getStoryFromMap(storiesById, id))
      .filter(Boolean);

    const sourceGroups = [...new Set(
      clusterStories.map(getStorySourceKey).filter(Boolean)
    )];

    const childSourceGroups = [...new Set(
      childStories.map(getStorySourceKey).filter(Boolean)
    )];

    const angleLabels = [...new Set(
      childStories.map(getStoryAngleLabel).filter(Boolean)
    )];

    const snapshotMatches = getParentSnapshotMatches(parent, clusterStories);

    const hiddenDuplicateCount = hiddenDuplicateIds.length ||
      Number(parent.debug?.hiddenCount || 0);

    const childCount = childStoryIds.length;
    const angleCount = angleLabels.length;
    const sourceGroupCount = sourceGroups.length;
    const snapshotCount = snapshotMatches.length;

    return {
      parentId: parent.parentId,
      rank: index + 1,
      headline: parent.canonicalHeadline || `Cluster ${index + 1}`,
      childCount,
      clusterCount: clusterStoryIds.length,
      hiddenDuplicateCount,
      angleLabels,
      sourceGroups,
      childSourceGroups,
      snapshotMatches,
      weakTree: Boolean(parent.weakTree),
      reasons: getParentAuditReason({
        childCount,
        angleCount,
        sourceGroupCount,
        snapshotCount,
        hiddenDuplicateCount,
        weakTree: Boolean(parent.weakTree)
      })
    };
  });
}

function getInsightAuditSummary(auditRows) {
  const total = auditRows.length;
  const singleAngle = auditRows.filter(row => row.angleLabels.length < 2).length;
  const weakTrees = auditRows.filter(row => row.weakTree).length;
  const lowSourceDiversity = auditRows.filter(row => row.sourceGroups.length < DEFAULT_CONFIG.MIN_SOURCES_PER_TREE).length;
  const lowSnapshotCoverage = auditRows.filter(row => row.snapshotMatches.length < 2).length;
  const hiddenDuplicates = auditRows.reduce((sum, row) => sum + row.hiddenDuplicateCount, 0);

  return {
    total,
    singleAngle,
    weakTrees,
    lowSourceDiversity,
    lowSnapshotCoverage,
    hiddenDuplicates
  };
}

function asFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatScore(value) {
  return asFiniteNumber(value).toFixed(2);
}

function formatPercent(value) {
  return `${Math.round(asFiniteNumber(value) * 100)}%`;
}

function countBy(items, mapper) {
  const counts = new Map();

  for (const item of items) {
    const key = mapper(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

function getScoreBreakdownEntries(parent) {
  const breakdown = parent?.debug?.scoreBreakdown || {};

  return Object.entries(breakdown)
    .filter(([key]) => key !== 'finalParentScore')
    .map(([key, value]) => ({
      key,
      value: asFiniteNumber(value),
      label: key
        .replace(/Score$/i, '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, char => char.toUpperCase())
    }))
    .sort((a, b) => b.value - a.value);
}

function getDuplicatePressureTone(hiddenDuplicateCount, clusterCount) {
  if (!clusterCount) return 'unknown';

  const ratio = hiddenDuplicateCount / Math.max(1, clusterCount);

  if (ratio >= 0.6) return 'high';
  if (ratio >= 0.3) return 'medium';
  return 'low';
}

function getRankingDiagnosticNotes(row) {
  const notes = [];

  if (row.scoreBreakdown.length === 0) {
    notes.push('Score breakdown is unavailable on this cluster.');
  } else {
    const top = row.scoreBreakdown.slice(0, 3).map(item => `${item.label} ${formatScore(item.value)}`).join(', ');
    notes.push(`Top ranking drivers: ${top}.`);
  }

  if (row.duplicatePressureTone === 'high') {
    notes.push(`High duplicate pressure: ${row.hiddenDuplicateCount} hidden duplicate(s) from ${row.clusterCount} cluster stories.`);
  } else if (row.duplicatePressureTone === 'medium') {
    notes.push(`Moderate duplicate pressure: ${row.hiddenDuplicateCount} hidden duplicate(s).`);
  }

  if (row.topSourceShare >= 0.67 && row.clusterCount >= 3) {
    notes.push(`Source concentration is high: ${row.topSource?.key || 'unknown'} contributes ${formatPercent(row.topSourceShare)} of cluster stories.`);
  }

  if (row.sourceGroupCount < DEFAULT_CONFIG.MIN_SOURCES_PER_TREE) {
    notes.push(`Source diversity is below configured minimum ${DEFAULT_CONFIG.MIN_SOURCES_PER_TREE}.`);
  }

  if (row.topAngleShare >= 0.75 && row.childCount >= 3) {
    notes.push(`Angle concentration is high: ${formatAngleLabel(row.topAngle?.key)} contributes ${formatPercent(row.topAngleShare)} of child stories.`);
  }

  if (row.weakTree) {
    notes.push('Weak-tree flag is active, so this cluster may be under-supported.');
  }

  if (row.replacements.length > 0) {
    notes.push(`${row.replacements.length} replacement event(s) recorded in tree debug.`);
  }

  if (notes.length === 0) {
    notes.push('No major duplicate/ranking pressure detected from current output.');
  }

  return notes;
}

function getInsightRankingDiagnosticRows(result) {
  const parents = safeArray(result?.parents);
  const storiesById = normalizeStoriesById(result?.storiesById);

  return parents.map((parent, index) => {
    const clusterStoryIds = safeArray(parent.clusterStoryIds);
    const childStoryIds = safeArray(parent.childStoryIds);
    const hiddenDuplicateIds = safeArray(parent.hiddenDuplicateIds);

    const clusterStories = clusterStoryIds
      .map(id => getStoryFromMap(storiesById, id))
      .filter(Boolean);

    const childStories = childStoryIds
      .map(id => getStoryFromMap(storiesById, id))
      .filter(Boolean);

    const sourceCounts = countBy(clusterStories, getStorySourceKey);
    const angleCounts = countBy(childStories, getStoryAngleLabel);

    const topSource = sourceCounts[0] || null;
    const topAngle = angleCounts[0] || null;

    const hiddenDuplicateCount = hiddenDuplicateIds.length ||
      Number(parent.debug?.hiddenCount || 0);

    const clusterCount = clusterStoryIds.length;
    const childCount = childStoryIds.length;

    const topSourceShare = topSource ? topSource.count / Math.max(1, clusterStories.length || clusterCount) : 0;
    const topAngleShare = topAngle ? topAngle.count / Math.max(1, childStories.length || childCount) : 0;

    const row = {
      parentId: parent.parentId,
      rank: index + 1,
      headline: parent.canonicalHeadline || `Cluster ${index + 1}`,
      finalParentScore: asFiniteNumber(parent.finalParentScore),
      scoreBreakdown: getScoreBreakdownEntries(parent),
      hiddenDuplicateCount,
      duplicatePressureTone: getDuplicatePressureTone(hiddenDuplicateCount, clusterCount),
      clusterCount,
      childCount,
      sourceCounts,
      angleCounts,
      topSource,
      topAngle,
      topSourceShare,
      topAngleShare,
      sourceGroupCount: sourceCounts.length,
      weakTree: Boolean(parent.weakTree),
      replacements: safeArray(parent.debug?.replacements)
    };

    return {
      ...row,
      notes: getRankingDiagnosticNotes(row)
    };
  });
}

function getInsightRankingDiagnosticSummary(rows) {
  return {
    clusters: rows.length,
    highDuplicatePressure: rows.filter(row => row.duplicatePressureTone === 'high').length,
    mediumDuplicatePressure: rows.filter(row => row.duplicatePressureTone === 'medium').length,
    highSourceConcentration: rows.filter(row => row.topSourceShare >= 0.67 && row.clusterCount >= 3).length,
    highAngleConcentration: rows.filter(row => row.topAngleShare >= 0.75 && row.childCount >= 3).length,
    weakTrees: rows.filter(row => row.weakTree).length,
    replacements: rows.reduce((sum, row) => sum + row.replacements.length, 0)
  };
}

function getInsightDiagnostics(result, source) {
  return getInsightCoreQualityDiagnostics(result, source, DEFAULT_CONFIG);
}

function ICard({ story, index, storiesById = new Map() }) {
  const [open, setOpen] = useState(false);
  const pct = Math.min(Math.round((story.finalParentScore || 0) * 100), 100);

  const clusterStoryIds = safeArray(story.clusterStoryIds);
  const childStoryIds = safeArray(story.childStoryIds);
  const isBreaking = story.isRising || false;
  const srcCount = clusterStoryIds.length || childStoryIds.length || 1;
  const timeAgo = 'Live';
  const sources = [...new Set(clusterStoryIds.map(id => String(id).split('-')[0] || 'Unknown'))].slice(0, 3);

  return (
    <div className={`icard ${open ? 'open' : ''}`} data-top="true">
      <div className="icard-top" onClick={() => setOpen(o => !o)}>
        <div className="irank">{String(index + 1).padStart(2, '0')}</div>
        <div className="ibody">
          <div className="imeta-row">
            <span className="isource">Cluster</span><span className="idot" />
            <span className="itime">{timeAgo}</span>
            {isBreaking && <span className="itag breaking">🔥 Rising</span>}
            {srcCount > 1 && <span className="itag multi">{srcCount} stories</span>}
            {story.weakTree && <span className="itag" style={{ background: '#78350f', color: '#fde68a' }}>⚠ Thin</span>}
          </div>
          <h3>{story.canonicalHeadline}</h3>
          <div className="iimpact">
            <div className="ibar"><span style={{ width: `${pct}%` }} /></div>
            <div className="ival">{(story.finalParentScore || 0).toFixed(2)}</div>
          </div>
          <div className="isrcs">{sources.map((s, i) => <span key={i} className="s">{s}</span>)}</div>
        </div>
        <button className="expand-btn" tabIndex={-1}>{open ? '−' : '+'}</button>
      </div>
      {open && (
        <div className="iexpand"><div className="iexpand-inner">
          <div className="exp-block">
            <div className="exp-label"><span className="dot" />Summary</div>
            <p className="exp-summary">{story.canonicalSummary}</p>
          </div>
          <div className="exp-block">
            <div className="exp-label"><span className="dot" style={{ background: 'var(--warn, #F0883E)' }} />Child Stories</div>
            <div className="src-list">
              {childStoryIds.length > 0 ? (
                childStoryIds.map((childId, i) => {
                  const child = storiesById.get(childId);
                  if (!child) return null;
                  const display = getChildStoryDisplay(childId, child, i);

                  return (
                    <div key={childId} className="src-item src-item--angle-aware">
                      <span className="sname" title={display.sourceTitle}>
                        {display.sourceLabel}
                      </span>

                      {display.url
                        ? (
                          <a
                            className="sdesc"
                            href={display.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                          >
                            {display.title}
                          </a>
                        )
                        : <span className="sdesc">{display.title}</span>
                      }

                      <span
                        className={`ang angle-chip angle-chip--${display.angleKey}`}
                        title={display.angleRaw}
                      >
                        {display.angleLabel}
                      </span>

                      <span className="stime" title="Captured snapshot">
                        {display.snapshotLabel}
                      </span>

                      <span className="stime" title="Published time">
                        {display.publishedLabel}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="src-item" style={{ opacity: 0.5, fontStyle: 'italic' }}>
                  <span className="sdesc">No additional angles found for this story</span>
                </div>
              )}
            </div>
          </div>
        </div></div>
      )}
    </div>
  );
}

function InsightDiagnosticsPanel({ diagnostics }) {
  return (
    <section
      className={`insight-diagnostics insight-diagnostics--${diagnostics.tone}`}
      data-insight-quality-grade={diagnostics.grade}
    >
      <div className="insight-diagnostics__summary">
        <div className="insight-diagnostics__grade">
          <span>Grade</span>
          <strong>{diagnostics.grade}</strong>
        </div>

        <div className="insight-diagnostics__body">
          <div className="insight-diagnostics__eyebrow">Insight quality</div>
          <h2>{diagnostics.title}</h2>
          <p>
            Signal score {diagnostics.signalScore}/100 · {diagnostics.rankedCount} ranked clusters · {diagnostics.storyCount} source stories.
          </p>

          <div className="insight-diagnostics__meta">
            <span>{diagnostics.sourceLabel}</span>
            <span>{diagnostics.coverageLabel} multi-angle clusters</span>
            <span>{diagnostics.avgAngles.toFixed(1)} avg angles</span>
          </div>
        </div>
      </div>

      <div className="insight-diagnostics__grid" aria-label="Insight diagnostics">
        <div className="insight-diagnostics__tile">
          <span>Ranked</span>
          <strong>{diagnostics.rankedCount}</strong>
        </div>
        <div className="insight-diagnostics__tile">
          <span>Stories</span>
          <strong>{diagnostics.storyCount}</strong>
        </div>
        <div className="insight-diagnostics__tile">
          <span>Rising</span>
          <strong>{diagnostics.risingCount}</strong>
        </div>
        <div className="insight-diagnostics__tile">
          <span>Multi-angle</span>
          <strong>{diagnostics.multiAngleCount}</strong>
        </div>
        <div className="insight-diagnostics__tile">
          <span>Single-angle</span>
          <strong>{diagnostics.lowAngleCount}</strong>
        </div>
        <div className="insight-diagnostics__tile">
          <span>Thin</span>
          <strong>{diagnostics.thinCount}</strong>
        </div>
      </div>

      <details className="insight-diagnostics__warnings">
        <summary>Diagnostic notes</summary>
        <ul>
          {diagnostics.warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function InsightAuditPanel({ auditRows }) {
  const summary = getInsightAuditSummary(auditRows);

  return (
    <section className="insight-audit" data-insight-audit-contract="source-angle-snapshot">
      <div className="insight-audit__header">
        <div>
          <div className="insight-audit__eyebrow">Source audit</div>
          <h2>Why angles may be thin</h2>
          <p>
            This panel audits the current Insight output only. It does not change ranking, dedup, source selection, or tree building.
          </p>
        </div>
      </div>

      <div className="insight-audit__summary-grid">
        <div className="insight-audit__summary-tile">
          <span>Clusters</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="insight-audit__summary-tile">
          <span>Single-angle</span>
          <strong>{summary.singleAngle}</strong>
        </div>
        <div className="insight-audit__summary-tile">
          <span>Weak trees</span>
          <strong>{summary.weakTrees}</strong>
        </div>
        <div className="insight-audit__summary-tile">
          <span>Low source div.</span>
          <strong>{summary.lowSourceDiversity}</strong>
        </div>
        <div className="insight-audit__summary-tile">
          <span>Low snapshots</span>
          <strong>{summary.lowSnapshotCoverage}</strong>
        </div>
        <div className="insight-audit__summary-tile">
          <span>Hidden dupes</span>
          <strong>{summary.hiddenDuplicates}</strong>
        </div>
      </div>

      <details className="insight-audit__details">
        <summary>Cluster-level audit</summary>

        <div className="insight-audit__rows">
          {auditRows.map(row => (
            <article
              key={row.parentId}
              className={`insight-audit__row ${row.weakTree ? 'insight-audit__row--weak' : ''}`}
              data-angle-count={row.angleLabels.length}
              data-source-group-count={row.sourceGroups.length}
              data-snapshot-count={row.snapshotMatches.length}
            >
              <div className="insight-audit__row-head">
                <span className="insight-audit__rank">{String(row.rank).padStart(2, '0')}</span>
                <strong>{row.headline}</strong>
              </div>

              <div className="insight-audit__badges">
                <span>{row.childCount} children</span>
                <span>{row.clusterCount} cluster stories</span>
                <span>{row.angleLabels.length} angle(s)</span>
                <span>{row.sourceGroups.length} source group(s)</span>
                <span>{row.snapshotMatches.length}/4 snapshots</span>
                <span>{row.hiddenDuplicateCount} hidden dupes</span>
              </div>

              <div className="insight-audit__chips">
                <div>
                  <span>Angles</span>
                  <strong>{row.angleLabels.join(', ') || 'none'}</strong>
                </div>
                <div>
                  <span>Snapshots</span>
                  <strong>{row.snapshotMatches.join(', ') || 'none'}</strong>
                </div>
                <div>
                  <span>Sources</span>
                  <strong>{row.sourceGroups.slice(0, 6).join(', ') || 'none'}</strong>
                </div>
              </div>

              <ul className="insight-audit__reasons">
                {row.reasons.map((reason, index) => (
                  <li key={`${row.parentId}-${index}`}>{reason}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}

function InsightRankingDiagnosticsPanel({ rows }) {
  const summary = getInsightRankingDiagnosticSummary(rows);

  return (
    <section className="insight-ranking-diagnostics" data-insight-ranking-diagnostics="duplicate-ranking">
      <div className="insight-ranking-diagnostics__header">
        <div>
          <div className="insight-ranking-diagnostics__eyebrow">Duplicate & ranking diagnostics</div>
          <h2>Why this cluster ranked here</h2>
          <p>
            This panel reads existing score breakdown, hidden duplicate, source concentration,
            and angle concentration signals. It does not change ranking or dedup behavior.
          </p>
        </div>
      </div>

      <div className="insight-ranking-diagnostics__summary-grid">
        <div className="insight-ranking-diagnostics__summary-tile">
          <span>Clusters</span>
          <strong>{summary.clusters}</strong>
        </div>
        <div className="insight-ranking-diagnostics__summary-tile">
          <span>High dupes</span>
          <strong>{summary.highDuplicatePressure}</strong>
        </div>
        <div className="insight-ranking-diagnostics__summary-tile">
          <span>Med dupes</span>
          <strong>{summary.mediumDuplicatePressure}</strong>
        </div>
        <div className="insight-ranking-diagnostics__summary-tile">
          <span>Source conc.</span>
          <strong>{summary.highSourceConcentration}</strong>
        </div>
        <div className="insight-ranking-diagnostics__summary-tile">
          <span>Angle conc.</span>
          <strong>{summary.highAngleConcentration}</strong>
        </div>
        <div className="insight-ranking-diagnostics__summary-tile">
          <span>Replacements</span>
          <strong>{summary.replacements}</strong>
        </div>
      </div>

      <details className="insight-ranking-diagnostics__details">
        <summary>Cluster ranking details</summary>

        <div className="insight-ranking-diagnostics__rows">
          {rows.map(row => (
            <article
              key={row.parentId}
              className={`insight-ranking-diagnostics__row insight-ranking-diagnostics__row--dupe-${row.duplicatePressureTone}`}
              data-duplicate-pressure={row.duplicatePressureTone}
              data-source-share={row.topSourceShare.toFixed(2)}
              data-angle-share={row.topAngleShare.toFixed(2)}
            >
              <div className="insight-ranking-diagnostics__row-head">
                <span className="insight-ranking-diagnostics__rank">{String(row.rank).padStart(2, '0')}</span>
                <div>
                  <strong>{row.headline}</strong>
                  <div className="insight-ranking-diagnostics__score">
                    Final score {formatScore(row.finalParentScore)}
                  </div>
                </div>
              </div>

              <div className="insight-ranking-diagnostics__badges">
                <span>{row.clusterCount} cluster stories</span>
                <span>{row.childCount} children</span>
                <span>{row.hiddenDuplicateCount} hidden dupes</span>
                <span>{row.sourceGroupCount} source groups</span>
                <span>{formatPercent(row.topSourceShare)} top source</span>
                <span>{formatPercent(row.topAngleShare)} top angle</span>
              </div>

              <div className="insight-ranking-diagnostics__breakdown">
                {row.scoreBreakdown.slice(0, 8).map(item => (
                  <div key={`${row.parentId}-${item.key}`} className="insight-ranking-diagnostics__score-row">
                    <span>{item.label}</span>
                    <div className="insight-ranking-diagnostics__meter">
                      <i style={{ width: `${Math.round(item.value * 100)}%` }} />
                    </div>
                    <strong>{formatScore(item.value)}</strong>
                  </div>
                ))}
              </div>

              <div className="insight-ranking-diagnostics__chips">
                <div>
                  <span>Sources</span>
                  <strong>
                    {row.sourceCounts.slice(0, 5).map(item => `${item.key}×${item.count}`).join(', ') || 'none'}
                  </strong>
                </div>
                <div>
                  <span>Angles</span>
                  <strong>
                    {row.angleCounts.slice(0, 5).map(item => `${formatAngleLabel(item.key)}×${item.count}`).join(', ') || 'none'}
                  </strong>
                </div>
              </div>

              {row.replacements.length > 0 && (
                <div className="insight-ranking-diagnostics__replacement-box">
                  <span>Replacement debug</span>
                  <ul>
                    {row.replacements.slice(0, 3).map((replacement, index) => (
                      <li key={`${row.parentId}-replacement-${index}`}>
                        {replacement.replacedId} → {replacement.replacedBy}: {replacement.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ul className="insight-ranking-diagnostics__notes">
                {row.notes.map((note, index) => (
                  <li key={`${row.parentId}-note-${index}`}>{note}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}

function InsightBehaviorEvidencePanel({ evidence }) {
  return (
    <section
      className={`insight-behavior-evidence insight-behavior-evidence--${evidence.status}`}
      data-insight-behavior-evidence="top-story-24h-angle-rescue"
    >
      <div className="insight-behavior-evidence__header">
        <div>
          <div className="insight-behavior-evidence__eyebrow">Behavior evidence</div>
          <h2>{evidence.summaryTitle}</h2>
          <p>
            Evidence from top-story anchoring, representative selection, diversity tie-breaks,
            useful variant rescue, 24h coverage, and angle classification.
          </p>
        </div>
      </div>

      <div className="insight-behavior-evidence__summary-grid">
        <div className="insight-behavior-evidence__summary-tile">
          <span>Clusters</span>
          <strong>{evidence.clusterCount}</strong>
        </div>
        <div className="insight-behavior-evidence__summary-tile">
          <span>Angles</span>
          <strong>{evidence.angleCount}</strong>
        </div>
        <div className="insight-behavior-evidence__summary-tile">
          <span>24h full</span>
          <strong>{evidence.full24hClusters}</strong>
        </div>
        <div className="insight-behavior-evidence__summary-tile">
          <span>Top anchor</span>
          <strong>{evidence.impactAnchoredClusters}</strong>
        </div>
        <div className="insight-behavior-evidence__summary-tile">
          <span>Diversity picks</span>
          <strong>{evidence.diversityTieBreaks}</strong>
        </div>
        <div className="insight-behavior-evidence__summary-tile">
          <span>Variant rescues</span>
          <strong>{evidence.usefulVariantRescues}</strong>
        </div>
      </div>

      <div className="insight-behavior-evidence__angles">
        {evidence.angleLabels.length > 0
          ? evidence.angleLabels.map(angle => (
            <span key={angle}>{formatAngleLabel(angle)}</span>
          ))
          : <span>No child angles detected</span>
        }
      </div>

      <details className="insight-behavior-evidence__details">
        <summary>Behavior evidence by cluster</summary>

        <div className="insight-behavior-evidence__rows">
          {evidence.parentRows.map((row, index) => (
            <article
              key={row.parentId}
              className="insight-behavior-evidence__row"
              data-snapshot-coverage={row.snapshotCoverage}
              data-angle-count={row.angleCount}
            >
              <div className="insight-behavior-evidence__row-head">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{row.headline}</strong>
              </div>

              <div className="insight-behavior-evidence__badges">
                <span>{row.snapshotCoverage} snapshots</span>
                <span>{row.angleCount} angle(s)</span>
                <span>{row.childCount} children</span>
                <span>{row.topStoryProminenceScore} top anchor</span>
                <span>{row.representativeScore} representative</span>
                <span>{row.diversityTieBreakCount} diversity picks</span>
                <span>{row.usefulVariantRescueCount} rescues</span>
              </div>

              <ul className="insight-behavior-evidence__notes">
                {row.notes.map((note, noteIndex) => (
                  <li key={`${row.parentId}-${noteIndex}`}>{note}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </details>

      <ul className="insight-behavior-evidence__notes insight-behavior-evidence__notes--summary">
        {evidence.notes.map((note, index) => (
          <li key={`behavior-note-${index}`}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

function InsightRuntimeQualityGatePanel({ runtimeQualityGate }) {
  if (!runtimeQualityGate) return null;

  return (
    <section
      className={`insight-runtime-quality insight-runtime-quality--${runtimeQualityGate.recovered ? 'recovered' : runtimeQualityGate.attempted ? 'attempted' : 'accepted'}`}
      data-insight-runtime-quality-gate="post-pipeline-recovery"
    >
      <div className="insight-runtime-quality__eyebrow">Runtime quality gate</div>
      <h2>
        {runtimeQualityGate.recovered
          ? 'Recovered Insight quality'
          : runtimeQualityGate.attempted
            ? 'Recovery attempted'
            : 'First-pass accepted'}
      </h2>
      <p>{runtimeQualityGate.reason}</p>
      <div className="insight-runtime-quality__meta">
        <span>Before: {runtimeQualityGate.before?.grade || '-'}</span>
        <span>After: {runtimeQualityGate.after?.grade || '-'}</span>
        <span>Avg angles: {Number(runtimeQualityGate.after?.avgAngles || 0).toFixed(1)}</span>
      </div>
    </section>
  );
}

function InsightQualityPopupButton({
  diagnostics,
  audit,
  runtimeQualityGate,
  auditRows,
  rankingRows,
  behaviorEvidence,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="insight-quality-popup"
      data-insight-quality-popup="ranking-icon"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <button
        type="button"
        className="insight-quality-popup__trigger"
        aria-label="Open Insight quality diagnostics"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        title="Insight quality diagnostics"
        style={{
          border: '1px solid rgba(139, 148, 158, 0.35)',
          background: 'rgba(13, 17, 23, 0.72)',
          color: 'var(--txt, #fff)',
          borderRadius: '999px',
          padding: '6px 10px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.78rem',
        }}
      >
        <span aria-hidden="true">🏅</span>
        <span>Rank</span>
        <strong>{diagnostics.grade}</strong>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="insight-quality-popup__backdrop"
            aria-label="Close Insight diagnostics"
            onClick={() => setOpen(false)}
          />
          <div
            className="insight-quality-popup__panel"
            role="dialog"
            aria-modal="true"
            aria-label="Insight quality diagnostics"
          >
          <div
            className="insight-quality-popup__head"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted, #9CA5B0)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Ranking quality
              </div>
              <strong>Insight diagnostics</strong>
            </div>

            <button
              type="button"
              aria-label="Close Insight quality diagnostics"
              onClick={() => setOpen(false)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--txt, #fff)',
                cursor: 'pointer',
                fontSize: '1.1rem',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <GradeBadge
              audit={audit}
              label="Insight tab quality grade"
              position="inline"
              compact={true}
            />
          </div>

          <InsightDiagnosticsPanel diagnostics={diagnostics} />
          <InsightAuditPanel auditRows={auditRows} />
          <InsightRankingDiagnosticsPanel rows={rankingRows} />
          <InsightBehaviorEvidencePanel evidence={behaviorEvidence} />

          <div style={{ marginTop: '12px' }}>
            <NewsdataRuntimeStatusPanel compact />
          </div>

          <InsightRuntimeQualityGatePanel runtimeQualityGate={runtimeQualityGate} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setOpen(false)}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
              Close Diagnostics
            </button>
          </div>
          </div>
        </>
      )}
    </div>
  );
}

function InsightTab({ result, source }) {
  const [activeSec, setActiveSec] = React.useState(null);
  const parents = result?.parents || [];
  const storiesById = normalizeStoriesById(result?.storiesById);
  const diagnostics = getInsightDiagnostics(result, source);
  const sourceLabel = diagnostics.sourceLabel;
  const ringDash = (diagnostics.signalScore / 100) * 251.2;
  const auditRows = getInsightAuditRows(result);
  const rankingRows = getInsightRankingDiagnosticRows(result);
  const behaviorEvidence = getInsightBehaviorEvidence(result);
  const runtimeQualityGate = result?.runtimeQualityGate || null;

  const newestStoryTs = React.useMemo(() => {
    let latest = 0;

    for (const story of storiesById.values()) {
      const ts = getStoryPublishedAtMs(story);
      if (ts > latest) latest = ts;
    }

    return latest;
  }, [storiesById]);

  const freshnessMinutes = newestStoryTs > 0
    ? Math.max(0, Math.round((Date.now() - newestStoryTs) / 60000))
    : null;

  const sourceGroupCount = React.useMemo(() => {
    const set = new Set();

    for (const story of storiesById.values()) {
      set.add(story?.sourceGroup || story?.source || 'unknown');
    }

    return set.size;
  }, [storiesById]);

  const angleCounts = React.useMemo(() => {
    const map = new Map();

    for (const parent of parents) {
      for (const id of safeArray(parent.childStoryIds)) {
        const s = storiesById.get(id);
        const key = String(s?.angle || 'unknown');
        map.set(key, (map.get(key) || 0) + 1);
      }
    }

    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [parents, storiesById]);

  const insightTabAudit = React.useMemo(() => auditInsightTabQuality({
    result,
    diagnostics,
    behaviorEvidence,
    source,
    loading: false,
  }), [result, diagnostics, behaviorEvidence, source]);

  return (
    <div className="scroll insight-page">
      <div className="ins-pulse">
        <div className="ins-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#00D4AA" />
                <stop offset="1" stopColor="#58A6FF" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="url(#rg)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${ringDash} 251.2`}
            />
          </svg>
          <div className="ircenter">
            <div className="irscore">{diagnostics.signalScore}</div>
            <div className="irslbl">Signal</div>
          </div>
        </div>

        <div className="ins-body">
          <div className="eyebrow"><span className="bip" />{sourceLabel} feed</div>
          <p>
            {diagnostics.title} — <em>{diagnostics.risingCount} rising</em> threads,
            {' '}<em>{diagnostics.multiAngleCount}</em> multi-angle clusters.
          </p>
          <div className="ins-meta">
            <span>{sourceLabel}</span><span>·</span>
            <span><b>{parents.length}</b> clusters</span><span>·</span>
            <span><b>{diagnostics.storyCount}</b> source stories</span>
          </div>
        </div>
      </div>

      <div className="ins-meta" style={{ marginTop: 8 }}>
        <span>{freshnessMinutes == null ? 'Freshness unknown' : `Data from ~${freshnessMinutes} min ago · source ${sourceLabel} · fresh<${INSIGHT_POLICY.freshMaxAgeHours}h`}</span>
        <span>·</span>
        <span>{sourceGroupCount} source groups</span>
        <span>·</span>
        <span>{angleCounts.length} visible angle types</span>
      </div>

      {angleCounts.length > 0 && (
        <div className="insight-angle-row">
          {angleCounts.map(([angle, count]) => {
            const icon = getAngleIcon(angle);
            const label = formatAngleLabel(angle);
            return (
              <span key={angle} className="insight-angle-badge" title={`${label}: ${count}`}>
                <span className="iab-icon">{icon}</span>
                <span className="iab-label">{label}</span>
                <span className="iab-count">{count}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="insight-sigs-row">
        <button
          type="button"
          className="insight-sig-badge"
          title="Ranked clusters - Tap for details"
          onClick={() => setActiveSec('ranked')}
        >
          <span className="isb-icon">📊</span>
          <span className="isb-label">Ranked</span>
          <span className="isb-count">{parents.length}</span>
        </button>
        <button
          type="button"
          className="insight-sig-badge"
          title="Rising threads - Tap for details"
          onClick={() => setActiveSec('rising')}
        >
          <span className="isb-icon">⚡</span>
          <span className="isb-label">Rising</span>
          <span className="isb-count">{diagnostics.risingCount}</span>
        </button>
        <button
          type="button"
          className="insight-sig-badge"
          title="Source stories count - Tap for details"
          onClick={() => setActiveSec('stories')}
        >
          <span className="isb-icon">📰</span>
          <span className="isb-label">Stories</span>
          <span className="isb-count">{diagnostics.storyCount}</span>
        </button>
        <button
          type="button"
          className="insight-sig-badge"
          title="Multi-angle coverage - Tap for details"
          onClick={() => setActiveSec('angles')}
        >
          <span className="isb-icon">🧩</span>
          <span className="isb-label">Angles</span>
          <span className="isb-count">{diagnostics.coverageLabel}</span>
        </button>
        <button
          type="button"
          className="insight-sig-badge"
          title="Active source - Tap for details"
          onClick={() => setActiveSec('source')}
        >
          <span className="isb-icon">⚙️</span>
          <span className="isb-label">Source</span>
          <span className="isb-count">{sourceLabel}</span>
        </button>
      </div>

      <div className="isec">
        <h3><span className="glyph">▲</span>Top Ranked</h3>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="imeta"><b>{parents.length}</b> shown · tap + to expand</span>
          <span className="insight-quality-inline">
            Signal <b>{diagnostics.signalScore}</b> · Multi-angle <b>{diagnostics.multiAngleCount}</b>
          </span>
          <InsightQualityPopupButton
            diagnostics={diagnostics}
            audit={insightTabAudit}
            runtimeQualityGate={runtimeQualityGate}
            auditRows={auditRows}
            rankingRows={rankingRows}
            behaviorEvidence={behaviorEvidence}
          />
        </div>
      </div>

      {parents.map((p, i) => (
        <ErrorBoundary key={p.parentId} label={`Cluster ${i + 1}`} resetKeys={[p.parentId]}>
          <ICard story={p} index={i} storiesById={storiesById} />
        </ErrorBoundary>
      ))}

      {activeSec && (
        <>
          <button
            type="button"
            className="insight-quality-popup__backdrop"
            aria-label={`Close ${activeSec} diagnostics`}
            onClick={() => setActiveSec(null)}
          />
          <div
            className="insight-quality-popup__panel"
            role="dialog"
            aria-modal="true"
            aria-label={`${activeSec} diagnostics`}
          >
            <div
              className="insight-quality-popup__head"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid rgba(139, 148, 158, 0.15)',
                paddingBottom: '12px'
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted, #9CA5B0)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Targeted Audit
                </div>
                <strong style={{ fontSize: '1.2rem', color: 'var(--txt, #fff)' }}>
                  {activeSec === 'ranked' && 'Ranked Clusters Quality'}
                  {activeSec === 'rising' && 'Rising Threads Diagnostic'}
                  {activeSec === 'stories' && 'Source Stories Evidence'}
                  {activeSec === 'angles' && 'Angle Diversity Audit'}
                  {activeSec === 'source' && 'Active Data Source Status'}
                </strong>
              </div>

              <button
                type="button"
                aria-label="Close details"
                onClick={() => setActiveSec(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--txt, #fff)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.85
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0.85}
              >
                ✕
              </button>
            </div>

            <div className="targeted-popup-content" style={{ overflowY: 'auto' }}>
              {activeSec === 'ranked' && <InsightDiagnosticsPanel diagnostics={diagnostics} />}
              {activeSec === 'rising' && <InsightRankingDiagnosticsPanel rows={rankingRows} />}
              {activeSec === 'stories' && <InsightBehaviorEvidencePanel evidence={behaviorEvidence} />}
              {activeSec === 'angles' && <InsightAuditPanel auditRows={auditRows} />}
              {activeSec === 'source' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <NewsdataRuntimeStatusPanel compact={false} />
                  {runtimeQualityGate && (
                    <InsightRuntimeQualityGatePanel runtimeQualityGate={runtimeQualityGate} />
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid rgba(139, 148, 158, 0.15)', paddingTop: '12px' }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setActiveSec(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              >
                Close details
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Failure-path components ───────────────────────────────────────────────────

/**
 * Collapsible diagnostics block shown below EmptyState when Insight cannot load.
 * Surfaces envelope metadata, SLO reasons, and validation errors without
 * exposing raw stack traces.
 */
function InsightFailureDiagnostics({ envelope, source, error }) {
  if (!envelope && !error) return null;

  const sloReasons = Array.isArray(envelope?.slo?.reasons) ? envelope.slo.reasons : [];
  const sloWarnings = Array.isArray(envelope?.slo?.warnings) ? envelope.slo.warnings : [];
  const validationErrors = Array.isArray(envelope?.validation?.errors) ? envelope.validation.errors : [];
  const hasDetail = error || sloReasons.length > 0 || sloWarnings.length > 0 || validationErrors.length > 0;

  if (!hasDetail) return null;

  return (
    <details
      className="insight-failure-diagnostics"
      style={{ marginTop: 20, textAlign: 'left', fontSize: '0.82rem', color: 'var(--muted, #9CA5B0)' }}
    >
      <summary style={{ cursor: 'pointer', marginBottom: 8, color: 'var(--txt, #D0D7DE)', userSelect: 'none' }}>
        Diagnostics
      </summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 16px', padding: '8px 0' }}>
        <span>Source</span>
        <strong style={{ color: 'var(--txt, #D0D7DE)' }}>{source || 'unknown'}</strong>
        <span>Freshness</span>
        <strong style={{ color: 'var(--txt, #D0D7DE)' }}>{envelope?.freshness || 'unknown'}</strong>
        <span>SLO score</span>
        <strong style={{ color: 'var(--txt, #D0D7DE)' }}>{envelope?.slo?.score ?? 'N/A'}</strong>
        <span>Fetched</span>
        <strong style={{ color: 'var(--txt, #D0D7DE)' }}>
          {envelope?.fetchedAt ? new Date(envelope.fetchedAt).toLocaleTimeString() : 'N/A'}
        </strong>
        {error && (
          <><span>Error</span><strong style={{ color: '#f85149' }}>{error}</strong></>
        )}
        {validationErrors.length > 0 && (
          <><span>Validation</span><strong style={{ color: '#f85149' }}>{validationErrors.join(' · ')}</strong></>
        )}
        {sloReasons.length > 0 && (
          <><span>SLO failures</span><strong style={{ color: '#e0af68' }}>{sloReasons.join(' · ')}</strong></>
        )}
        {sloWarnings.length > 0 && (
          <><span>SLO warnings</span><strong style={{ color: '#e0af68' }}>{sloWarnings.join(' · ')}</strong></>
        )}
      </div>
    </details>
  );
}

/**
 * Raw story list shown when clustering failed but stories exist.
 * Allows users to see that data arrived even when no clusters were built.
 */
function InsightRawCandidates({ result, count }) {
  const storiesById = normalizeStoriesById(result?.storiesById);
  const stories = [...storiesById.values()].slice(0, 20);

  if (stories.length === 0) return null;

  return (
    <div style={{ marginTop: 24, textAlign: 'left' }}>
      <div className="exp-label" style={{ marginBottom: 8 }}>
        <span className="dot" style={{ background: 'var(--warn, #F0883E)' }} />
        &#9889; Raw story candidates ({count} available — clustering could not build clusters)
      </div>
      <div className="src-list">
        {stories.map(story => (
          <div key={story.id || story.url} className="src-item">
            <span className="sname" title={story.sourceGroup || story.source}>
              {story.sourceGroup || story.source || 'Unknown source'}
            </span>
            {story.url
              ? (
                <a className="sdesc" href={story.url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}>
                  {story.title || story.url}
                </a>
              )
              : <span className="sdesc">{story.title || '(no title)'}</span>
            }
            <span className="stime">{getStoryTimeLabel(story)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, message }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted, #9CA5B0)' }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{ margin: '0 0 8px 0', color: 'var(--txt, #FFFFFF)' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '14px' }}>{message}</p>
    </div>
  );
}

function FreshBanner({ onAccept, onDismiss }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'var(--accent, #00D4AA)', color: '#000',
      padding: '10px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', fontSize: '13px', fontWeight: 600,
    }}>
      <span>🔄 New clusters available · Refresh now</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onAccept}
          style={{ background: '#000', color: '#fff', border: 'none', borderRadius: 4,
                   padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}>
          Update
        </button>
        <button onClick={onDismiss}
          style={{ background: 'transparent', color: '#000', border: '1px solid #000',
                   borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InsightPage() {
  const shellRuntimeProps = useShellRuntimeProps();
  // showStaticHostBadge mirrors getRuntimeCapabilities().isStaticHost, owned by useShellRuntimeProps
  const isStaticHost = shellRuntimeProps?.showStaticHostBadge ?? false;
  // Dynamic TTL: 6h on static hosts (snapshot-first), 3h on live servers
  const CACHE_MAX_AGE = (isStaticHost ? 6 : 3) * 60 * 60 * 1000;

  const {
    envelope,
    result,
    pendingResult,
    loading,
    source,
    staleLabel,
    emptyReason,
    error,
    refresh,
    acceptPending,
    dismissPending,
    hasResult,
    rawStoryCount,
    rawResult,
  } = useInsightTabViewModel();

  // On static hosts surface "Pre-generated · Nh ago" to set correct user expectations
  const displayStaleLabel = isStaticHost && staleLabel
    ? `Pre-generated · ${staleLabel}`
    : staleLabel;

  const handleRefresh = () => refresh(false);

  if (loading) {
    return (
      <div className="page-container insight-page">
        <Header
          title="Insight"
          stateLabel="Loading"
          stateType="loading"
          onRefresh={handleRefresh}
          loadingPhase={1}
          shellRuntimeProps={shellRuntimeProps}
        />
        <div className="modern-container">
          <p style={{ textAlign: 'center', marginTop: '20px' }}>Running AI pipeline…</p>
        </div>
      </div>
    );
  }

  if (!hasResult) {
    return (
      <div className="page-container insight-page">
        <Header
          title="Insight"
          stateLabel={displayStaleLabel || 'Up to date'}
          stateType={staleLabel ? 'stale' : 'live'}
          onRefresh={handleRefresh}
          shellRuntimeProps={shellRuntimeProps}
        />

        <div className="modern-container">
          <DataStateBoundary
            envelope={envelope}
            loading={loading}
            error={error}
            onRetry={handleRefresh}
            label="Insight"
            emptyTitle="No Insights Available"
            emptyMessage={emptyReason}
            errorTitle="Insight unavailable"
            errorMessage={error || emptyReason}
            allowDegraded={true}
            treatEmptyAsReady={false}
            showMeta={true}
            showBanner={true}
          >
            {() => (
              <>
                <EmptyState
                  icon="🧠"
                  title="No Insights Available"
                  message={emptyReason}
                />
                {rawStoryCount > 0 && rawResult && (
                  <InsightRawCandidates result={rawResult} count={rawStoryCount} />
                )}
                <InsightFailureDiagnostics envelope={envelope} source={source} error={error} />
              </>
            )}
          </DataStateBoundary>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header
        title="Insight"
        stateLabel={displayStaleLabel || 'Live'}
        stateType={staleLabel ? 'stale' : 'live'}
        onRefresh={handleRefresh}
        shellRuntimeProps={shellRuntimeProps}
      />

      {pendingResult && (
        <FreshBanner onAccept={acceptPending} onDismiss={dismissPending} />
      )}

      <div className="modern-container">
        <DataStateBoundary
          envelope={envelope}
          loading={loading}
          error={error}
          onRetry={handleRefresh}
          label="Insight"
          emptyTitle="No Insights Available"
          emptyMessage={emptyReason}
          errorTitle="Insight unavailable"
          errorMessage={error || 'Unable to load Insight.'}
          allowDegraded={true}
          treatEmptyAsReady={false}
          showMeta={true}
          showBanner={true}
        >
          {() => (
            <InsightTab result={result} source={source} />
          )}
        </DataStateBoundary>
      </div>
    </div>
  );
}
