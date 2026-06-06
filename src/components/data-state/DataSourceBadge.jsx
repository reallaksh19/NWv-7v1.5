import React from 'react';
import { getSourceLabel, getSourceTone } from './DataSourceBadge.internals.js';

export default function DataSourceBadge({ source, fallbackUsed = false, labelPrefix = 'Source' }) {
  const label = getSourceLabel(source, fallbackUsed);
  const tone = getSourceTone(source, fallbackUsed);

  return (
    <span
      className={`data-state-badge data-state-badge--${tone}`}
      title={`${labelPrefix}: ${label}`}
      data-testid="data-source-badge"
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
        {tone === 'positive' ? '●' : tone === 'danger' ? '■' : tone === 'warning' ? '▲' : '○'}
      </span>
      {label}
    </span>
  );
}
