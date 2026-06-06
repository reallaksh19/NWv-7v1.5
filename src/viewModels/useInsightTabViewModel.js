import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDataset } from '../data/orchestrator/useDataset.js';
import { useMountedRef } from '../hooks/useMountedRef.js';
import { runInsightPipeline, DEFAULT_CONFIG } from '../insight/src/index.ts';
import {
  INSIGHT_OUTPUT_CONTRACT_VERSION,
  repairInsightResult,
} from '../insight/src/diagnostics/insightResultRepair.ts';
import { recoverInsightRuntimeQuality } from '../insight/src/diagnostics/insightRuntimeQualityGate.ts';
import { createInsightFetcher } from '../adapters/insightFetcher.js';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities';

const CACHE_KEY = 'insight_pipeline_cache';
const CACHE_SCHEMA_VERSION = INSIGHT_OUTPUT_CONTRACT_VERSION;
const REFRESH_EVERY = 5 * 60_000;
const HIDDEN_REFRESH = 5 * 60_000;

function getInsightCacheMaxAgeMs() {
  const { isStaticHost } = getRuntimeCapabilities();
  return (isStaticHost ? 6 : 3) * 60 * 60 * 1000;
}

function normalizeStoriesById(storiesById) {
  if (storiesById instanceof Map) return storiesById;

  if (storiesById && typeof storiesById === 'object') {
    return new Map(Object.entries(storiesById));
  }

  return new Map();
}

function serializeInsightResult(data) {
  if (!data || typeof data !== 'object') return data;

  return {
    ...data,
    storiesById: data.storiesById instanceof Map
      ? Object.fromEntries(data.storiesById)
      : (data.storiesById || {}),
  };
}

function normalizeInsightResult(data) {
  if (!data || typeof data !== 'object') return null;

  const normalized = {
    ...data,
    storiesById: normalizeStoriesById(data.storiesById),
  };

  return repairInsightResult(normalized);
}

function safeGetLocalStorage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function extractInsightResultFromEnvelope(envelope) {
  const data = envelope?.data;

  if (!data) return null;

  if (data.result) return normalizeInsightResult(data.result);
  if (data.insightResult) return normalizeInsightResult(data.insightResult);
  if (Array.isArray(data.parents) || data.storiesById) return normalizeInsightResult(data);

  return null;
}

function getInsightResultParentCount(result) {
  return Array.isArray(result?.parents) ? result.parents.length : 0;
}

function hasRenderableInsightResult(result) {
  const parents = result?.parents;
  if (!Array.isArray(parents) || parents.length === 0) return false;

  // Gate out thin live-fallback results that would render as grade F / 0 multi-angle.
  // The runtimeQualityGate.before diagnostics are produced by recoverInsightRuntimeQuality
  // before any recovery attempt; they reflect raw pipeline output.
  const gate = result?.runtimeQualityGate;
  if (gate?.attempted) {
    const before = gate?.before || {};
    const multiAngleCount = Number(before.multiAngleCount || 0);
    const storyCount = Number(before.storyCount || 0);
    const grade = String(before.grade || 'F');
    const gradeRank = ['F', 'D', 'C', 'B', 'A'].indexOf(grade);
    // Suppress: fewer than 3 parents, or grade F/D with no multi-angle clusters,
    // or storyCount below a meaningful minimum.
    if (parents.length < 3) return false;
    if (gradeRank < 2 && multiAngleCount === 0) return false;
    if (storyCount > 0 && storyCount < 24) return false;
  }

  return true;
}

function hasQualityAcceptedInsightResult(result) {
  if (!hasRenderableInsightResult(result)) return false;

  const gate = result?.runtimeQualityGate;

  if (!gate) return true;

  if (gate.attempted === true && gate.recovered !== true) {
    return false;
  }

  return true;
}

function hasCacheAcceptableInsightResult(result) {
  return hasRenderableInsightResult(result) && hasQualityAcceptedInsightResult(result);
}

function readInsightCache(now = Date.now()) {
  try {
    const storage = safeGetLocalStorage();
    if (!storage) return null;

    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;

    const { ts, data, schemaVersion } = JSON.parse(raw);

    if (schemaVersion !== CACHE_SCHEMA_VERSION) {
      storage.removeItem(CACHE_KEY);
      return null;
    }

    if (now - Number(ts || 0) > getInsightCacheMaxAgeMs()) {
      return null;
    }

    const repaired = normalizeInsightResult(data);

    if (!repaired || !hasCacheAcceptableInsightResult(repaired)) {
      return null;
    }

    return {
      ts: Number(ts || now),
      data: repaired,
    };
  } catch {
    return null;
  }
}

