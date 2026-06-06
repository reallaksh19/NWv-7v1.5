/**
 * Builds a Google News RSS search URL from user keywords
 *
 * User types: "Tamil Nadu Elections"
 * Output: https://news.google.com/rss/search?q=Tamil+Nadu+Elections+when:7d&hl=en-IN&gl=IN&ceid=IN:en
 *
 * User types: "Sri Lanka floods"
 * Output: https://news.google.com/rss/search?q=Sri+Lanka+floods+when:7d&hl=en-LK&gl=LK&ceid=LK:en
 */
import { inferTopicCountryEdition } from './topicCountryInference.js';

export function buildTopicQuery(topic, options = {}) {
    const inferred = inferTopicCountryEdition(topic);
    const {
        country = inferred.country,
        lang = inferred.lang,
        timeRange = '7d',  // 7 days by default
        excludeTerms = []
    } = options;

    // Encode the base query
    // If the topic already contains URI encoded chars, we might double encode, but assume input is raw text.
    // However, if the user typed "A OR B", we want "A+OR+B". encodeURIComponent handles space as %20.
    // Google News accepts %20.

    let query = encodeURIComponent(topic);

    // Add time constraint (e.g., when:7d for last 7 days)
    if (timeRange) {
        query += `+when:${timeRange}`;
    }

    // Add exclusion terms
    if (Array.isArray(excludeTerms)) {
        excludeTerms.forEach(term => {
            query += `+-${encodeURIComponent(term)}`;
        });
    }

    // Construct Google News parameters
    const hl = `${lang}-${country}`;  // Host Language: en-IN or en-LK
    const gl = country;                // Geolocation: IN or LK
    const ceid = `${country}:${lang}`; // Custom Edition ID: IN:en or LK:en

    return `https://news.google.com/rss/search?q=${query}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

