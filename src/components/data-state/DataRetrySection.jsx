import React from 'react';
import DataStateBanner from './DataStateBanner.jsx';

export default function DataRetrySection({
  title = 'Data unavailable',
  message = 'This section could not be loaded.',
  retryLabel = 'Retry',
  onRetry,
  envelope,
  error,
  icon = '📡',
}) {
  return (
    <section
      className="data-retry-section modern-card"
      data-testid="data-retry-section"
      style={{
        padding: '20px',
        textAlign: 'center',
        borderStyle: 'dashed',
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '10px' }} aria-hidden="true">
        {icon}
      </div>

      <h3 style={{ margin: '0 0 8px' }}>{title}</h3>

      <p style={{ color: 'var(--text-secondary, #9CA5B0)', margin: '0 0 14px' }}>
        {message}
      </p>

      {(error || envelope?.error || envelope?.ok === false) && (
        <div style={{ marginBottom: '14px' }}>
          <DataStateBanner
            envelope={envelope}
            error={error || envelope?.error}
            label={title}
            compact
          />
        </div>
      )}

      {typeof onRetry === 'function' && (
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onRetry(true)}
        >
          {retryLabel}
        </button>
      )}
    </section>
  );
}
