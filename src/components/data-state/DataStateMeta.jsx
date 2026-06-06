import React, { useState, useRef, useEffect } from 'react';
import DataFreshnessBadge from './DataFreshnessBadge.jsx';
import DataSourceBadge from './DataSourceBadge.jsx';
import DataSloBadge from './DataSloBadge.jsx';
import { formatTimestamp, getWarningCount, getWarningMessages } from './DataStateMeta.internals.js';

export default function DataStateMeta({
  envelope,
  showHash = false,
  showWarnings = true,
}) {
  const [warnOpen, setWarnOpen] = useState(false);
  const warnRef = useRef(null);

  useEffect(() => {
    if (!warnOpen) return;
    const handler = (e) => {
      if (warnRef.current && !warnRef.current.contains(e.target)) {
        setWarnOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [warnOpen]);

  if (!envelope) return null;

  const fetchedAtLabel = formatTimestamp(envelope.fetchedAt);
  const warningCount = getWarningCount(envelope);

  return (
    <div
      className="data-state-meta"
      data-testid="data-state-meta"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px',
        margin: '8px 0',
      }}
    >
      <DataFreshnessBadge freshness={envelope.freshness} />
      <DataSourceBadge source={envelope.source} fallbackUsed={envelope.fallbackUsed} />

      {envelope.slo && <DataSloBadge slo={envelope.slo} />}

      {showWarnings && warningCount > 0 && (
        <span ref={warnRef} style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            type="button"
            className="data-state-badge data-state-badge--warning"
            onClick={() => setWarnOpen(v => !v)}
            title={`${warningCount} warning(s) — click to view`}
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
              cursor: 'pointer',
            }}
          >
            {'\u25B2'} {warningCount} warning{warningCount === 1 ? '' : 's'}
          </button>

          {warnOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                left: 0,
                zIndex: 200,
                minWidth: '220px',
                maxWidth: '340px',
                background: 'var(--bg-elevated, #1e2433)',
                border: '1px solid rgba(148, 163, 184, 0.24)',
                borderRadius: '10px',
                padding: '10px 12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Warnings
              </div>
              {getWarningMessages(envelope).length === 0 ? (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>No details available.</div>
              ) : (
                <ul style={{ margin: 0, padding: '0 0 0 14px', listStyle: 'disc' }}>
                  {getWarningMessages(envelope).map((msg, i) => (
                    <li key={i} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {typeof msg === 'string' ? msg : JSON.stringify(msg)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </span>
      )}

      {fetchedAtLabel && (
        <span
          style={{
            color: 'var(--text-muted, #768390)',
            fontSize: '0.72rem',
          }}
        >
          Updated {fetchedAtLabel}
        </span>
      )}

      {showHash && envelope.payloadHash && (
        <span
          style={{
            color: 'var(--text-muted, #768390)',
            fontSize: '0.72rem',
            fontFamily: 'monospace',
          }}
        >
          #{String(envelope.payloadHash).slice(0, 8)}
        </span>
      )}
    </div>
  );
}

