/* eslint-disable */
// useNewspaperTabViewModel — Newspaper tab ViewModel pattern; page consumes useNewspaperPageViewModel
// DataStateBoundary integration: <DataStateBoundary onRetry={handleRefresh} errorMessage={error || "Failed to load today's newspaper."} />
import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaNewspaper,
  FaSync,
  FaLanguage,
  FaMagic,
  FaExclamationTriangle,
  FaBolt,
} from 'react-icons/fa';
import { useMediaQuery } from '../hooks/useMediaQuery';
import NewspaperCard from '../components/NewspaperCard';
import '../components/NewspaperLayout.css';
import {
  useNewspaperPageViewModel,
} from '../viewModels/useNewspaperPageViewModel';

const methodLabels = {
  gemini: 'AI Summary',
  server: 'Summary',
  extractive: 'Auto-Summary',
  headlines: 'Headlines',
};

const NewspaperPage = () => {
  const { isWebView } = useMediaQuery();

  const {
    sources,
    activeSource,
    currentSections,
    data,
    lastUpdated,
    loading,
    error,

    isTranslated,
    dynamicTitles,
    isGeneratingSummary,
    isTranslatingTitles,
    digestMode,
    isGeneratingAll,
    summaryLineLimit,
    hasGeminiKey,

    showTranslationControls,

    handleRefresh,
    reload,
    getSectionSummary,
    handleGenerateAll,
    handleSourceChange,
    toggleDigestMode,
    toggleTranslation,
  } = useNewspaperPageViewModel();

  return (
    <div className={`page-container mode-newspaper ${isWebView ? 'page-container--desktop' : ''}`}>
      <div className="header">
        <div className="header__title">
          <FaNewspaper className="header__title-icon" />
          <span>Daily Brief</span>
        </div>

        <div className="header__actions" style={{ gap: '8px' }}>
          <button
            onClick={handleGenerateAll}
            className={`btn-icon ${isGeneratingAll ? 'pulse' : ''}`}
            title="Generate All Summaries"
            disabled={isGeneratingAll}
            style={{
              color: isGeneratingAll ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}
          >
            <FaBolt size={18} />
          </button>

          <button
            onClick={toggleDigestMode}
            className={`btn-icon ${digestMode ? 'active' : ''}`}
            title={digestMode ? 'Card View' : 'Digest View'}
            style={{
              color: digestMode ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '1.1rem',
            }}
          >
            {digestMode ? '📰' : '📖'}
          </button>

          {showTranslationControls && (
            <button
              onClick={toggleTranslation}
              className={`btn-icon ${isTranslated ? 'active' : ''}`}
              title={isTranslated ? 'Show Original (Tamil)' : 'Translate to English'}
              style={{
                color: isTranslated ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              <FaLanguage size={24} />
            </button>
          )}

          <button onClick={handleRefresh} className="btn-icon" aria-label="Refresh" title="Refresh newspaper">
            <FaSync className={loading ? 'spin' : ''} />
          </button>
          {/* Force reload: reload(true) triggers a fresh fetch bypassing cache */}
        </div>
      </div>

      <div
        className="topline"
        style={{
          borderRadius: 0,
          margin: 0,
          borderLeft: 'none',
          borderBottom: '1px solid var(--border-default)',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', minWidth: 'max-content' }}>
          {Object.values(sources).map(source => (
            <button
              key={source.id}
              onClick={() => handleSourceChange(source.id)}
              className={`btn ${activeSource === source.id ? 'btn--primary' : 'btn--secondary'}`}
              style={{
                padding: '8px 12px',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
              }}
            >
              {source.label}
            </button>
          ))}
        </div>

        {lastUpdated && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginTop: '8px',
              textAlign: 'center',
            }}
          >
            Updated: {new Date(lastUpdated).toLocaleString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>

      <div className="main-content" style={{ padding: '16px' }}>
        {loading && !data ? (
          <div className="loading">
            <div className="loading__spinner"></div>
            <p>Fetching Today&apos;s Brief...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state__icon">⚠️</div>
            <p>{error}</p>
            <button onClick={handleRefresh} className="btn btn--primary mt-md">
              Retry
            </button>
          </div>
        ) : (
          <div className="newspaper-content">
            {!currentSections || currentSections.length === 0 ? (
              <div className="empty-state">
                <p>No content available for this source today.</p>
              </div>
            ) : (
              currentSections.map((section, idx) => {
                const summaryResult = getSectionSummary(section);
                const sectionArticles = Array.isArray(section.articles) ? section.articles : [];

                return (
                  <div key={`${section.page || 'page'}-${idx}`} className="newspaper-section" style={{ marginBottom: '32px' }}>
                    <h2
                      className="zone-title"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{section.page}</span>

                      {isTranslatingTitles && isTranslated && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--accent-primary)',
                            fontWeight: 'normal',
                          }}
                        >
                          Translating...
                        </span>
                      )}
                    </h2>

                    {summaryResult ? (
                      <div
                        style={{
                          background: 'var(--bg-secondary)',
                          padding: '16px',
                          borderRadius: '8px',
                          marginBottom: '20px',
                          borderLeft: '4px solid var(--accent-primary)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: 'var(--accent-primary)',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                          }}
                        >
                          <FaMagic />
                          <span>{methodLabels[summaryResult.method] || 'Summary'}</span>

                          {summaryResult.method === 'extractive' && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 'normal',
                                color: 'var(--text-muted)',
                                marginLeft: '4px',
                              }}
                            >
                              (no API key needed)
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            whiteSpace: 'pre-line',
                            fontSize: '0.95rem',
                            lineHeight: '1.6',
                            fontFamily: 'serif',
                            display: '-webkit-box',
                            WebkitLineClamp: summaryLineLimit,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {summaryResult.text}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '12px',
                          marginBottom: '20px',
                          background: 'rgba(255, 0, 0, 0.05)',
                          borderLeft: '4px solid var(--accent-danger)',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FaExclamationTriangle color="var(--accent-danger)" />
                          <span>
                            {section.error === 'Quota Exceeded'
                              ? 'Daily AI Limit Reached.'
                              : section.error === 'API Key Missing'
                                ? 'AI Summary Unavailable.'
                                : 'Summary not generated.'}
                          </span>
                        </div>

                        {!hasGeminiKey && (
                          <Link
                            to="/settings"
                            style={{
                              color: 'var(--accent-primary)',
                              fontWeight: 'bold',
                            }}
                          >
                            Add Key to Enable
                          </Link>
                        )}

                        {hasGeminiKey && isGeneratingSummary && (
                          <span style={{ color: 'var(--accent-primary)' }}>
                            Generating...
                          </span>
                        )}
                      </div>
                    )}

                    {digestMode ? (
                      <div style={{ fontSize: '0.9rem', lineHeight: '1.7' }}>
                        {sectionArticles.map((article, aIdx) => {
                          const title = (isTranslated && (dynamicTitles[article.link] || article.title_en)) || article.title;

                          return (
                            <div
                              key={`${article.link || article.title || 'article'}-${aIdx}`}
                              style={{
                                padding: '8px 0',
                                borderBottom: '1px solid var(--border-default)',
                              }}
                            >
                              <a
                                href={article.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: 'var(--text-primary)',
                                  textDecoration: 'none',
                                  fontWeight: 500,
                                }}
                              >
                                {title}
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                          gap: '16px',
                        }}
                      >
                        {sectionArticles.map((article, aIdx) => {
                          const articleWithTranslation = {
                            ...article,
                            title_en: dynamicTitles[article.link] || article.title_en,
                          };

                          return (
                            <NewspaperCard
                              key={`${article.link || article.title || 'article'}-${aIdx}`}
                              article={articleWithTranslation}
                              sourceName={sources[activeSource].label}
                              isTranslated={isTranslated}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            <div className="market-disclaimer" style={{ marginTop: '32px' }}>
              Content aggregated from official sources. Summaries generated by AI.
              Verify important details from original articles.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewspaperPage;
