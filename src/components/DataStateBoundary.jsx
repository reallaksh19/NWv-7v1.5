import React from 'react';
import {
  DataRetrySection,
  DataSkeleton,
  DataStateBanner,
  DataStateMeta,
} from './data-state/index.js';
import { getBoundaryState } from './DataStateBoundary.internals.js';

export default function DataStateBoundary({
  envelope,
  loading = false,
  error = null,
  onRetry,
  children,
  label = 'Data',
  emptyTitle,
  emptyMessage,
  errorTitle,
  errorMessage,
  loadingRows = 3,
  allowDegraded = true,
  treatEmptyAsReady = false,
  showMeta = true,
  showBanner = true,
  compact = false,
}) {
  const state = getBoundaryState({
    envelope,
    loading,
    error,
    allowDegraded,
    treatEmptyAsReady,
  });

  if (state === 'loading') {
    return (
      <DataSkeleton
        rows={loadingRows}
        title={`Loading ${label}`}
        compact={compact}
      />
    );
  }

  if (state === 'error') {
    return (
      <DataRetrySection
        title={errorTitle || `${label} unavailable`}
        message={errorMessage || error || envelope?.error || `Unable to load ${label}.`}
        onRetry={onRetry}
        envelope={envelope}
        error={error}
      />
    );
  }

  if (state === 'empty') {
    return (
      <DataRetrySection
        title={emptyTitle || `${label} is empty`}
        message={emptyMessage || `No ${label.toLowerCase()} items are available right now.`}
        retryLabel="Refresh"
        onRetry={onRetry}
        envelope={envelope}
        icon="∅"
      />
    );
  }

  return (
    <section
      className={`data-state-boundary data-state-boundary--${state}`}
      data-state={state}
      data-testid="data-state-boundary"
    >
      {showBanner && (
        state === 'degraded' ||
        state === 'refreshing' ||
        envelope?.fallbackUsed ||
        envelope?.freshness === 'stale'
      ) && (
        <div style={{ marginBottom: compact ? '8px' : '12px' }}>
          <DataStateBanner
            envelope={envelope}
            error={error}
            loading={state === 'refreshing'}
            label={label}
            compact={compact}
          />
        </div>
      )}

      {showMeta && <DataStateMeta envelope={envelope} />}

      {typeof children === 'function'
        ? children({
            envelope,
            data: envelope?.data,
            state,
            loading,
            error,
            retry: onRetry,
          })
        : children}
    </section>
  );
}
