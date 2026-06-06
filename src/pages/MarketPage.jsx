import React, { useEffect, useState, useCallback } from 'react';
import MarketStickyHeader from '../components/MarketStickyHeader';
import MutualFundCard from '../components/MutualFundCard';
import IPOCard from '../components/IPOCard';
import SectionNavigator from '../components/SectionNavigator';
import MarketSparkline from '../components/MarketSparkline';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import EmptyState from '../components/EmptyState';
import GradeBadge from '../components/audit/GradeBadge.jsx';
// useMarketTabViewModel — consumed via page-scoped alias useMarketPageViewModel
import { useMarketPageViewModel } from '../viewModels/useMarketPageViewModel.js';

function formatUpdated(timestamp) {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
    });
}

function getSourceHealthIcon(section) {
    const s = String(section || '').toLowerCase();
    if (s.includes('indices')) return '📊';
    if (s.includes('movers')) return '🏃';
    if (s.includes('sectorals')) return '🏢';
    if (s.includes('commodities')) return '🍬';
    if (s.includes('currencies')) return '💵';
    if (s.includes('mutualfund') || s.includes('funds')) return '📈';
    if (s.includes('ipo')) return '📅';
    return '🔌';
}

function MarketStat({ label, value, hint, tone = 'neutral', icon }) {
    return (
        <div className={`market-stat market-stat--${tone}`} title={`${label}: ${hint}`}>
            <span className="market-stat__icon">{icon}</span>
            <div className="market-stat__info">
                <span className="market-stat__label">{label}</span>
                <span className="market-stat__value">{value}</span>
            </div>
        </div>
    );
}

