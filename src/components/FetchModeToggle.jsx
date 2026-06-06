import React, { useState, useCallback } from 'react';
import { getFetchMode, setFetchMode, FETCH_MODES } from '../utils/fetchMode.js';
import { clearEnvelopeCache } from '../data/orchestrator/useDataset.js';

export default function FetchModeToggle() {
    const [mode, setMode] = useState(getFetchMode);

    const toggle = useCallback((next) => {
        if (next === mode) return;
        setFetchMode(next);
        setMode(next);
        clearEnvelopeCache();
        // Reload the page so all contexts and services re-initialise with the new mode.
        window.location.reload();
    }, [mode]);

    const isLive = mode === FETCH_MODES.LIVE;

    return (
        <div className="fetch-mode-toggle" role="group" aria-label="Data fetch mode">
            <button
                type="button"
                className={`fmt-btn${!isLive ? ' fmt-btn--active' : ''}`}
                onClick={() => toggle(FETCH_MODES.HYBRID)}
                title="Hybrid: use prefetched workflow data, fall back to live if unavailable"
                aria-pressed={!isLive}
            >
                Hybrid
            </button>
            <button
                type="button"
                className={`fmt-btn${isLive ? ' fmt-btn--active' : ''}`}
                onClick={() => toggle(FETCH_MODES.LIVE)}
                title="Live: fetch fresh data from RSS and live sources, bypass all caches"
                aria-pressed={isLive}
            >
                Live
            </button>
        </div>
    );
}