function writeInsightCache(data, now = Date.now()) {
  try {
    if (!hasCacheAcceptableInsightResult(data)) return false;

    const storage = safeGetLocalStorage();
    if (!storage) return false;

    storage.setItem(CACHE_KEY, JSON.stringify({
      ts: now,
      schemaVersion: CACHE_SCHEMA_VERSION,
      data: serializeInsightResult(data),
    }));

    return true;
  } catch {
    return false;
  }
}

function getInsightResultSignature(result) {
  const parents = Array.isArray(result?.parents) ? result.parents : [];

  return parents.map(parent => [
    parent.parentId,
    parent.canonicalHeadline,
    Number(parent.finalParentScore || 0).toFixed(3),
    (parent.childStoryIds || []).join('|'),
    (parent.clusterStoryIds || []).join('|'),
    Boolean(parent.weakTree),
  ].join(':')).join('||');
}

function hasMeaningfulInsightChange(currentResult, nextResult) {
  if (!hasRenderableInsightResult(nextResult)) return false;
  if (!hasRenderableInsightResult(currentResult)) return true;

  return getInsightResultSignature(currentResult) !== getInsightResultSignature(nextResult);
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

function getInsightStaleLabel({ source, fetcherSnapshotTs, envelope }) {
  // Exclude envelope.fetchedAt — that is the boundary construction time, not data generation time.
  const generatedAt = envelope?.generatedAt ||
    envelope?.data?.generatedAt ||
    envelope?.data?.fetchedAt;

  if (source === 'snapshot' && generatedAt) {
    return `Pre-generated · ${formatInsightAge(generatedAt)}`;
  }

  if (source === 'stale-snapshot' && fetcherSnapshotTs) {
    // Stale snapshots run with a relaxed (but still 2-angle/2-source) floor — flag the
    // reduced quality so the front page doesn't look as authoritative as a fresh one.
    return `Pre-generated · ${formatInsightAge(fetcherSnapshotTs)} · reduced quality`;
  }

  if (source === 'cached') {
    // Show age when a pipeline-generated timestamp is available; otherwise acknowledge
    // it's cached without fabricating an age from the envelope construction time.
    return generatedAt ? `Cached · ${formatInsightAge(generatedAt)}` : 'Cached';
  }

  if (source === 'unavailable' || source === 'failed') {
    return 'Unavailable';
  }

  return null;
}

function makeInsightBoundaryEnvelope({ envelope, result, source, emptyReason }) {
  const renderable = hasRenderableInsightResult(result);

  if (envelope) {
    const existingValidation = envelope.validation || {};

    return {
      ...envelope,
      ok: Boolean(envelope.ok && renderable),
      freshness: renderable ? (envelope.freshness || 'fresh') : 'empty',
      error: renderable ? (envelope.error || null) : (envelope.error || emptyReason || 'No renderable Insight clusters'),
      data: {
        ...(envelope.data || {}),
        result,
        parents: result?.parents || [],
        projectedHasRenderableInsight: renderable,
      },
      validation: {
        ...existingValidation,
        passed: Boolean(existingValidation.passed !== false && renderable),
        errors: renderable
          ? (Array.isArray(existingValidation.errors) ? existingValidation.errors : [])
          : [
              ...(Array.isArray(existingValidation.errors) ? existingValidation.errors : []),
              'insight_no_renderable_clusters',
            ],
        warnings: Array.isArray(existingValidation.warnings) ? existingValidation.warnings : [],
      },
      diagnostics: [
        ...(Array.isArray(envelope.diagnostics) ? envelope.diagnostics : []),
        {
          event: 'insight.view_model.projected_result',
          severity: renderable ? 'info' : 'warn',
          message: renderable
            ? 'Insight ViewModel projected render-ready result into the boundary envelope.'
            : 'Insight ViewModel projected an empty/non-renderable result into the boundary envelope.',
        },
      ],
    };
  }

  return {
    ok: renderable,
    datasetId: 'insight',
    data: {
      result,
      parents: result?.parents || [],
      projectedHasRenderableInsight: renderable,
    },
    source,
    freshness: renderable ? 'fresh' : 'empty',
    validation: {
      passed: renderable,
      errors: renderable ? [] : [emptyReason || 'No renderable Insight clusters'],
      warnings: [],
    },
    diagnostics: [
      {
        event: 'insight.view_model.pipeline_fallback',
        severity: renderable ? 'info' : 'warn',
        message: renderable
          ? 'Insight ViewModel used pipeline fallback while dataset envelope was unavailable.'
          : 'Insight ViewModel has no renderable Insight result.',
      },
    ],
  };
}

function getRefreshOutcome(results) {
  const rejected = results.find(result => result.status === 'rejected');

  const fulfilledValues = results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);

  const successfulInsight = fulfilledValues.find(value => (
    value?.ok === true &&
    (
      hasRenderableInsightResult(value.result) ||
      hasRenderableInsightResult(extractInsightResultFromEnvelope(value))
    )
  ));

  if (successfulInsight) {
    return {
      ok: true,
      degraded: fulfilledValues.some(value => value?.ok === false) || Boolean(successfulInsight.degraded),
      qualityAccepted: successfulInsight.qualityAccepted !== false,
      results,
    };
  }

  if (rejected) {
    return {
      ok: false,
      error: rejected.reason?.message || String(rejected.reason),
      results,
    };
  }

  const failedEnvelope = fulfilledValues.find(value => value?.ok === false);

  if (failedEnvelope) {
    return {
      ok: false,
      error: failedEnvelope.error || 'Insight refresh returned no usable result',
      results,
    };
  }

  return {
    ok: true,
    results,
  };
}