function MarketPage() {
    const {
        marketData,
        rawMarketData,
        marketSettings,
        indices,
        primaryIndices,
        globalIndices,
        displayedPrimaryIndices,
        heroSeries,
        mood,
        sourceHealth,
        sessionState,
        moverGainers,
        moverLosers,
        marketBreath,
        sectoralIndices,
        marketTabAudit,
        navSections,
        loading,
        error,
        lastFetch,
        refreshMarket,
        helpers,
    } = useMarketPageViewModel();

    const {
        getFloat,
        getMarketToneClass,
        hasUsableSectionData,
    } = helpers;

    const hasCommodityData = hasUsableSectionData(marketData?.commodities);
    const hasCurrencyData = hasUsableSectionData(marketData?.currencies);
    const hasFIIDIIData =
        hasUsableSectionData(marketData?.fiidii?.fii) ||
        hasUsableSectionData(marketData?.fiidii?.dii);
    const hasMutualFundData = hasUsableSectionData(marketData?.mutualFunds);
    const hasIPOData =
        hasUsableSectionData(marketData?.ipo?.upcoming) ||
        hasUsableSectionData(marketData?.ipo?.live) ||
        hasUsableSectionData(marketData?.ipo?.recent);

    const [showBackToTop, setShowBackToTop] = useState(false);

    const handleRefresh = useCallback(() => refreshMarket(true), [refreshMarket]);
    const { pullDistance } = usePullToRefresh(handleRefresh);

    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 400);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Phase 6: Log offline/snapshot fallback metrics
    useEffect(() => {
      if (!marketData) return;

      console.log({
        page: 'market',
        mode: marketData?.isSnapshot ? 'snapshot' : marketData?.isStale ? 'cache' : 'live',
        availability: {
          indices: hasUsableSectionData(marketData.indices),
          mutualFunds: hasUsableSectionData(marketData.mutualFunds),
          movers:
            hasUsableSectionData(marketData.movers?.gainers) ||
            hasUsableSectionData(marketData.movers?.losers),
          sectorals: hasUsableSectionData(marketData.sectorals),
          commodities: hasUsableSectionData(marketData.commodities),
          currencies: hasUsableSectionData(marketData.currencies),
          fiidii:
            hasUsableSectionData(marketData.fiidii?.fii) ||
            hasUsableSectionData(marketData.fiidii?.dii)
        }
      });
    }, [hasUsableSectionData, marketData]);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading && !rawMarketData) {
        return (
            <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="loading">
                    <div className="loading__spinner" />
                    <span>Loading Market Data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container market-page-shell" style={{ padding: 0 }}>
            <GradeBadge
                audit={marketTabAudit}
                label="Market tab quality grade"
                position="below-header"
                topOffset="74px"
                compact={true}
            />

            <div style={{
                height: `${pullDistance}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: 'var(--bg-secondary)',
                color: 'var(--accent-primary)',
                fontSize: '0.8rem',
                transition: pullDistance === 0 ? 'height 0.3s ease' : 'none'
            }}>
                <span style={{ transform: `rotate(${pullDistance * 2}deg)` }}>↻</span>
                <span style={{ marginLeft: '8px' }}>Pull to refresh...</span>
            </div>
            
            <MarketStickyHeader
                marketData={rawMarketData || marketData}
                indices={primaryIndices.length ? primaryIndices : indices.slice(0, 4)}
                onRefresh={refreshMarket}
                loading={loading}
                lastUpdated={lastFetch}
                tradingHolidays={marketSettings.tradingHolidays || []}
            />

            <main className="main-content market-page market-page--revamp" style={{ padding: '16px', marginTop: 0 }}>
                {error && typeof error === 'string' && (
                    <div className="market-inline-banner">
                        <div className="market-inline-banner__title">Degraded feed detected</div>
                        <div className="market-inline-banner__body">{error}</div>
                    </div>
                )}

                {marketSettings.showIndices !== false && displayedPrimaryIndices.length > 0 && (
                    <section className="market-hero-grid">
                        <div className="market-hero-panel modern-card">
                            <div className="market-hero-panel__top">
                                <div>
                                    <div className="market-hero-panel__eyebrow">India-first market board</div>
                                    <h1 className="market-hero-panel__title">Market pulse</h1>
                                    <div className={`market-hero-panel__status ${mood.tone === 'positive' ? 'text-success' : mood.tone === 'negative' ? 'text-danger' : 'text-muted'}`}>
                                        {mood.label}
                                    </div>
                                </div>
                                <div className={`market-status-pill market-status-pill--${sessionState.tone}`}>
                                    {sessionState.label} · {sessionState.ageLabel}
                                </div>
                            </div>

                            <div className="market-hero-panel__body">
                                <div className="market-hero-board">
                                    {displayedPrimaryIndices.map((index, idx) => {
                                        const isUp = getFloat(index.change) >= 0;
                                        return (
                                            <div key={`${index.name}-${idx}`} className={`market-hero-board__tile ${getMarketToneClass(index.change)}`}>
                                                <div className="market-hero-board__symbol">{index.name}</div>
                                                <div className="market-hero-board__value">{index.value}</div>
                                                <div className={`market-hero-board__change ${isUp ? 'text-success' : 'text-danger'}`}>
                                                    {isUp ? '▲' : '▼'} {Math.abs(getFloat(index.changePercent)).toFixed(2)}%
                                                </div>
                                                <div className="market-hero-board__range">
                                                    {index.dayLow ? Number(index.dayLow).toLocaleString('en-IN') : '--'} - {index.dayHigh ? Number(index.dayHigh).toLocaleString('en-IN') : '--'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="market-hero-panel__spark">
                                    <MarketSparkline series={heroSeries} positive={getFloat(displayedPrimaryIndices[0]?.change) >= 0} />
                                    <div className="market-hero-panel__timestamp">Updated {formatUpdated(lastFetch || marketData?.fetchedAt)}</div>
                                </div>
                            </div>

                            <div className="market-stat-grid">
                                <MarketStat
                                    label="Breadth"
                                    value={`${marketBreath.up}/${marketBreath.down}`}
                                    hint="advancers / decliners"
                                    tone={marketBreath.up >= marketBreath.down ? 'positive' : 'negative'}
                                    icon="⚖️"
                                />
                                <MarketStat
                                    label="Last Fetch"
                                    value={lastFetch ? new Date(lastFetch).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                                    hint="local cache or live"
                                    icon="🕒"
                                />
                                <MarketStat
                                    label="Feed Age"
                                    value={sessionState.ageLabel}
                                    hint={sessionState.reason}
                                    icon="⏳"
                                />
                                <MarketStat
                                    label="Source Mode"
                                    value={sessionState.label}
                                    hint={sessionState.reason}
                                    tone={sessionState.tone === 'success' ? 'positive' : sessionState.tone === 'warning' ? 'warning' : 'neutral'}
                                    icon="⚙️"
                                />
                            </div>
                        </div>

                        <div className="market-hero-side">
                            {marketSettings.showGlobalIndices !== false && (
                                <div className="market-side-panel modern-card">
                                    <div className="market-side-panel__title">Global context</div>
                                    <div className="market-global-rail">
                                        {globalIndices.length > 0 ? globalIndices.map((item) => {
                                            const isUp = getFloat(item.change) >= 0;
                                            return (
                                                <div key={item.name} className={`market-global-rail__item ${getMarketToneClass(item.change)}`}>
                                                    <div className="market-global-rail__name">{item.name}</div>
                                                    <div className="market-global-rail__value">{item.value}</div>
                                                    <div className={`market-global-rail__change ${isUp ? 'text-success' : 'text-danger'}`}>
                                                        {isUp ? '▲' : '▼'} {Math.abs(getFloat(item.changePercent)).toFixed(2)}%
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="market-empty-state" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>Global indices unavailable.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    </section>
                )}

                {(marketSettings.showGainers !== false || marketSettings.showLosers !== false) && (
                    <section id="market-movers" className="market-section modern-card">
                        <div className="modern-card__header">
                            <div>
                                <div className="market-section__eyebrow">Live movers</div>
                                <h2 className="modern-card__title">Top Movers</h2>
                            </div>
                            <div className="market-section__subtitle">Market breadth leaders and laggards</div>
                        </div>

                        <div className="market-movers-grid">
                            {marketSettings.showGainers !== false && (
                                <div className="market-movers-column">
                                    <div className="market-column-title text-success">Top Gainers</div>
                                    <div className="market-table">
                                        {moverGainers.length > 0 ? moverGainers.slice(0, 5).map((stock, idx) => (
                                            <div key={`${stock.symbol}-${idx}`} className={`market-table__row ${getMarketToneClass(stock.changePercent)}`}>
                                                <div>
                                                    <div className="market-table__symbol">{stock.symbol}</div>
                                                    <div className="market-table__meta">{stock.action || stock.volume ? `Vol ${stock.volume || '--'}` : 'Live quote'}</div>
                                                </div>
                                                <div className="market-table__value">
                                                    <div>{stock.price}</div>
                                                    <div className="text-success">+{Math.abs(getFloat(stock.changePercent)).toFixed(2)}%</div>
                                                </div>
                                            </div>
                                        )) : <div className="market-empty-state" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>No gainers data available.</div>}
                                    </div>
                                </div>
                            )}

                            {marketSettings.showLosers !== false && (
                                <div className="market-movers-column">
                                    <div className="market-column-title text-danger">Top Losers</div>
                                    <div className="market-table">
                                        {moverLosers.length > 0 ? moverLosers.slice(0, 5).map((stock, idx) => (
                                            <div key={`${stock.symbol}-${idx}`} className={`market-table__row ${getMarketToneClass(stock.changePercent)}`}>
                                                <div>
                                                    <div className="market-table__symbol">{stock.symbol}</div>
                                                    <div className="market-table__meta">{stock.action || stock.volume ? `Vol ${stock.volume || '--'}` : 'Live quote'}</div>
                                                </div>
                                                <div className="market-table__value">
                                                    <div>{stock.price}</div>
                                                    <div className="text-danger">-{Math.abs(getFloat(stock.changePercent)).toFixed(2)}%</div>
                                                </div>
                                            </div>
                                        )) : <div className="market-empty-state" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>No losers data available.</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {marketSettings.showSectorals !== false && (
                    <section id="sectoral-indices" className="market-section modern-card">
                        <div className="modern-card__header">
                            <div>
                                <div className="market-section__eyebrow">Rotation map</div>
                                <h2 className="modern-card__title">Sectoral Indices</h2>
                            </div>
                            <div className="market-section__subtitle">Breadth by sector, not just headline indices</div>
                        </div>

                        <div className="market-heatmap">
                            {sectoralIndices.length > 0 ? sectoralIndices.map((sector) => {
                                const isUp = getFloat(sector.changePercent) >= 0;
                                return (
                                    <div key={sector.name} className={`market-heatmap__tile ${isUp ? 'market-heatmap__tile--up' : 'market-heatmap__tile--down'} ${getMarketToneClass(sector.changePercent)}`}>
                                        <div className="market-heatmap__name">{sector.name}</div>
                                        <div className="market-heatmap__value">{sector.value}</div>
                                        <div className={isUp ? 'text-success' : 'text-danger'}>
                                            {isUp ? '▲' : '▼'} {Math.abs(getFloat(sector.changePercent)).toFixed(2)}%
                                        </div>
                                    </div>
                                );
                            }) : <div className="market-empty-state" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>Sector data unavailable.</div>}
                        </div>
                    </section>
                )}

                <section className="market-macro-grid">
                    {marketSettings.showCommodities !== false && hasCommodityData && (
                        <div id="commodities" className="market-section modern-card">
                            <div className="modern-card__header">
                                <div>
                                    <div className="market-section__eyebrow">Macro watch</div>
                                    <h2 className="modern-card__title">Commodities</h2>
                                </div>
                                <div className="market-section__subtitle">Gold, silver and crude</div>
                            </div>

                            <div className="market-macro-list">
                                {(marketData?.commodities || []).map((commodity) => {
                                    const isUp = getFloat(commodity.changePercent) >= 0;
                                    return (
                                        <div key={commodity.name} className={`market-macro-item ${getMarketToneClass(commodity.changePercent)}`}>
                                            <div>
                                                <div className="market-macro-item__name">{commodity.name}</div>
                                                <div className="market-macro-item__meta">{commodity.unit}</div>
                                            </div>
                                            <div className="market-macro-item__value">
                                                <div>{commodity.value}</div>
                                                <div className={isUp ? 'text-success' : 'text-danger'}>
                                                    {isUp ? '+' : ''}{getFloat(commodity.changePercent).toFixed(2)}%
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {marketSettings.showCurrency !== false && hasCurrencyData && (
                        <div id="currency" className="market-section modern-card">
                            <div className="modern-card__header">
                                <div>
                                    <div className="market-section__eyebrow">FX</div>
                                    <h2 className="modern-card__title">Currency Rates</h2>
                                </div>
                                <div className="market-section__subtitle">INR reference pairs</div>
                            </div>

                            <div className="market-macro-list">
                                {(marketData?.currencies || []).map((currency) => {
                                    const isUp = getFloat(currency.changePercent) >= 0;
                                    return (
                                        <div key={currency.name} className={`market-macro-item ${getMarketToneClass(currency.changePercent)}`}>
                                            <div>
                                                <div className="market-macro-item__name">{currency.name}</div>
                                                <div className="market-macro-item__meta">{currency.source || 'live'}</div>
                                            </div>
                                            <div className="market-macro-item__value">
                                                <div>{currency.value}</div>
                                                <div className={isUp ? 'text-success' : 'text-danger'}>
                                                    {isUp ? '+' : ''}{getFloat(currency.changePercent).toFixed(2)}%
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {marketSettings.showFIIDII !== false && hasFIIDIIData && (
                        <div id="fiidii" className="market-section modern-card">
                            <div className="modern-card__header">
                                <div>
                                    <div className="market-section__eyebrow">Flows</div>
                                    <h2 className="modern-card__title">FII / DII Activity</h2>
                                </div>
                                <div className="market-section__subtitle">Latest available institutional flow readout</div>
                            </div>

                            <div className="market-flow-grid">
                                <div className={`market-flow-card ${getMarketToneClass(marketData?.fiidii?.fii?.net)}`}>
                                    <div className="market-flow-card__title">FII</div>
                                    <div className="market-flow-card__row"><span>Buy</span><strong className="text-success">₹{marketData?.fiidii?.fii?.buy ?? '--'} Cr</strong></div>
                                    <div className="market-flow-card__row"><span>Sell</span><strong className="text-danger">₹{marketData?.fiidii?.fii?.sell ?? '--'} Cr</strong></div>
                                    <div className="market-flow-card__row"><span>Net</span><strong className={getFloat(marketData?.fiidii?.fii?.net) >= 0 ? 'text-success' : 'text-danger'}>₹{marketData?.fiidii?.fii?.net ?? '--'} Cr</strong></div>
                                </div>
                                <div className={`market-flow-card ${getMarketToneClass(marketData?.fiidii?.dii?.net)}`}>
                                    <div className="market-flow-card__title">DII</div>
                                    <div className="market-flow-card__row"><span>Buy</span><strong className="text-success">₹{marketData?.fiidii?.dii?.buy ?? '--'} Cr</strong></div>
                                    <div className="market-flow-card__row"><span>Sell</span><strong className="text-danger">₹{marketData?.fiidii?.dii?.sell ?? '--'} Cr</strong></div>
                                    <div className="market-flow-card__row"><span>Net</span><strong className={getFloat(marketData?.fiidii?.dii?.net) >= 0 ? 'text-success' : 'text-danger'}>₹{marketData?.fiidii?.dii?.net ?? '--'} Cr</strong></div>
                                </div>
                            </div>
                            <div className="market-flow-card__footer">As of {marketData?.fiidii?.date || 'N/A'}</div>
                        </div>
                    )}
                </section>

                <section className="market-bottom-grid">
                    {marketSettings.showMutualFunds !== false && hasMutualFundData && (
                        <div id="mutual-funds" className="market-section modern-card">
                            <div className="modern-card__header">
                                <div>
                                    <div className="market-section__eyebrow">NAV board</div>
                                    <h2 className="modern-card__title">Mutual Funds</h2>
                                </div>
                                <div className="market-section__subtitle">Tracked funds with latest NAV movement</div>
                            </div>
                            <MutualFundCard funds={marketData.mutualFunds} />
                        </div>
                    )}

                    {marketSettings.showIPO !== false && hasIPOData && (
                        <div id="ipo-tracker" className="market-section modern-card">
                            <div className="modern-card__header">
                                <div>
                                    <div className="market-section__eyebrow">Primary issues</div>
                                    <h2 className="modern-card__title">IPO Tracker</h2>
                                </div>
                                <div className="market-section__subtitle">Upcoming, live and recent issues</div>
                            </div>
                            <IPOCard ipoData={marketData.ipo} />
                        </div>
                    )}
                </section>

                

                {hasUsableSectionData(marketData?.marketNews) && (
                    <section id="market-news" className="market-section modern-card">
                        <div className="modern-card__header">
                            <div>
                                <div className="market-section__eyebrow">Latest updates</div>
                                <h2 className="modern-card__title">Market News</h2>
                            </div>
                            <div className="market-section__subtitle">Fresh from business desks</div>
                        </div>
                        <div className="market-news-list">
                            {(marketData.marketNews || []).map(item => (
                                <a
                                    key={item.id || item.url}
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="market-news-item"
                                >
                                    <div className="market-news-item__meta">
                                        <span className="market-news-item__source">{item.source}</span>
                                        {item.publishedAt && (
                                            <span className="market-news-item__time">
                                                {new Date(item.publishedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                    <div className="market-news-item__title">{item.title}</div>
                                </a>
                            ))}
                        </div>
                    </section>
                )}

                {marketSettings.showMarketHealth !== false && (
                    <section id="source-health" className="market-section modern-card market-source-health-section">
                        <div className="modern-card__header">
                            <div>
                                <div className="market-section__eyebrow">Reliability</div>
                                <h2 className="modern-card__title">Source health</h2>
                            </div>
                            <div className="market-section__subtitle">Live, snapshot, or failed status by feed</div>
                        </div>

                        <div className="market-health-row-flow">
                            {Object.entries(sourceHealth).length > 0 ? Object.entries(sourceHealth).map(([section, statusObj]) => {
                                const statusStr = typeof statusObj === 'object' && statusObj !== null ? statusObj.status : statusObj;
                                const icon = getSourceHealthIcon(section);
                                const label = section.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
                                return (
                                <div key={section} className="market-health-badge" title={`${label}: ${statusStr}`}>
                                    <span className="mhb-icon">{icon}</span>
                                    <span className="mhb-label">{label}</span>
                                    <span className={`mhb-status mhb-status--${statusStr === 'live' ? 'success' : statusStr === 'snapshot' ? 'warning' : statusStr === 'failed' ? 'danger' : 'empty'}`}>
                                        {statusStr.toUpperCase()}
                                    </span>
                                </div>
                                );
                            }) : (
                                <div className="market-empty-state" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>Source health unavailable.</div>
                            )}
                        </div>
                    </section>
                )}

                <div className="market-disclaimer market-disclaimer--revamp">
                    <div>* Data is for informational purposes only. Not investment advice.</div>
                    <div className="market-disclaimer__meta">
                        Last Updated: {marketData?.fetchedAt ? new Date(marketData.fetchedAt).toLocaleString() : 'N/A'}
                    </div>
                </div>
            </main>

            <SectionNavigator sections={navSections} />

            <button
                onClick={scrollToTop}
                className="market-back-to-top"
                style={{
                    opacity: showBackToTop ? 1 : 0,
                    pointerEvents: showBackToTop ? 'auto' : 'none'
                }}
            >
                ↑
            </button>
        </div>
    );
}

export default MarketPage;
