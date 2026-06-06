import React, { useEffect, useState } from 'react';
import {
  clearDiagnostics,
  listDiagnostics,
  subscribeDiagnostics,
} from '../data/diagnosticsStore.js';
import { listDatasetCache } from '../data/orchestrator/useDataset.js';

function formatTime(value) {
  if (!value) return '--';

  try {
    return new Date(value).toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return '--';
  }
}

function getCacheSnapshot() {
  return listDatasetCache();
}

export default function DataHealthPanel() {
  const [diagnostics, setDiagnostics] = useState(() => listDiagnostics());
  const [, setCacheVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeDiagnostics(nextDiagnostics => {
      setDiagnostics(nextDiagnostics);
      setCacheVersion(v => v + 1);
    });

    return unsubscribe;
  }, []);

  const cachedEnvelopes = getCacheSnapshot();

  const exportPayload = () => {
    const payload = {
      exportedAt: Date.now(),
      diagnostics,
      datasets: cachedEnvelopes.map(({ datasetId, envelope }) => ({
        datasetId,
        ok: envelope?.ok,
        source: envelope?.source,
        freshness: envelope?.freshness,
        fallbackUsed: envelope?.fallbackUsed,
        payloadHash: envelope?.payloadHash,
        fetchedAt: envelope?.fetchedAt,
        lastGoodAt: envelope?.lastGoodAt,
        validation: envelope?.validation,
        slo: envelope?.slo,
        error: envelope?.error,
      })),
    };

    const text = JSON.stringify(payload, null, 2);

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    if (
      typeof document !== 'undefined' &&
      typeof Blob !== 'undefined' &&
      typeof URL !== 'undefined'
    ) {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = `data-health-${Date.now()}.json`;
      anchor.click();

      URL.revokeObjectURL(url);
    }
  };

  return (
    <section className="modern-card" data-testid="data-health-panel" style={{ padding: '16px' }}>
      <div className="modern-card__header">
        <div>
          <div className="topline__label">Runtime diagnostics</div>
          <h2 className="modern-card__title">Data Health</h2>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => clearDiagnostics()}
          >
            Clear diagnostics
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={exportPayload}
          >
            Export JSON
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
        {cachedEnvelopes.length === 0 ? (
          <div className="empty-state" style={{ padding: '16px' }}>
            No cached dataset envelopes yet. Open a migrated tab to populate this panel.
          </div>
        ) : cachedEnvelopes.map(({ datasetId, envelope }) => (
          <div key={datasetId} className="modern-card" style={{ padding: '12px', background: 'var(--bg-secondary)' }}>
            <h3 style={{ margin: '0 0 8px' }}>{datasetId}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
              <div><strong>Status:</strong> {envelope?.ok ? 'ok' : 'degraded'}</div>
              <div><strong>Source:</strong> {envelope?.source || '--'}</div>
              <div><strong>Freshness:</strong> {envelope?.freshness || '--'}</div>
              <div><strong>Fallback:</strong> {envelope?.fallbackUsed ? 'yes' : 'no'}</div>
              <div><strong>Payload hash:</strong> {envelope?.payloadHash || '--'}</div>
              <div><strong>Last good:</strong> {formatTime(envelope?.lastGoodAt)}</div>
              <div><strong>Validation:</strong> {envelope?.validation?.passed === false ? 'failed' : 'passed'}</div>
              <div><strong>SLO score:</strong> {envelope?.slo?.score ?? '--'}</div>
            </div>

            {envelope?.error && (
              <div style={{ marginTop: '8px', color: 'var(--accent-danger)' }}>
                {envelope.error}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Recent diagnostics ({diagnostics.length})</h3>

        <div style={{ display: 'grid', gap: '8px' }}>
          {diagnostics.slice(-20).reverse().map(item => (
            <div
              key={item.id}
              className="modern-card"
              style={{ padding: '10px', background: 'rgba(255,255,255,0.03)' }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {formatTime(item.ts)} · {item.datasetId} · {item.severity}
              </div>
              <div style={{ fontWeight: 600 }}>{item.event}</div>
              {item.message && <div style={{ fontSize: '0.85rem' }}>{item.message}</div>}
            </div>
          ))}

          {diagnostics.length === 0 && (
            <div className="empty-state" style={{ padding: '12px' }}>
              No diagnostics recorded.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
