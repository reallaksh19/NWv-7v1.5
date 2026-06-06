import React, { useEffect, useRef, useMemo } from 'react';
import { useMarket } from '../context/MarketContext';
import './MarketTicker.css';
import { MARKET_SEED } from '../services/indianMarketStableService.js';
import { summarizeMarketSourceHealth } from '../services/marketTrust.js';
import { getMarketSessionState } from '../utils/marketSession.js';

const MARKET_TICKER_SEED_FALLBACK = {
    ...MARKET_SEED,
    sourceMode: 'seed',
    fetchedAt: 0,
    generatedAt: ''
};

function DataStatePill({ mode, label }) {
    const bgColors = {
        live: '#10b981', // green
        cache: '#f59e0b', // amber
        cached: '#f59e0b', // amber
        snapshot: '#3b82f6', // blue
        degraded: '#ef4444', // red
        closed: '#6b7280', // gray
        after_hours: '#6b7280' // gray
    };
    return (
        <span style={{
            fontSize: '0.65rem',
            background: bgColors[mode] || '#666',
            color: '#fff',
            padding: '2px 4px',
            borderRadius: '4px',
            marginLeft: '6px',
            verticalAlign: 'middle',
            fontWeight: 'bold',
            textTransform: 'uppercase'
        }} title={`Data mode: ${mode}`}>
            {label}
        </span>
    );
}

const MarketTicker = ({ loadingPhase }) => {
    const { marketData, loading, lastFetch, ensureBoot } = useMarket();
    const scrollRef = useRef(null);
    const isPaused = useRef(false);
    const [currentTime, setCurrentTime] = React.useState(() => Date.now());

    useEffect(() => {
        ensureBoot?.();
    }, [ensureBoot]);

    const displayData = marketData || MARKET_TICKER_SEED_FALLBACK;
    const sourceSummary = useMemo(() => (
        summarizeMarketSourceHealth(displayData)
    ), [displayData]);

    const session = useMemo(() => getMarketSessionState({
        now: new Date(currentTime),
        lastUpdated: displayData.fetchedAt
    }), [currentTime, displayData.fetchedAt]);

    const pillMode = session.isOpen ? sourceSummary.modeStr : 'closed';
    const pillLabel = session.isOpen ? sourceSummary.modeLabel : session.label;

    const markets = useMemo(() => {
        if (!displayData) return [];

        const { indices = [], commodities = [] } = displayData;
        const allItems = [...indices, ...commodities];

        const allowedNames = [
            'NIFTY 50',
            'SENSEX',
            'DOW',
            'NASDAQ',
            'S&P 500',
            'FTSE 100',
            'NIKKEI 225',
            'HANG SENG',
            'Gold',
            'Silver'
        ];

        return allowedNames
            .map((name) => allItems.find((item) => item.name === name))
            .filter(Boolean);
    }, [displayData]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let animationFrameId;
        let lastTimestamp = 0;
        const speed = 40;
        let accumulator = 0;

        const scroll = (timestamp) => {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const deltaTime = timestamp - lastTimestamp;
            lastTimestamp = timestamp;

            if (scrollRef.current && !isPaused.current) {
                const move = (speed * deltaTime) / 1000;
                accumulator += move;

                if (accumulator >= 1) {
                    const pixelsToMove = Math.floor(accumulator);
                    accumulator -= pixelsToMove;

                    const { scrollLeft, scrollWidth } = scrollRef.current;
                    if (scrollLeft >= scrollWidth / 2) {
                        scrollRef.current.scrollLeft = 0;
                    } else {
                        scrollRef.current.scrollLeft += pixelsToMove;
                    }
                }
            } else {
                lastTimestamp = timestamp;
            }
            animationFrameId = requestAnimationFrame(scroll);
        };

        const timeoutId = setTimeout(() => {
            animationFrameId = requestAnimationFrame(scroll);
        }, 1000);

        return () => {
            cancelAnimationFrame(animationFrameId);
            clearTimeout(timeoutId);
        };
    }, [markets]);

    const isItemStale = (item) => {
        if (displayData?.sourceMode === 'seed') return false;
        if (!item.timestamp) return true;
        const diff = currentTime - item.timestamp;
        const isCommodity = ['Gold', 'Silver', 'Crude Oil'].includes(item.name);
        const isGlobalIndex = ['DOW', 'NASDAQ', 'S&P 500', 'FTSE 100', 'NIKKEI 225', 'HANG SENG'].includes(item.name);
        const threshold = isCommodity ? 60 * 60 * 1000 : isGlobalIndex ? 30 * 60 * 1000 : 15 * 60 * 1000;
        return diff > threshold;
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getDisplayName = (name) => {
        if (name === 'NSE 50' || name === '50') return 'NIFTY 50';
        if (name === 'SENSEX') return 'BSE SENSEX';
        if (name === 'DOW') return 'DOW JONES';
        return name;
    };

    const getChangePercent = (item) => {
        const value = Number.parseFloat(item.changePercent ?? item.change ?? 0);
        return Number.isFinite(value) ? value : 0;
    };

    const isPositiveMove = (item) => {
        const direction = String(item.direction || '').toLowerCase();
        if (direction === 'up') return true;
        if (direction === 'down') return false;
        return getChangePercent(item) >= 0;
    };

    const getPhaseStyle = () => {
        if (!loadingPhase) return {};

        let color = 'transparent';
        if (loadingPhase === 1) color = 'rgba(144, 238, 144, 0.2)';
        else if (loadingPhase === 2) color = 'rgba(60, 179, 113, 0.2)';
        else if (loadingPhase === 3) color = 'rgba(34, 139, 34, 0.2)';

        return {
            background: `linear-gradient(to bottom, transparent, ${color})`,
            transition: 'background 0.5s ease'
        };
    };

    if ((loading && markets.length === 0) || markets.length === 0) return null;

    return (
        <div className="market-ticker-container market-ticker-container--sleek" style={getPhaseStyle()}>
            <div className="ticker-label">
                Markets
                <DataStatePill mode={pillMode} label={pillLabel} />
            </div>

            <div
                className="ticker-track-wrapper"
                ref={scrollRef}
                onMouseEnter={() => { isPaused.current = true; }}
                onMouseLeave={() => { isPaused.current = false; }}
                onTouchStart={() => { isPaused.current = true; }}
                onTouchEnd={() => { isPaused.current = false; }}
            >
                <div className="ticker-track">
                    {[...markets, ...markets].map((item, index) => {
                        const stale = isItemStale(item);
                        const changePercent = getChangePercent(item);
                        const isUp = isPositiveMove(item);
                        return (
                            <div key={`${item.name}-${index}`} className={`ticker-item ${stale ? 'stale-data' : ''}`}>
                                <span className="ticker-name">{getDisplayName(item.name)}</span>
                                <span className="ticker-price">
                                    {item.name === 'Gold' || item.name === 'Silver'
                                        ? item.value
                                        : (typeof item.value === 'number' ? item.value.toFixed(2) : item.value)}
                                    {item.unit ? <span style={{ fontSize: '0.7em', marginLeft: '2px' }}>{item.unit}</span> : ''}
                                </span>
                                <span className={`ticker-change ${isUp ? 'positive' : 'negative'}`}>
                                    {isUp ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {lastFetch && (
                <div className="ticker-updated">
                    <span style={{ marginRight: '4px' }}>•</span> {formatTime(lastFetch)}
                </div>
            )}
        </div>
    );
};

export default MarketTicker;
