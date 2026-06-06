import React from 'react';
import { getBannerMessage, getBannerTone } from './DataStateBanner.internals.js';

export default function DataStateBanner({
  envelope,
  error,
  loading = false,
  label = 'Data',
  compact = false,
}) {
  const tone = getBannerTone({ envelope, error, loading });
  const message = getBannerMessage({ envelope, error, loading, label });

  return (
    <div
      className={`data-state-banner data-state-banner--${tone}`}
      role={tone === 'danger' ? 'alert' : 'status'}
      data-testid="data-state-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: compact ? '8px 10px' : '10px 12px',
        borderRadius: '12px',
        border: '1px solid rgba(148, 163, 184, 0.22)',
        background: 'rgba(148, 163, 184, 0.08)',
        color: tone === 'danger'
          ? 'var(--accent-danger, #ff6b6b)'
          : 'var(--text-secondary, #9CA5B0)',
        fontSize: compact ? '0.78rem' : '0.84rem',
      }}
    >
      <span aria-hidden="true">
        {tone === 'danger' ? '⚠️' : tone === 'warning' ? '▲' : tone === 'positive' ? '✓' : '•'}
      </span>
      <span>{message}</span>
    </div>
  );
}
