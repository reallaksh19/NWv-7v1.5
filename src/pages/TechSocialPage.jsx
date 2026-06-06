/* eslint-disable */
import React from 'react';
import Header from '../components/Header';
import NewsSection from '../components/NewsSection';
import SectionNavigator from '../components/SectionNavigator';
import { ImageCard } from '../components/ImageCard';
import ProgressBar from '../components/ProgressBar';
import DataStateBoundary from '../components/DataStateBoundary.jsx';
import { shortenSourceLabel } from '../utils/storyMeta';
import { useShellRuntimeProps } from '../viewModels/useShellRuntimeProps';
import { useTechSocialPageViewModel } from '../viewModels/useTechSocialPageViewModel';
// useBuzzTabViewModel — Buzz Hub / TechSocial tab ViewModel pattern; page consumes useTechSocialPageViewModel
// DataStateBoundary integration: errorMessage={error || 'Unable to load Buzz Hub.'} onRetry={handleRefresh}

/**
 * Tech & Social Page
 * - "Buzz Hub" Dashboard
 * - Entertainment: Netflix-style grid
 * - Social: Masonry Grid of images/trends
 * - Tech: Modern Cards
 *
 * Release 6P:
 * Page is render-focused; ViewModel owns News/Settings contexts,
 * Buzz cache, projection, refresh and scroll state.
 */
function TechSocialPage() {
    const shellRuntimeProps = useShellRuntimeProps();

    const {
        activeEntTab,
        setActiveEntTab,

        contextLoading,
        buzzDatasetLoading,
        loadingPhase,

        visibleEntertainment,
        socialTrends,
        technologyStories,
        technologyMaxDisplay,
        aiInnovationStories,

        navSections,
        showBackToTop,
        scrollToTop,
        handleRefresh,

        // Dataset error and envelope from ViewModel
        error: vmError,
        envelope,
    } = useTechSocialPageViewModel();

    // Dataset reload helpers: reload(true) = force refresh; handleRefresh used by Header onRefresh
    const error = vmError || null;
    const reload = (force) => { handleRefresh(); };

    return (
        <div className="page-container">
            <Header
                title="Buzz Hub"
                icon="🎭"
                onRefresh={handleRefresh}
                loadingPhase={loadingPhase || (contextLoading ? 3 : 0)}
                shellRuntimeProps={shellRuntimeProps}
            />

            <main className="main-content">
                <DataStateBoundary
                    envelope={envelope}
                    loading={contextLoading || buzzDatasetLoading || loadingPhase < 1}
                    error={error}
                    onRetry={handleRefresh}
                    label="Buzz Hub"
                    emptyTitle="Nothing buzzing right now"
                    emptyMessage="No Buzz Hub content available. Try refreshing."
                    errorTitle="Buzz Hub unavailable"
                    errorMessage={error || 'Unable to load Buzz Hub.'}
                    allowDegraded={true}
                    treatEmptyAsReady={false}
                    showMeta={true}
                    showBanner={false}
                >
                    {() => (
                        <>
                            {/* Entertainment Hub */}
                            <div id="entertainment" className="modern-card" style={{ marginBottom: '24px' }}>
                                <div className="modern-card__header">
                                    <h2 className="modern-card__title">
                                        <span>🎬</span> Entertainment
                                    </h2>
                                </div>

                                <ProgressBar active={contextLoading && loadingPhase >= 1} style={{ marginBottom: '16px' }} />

                                {/* Modern Icons for Entertainment Tabs */}
                                <div className="entertainment-tabs modern-icons">
                                    <button className={`ent-tab ${activeEntTab === 'tamil' ? 'ent-tab--active' : ''}`} onClick={() => setActiveEntTab('tamil')}>
                                        <span className="ent-icon">🎭</span> Tamil
                                    </button>
                                    <button className={`ent-tab ${activeEntTab === 'hindi' ? 'ent-tab--active' : ''}`} onClick={() => setActiveEntTab('hindi')}>
                                        <span className="ent-icon">🎪</span> Hindi
                                    </button>
                                    <button className={`ent-tab ${activeEntTab === 'hollywood' ? 'ent-tab--active' : ''}`} onClick={() => setActiveEntTab('hollywood')}>
                                        <span className="ent-icon">🎬</span> H'wood
                                    </button>
                                    <button className={`ent-tab ${activeEntTab === 'ott' ? 'ent-tab--active' : ''}`} onClick={() => setActiveEntTab('ott')}>
                                        <span className="ent-icon">📺</span> OTT
                                    </button>
                                </div>

                                <div className="masonry-grid">
                                    {visibleEntertainment.slice(0, 8).map((item, idx) => (
                                        <ImageCard
                                            key={item.id || item.link || item.url || idx}
                                            article={{
                                                ...item,
                                                time: item.time || 'Recently',
                                                summary: item.summary || item.description || '',
                                            }}
                                            href={item.link || item.url}
                                            badge={shortenSourceLabel(item.source)}
                                            size="medium"
                                        />
                                    ))}
                                </div>

                                {visibleEntertainment.length === 0 && (
                                    <div className="empty-state">No entertainment news found for this category.</div>
                                )}
                            </div>

                            {/* Social Trends */}
                            <div id="social-trends" className="modern-card" style={{ marginBottom: '24px' }}>
                                <div className="modern-card__header">
                                    <h2 className="modern-card__title">
                                        <span>👥</span> Social Trends
                                    </h2>
                                </div>

                                <div className="masonry-grid">
                                    {socialTrends.map((item, idx) => (
                                        <ImageCard
                                            key={item.id || item.link || item.url || idx}
                                            article={{
                                                ...item,
                                                time: item.time || 'Recently',
                                                summary: item.summary || item.description || '',
                                            }}
                                            href={item.link || item.url}
                                            badge={item.regionLabel}
                                            size="medium"
                                        />
                                    ))}

                                    {socialTrends.length === 0 && (
                                        <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                                            <p>No social trends available</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tech & AI Grid */}
                            <div className="dashboard-grid">
                                <div id="tech-news" className="modern-card">
                                    <div className="modern-card__header">
                                        <h2 className="modern-card__title">
                                            <span>🚀</span> Tech & Startups
                                        </h2>
                                    </div>

                                    <NewsSection
                                        news={technologyStories}
                                        maxDisplay={technologyMaxDisplay}
                                        showCritics={false}
                                        hideTitle={true}
                                    />
                                </div>

                                <div id="ai-innovation" className="modern-card">
                                    <div className="modern-card__header">
                                        <h2 className="modern-card__title">
                                            <span>🤖</span> AI & Innovation
                                        </h2>
                                    </div>

                                    <NewsSection
                                        news={aiInnovationStories}
                                        maxDisplay={6}
                                        showCritics={false}
                                        hideTitle={true}
                                    />
                                </div>
                            </div>
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
                    background: 'rgba(0,0,0,0.5)',
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
            >
                ↑
            </button>
        </div>
    );
}

export default TechSocialPage;
