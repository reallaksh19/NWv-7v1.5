import React from 'react';

export default function DataSkeleton({
  rows = 3,
  title = 'Loading…',
  compact = false,
}) {
  const rowCount = Math.max(1, Number(rows) || 3);

  return (
    <section
      className="data-skeleton modern-card"
      aria-busy="true"
      aria-label={title}
      data-testid="data-skeleton"
      style={{
        padding: compact ? '12px' : '16px',
        display: 'grid',
        gap: compact ? '8px' : '12px',
      }}
    >
      <div
        style={{
          width: '38%',
          height: compact ? '10px' : '14px',
          borderRadius: '999px',
          background: 'rgba(148, 163, 184, 0.18)',
        }}
      />

      {Array.from({ length: rowCount }, (_, index) => (
        <div
          key={index}
          style={{
            width: `${92 - index * 9}%`,
            height: compact ? '9px' : '12px',
            borderRadius: '999px',
            background: 'rgba(148, 163, 184, 0.12)',
          }}
        />
      ))}
    </section>
  );
}
