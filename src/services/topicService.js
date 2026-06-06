import { buildTopicQuery } from '../utils/topicQueryBuilder.js';
import { fetchAndParseFeed } from './rssAggregator.js';
import { updateTopicLastFetched, getSettings } from '../utils/storage.js';
import { makeEnvelope } from '../data/dataEnvelope.js';

function getTopicDatasetId(topic) {
    return `topic:${topic?.id || topic?.query || topic?.name || 'unknown'}`;
}

function getTopicDisplayName(topic) {
    return topic?.name || topic?.query || topic?.id || 'unknown';
}

function failedTopicEnvelope(topic, message, diagnosticsEvent = 'topic_fetch_failed') {
    return makeEnvelope({
        ok: false,
        datasetId: getTopicDatasetId(topic),
        data: [],
        source: 'failed',
        freshness: 'unknown',
        error: message,
        validation: {
            passed: false,
            errors: [message],
            warnings: [],
        },
        diagnostics: [
            {
                event: diagnosticsEvent,
                severity: 'error',
                message,
            },
        ],
    });
}

function safeGetSettings() {
    try {
        return getSettings() || {};
    } catch (error) {
        console.warn('[TopicService] Failed to read settings. Using defaults.', error);
        return {};
    }
}

/**
 * Fetches news articles for a specific followed topic.
 * Returns a canonical DataEnvelope.
 */
export async function fetchTopicNews(topic) {
    const datasetId = getTopicDatasetId(topic);
    const topicName = getTopicDisplayName(topic);
    const query = topic?.query || topic?.name;

    if (!query) {
        return failedTopicEnvelope(
            topic,
            'Invalid topic: missing query/name',
            'topic_fetch_invalid'
        );
    }

    try {
        const feedUrl = buildTopicQuery(query, topic?.options || {});

        console.log(`[TopicService] Fetching news for "${topicName}"`);

        const articles = await fetchAndParseFeed(feedUrl, 'following');

        if (topic?.id) {
            updateTopicLastFetched(topic.id);
        }

        const settings = safeGetSettings();
        const limitHours = settings.hideOlderThanHours || 60;
        const now = Date.now();
        const maxAge = limitHours * 60 * 60 * 1000;
        const strictFreshness = settings.strictFreshness !== false;

        let filteredArticles = Array.isArray(articles) ? articles : [];

        if (strictFreshness) {
            filteredArticles = filteredArticles.filter(article => {
                if (!article.publishedAt) return false;
                const age = now - article.publishedAt;
                return age <= maxAge;
            });

            console.log(
                `[TopicService] Filtered ${(Array.isArray(articles) ? articles.length : 0) - filteredArticles.length} old articles for "${topicName}" (Limit: ${limitHours}h)`
            );
        }

        const articlesWithTopic = filteredArticles.map(article => ({
            ...article,
            topicId: topic?.id,
            topicName: topic?.name || topicName,
            context: 'following'
        }));

        return makeEnvelope({
            ok: true,
            datasetId,
            data: articlesWithTopic,
            source: 'live',
            freshness: articlesWithTopic.length > 0 ? 'fresh' : 'empty',
            generatedAt: Date.now(),
            validation: {
                passed: true,
                errors: [],
                warnings: articlesWithTopic.length === 0 ? ['topic_returned_no_articles'] : [],
            },
            diagnostics: [
                {
                    event: 'topic_fetch_success',
                    severity: 'info',
                    message: `${articlesWithTopic.length} article(s) loaded`,
                },
            ],
        });

    } catch (error) {
        const message = error?.name === 'TimeoutError'
            ? 'TimeoutError'
            : (error?.message || String(error));

        console.error(`[TopicService] Failed to fetch topic "${topicName}":`, error);

        return failedTopicEnvelope(topic, message);
    }
}

/**
 * Fetches news for all followed topics in parallel.
 * Preserves compatibility by returning { [topicId]: Article[] | DataEnvelope }.
 */
export async function fetchAllTopicsNews(followedTopics) {
    if (!followedTopics || followedTopics.length === 0) return {};

    const results = await Promise.allSettled(
        followedTopics.map(topic => fetchTopicNews(topic))
    );

    const byTopic = {};

    results.forEach((result, index) => {
        const topic = followedTopics[index];
        const topicId = topic?.id;

        if (!topicId) return;

        if (result.status === 'fulfilled') {
            const env = result.value;

            if (Array.isArray(env)) {
                byTopic[topicId] = env;
                return;
            }

            if (env?.ok === true && Array.isArray(env.data)) {
                byTopic[topicId] = env.data;
                return;
            }

            byTopic[topicId] = env;
            return;
        }

        const message = result.reason?.message || String(result.reason);

        byTopic[topicId] = failedTopicEnvelope(topic, message);
    });

    return byTopic;
}
