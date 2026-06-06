import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { applyDatasetSlo } from '../slo/applyDatasetSlo.js';
import { load as loadSectionsDataset } from './sectionsDataset.js';
import { fetchSectionNews } from '../../services/rssAggregator.js';

const BUZZ_SOURCE_SECTIONS = [
  'entertainment',
  'social',
  'technology',
  'world',
  'india',
  'chennai',
  'local',
];

const ENTERTAINMENT_REGION_IDS = new Set(['tamil', 'hindi', 'hollywood', 'ott']);

const ENTERTAINMENT_TERMS = {
  tamil: [
    'tamil cinema', 'tamil film', 'tamil movie', 'kollywood', 'vijay', 'ajith',
    'rajini', 'rajinikanth', 'kamal haasan', 'dhanush', 'suriya', 'vikram',
    'simbu', 'sivakarthikeyan', 'siva karthikeyan', 'nayanthara', 'trisha',
    'anirudh', 'lokesh kanagaraj', 'vijay sethupathi', 'jailer 2', 'leo movie',
  ],
  hindi: [
    'bollywood', 'hindi cinema', 'hindi film', 'hindi movie', 'shah rukh',
    'srk', 'salman khan', 'aamir khan', 'ranbir', 'alia bhatt', 'deepika',
    'ranveer', 'kareena', 'akshay kumar', 'amitabh', 'bachchan', 'hrithik',
    'katrina', 'vicky kaushal', 'karan johar', 'kajol', 'mukerji', 'mukherjee',
    'yrf', 'dharma productions',
  ],
  hollywood: [
    'hollywood', 'variety', 'deadline', 'hollywood reporter', 'indiewire',
    'screen rant', 'oscar', 'emmy', 'marvel', 'dc studios', 'warner bros',
    'universal pictures', 'tom cruise', 'leonardo dicaprio', 'nolan', 'zendaya',
    'taylor swift', 'bruce willis', 'baywatch', 'lionsgate',
  ],
  ott: [
    'ott', 'netflix', 'prime video', 'amazon prime', 'hotstar', 'disney+',
    'sonyliv', 'zee5', 'aha', 'hulu', 'max', 'apple tv', 'streaming',
    'web series', 'limited series', 'ott release', 'ott platform',
  ],
};

function textOf(item) {
  return [
    item?.title,
    item?.headline,
    item?.description,
    item?.summary,
    item?.source,
    item?.category,
    item?.section,
  ].filter(Boolean).join(' ').toLowerCase();
}

function entertainmentTextOf(item) {
  return [
    item?.title,
    item?.headline,
    item?.description,
    item?.summary,
    item?.source,
  ].filter(Boolean).join(' ').toLowerCase();
}

function includesAny(item, terms) {
  const text = textOf(item);
  return terms.some(term => text.includes(term));
}

function normalizeEntertainmentRegion(region) {
  const value = String(region || '').toLowerCase().trim();
  if (!value) return null;
  if (value === 'hwood' || value === 'h\'wood' || value === 'hollywood') return 'hollywood';
  if (value === 'streaming') return 'ott';
  return ENTERTAINMENT_REGION_IDS.has(value) ? value : null;
}

function classifyEntertainmentItem(item) {
  const trustedRegion = normalizeEntertainmentRegion(item?.region);
  const text = entertainmentTextOf(item);

  let inferredRegion = null;

  if (ENTERTAINMENT_TERMS.ott.some(term => text.includes(term))) inferredRegion = 'ott';
  else if (ENTERTAINMENT_TERMS.tamil.some(term => text.includes(term))) inferredRegion = 'tamil';
  else if (ENTERTAINMENT_TERMS.hindi.some(term => text.includes(term))) inferredRegion = 'hindi';
  else if (ENTERTAINMENT_TERMS.hollywood.some(term => text.includes(term))) inferredRegion = 'hollywood';

  if (!trustedRegion) return inferredRegion;
  if (!inferredRegion) return null;
  return inferredRegion;
}

function hasAiSignal(item) {
  const text = textOf(item);

  return /\bai\b/.test(text) ||
    includesAny(item, [
      'artificial intelligence',
      'openai',
      'chatgpt',
      'machine learning',
      'generative',
      'large language model',
      'llm',
    ]);
}

function classifyEntertainment(items = []) {
  const buckets = {
    tamil: [],
    hindi: [],
    hollywood: [],
    ott: [],
  };

  items.forEach(item => {
    const region = classifyEntertainmentItem(item);
    if (region) buckets[region].push({ ...item, region });
  });

  return buckets;
}

function distributeSocialTrends(items = []) {
  const buckets = {
    world: [],
    india: [],
    tamilnadu: [],
    muscat: [],
  };

  items.forEach(item => {
    if (includesAny(item, ['oman', 'muscat', 'gulf', 'middle east'])) {
      buckets.muscat.push(item);
      return;
    }

    if (includesAny(item, ['tamil nadu', 'tamilnadu', 'chennai', 'trichy', 'coimbatore', 'madurai'])) {
      buckets.tamilnadu.push(item);
      return;
    }

    if (includesAny(item, ['india', 'delhi', 'mumbai', 'bengaluru', 'hyderabad', 'kolkata'])) {
      buckets.india.push(item);
      return;
    }

    buckets.world.push(item);
  });

  return buckets;
}

