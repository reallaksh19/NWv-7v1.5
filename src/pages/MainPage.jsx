import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Header from '../components/Header';
import NewsSection from '../components/NewsSection';
import SectionNavigator from '../components/SectionNavigator';
import BreakingNews from '../components/BreakingNews';
import TimelineHeader from '../components/TimelineHeader';
import QuickWeather from '../components/QuickWeather';
import DataStateBoundary from '../components/DataStateBoundary.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery';
import GradeBadge from '../components/audit/GradeBadge.jsx';
import '../components/audit/AuditDetailModal.css';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import TravelLocationBanner from '../components/travel/TravelLocationBanner.jsx';
import TravelLocalStories from '../components/travel/TravelLocalStories.jsx';
import { useMainTabViewModel } from '../viewModels/useMainTabViewModel.js';

const MainPage = () => {
    const {
        envelope,
        settings,
        sections,
        uiMode,
        currentSegment,
        notifPermission,
        newsData,
        breakingNews,
        travelLocationProfile,
        prioritizedNewsData,
        latestStories,
        toplineContent,
        fallbackTopline,
        mainTabAudit,
        navSections,
        refreshAll,
        isLoading,
        loadingPhase,
        isTimelineMode,
        isUrgentMode,
        error,
        marketTickerProps,
        themeToggleProps,
        shellRuntimeProps,
    } = useMainTabViewModel();

    const { isWebView } = useMediaQuery();
    // refreshAll delegates to Promise.allSettled — parallel crash-safe refresh
    const { pullDistance } = usePullToRefresh(refreshAll);

    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 400);
        };

        window.addEventListener('scroll', handleScroll);

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const headerActions = (
        <div className="header__actions">
            <Link to="/refresh" className="header__action-btn">🔄</Link>
            <Link to="/settings" className="header__action-btn">⚙️</Link>
        </div>
    );

    return (
        <div className={`page-container mode-${uiMode} ${isWebView ? 'page-container--desktop' : ''}`}>
            <GradeBadge
                audit={mainTabAudit}
                label="Main tab quality grade"
                position="below-header"
                compact={false}
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

            {isTimelineMode ? (
                <TimelineHeader
                    title=""
                    icon=""
                    actions={headerActions}
                    loadingPhase={loadingPhase}
                    marketTickerProps={marketTickerProps}
                />
            ) : (
                <Header
                    title=""
                    icon=""
                    actions={headerActions}
                    loadingPhase={loadingPhase}
                    showMarket
                    marketTickerProps={marketTickerProps}
                    themeToggleProps={themeToggleProps}
                    shellRuntimeProps={shellRuntimeProps}
                />
            )}

            <main className={`main-content ${isWebView ? 'main-content--desktop' : ''}`}>
                <DataStateBoundary
                    envelope={envelope}
                    loading={isLoading}
                    error={error}
                    onRetry={refreshAll}
                    label="Main"
                    emptyTitle="No updates available"
                    emptyMessage="Main feed is empty. Try refreshing or checking source health."
                    errorTitle="Main feed unavailable"
                    errorMessage={error || 'Unable to load the main feed.'}
                    allowDegraded={true}
                    treatEmptyAsReady={false}
                    showMeta={true}
                    showBanner={true}
                >
                    {() => (
                        <>
                            {isLoading && (
                                <div className="loading" style={{ padding: '40px' }}>
                                    <div className="loading__spinner"></div>
                                    <span>Loading Updates...</span>
                                </div>
                            )}

                            {isWebView ? (
                                <div className="main-page-grid">
                                    <div className="left-col">
                                        <QuickWeather />

                                        <TravelLocationBanner profile={travelLocationProfile} />
                                        <TravelLocalStories newsData={prioritizedNewsData} profile={travelLocationProfile} />

                                        <div className="modern-card" style={{ marginTop: '20px' }}>
                                            <div className="modern-card__header">
                                                <h2 className="modern-card__title">🌍 Global News</h2>
                                            </div>

                                            <div className="newspaper-column">
                                                {(newsData.world || []).slice(0, 8).map((item, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={item.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="newspaper-item"
                                                    >
                                                        <div className="newspaper-item__title">{item.title}</div>
                                                        <div className="newspaper-item__meta">{item.source} • {item.time}</div>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="right-col">
                                        <div className="news-sections">
                                            {latestStories.length > 0 && (
                                                <NewsSection
                                                    id="top-stories"
                                                    title="Top Stories"
                                                    icon="⭐"
                                                    colorClass="news-section__title--world"
                                                    news={latestStories}
                                                    maxDisplay={10}
                                                />
                                            )}

                                            {sections.india?.enabled && (
                                                <NewsSection
                                                    id="india-news"
                                                    title="India News"
                                                    icon="🇮🇳"
                                                    colorClass="news-section__title--india"
                                                    news={newsData.india}
                                                    maxDisplay={sections.india.count || 5}
                                                />
                                            )}

                                            {sections.chennai?.enabled && (
                                                <NewsSection
                                                    id="chennai-news"
                                                    title="Tamil Nadu"
                                                    icon="🏛️"
                                                    colorClass="news-section__title--chennai"
                                                    news={newsData.chennai}
                                                    maxDisplay={sections.chennai.count || 5}
                                                />
                                            )}

                                            {sections.local?.enabled && (
                                                <NewsSection
                                                    id="local-news"
                                                    title="Muscat / Local"
                                                    icon="📍"
                                                    colorClass="news-section__title--local"
                                                    news={newsData.local}
                                                    maxDisplay={sections.local.count || 5}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="content-wrapper">
                                    {!isTimelineMode && (
                                        <>
                                            <div className="topline">
                                                <div
                                                    className="topline__label"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    <span>{toplineContent?.icon || '📰'}</span>
                                                    <span>{toplineContent?.type || 'TOPLINE'}</span>
                                                </div>
                                                <div className="topline__text">
                                                    {toplineContent?.text || fallbackTopline}
                                                </div>
                                            </div>

                                            <BreakingNews items={breakingNews} />
                                        </>
                                    )}

                                    <QuickWeather />

                                    <div className="news-sections">
                                        {(!isUrgentMode || breakingNews.length === 0) && (
                                            <>
                                                {latestStories.length > 0 && (
                                                    <NewsSection
                                                        id="top-stories"
                                                        title="Top Stories"
                                                        icon="⭐"
                                                        colorClass="news-section__title--world"
                                                        news={latestStories}
                                                        maxDisplay={10}
                                                    />
                                                )}

                                                {sections.india?.enabled && (
                                                    <NewsSection
                                                        id="india-news"
                                                        title="India"
                                                        icon="🇮🇳"
                                                        colorClass="news-section__title--india"
                                                        news={newsData.india}
                                                        maxDisplay={sections.india.count || 5}
                                                    />
                                                )}

                                                {sections.chennai?.enabled && (
                                                    <NewsSection
                                                        id="chennai-news"
                                                        title="Tamil Nadu"
                                                        icon="🏛️"
                                                        colorClass="news-section__title--chennai"
                                                        news={newsData.chennai}
                                                        maxDisplay={sections.chennai.count || 5}
                                                    />
                                                )}

                                                {sections.local?.enabled && (
                                                    <NewsSection
                                                        id="local-news"
                                                        title="Muscat"
                                                        icon="📍"
                                                        colorClass="news-section__title--local"
                                                        news={newsData.local}
                                                        maxDisplay={sections.local.count || 5}
                                                    />
                                                )}

                                                <NewsSection
                                                    id="world-news"
                                                    title="World"
                                                    icon="🌍"
                                                    colorClass="news-section__title--world"
                                                    news={newsData.world}
                                                    maxDisplay={sections.world?.count || 5}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {settings.debugLogs && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    marginTop: 'var(--spacing-md)',
                                    padding: '8px 12px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)',
                                    flexWrap: 'wrap'
                                }}>
                                    <span title="Segment">{currentSegment.icon} {currentSegment.label}</span>
                                    <span title="Notifications">{notifPermission === 'granted' ? '🔔' : '🔕'}</span>
                                    <span title="UI Mode">📱 {uiMode}</span>
                                </div>
                            )}
                        </>
                    )}
                </DataStateBoundary>
            </main>

            <SectionNavigator sections={navSections} />

            <button
                onClick={scrollToTop}
                style={{
                    position: 'fixed',
                    bottom: '90px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    opacity: showBackToTop ? 1 : 0,
                    pointerEvents: showBackToTop ? 'auto' : 'none',
                    transition: 'all 0.3s ease',
                    zIndex: 900,
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
                className="back-to-top"
            >
                ↑
            </button>
        </div>
    );
};

export default MainPage;
