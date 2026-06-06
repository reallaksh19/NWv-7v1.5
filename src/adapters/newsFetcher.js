
import { fetchNews } from '../services/newsService.js';
import { extractSchemaOrg } from './schemaOrgExtractor.js';
import { fnv1aHex } from '../data/dataEnvelope.js';

// Different query per slot for temporal diversity
const SLOT_QUERIES = {
  now       : 'breaking news today top stories',
  minus4h   : 'India news today top headlines',
  minus12h  : 'world news top stories',
  minus24h  : 'business economy markets technology',
  world     : 'world news top stories today',
  india     : 'India news today top stories',
  business  : 'India business economy markets today',
  technology: 'technology AI startups innovation',
  sports    : 'cricket IPL football sports India',
  chennai   : 'Chennai Tamil Nadu news today',
};

export function makeStableSlotStoryId(slot, article) {
  const seed = article?.url || article?.link || article?.title || article?.headline || '';
  return `${slot}-${fnv1aHex(seed)}`;
}

export async function fetchStoriesForSlot(slot) {
  const query = SLOT_QUERIES[slot] || `${slot} news today`;
  const news = await fetchNews(query, { newsApiKey: '' });
  if (!news || !Array.isArray(news)) return [];

  return news.map((article) => {
    // Try Schema.org enrichment if raw HTML is available
    const schema = article.rawHtml ? extractSchemaOrg(article.rawHtml) : null;

    // Timestamp — must be a NUMBER (epoch ms), not ISO string
    let publishedAt;
    if (schema?.datePublished) {
      publishedAt = Date.parse(schema.datePublished);
    } else if (typeof article.publishedAt === 'number') {
      publishedAt = article.publishedAt;
    } else if (article.publishedAt) {
      publishedAt = Date.parse(article.publishedAt);
    } else {
      publishedAt = Date.now();
    }
    if (isNaN(publishedAt)) publishedAt = Date.now();

    return {
      // Slot-prefixed ID prevents cross-slot collisions in storiesById Map
      id         : makeStableSlotStoryId(slot, article),
      title      : schema?.headline    || article.headline || article.title   || '',
      summary    : schema?.description || article.description || article.summary || article.headline || '',
      content    : schema?.description || article.description || article.summary || '',
      url        : article.url || article.link || '',
      publishedAt,
      author     : schema?.author   || article.author  || null,
      image      : schema?.image    || article.image   || null,
      keywords   : schema?.keywords || [],
      source     : article.source   || 'Unknown',
      sourceGroup: (article.source  || 'unknown').toLowerCase().replace(/[^a-z]/g, '_'),
    };
  });
}
