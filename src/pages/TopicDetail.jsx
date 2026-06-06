import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTopics } from '../context/TopicContext.jsx';
import NewsSection from '../components/NewsSection.jsx';
import { useTopicDetailViewModel } from '../viewModels/useTopicDetailViewModel.js';
import { useMountedRef } from '../hooks/useMountedRef.js';
// Note: withTimeout and per-fetch deadline protection are encapsulated in useTopicDetailViewModel
import './FollowingPage.css';

export default function TopicDetail() {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const { followedTopics, addToHistory } = useTopics();
    const [notFoundTimeout, setNotFoundTimeout] = useState(false);
    const mountedRef = useMountedRef();

    const topic = followedTopics.find(t => t.id === topicId);

    const {
        articles,
        loading,
        error,
        envelope: env,
        fetch: loadTopic,
        retry,
    } = useTopicDetailViewModel(topic);

    useEffect(() => {
        if (topic) return;

        const timeoutId = setTimeout(() => {
            if (mountedRef.current) setNotFoundTimeout(true);
        }, 5000);

        return () => clearTimeout(timeoutId);
    }, [topic, mountedRef]);

    useEffect(() => {
        loadTopic();
    }, [loadTopic]);

    if (!topic) {
        return (
             <div className="page-container">
                 <div className="loading" style={{padding: '20px'}}>
                     {notFoundTimeout ? (
                         <>
                             <p>Topic not found.</p>
                             <button onClick={() => navigate('/following')}>Back to List</button>
                         </>
                     ) : (
                         <p>Loading topic…</p>
                     )}
                 </div>
             </div>
        );
    }

    return (
        <div className="page-container">
            <header
                className="header"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    padding: '10px 15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px'
                }}
            >
                <button
                    onClick={() => navigate('/following')}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        color: 'var(--text-primary)'
                    }}
                >
                    ←
                </button>
                <h1 style={{margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span>{topic?.icon}</span>
                    {topic?.name}
                </h1>
            </header>

            <main className="main-content" style={{paddingTop: '0'}}>
                {loading ? (
                    <div className="loading" style={{padding: '20px', textAlign: 'center'}}>
                        <div className="loading__spinner"></div>
                        <p>Fetching latest news...</p>
                    </div>
                ) : (
                    <>
                        {(error || (env && env.ok === false)) && (
                            <div className="modern-card empty-state" role="alert" style={{margin: '20px', padding: '30px', textAlign: 'center', borderStyle: 'dashed'}}>
                                <span style={{fontSize: '2rem', display: 'block', marginBottom: '12px'}}>📡</span>
                                <h3>Unable to load this topic</h3>
                                <p style={{color: 'var(--text-secondary)', marginBottom: '16px'}}>{error}</p>
                                {articles.length > 0 && (
                                    <p style={{color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px'}}>
                                        Showing the last available results below.
                                    </p>
                                )}
                                {env?.diagnostics?.length > 0 && (
                                    <p style={{color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px'}}>
                                        {env.diagnostics[0]?.message}
                                    </p>
                                )}
                                <button type="button" className="btn btn--primary" onClick={retry}>
                                    Retry
                                </button>
                            </div>
                        )}

                        {(articles.length > 0 || !error) && (
                            <div style={{padding: '10px'}}>
                                <NewsSection
                                    id={`topic-${topicId}`}
                                    title={`Latest on ${topic?.name}`}
                                    icon={topic?.icon}
                                    news={articles}
                                    maxDisplay={50}
                                    showExpand={false}
                                    colorClass="news-section__title--world"
                                    onArticleClick={(article) => addToHistory(article)}
                                />
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
