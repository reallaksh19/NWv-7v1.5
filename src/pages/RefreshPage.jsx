import React from 'react';
import Header from '../components/Header';
import Toggle from '../components/Toggle';
import { useShellRuntimeProps } from '../viewModels/useShellRuntimeProps';
import { useRefreshPageViewModel } from '../viewModels/useRefreshPageViewModel';

/**
 * Refresh Page Component
 * Allows user to:
 * - Select sections to refresh
 * - See last refresh time
 * - Trigger refresh
 * - View refresh schedule
 *
 * useRefreshPageViewModel owns: useMarket, refreshMarket(true), Promise.allSettled, finally
 */
function RefreshPage() {
    const shellRuntimeProps = useShellRuntimeProps();

    const {
        refreshToggles,
        loading,
        lastRefresh,
        lastError,
        recommended,
        sectionConfig,
        selectedCount,
        currentSegment,
        updateSectionToggle,
        toggleAll,
        refreshSelectedSections,
    } = useRefreshPageViewModel();

    return (
        <>
            <Header
                title="Refresh Content"
                showBack
                backTo="/"
                shellRuntimeProps={shellRuntimeProps}
            />

            <div className="refresh-page">
                <div className="refresh-info">
                    <span>⏱️</span>
                    <span>Last refresh: <strong>{lastRefresh}</strong></span>
                </div>

                {lastError && (
                    <div className="topline" style={{ borderLeftColor: 'var(--accent-danger)' }}>
                        <div className="topline__label" style={{ color: 'var(--accent-danger)' }}>
                            Refresh warning
                        </div>
                        <div className="topline__text">{lastError}</div>
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    gap: 'var(--spacing-sm)',
                    marginBottom: 'var(--spacing-md)',
                }}>
                    <button
                        className="btn btn--secondary"
                        style={{ flex: 1 }}
                        onClick={() => toggleAll(true)}
                    >
                        Select All
                    </button>

                    <button
                        className="btn btn--secondary"
                        style={{ flex: 1 }}
                        onClick={() => toggleAll(false)}
                    >
                        Clear All
                    </button>
                </div>

                <section className="settings-section">
                    <h2 className="settings-section__title">
                        <span>📋</span>
                        Select Sections to Refresh
                        <span style={{
                            marginLeft: 'auto',
                            fontSize: '0.8rem',
                            fontWeight: 'normal',
                            color: 'var(--accent-primary)',
                        }}>
                            {selectedCount}/{sectionConfig.length}
                        </span>
                    </h2>

                    <div className="modern-card" style={{ padding: '16px', gap: '0' }}>
                        {sectionConfig.map(({ key, icon, label, desc }) => (
                            <div key={key} className="settings-item">
                                <div
                                    className="settings-item__label"
                                    style={{ flexDirection: 'column', alignItems: 'flex-start' }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-sm)',
                                    }}>
                                        <span className="settings-item__icon">{icon}</span>
                                        {label}
                                        {recommended[key] && (
                                            <span style={{
                                                color: 'var(--weather-sun)',
                                                fontSize: '0.7rem',
                                            }}>
                                                ★
                                            </span>
                                        )}
                                    </div>

                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        marginLeft: '28px',
                                    }}>
                                        {desc}
                                    </div>
                                </div>

                                <Toggle
                                    checked={refreshToggles[key]}
                                    onChange={(val) => updateSectionToggle(key, val)}
                                    recommended={recommended[key]}
                                />
                            </div>
                        ))}
                    </div>
                </section>

                <button
                    className={`refresh-btn ${loading ? 'refresh-btn--loading' : ''}`}
                    onClick={refreshSelectedSections}
                    disabled={loading || selectedCount === 0}
                >
                    <span className="refresh-btn__icon">{loading ? '⟳' : '🔄'}</span>
                    <span>{loading ? 'Refreshing...' : 'Refresh Now'}</span>
                </button>

                <div className="schedule-card">
                    <div className="schedule-card__title">
                        <span>📊</span>
                        Auto-Refresh Schedule
                    </div>

                    <div className="schedule-item">
                        <span className="schedule-item__label">Weather Forecast</span>
                        <span className="schedule-item__value">Every 3 hours</span>
                    </div>

                    <div className="schedule-item">
                        <span className="schedule-item__label">Weather Nowcast</span>
                        <span className="schedule-item__value">Every 1 hour</span>
                    </div>

                    <div className="schedule-item">
                        <span className="schedule-item__label">News Updates</span>
                        <span className="schedule-item__value">Every 30 minutes</span>
                    </div>

                    <div className="schedule-item">
                        <span className="schedule-item__label">Market Data</span>
                        <span className="schedule-item__value">Every 5 minutes</span>
                    </div>

                    <div className="schedule-item">
                        <span className="schedule-item__label">Social Trends</span>
                        <span className="schedule-item__value">Every 15 minutes</span>
                    </div>
                </div>

                <div className="card" style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Current Segment:{' '}
                        <strong style={{ color: 'var(--accent-primary)' }}>
                            {currentSegment?.name}
                        </strong>
                    </div>

                    <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        marginTop: '4px',
                    }}>
                        ★ = Recommended sections for this time
                    </div>
                </div>
            </div>
        </>
    );
}

export default RefreshPage;