function sourceDominance(items = []) {
  if (items.length === 0) {
    return {
      topSource: null,
      ratio: 0,
      counts: {},
    };
  }

  const counts = {};

  items.forEach(item => {
    const source = item?.source || 'Unknown';
    counts[source] = (counts[source] || 0) + 1;
  });

  const [topSource, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [null, 0];

  return {
    topSource,
    ratio: count / items.length,
    counts,
  };
}

function uniqByBuzzItem(items = []) {
  const seen = new Set();
  const out = [];

  for (const item of items || []) {
    const key = String(item?.id || item?.link || item?.url || item?.title || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

async function getTechnologyItemsWithFallback(sectionsEnv, diagnostics = []) {
  const sourceSections = sectionsEnv?.data?.sections || {};
  const rawSections = sectionsEnv?.data?.raw || {};
  const frontPage = sectionsEnv?.data?.frontPage || [];

  const fromBuckets = uniqByBuzzItem([
    ...(sourceSections.technology || []),
    ...(rawSections.technology || []),
    ...frontPage.filter(item => item?.section === 'technology' || includesAny(item, ['startup', 'technology', 'software', 'chip', 'ai'])),
  ]);

  if (fromBuckets.length > 0) {
    diagnostics.push({
      event: 'buzzDataset.technology_recovered_from_sections',
      severity: 'info',
      message: `Recovered ${fromBuckets.length} technology item(s) from section/raw/front-page data`,
    });
    return fromBuckets;
  }

  try {
    const live = await fetchSectionNews('technology', 25);
    const liveItems = uniqByBuzzItem(Array.isArray(live) ? live : []);

    diagnostics.push({
      event: 'buzzDataset.technology_live_fallback',
      severity: liveItems.length > 0 ? 'info' : 'warn',
      message: `Direct technology fallback returned ${liveItems.length} item(s)`,
    });

    return liveItems;
  } catch (error) {
    diagnostics.push({
      event: 'buzzDataset.technology_live_fallback_failed',
      severity: 'warn',
      message: error?.message || String(error),
    });
    return [];
  }
}

function splitTechnologyCards(technologyItems = []) {
  const aiCards = technologyItems.filter(hasAiSignal).slice(0, 20);
  let techCards = technologyItems.filter(item => !hasAiSignal(item)).slice(0, 20);

  if (techCards.length === 0 && technologyItems.length > 0) {
    techCards = technologyItems.slice(0, 20);
  }

  return {
    techCards,
    aiCards,
  };
}

export async function load() {
  const sectionsEnv = await loadSectionsDataset({
    sections: BUZZ_SOURCE_SECTIONS,
    maxSections: BUZZ_SOURCE_SECTIONS.length,
    frontPageLimit: 30,
  });
  const diagnostics = [];

  const sourceSections = sectionsEnv.data?.sections || {};
  const entertainmentItems = sourceSections.entertainment || [];

  const socialItems = [
    ...(sourceSections.social || []),
    ...(sourceSections.world || []).filter(item => includesAny(item, ['viral', 'trend', 'social media'])),
    ...(sourceSections.india || []).filter(item => includesAny(item, ['viral', 'trend', 'social media'])),
    ...(sourceSections.chennai || []).filter(item => includesAny(item, ['viral', 'trend', 'social media'])),
    ...(sourceSections.local || []).filter(item => includesAny(item, ['viral', 'trend', 'social media'])),
  ];

  const technologyItems = await getTechnologyItemsWithFallback(sectionsEnv, diagnostics);
  const { techCards, aiCards } = splitTechnologyCards(technologyItems);

  const entertainment = classifyEntertainment(entertainmentItems);
  const socialTrends = distributeSocialTrends(socialItems);

  const allBuzzItems = [
    ...entertainmentItems,
    ...socialItems,
    ...technologyItems,
  ];

  const dominance = sourceDominance(allBuzzItems);
  const ok = allBuzzItems.length > 0;

  const envelope = makeEnvelope({
    ok,
    datasetId: 'buzz',
    data: {
      entertainment,
      socialTrends,
      techCards,
      aiCards,
      sourceSections,
      raw: {
        sections: sectionsEnv.data,
        sourceDominance: dominance,
      },
    },
    source: sectionsEnv.source || ENVELOPE_SOURCES.LIVE,
    freshness: ok ? ENVELOPE_FRESHNESS.FRESH : ENVELOPE_FRESHNESS.EMPTY,
    error: ok ? null : 'buzz unavailable',
    validation: {
      passed: ok,
      errors: ok ? [] : ['buzz_unavailable'],
      warnings: [
        ...(sectionsEnv.validation?.warnings || []),
        technologyItems.length === 0 ? 'buzz_technology_unavailable_after_fallback' : null,
        dominance.ratio > 0.45 ? `source_dominance:${dominance.topSource}` : null,
      ].filter(Boolean),
    },
    diagnostics: [
      ...(sectionsEnv.diagnostics || []),
      ...diagnostics,
      {
        event: 'buzzDataset.loaded',
        severity: ok ? 'info' : 'warn',
        message: `Buzz dataset created with ${allBuzzItems.length} item(s)`,
        details: {
          entertainmentCount: entertainmentItems.length,
          socialCount: socialItems.length,
          techCount: techCards.length,
          aiCount: aiCards.length,
          dominance,
        },
      },
    ],
  });

  return applyDatasetSlo(envelope);
}

export const __buzzDatasetInternalsForTest = {
  classifyEntertainment,
  classifyEntertainmentItem,
  distributeSocialTrends,
  sourceDominance,
  hasAiSignal,
  splitTechnologyCards,
};
