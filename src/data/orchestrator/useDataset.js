import { useCallback, useEffect, useState } from 'react';
import { getDatasetLoader } from '../datasets/index.js';
import { recordDiagnostic } from '../diagnosticsStore.js';
import { useMountedRef } from '../../hooks/useMountedRef.js';
import { isLiveMode } from '../../utils/fetchMode.js';

const envelopeCache = new Map();
const inFlight = new Map();

export async function loadDataset(datasetId, force = false) {
  const loader = getDatasetLoader(datasetId);

  if (!loader?.load) {
    throw new Error(`Unknown dataset: ${datasetId}`);
  }

  const effectiveForce = force || isLiveMode();

  if (!effectiveForce && envelopeCache.has(datasetId)) {
    return envelopeCache.get(datasetId);
  }

  if (!effectiveForce && inFlight.has(datasetId)) {
    return inFlight.get(datasetId);
  }

  const promise = loader.load()
    .then(env => {
      envelopeCache.set(datasetId, env);

      recordDiagnostic({
        datasetId,
        severity: env.ok ? 'info' : 'warn',
        event: 'dataset_loaded',
        message: env.ok ? 'Dataset loaded' : (env.error || 'Dataset degraded'),
        details: {
          freshness: env.freshness,
          source: env.source,
          payloadHash: env.payloadHash,
        },
      });

      return env;
    })
    .finally(() => {
      inFlight.delete(datasetId);
    });

  inFlight.set(datasetId, promise);
  return promise;
}

export function useDataset(datasetId, options = {}) {
  const { auto = true } = options;
  const mountedRef = useMountedRef();

  const [state, setState] = useState(() => ({
    envelope: envelopeCache.get(datasetId) || null,
    loading: auto && !envelopeCache.has(datasetId),
    error: null,
  }));

  const reload = useCallback(async (force = true) => {
    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));
    }

    try {
      const envelope = await loadDataset(datasetId, force);

      if (mountedRef.current) {
        setState({
          envelope,
          loading: false,
          error: envelope.ok ? null : envelope.error,
        });
      }

      return envelope;
    } catch (error) {
      const message = error?.message || String(error);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: message,
        }));
      }

      throw error;
    }
  }, [datasetId, mountedRef]);

  useEffect(() => {
    if (!auto) return;
    queueMicrotask(() => {
      reload(false).catch(() => {});
    });
  }, [auto, reload]);

  return {
    ...state,
    reload,
  };
}

export function listDatasetCache() {
  return Array.from(envelopeCache.entries()).map(([datasetId, envelope]) => ({
    datasetId,
    envelope,
  }));
}

export function __getDatasetCacheForTest() {
  return envelopeCache;
}

export function clearEnvelopeCache() {
  envelopeCache.clear();
  inFlight.clear();
}

export function __clearDatasetCacheForTest() {
  envelopeCache.clear();
  inFlight.clear();
}