async function runInsightPipelineSafely(fetcherRef) {
  if (!fetcherRef.current) {
    fetcherRef.current = await createInsightFetcher();
  }

  const { fetcher, source: src, pipelineConfigOverrides, snapshotTs } = fetcherRef.current;

  const config = pipelineConfigOverrides
    ? { ...DEFAULT_CONFIG, ...pipelineConfigOverrides }
    : DEFAULT_CONFIG;

  const runtimeQuality = recoverInsightRuntimeQuality(
    repairInsightResult(await runInsightPipeline(fetcher, config)),
    src,
    config
  );

  return {
    result: runtimeQuality.result,
    source: src,
    snapshotTs,
  };
}

export function useInsightTabViewModel() {
  const {
    envelope: datasetEnvelope,
    loading: datasetLoading,
    error: datasetError,
    reload: reloadDataset,
  } = useDataset('insight');

  const mountedRef = useMountedRef();
  const fetcherRef = useRef(null);
  const hiddenAtRef = useRef(null);
  const bootstrapStartedRef = useRef(false);

  const [result, setResult] = useState(null);
  const [pendingResult, setPendingResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('live');
  const [pipelineError, setPipelineError] = useState(null);

  const datasetResult = useMemo(
    () => extractInsightResultFromEnvelope(datasetEnvelope),
    [datasetEnvelope]
  );

  const renderableDatasetResult = hasRenderableInsightResult(datasetResult)
    ? datasetResult
    : null;

  const resultToRender = renderableDatasetResult || result;

  const effectiveSource = renderableDatasetResult
    ? (datasetEnvelope?.source || 'dataset')
    : source;

  const emptyReason = getInsightEmptyStateMessage(resultToRender, effectiveSource);

  const boundaryEnvelope = useMemo(() => makeInsightBoundaryEnvelope({
    envelope: datasetEnvelope,
    result: resultToRender,
    source: effectiveSource,
    emptyReason,
  }), [datasetEnvelope, emptyReason, effectiveSource, resultToRender]);

  const staleLabel = getInsightStaleLabel({
    source: effectiveSource,
    fetcherSnapshotTs: fetcherRef.current?.snapshotTs,
    envelope: datasetEnvelope,
  });

  const runPipeline = useCallback(async (background = false) => {
    try {
      setPipelineError(null);

      if (!background && !resultToRender) {
        setLoading(true);
      }

      const {
        result: nextResult,
        source: nextSource,
      } = await runInsightPipelineSafely(fetcherRef);

      if (!mountedRef.current) return null;

      const renderable = hasRenderableInsightResult(nextResult);
      const qualityAccepted = hasQualityAcceptedInsightResult(nextResult);

      if (background && hasRenderableInsightResult(resultToRender)) {
        if (hasMeaningfulInsightChange(resultToRender, nextResult)) {
          setPendingResult({
            result: nextResult,
            source: nextSource,
          });
        } else if (!renderableDatasetResult) {
          setResult(nextResult);
          setSource(nextSource);
        }

        if (hasCacheAcceptableInsightResult(nextResult)) {
          writeInsightCache(nextResult);
        }
      } else {
        setResult(nextResult);
        setSource(nextSource);

        if (hasCacheAcceptableInsightResult(nextResult)) {
          writeInsightCache(nextResult);
        }
      }

      return {
        ok: renderable,
        degraded: renderable && !qualityAccepted,
        result: nextResult,
        source: nextSource,
        qualityAccepted,
        error: renderable ? null : 'Insight pipeline returned no renderable parents',
      };
    } catch (error) {
      const message = error?.message || String(error);

      console.error('[useInsightTabViewModel] Pipeline failed:', error);

      if (mountedRef.current) {
        setPipelineError(message);
      }

      return {
        ok: false,
        error: message,
      };
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [mountedRef, renderableDatasetResult, resultToRender]);

  const refresh = useCallback(async (background = false, options = {}) => {
    const { forcePipeline = false } = options;

    const datasetRefresh = await reloadDataset(true).catch(error => ({
      ok: false,
      error: error?.message || String(error),
    }));

    const nextDatasetResult = extractInsightResultFromEnvelope(datasetRefresh);

    if (hasRenderableInsightResult(nextDatasetResult) && !forcePipeline) {
      return {
        ok: true,
        source: 'dataset',
        envelope: datasetRefresh,
      };
    }

    const pipelineRefresh = await runPipeline(background);

    return getRefreshOutcome([
      { status: 'fulfilled', value: datasetRefresh },
      { status: 'fulfilled', value: pipelineRefresh },
    ]);
  }, [reloadDataset, runPipeline]);

  useEffect(() => {
    if (bootstrapStartedRef.current) return;

    if (datasetLoading) {
      return;
    }

    bootstrapStartedRef.current = true;

    const cached = readInsightCache();

    if (renderableDatasetResult) {
      setLoading(false);
      return;
    }

    if (cached?.data && hasCacheAcceptableInsightResult(cached.data)) {
      setResult(cached.data);
      setSource('cached');
      setLoading(false);
      refresh(true, { forcePipeline: false });
      return;
    }

    runPipeline(false);
  }, [datasetLoading, renderableDatasetResult, refresh, runPipeline]);

  useEffect(() => {
    if (!renderableDatasetResult) return;

    setResult(renderableDatasetResult);
    setSource(datasetEnvelope?.source || 'dataset');
    setLoading(false);
  }, [datasetEnvelope?.source, renderableDatasetResult]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (mountedRef.current) {
        refresh(true);
      }
    }, REFRESH_EVERY);

    return () => clearInterval(timer);
  }, [mountedRef, refresh]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenMs = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;

      if (hiddenMs > HIDDEN_REFRESH) {
        fetcherRef.current = null;
        refresh(true);
      }

      hiddenAtRef.current = null;
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refresh]);

  const acceptPending = useCallback(() => {
    if (pendingResult) {
      setResult(pendingResult.result);
      setSource(pendingResult.source);

      if (hasCacheAcceptableInsightResult(pendingResult.result)) {
        writeInsightCache(pendingResult.result);
      }
    }

    setPendingResult(null);
  }, [pendingResult]);

  const dismissPending = useCallback(() => {
    setPendingResult(null);
  }, []);

  const combinedLoading = Boolean(loading || (datasetLoading && !resultToRender));
  const error = datasetError || pipelineError || boundaryEnvelope?.error || null;

  const hasResult = hasRenderableInsightResult(resultToRender);

  return {
    envelope: boundaryEnvelope,
    datasetEnvelope,
    result: resultToRender,
    pendingResult,
    loading: combinedLoading,
    source: effectiveSource,
    sourceLabel: getInsightSourceLabel(effectiveSource),
    staleLabel,
    emptyReason,
    error,
    refresh,
    runPipeline,
    acceptPending,
    dismissPending,
    hasResult,
    // Expose raw pipeline result for partial rendering when clustering fails.
    // Only populated when hasResult is false so callers don't need to guard.
    rawStoryCount: hasResult ? 0 : (result?.storiesById?.size || 0),
    rawResult: hasResult ? null : result,
    sourceInfo: {
      source: effectiveSource,
      label: getInsightSourceLabel(effectiveSource),
      staleLabel,
    },
    freshness: boundaryEnvelope?.freshness || null,
    slo: boundaryEnvelope?.slo || null,
    warnings: [
      ...(Array.isArray(boundaryEnvelope?.validation?.warnings) ? boundaryEnvelope.validation.warnings : []),
      ...(Array.isArray(boundaryEnvelope?.slo?.warnings) ? boundaryEnvelope.slo.warnings : []),
    ],
    diagnostics: boundaryEnvelope?.diagnostics || [],
  };
}

export const __insightViewModelInternalsForTest = {
  CACHE_KEY,
  CACHE_SCHEMA_VERSION,
  REFRESH_EVERY,
  HIDDEN_REFRESH,
  getInsightCacheMaxAgeMs,
  normalizeStoriesById,
  serializeInsightResult,
  normalizeInsightResult,
  readInsightCache,
  writeInsightCache,
  extractInsightResultFromEnvelope,
  getInsightResultParentCount,
  hasRenderableInsightResult,
  hasQualityAcceptedInsightResult,
  hasCacheAcceptableInsightResult,
  getInsightResultSignature,
  hasMeaningfulInsightChange,
  getInsightEmptyStateMessage,
  getInsightSourceLabel,
  formatInsightAge,
  getInsightStaleLabel,
  makeInsightBoundaryEnvelope,
  getRefreshOutcome,
};
