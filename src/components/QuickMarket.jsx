import React from 'react';
import { RefreshIcon } from './AppIcons';
import './QuickMarket.css';

/**
 * Quick Market Widget — prop-driven (Release 6J).
 * Summarizes key indices (Nifty/Sensex) and market trend.
 * All context access removed; data supplied via props from the Market ViewModel.
 */
function QuickMarket({
  marketData = {},
  loading = false,
  error = null,
  booted = true,
  sessionState = null,
  onRefreshMarket = null,
}) {
  const indices = Array.isArray(marketData?.indices) ? marketData.indices : [];
  const canRefresh = typeof onRefreshMarket === 'function';

  async function handleRefresh() {
    try {
      if (canRefresh) {
        await Promise.resolve(onRefreshMarket(true));
      }
    } catch (err) {
      console.warn('[QuickMarket] refresh failed', {
        message: err?.message || String(err),
      });
    }
  }

  if (!booted || (loading && indices.length === 0)) {
    return (
      <div className="quick-market">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading Markets...</div>
      </div>
    );
  }

  if (error && indices.length === 0) {
    return (
      <div className="quick-market">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Market unavailable</div>
      </div>
    );
  }

  if (indices.length === 0) {
    return (
      <div className="quick-market">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Market unavailable</div>
      </div>
    );
  }

  const nifty = indices.find(i => i.name?.toUpperCase().includes('NIFTY') && i.name?.includes('50')) || indices[0];
  const sensex = indices.find(i => i.name?.toUpperCase().includes('SENSEX')) || indices[1];

  if (!nifty || !sensex) {
    return (
      <div className="quick-market">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Market unavailable</div>
      </div>
    );
  }

  const now = new Date();
  const statusText = sessionState?.label || 'Market';
  const statusClass = sessionState?.tone === 'success' ? 'qm-status--open' : 'qm-status--closed';

  const niftyChange = parseFloat(nifty.change);
  const sensexChange = parseFloat(sensex.change);

  const isBullish = niftyChange > 0 && sensexChange > 0;
  const isBearish = niftyChange < 0 && sensexChange < 0;

  let trendText = 'Global cues are mixed; proceed with caution.';
  let trendIcon = '⚖️';

  if (isBullish) {
    if (parseFloat(nifty.changePercent) > 1.0) {
      trendText = 'Strong bullish momentum across major indices.';
      trendIcon = '🚀';
    } else {
      trendText = 'Markets are trading in the green.';
      trendIcon = '📈';
    }
  } else if (isBearish) {
    if (parseFloat(nifty.changePercent) < -1.0) {
      trendText = 'Heavy selling pressure observed today.';
      trendIcon = '📉';
    } else {
      trendText = 'Indices are under pressure.';
      trendIcon = '🔻';
    }
  }

  return (
    <section className="quick-market">
      <div className="qm-header">
        <div style={{ fontWeight: 600, color: 'var(--accent-success)' }}>
          Market Pulse
        </div>
        <div className="qm-header-actions">
          {canRefresh && (
            <button
              type="button"
              className="qm-refresh-btn"
              onClick={handleRefresh}
              aria-label="Refresh market pulse"
              title="Refresh market pulse"
              disabled={loading}
            >
              <RefreshIcon size={14} />
            </button>
          )}
          <div className={`qm-status ${statusClass}`}>
          {statusText} • {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      </div>

      <div className="qm-body">
        <div className="qm-index">
          <span className="qm-index-name">{nifty.name}</span>
          <span className="qm-index-value">{nifty.value}</span>
          <span className="qm-index-change" style={{ color: niftyChange >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
            {niftyChange >= 0 ? '▲' : '▼'} {Math.abs(niftyChange).toFixed(2)} ({nifty.changePercent}%)
          </span>
        </div>
        <div className="qm-index" style={{ alignItems: 'flex-end', textAlign: 'right' }}>
          <span className="qm-index-name">{sensex.name}</span>
          <span className="qm-index-value">{sensex.value}</span>
          <span className="qm-index-change" style={{ color: sensexChange >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
            {sensexChange >= 0 ? '▲' : '▼'} {Math.abs(sensexChange).toFixed(2)} ({sensex.changePercent}%)
          </span>
        </div>
      </div>

      <div className="qm-summary">
        <span className="qm-trend-icon">{trendIcon}</span>
        {trendText}
      </div>
    </section>
  );
}

export default QuickMarket;
