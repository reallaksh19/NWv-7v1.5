import React from 'react';
import DataStateBoundary from '../components/DataStateBoundary.jsx';
import { TopicCard } from '../components/TopicCard.jsx';
import { TopicSearch } from '../components/TopicSearch.jsx';
import { useFollowingTabViewModel } from '../viewModels/useFollowingTabViewModel.js';
import './FollowingPage.css';

export default function FollowingPage() {
    const {
        envelope,
        sortedTopics,
        loading,
        suggestions,
        topicMessage,
        addTopic,
        removeTopic,
        clearTopicMessage,
        handleSuggestionClick,
        getArticlesForTopic,
        getArticleCountForTopic,
        hasTopics,
        stats,
        refresh,
        error,
    } = useFollowingTabViewModel();

    const handleRefresh = () => refresh(false);

    return (
        <div className="following-page following-page--pro">
            <header className="following-page__hero">
                <div>
                    <div className="following-page__eyebrow">Personal topic desk</div>
                    <h1>📌 Following</h1>
                    <p>
                        Track recurring topics, companies, people, cities, and story lines from one focused desk.
                    </p>
                </div>

                <button
                    type="button"
                    className="following-page__refresh"
                    onClick={handleRefresh}
                    disabled={loading}
                >
                    {loading ? 'Refreshing…' : 'Refresh topics'}
                </button>
            </header>

            <main className="following-page__content following-page__content--pro">
                <section className="following-page__rail">
                    <TopicSearch onAddTopic={addTopic} />

                    {topicMessage && (
                        <div className="following-page__message">
                            <span>{topicMessage}</span>
                            <button type="button" onClick={clearTopicMessage} aria-label="Dismiss topic message">×</button>
                        </div>
                    )}

                    {suggestions.length > 0 && (
                        <div className="following-page__suggestions-section">
                            <h4>Suggested for you</h4>
                            <div className="following-page__suggestions">
                                {suggestions.map((suggestion, index) => (
                                    <button
                                        key={`${suggestion.query || suggestion.word}-${index}`}
                                        className="suggestion-chip"
                                        onClick={() => handleSuggestionClick(suggestion.word)}
                                    >
                                        + {suggestion.word}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <section className="following-page__desk">
                    <DataStateBoundary
                        envelope={envelope}
                        loading={loading}
                        error={error}
                        onRetry={handleRefresh}
                        label="Following"
                        emptyTitle="No topics followed yet"
                        emptyMessage="Search and follow a topic to build your personal news desk."
                        errorTitle="Following unavailable"
                        errorMessage={error || 'Unable to load followed topics.'}
                        allowDegraded={true}
                        treatEmptyAsReady={true}
                        showMeta={true}
                        showBanner={true}
                    >
                        {() => (
                            <>
                                <div className="following-page__stats">
                                    <div className="following-page__stat">
                                        <span>📌 Topics</span>
                                        <strong>{stats.topicCount}</strong>
                                    </div>
                                    <div className="following-page__stat">
                                        <span>📰 Articles</span>
                                        <strong>{stats.articleCount}</strong>
                                    </div>
                                    <div className="following-page__stat">
                                        <span>⚡ Active</span>
                                        <strong>{stats.activeCount}</strong>
                                    </div>
                                    <div className="following-page__stat">
                                        <span>✨ New</span>
                                        <strong>{stats.newCount}</strong>
                                    </div>
                                </div>

                                {loading && (
                                    <div className="following-page__loading">
                                        Loading topic updates...
                                    </div>
                                )}

                                {hasTopics ? (
                                    <div className="following-page__topics">
                                        <div className="following-page__section-row">
                                            <div>
                                                <div className="following-page__eyebrow">Watchlist</div>
                                                <h2 className="following-page__section-title">Your Topics</h2>
                                            </div>
                                            <span>{sortedTopics.length} followed</span>
                                        </div>

                                        <div className="following-page__topic-grid">
                                            {sortedTopics.map(topic => (
                                                <TopicCard
                                                    key={topic.id}
                                                    topic={topic}
                                                    articleCount={getArticleCountForTopic(topic.id)}
                                                    articles={getArticlesForTopic(topic.id)}
                                                    onRemove={removeTopic}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="following-page__empty">
                                        <div className="following-page__empty-icon">📌</div>
                                        <h2>No topics followed yet</h2>
                                        <p>Search above and follow a topic to build your personal news desk.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </DataStateBoundary>
                </section>
            </main>
        </div>
    );
}
