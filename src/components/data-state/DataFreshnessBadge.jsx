import React from 'react';
import { getFreshnessLabel, getFreshnessTone } from './DataFreshnessBadge.internals.js';

export default function DataFreshnessBadge({ freshness, labelPrefix = 'Freshness' }) {
  const label = getFreshnessLabel(freshness);
  const tone = getFreshnessTone(freshness);

  return (
    <span
      className={`data-state-badge data-state-badge--${tone}`}
      title={`${labelPrefix}: ${label}`}
      data-testid="data-freshness-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '999px',
        fontSize: '0.72rem',
        lineHeight: 1.2,
        border: '1px solid rgba(148, 163, 184, 0.24)',
        background: 'rgba(148, 163, 184, 0.10)',
        color: 'var(--text-secondary, #9CA5B0)',
      }}
    >
      <span aria-hidden="true">
        {tone === 'positive' ? '●' : tone === 'warning' ? '▲' : '○'}
      </span>
      {label}
    </span>
  );
}
