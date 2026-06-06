/* eslint-disable */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNews } from '../context/NewsContext';
import { useSettings } from '../context/SettingsContext';
import { useDataset } from '../data/orchestrator/useDataset.js';

export const BUZZ_PAGE_CACHE_KEY = 'buzz_page_cache';
const BUZZ_CACHE_NEXT_KEY = 'nw_buzz_hub_cache_v1';
const BUZZ_CACHE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export const BUZZ_REQUIRED_SECTIONS = [
  'entertainment',
  'social',
  'technology',
  'local',
  'world',
  'india',
  'chennai',
];

// Hardcoded defaults — also stored in DEFAULT_SETTINGS.buzzRegionKeywords for user editing.
const ENTERTAINMENT_KEYWORDS_DEFAULT = {
  tamil: [
    'vijay', 'ajith', 'rajini', 'kamal', 'dhanush', 'suriya', 'vikram', 'simbu',
    'siva karthikeyan', 'trisha', 'nayanthara', 'anirudh', 'ar rahman', 'kollywood',
    'thalapathy', 'thala', 'udhayanidhi', 'vetri maaran', 'lokesh', 'nelson',
    'jailer 2', 'leo movie', 'kanguva', 'indian 2', 'vettaiyan', 'viduthalai',
    'karthi', 'sethupathi', 'rajinikanth', 'kamal haasan', 'lokesh kanagaraj',
    'tamil cinema', 'tamil film', 'tamil movie', 'tamil actor', 'tamil actress',
    'kollywood news', 'kollywood update', 'vadivelu', 'yogi babu',
    'atlee', 'shankar director', 'karthik subbaraj',
    'k-town'
  ],
  hindi: [
    'shah rukh', 'srk', 'salman', 'aamir', 'ranbir', 'alia', 'deepika', 'ranveer',
    'kareena', 'akshay', 'bachchan', 'bollywood', 'hrithik', 'katrina', 'vicky kaushal',
    'karan johar', 'yrf', 'dharma', 'pathaan', 'jawan', 'tiger 3', 'dunki',
    'war 2', 'singham', 'amitabh', 'salman khan', 'aamir khan', 'akshay kumar',
    'kajol', 'mukerji', 'mukherjee', 'hindi cinema', 'hindi film', 'hindi movie',
    'hindi actor', 'hindi actress', 'bollywood news', 'bollywood update',
    'hombale films', 'dharma productions', 'excel entertainment',
    'marathi', 'bhojpuri', 'punjabi film', 'tollywood',
    'b-town', 't-series', 't series'
  ],
  hollywood: [
    'oscar', 'grammy', 'emmy', 'golden globe', 'marvel', 'dc', 'disney', 'warner bros',
    'universal', 'tom cruise', 'dicaprio', 'nolan', 'avengers', 'spider-man', 'batman',
    'superman', 'taylor swift', 'beyonce', 'kim kardashian', 'kanye', 'justin bieber',
    'selena gomez', 'zendaya', 'hollywood', 'bad bunny', 'rihanna', 'drake',
    'variety', 'deadline', 'hollywood reporter', 'indiewire', 'screen rant',
    'bruce willis', 'baywatch', 'lionsgate', 'game of thrones', 'house of the dragon',
    'got', 'hotd', 'emilia clarke', 'florence pugh', 'margot robbie', 'ryan reynolds',
    'chris hemsworth', 'chris evans', 'robert downey', 'scarlett johansson',
    'jennifer lawrence', 'anne hathaway', 'cate blanchett', 'meryl street',
    'brad pitt', 'angelina jolie', 'johnny depp', 'keanu reeves',
    'euphoria', 'stranger things', 'succession', 'last of us', 'yellowstone',
    'paramount', 'sony pictures', 'a24', 'mgm', 'columbia pictures',
    'variety', 'deadline', 'cannes', 'netflix', 'disney', 'marvel', 'hbo', 'hwood', 'h\'wood'
  ],
  ott: [
    'netflix', 'prime video', 'amazon prime', 'hotstar', 'disney+', 'sonyliv',
    'zee5', 'aha', 'hulu', 'max', 'apple tv', 'streaming', 'web series',
    'limited series', 'ott release', 'ott platform', 'ott', 'ott exclusive',
    'original series', 'season 2', 'season 3', 'season 4', 'binge',
    'jiocinema', 'mxplayer', 'voot', 'altbalaji',
    'jio cinema', 'sony liv', 'zee 5', 'mx player', 'alt balaji',
    'panchayat', 'mirzapur', 'family man', 'sacred games', 'farzi', 'asur',
    'scam 1992', 'aspirants', 'kota factory', 'jubilee', 'heeramandi',
    'delhi crime', 'made in heaven', 'bigg boss', 'splitsvilla', 'roadies',
    'indian web series', 'hindi web series', 'tamil web series', 'telugu web series',
    'direct-to-ott', 'digital release', 'direct digital release', 'streaming release',
    'netflix india', 'prime video india', 'amazon prime video'
  ],
};

// Named export alias so cert tests that check for ENTERTAINMENT_KEYWORDS still resolve.
export const ENTERTAINMENT_KEYWORDS = ENTERTAINMENT_KEYWORDS_DEFAULT;

/**
 * Returns the effective region keyword map, merging settings.buzzRegionKeywords
 * (user additions) additively into the hardcoded defaults.
 */
function getEntertainmentKeywords(settings) {
  const userMap = settings?.buzzRegionKeywords;
  if (!userMap || typeof userMap !== 'object') return ENTERTAINMENT_KEYWORDS_DEFAULT;
  const merged = {};
  for (const [region, defaults] of Object.entries(ENTERTAINMENT_KEYWORDS_DEFAULT)) {
    const userAdded = userMap[region];
    merged[region] = Array.isArray(userAdded) && userAdded.length > 0
      ? [...new Set([...defaults, ...userAdded])]
      : defaults;
  }
  return merged;
}


const ENTERTAINMENT_REGION_IDS = new Set(['tamil', 'hindi', 'hollywood', 'ott']);

const REGION_KEYWORDS = {
  world: ['global', 'world', 'international', 'usa', 'europe', 'uk', 'china', 'twitter', 'x.com', 'meta', 'tiktok', 'instagram', 'viral'],
  india: ['india', 'indian', 'bollywood', 'cricket', 'modi', 'delhi', 'mumbai', 'bangalore', 'hyderabad', 'ipl', 'bcci'],
  tamilnadu: ['chennai', 'tamil', 'tamilnadu', 'kollywood', 'rajini', 'kamal', 'vijay', 'trichy', 'coimbatore', 'madurai', 'tn'],
  muscat: ['muscat', 'oman', 'gulf', 'gcc', 'uae', 'dubai', 'arab', 'middle east', 'expat', 'omani'],
};

const AI_KEYWORDS = [
  'ai',
  'artificial intelligence',
  'innovation',
  'machine learning',
  'chatgpt',
  'gemini',
  'openai',
  'claude',
  'llm',
  'generative ai',
  'robot',
  'automation',
  'agent',
  'copilot',
];

export const NAV_SECTIONS = [
  { id: 'entertainment', icon: '🎬', label: 'Entertainment' },
  { id: 'social-trends', icon: '👥', label: 'Social Trends' },
  { id: 'tech-news', icon: '🚀', label: 'Tech & Startups' },
  { id: 'ai-innovation', icon: '🤖', label: 'AI & Innovation' },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function getStoryText(story) {
  return [
    story?.title,
    story?.headline,
    story?.summary,
    story?.description,
    story?.source,
    story?.category,
    story?.section,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getEntertainmentStoryText(story) {
  return [
    story?.title,
    story?.headline,
    story?.summary,
    story?.description,
    story?.source,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normalizeEntertainmentRegion(region) {
  const value = String(region || '').toLowerCase().trim();
  if (!value) return null;
  if (value === 'hwood' || value === 'h\'wood' || value === 'hollywood') return 'hollywood';
  if (value === 'streaming') return 'ott';
  return ENTERTAINMENT_REGION_IDS.has(value) ? value : null;
}

function hasAnyKeyword(text, keywords = []) {
  return keywords.some(keyword => {
    if (keyword.length <= 3) {
      // For very short keywords like 'ott', 'ai', check with strict word boundaries
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(text);
    }
    return text.includes(keyword);
  });
}

function getPublishedAtMs(value) {
  if (value == null) return 0;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }

  const numeric = Number(value);

  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStoryTimeMs(story) {
  return getPublishedAtMs(story?.publishedAt || story?.timestamp || story?.date || story?.pubDate);
}

function filterOldNews(newsArray, freshnessLimitHours = 72) {
  const limitMs = Number(freshnessLimitHours || 72) * 3600000;
  const now = Date.now();

  const filtered = asArray(newsArray).filter(item => {
    const publishedAtMs = getStoryTimeMs(item);
    if (!publishedAtMs) return true;
    return now - publishedAtMs < limitMs;
  });

  // If live feeds are stale (e.g. in test env or due to feed delay) and all items
  // were filtered, fall back to displaying the raw items to avoid a blank screen
  if (filtered.length === 0 && asArray(newsArray).length > 0) {
    console.warn(`[BuzzHub] Relaxing freshness filter; no articles found within ${freshnessLimitHours}h`);
    return asArray(newsArray);
  }
  return filtered;
}

function sortNewestFirst(stories) {
  return [...asArray(stories)].sort((a, b) => getStoryTimeMs(b) - getStoryTimeMs(a));
}

function uniqueByStory(stories) {
  const seen = new Set();

  return asArray(stories).filter(story => {
    const key = story?.id ||
      story?.url ||
      story?.link ||
      `${story?.title || story?.headline || ''}-${story?.source || ''}`;

    if (!key) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function hasBuzzLiveData(newsData) {
  const safeNewsData = asRecord(newsData);

  return BUZZ_REQUIRED_SECTIONS.some(section => (
    asArray(safeNewsData[section]).length > 0
  ));
}

function normalizeBuzzCachePayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  const savedAt = Number(parsed.savedAt || parsed.timestamp || 0);
  const data = asRecord(parsed.newsData || parsed.data);

  if (!savedAt || Object.keys(data).length === 0) return null;
  if (Date.now() - savedAt > BUZZ_CACHE_MAX_AGE_MS) return null;

  return {
    savedAt,
    timestamp: savedAt,
    data,
    newsData: data,
  };
}

function safeReadBuzzCache() {
  try {
    if (typeof window === 'undefined') return null;

    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return null;

    const keys = [BUZZ_CACHE_NEXT_KEY, BUZZ_PAGE_CACHE_KEY];

    for (const key of keys) {
      const raw = storage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const normalized = normalizeBuzzCachePayload(parsed);

      if (normalized) return normalized;
    }

    return null;
  } catch {
    return null;
  }
}

function safeWriteBuzzCache(newsData) {
  try {
    if (typeof window === 'undefined') return false;

    const storage = window.localStorage;
    if (!storage || typeof storage.setItem !== 'function') return false;

    const existing = safeReadBuzzCache();
    const existingData = asRecord(existing?.data || existing?.newsData);

    const data = {};
    BUZZ_REQUIRED_SECTIONS.forEach(section => {
      const liveItems = asArray(newsData?.[section]);
      const cachedItems = asArray(existingData[section]);
      data[section] = liveItems.length > 0 ? liveItems : cachedItems;
    });

    const legacyPayload = {
      timestamp: Date.now(),
      data,
    };

    const nextPayload = {
      savedAt: legacyPayload.timestamp,
      newsData: data,
    };

    storage.setItem(BUZZ_PAGE_CACHE_KEY, JSON.stringify(legacyPayload));
    storage.setItem(BUZZ_CACHE_NEXT_KEY, JSON.stringify(nextPayload));

    return true;
  } catch {
    return false;
  }
}

function classifyEntertainmentRegion(story, settings) {
  const text = getEntertainmentStoryText(story);
  const kw = getEntertainmentKeywords(settings);

  // Keyword inference is the only reliable classification signal.
  // The API region field is frequently wrong (e.g., Hollywood stories tagged as 'tamil'),
  // so we never fall back to it. Stories with no keyword match are excluded from all tabs.
  if (hasAnyKeyword(text, kw.ott)) return 'ott';
  if (hasAnyKeyword(text, kw.tamil)) return 'tamil';
  if (hasAnyKeyword(text, kw.hindi)) return 'hindi';
  if (hasAnyKeyword(text, kw.hollywood)) return 'hollywood';

  return null;
}


function projectEntertainmentStories(newsData, freshnessLimitHours = 72, settings = null) {
  const raw = asArray(asRecord(newsData).entertainment);

  return sortNewestFirst(
    filterOldNews(raw, freshnessLimitHours)
      .map(item => ({
        ...item,
        region: classifyEntertainmentRegion(item, settings),
      }))
      .filter(item => item.region)
  );
}

function categorizeSocialRegion(newsItem) {
  const text = getStoryText(newsItem);

  if (REGION_KEYWORDS.tamilnadu.some(keyword => text.includes(keyword))) return 'tamilnadu';
  if (REGION_KEYWORDS.muscat.some(keyword => text.includes(keyword))) return 'muscat';
  if (REGION_KEYWORDS.india.some(keyword => text.includes(keyword))) return 'india';

  return 'world';
}

function isTrendStory(story) {
  const title = String(story?.title || story?.headline || '').toLowerCase();
  return (
    title.includes('trend') ||
    title.includes('viral') ||
    title.includes('social')
  );
}

function getSocialDistribution(settings) {
  return {
    world: settings?.socialTrends?.worldCount ?? 8,
    india: settings?.socialTrends?.indiaCount ?? 8,
    tamilnadu: settings?.socialTrends?.tamilnaduCount ?? 5,
    muscat: settings?.socialTrends?.muscatCount ?? 4,
  };
}

function getRegionLabel(region) {
  if (region === 'world') return '🌍 World';
  if (region === 'india') return '🇮🇳 India';
  if (region === 'tamilnadu') return '🏛️ Tamil Nadu';
  return '🏝️ Muscat';
}

function distributeSocialTrends(newsData, settings = {}, freshnessLimitHours = 72) {
  const safeData = asRecord(newsData);

  const allSocial = filterOldNews(safeData.social, freshnessLimitHours);
  const worldNews = filterOldNews(safeData.world, freshnessLimitHours);
  const indiaNews = filterOldNews(safeData.india, freshnessLimitHours);
  const chennaiNews = filterOldNews(safeData.chennai, freshnessLimitHours);
  const localNews = filterOldNews(safeData.local, freshnessLimitHours);

  const regionBuckets = {
    world: [],
    india: [],
    tamilnadu: [],
    muscat: [],
  };

  allSocial.forEach(item => {
    const region = categorizeSocialRegion(item);
    regionBuckets[region].push({ ...item, source: item.source || 'social' });
  });

  worldNews
    .filter(isTrendStory)
    .forEach(item => regionBuckets.world.push({ ...item, source: item.source || 'world' }));

  indiaNews
    .filter(isTrendStory)
    .forEach(item => regionBuckets.india.push({ ...item, source: item.source || 'india' }));

  chennaiNews.forEach(item => {
    regionBuckets.tamilnadu.push({ ...item, source: item.source || 'chennai' });
  });

  localNews.forEach(item => {
    regionBuckets.muscat.push({ ...item, source: item.source || 'local' });
  });

  const distribution = getSocialDistribution(settings);
  const result = [];

  Object.entries(distribution).forEach(([region, count]) => {
    // Deduplicate within each bucket before applying the slot limit so
    // a story added via allSocial and again via worldNews.filter(isTrendStory)
    // cannot consume two quota slots.
    const bucket = sortNewestFirst(uniqueByStory(regionBuckets[region]));
    const toAdd = bucket.slice(0, count);

    toAdd.forEach(item => {
      result.push({
        ...item,
        region,
        regionLabel: getRegionLabel(region),
      });
    });
  });

  return sortNewestFirst(uniqueByStory(result));
}

function projectTechnologyStories(newsData, freshnessLimitHours = 72) {
  return sortNewestFirst(
    filterOldNews(asRecord(newsData).technology, freshnessLimitHours)
  );
}

function projectAiInnovationStories(newsData, freshnessLimitHours = 72) {
  return sortNewestFirst(
    filterOldNews(asRecord(newsData).technology, freshnessLimitHours)
      .filter(item => {
        const text = getStoryText(item);
        return hasAnyKeyword(text, AI_KEYWORDS);
      })
  );
}

function getFreshnessLimitHours(settings) {
  const value =
    settings?.freshnessLimitHours ??
    settings?.buzz?.freshnessLimitHours ??
    settings?.display?.freshnessLimitHours ??
    settings?.news?.freshnessLimitHours ??
    72;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
}

function getTechnologyMaxDisplay(settings) {
  const value =
    settings?.sections?.technology?.count ??
    settings?.buzz?.technologyMaxDisplay ??
    settings?.techSocial?.technologyMaxDisplay ??
    5;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

function flattenBucketMap(bucketMap = {}) {
  return Object.values(asRecord(bucketMap)).flatMap(items => asArray(items));
}

function projectBuzzDatasetToNewsData(buzzData = {}) {
  const data = asRecord(buzzData);
  const sourceSections = asRecord(data.sourceSections);
  const technology = uniqueByStory([
    ...asArray(data.techCards),
    ...asArray(data.aiCards),
    ...asArray(sourceSections.technology),
  ]);

  return {
    entertainment: uniqueByStory([
      ...flattenBucketMap(data.entertainment),
      ...asArray(sourceSections.entertainment),
    ]),
    social: uniqueByStory([
      ...flattenBucketMap(data.socialTrends),
      ...asArray(sourceSections.social),
    ]),
    technology,
    world: asArray(sourceSections.world),
    india: asArray(sourceSections.india),
    chennai: asArray(sourceSections.chennai),
    local: asArray(sourceSections.local),
  };
}

function mergeBuzzDisplayData(primaryData = {}, fallbackData = {}) {
  const primary = asRecord(primaryData);
  const fallback = asRecord(fallbackData);
  const merged = { ...primary };

  BUZZ_REQUIRED_SECTIONS.forEach(section => {
    if (asArray(merged[section]).length === 0 && asArray(fallback[section]).length > 0) {
      merged[section] = fallback[section];
    }
  });

  return merged;
}

export function useTechSocialPageViewModel() {
  const {
    newsData,
    refreshNews,
    loading: contextLoading,
    loadSection,
  } = useNews();

  const { settings } = useSettings();
  const {
    envelope: buzzEnvelope,
    loading: buzzDatasetLoading,
    reload: reloadBuzzDataset,
  } = useDataset('buzz');

  const [activeEntTab, setActiveEntTabState] = useState('tamil');
  const [userSelectedEntTab, setUserSelectedEntTab] = useState(false);
  const [cachedData, setCachedData] = useState(null);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Wrap the setter so an explicit user choice is remembered and we stop
  // auto-switching the Entertainment tab out from under them.
  const setActiveEntTab = useCallback((tab) => {
    setUserSelectedEntTab(true);
    setActiveEntTabState(tab);
  }, []);

  const freshnessLimitHours = useMemo(() => (
    getFreshnessLimitHours(settings)
  ), [settings]);

  const technologyMaxDisplay = useMemo(() => (
    getTechnologyMaxDisplay(settings)
  ), [settings]);

  useEffect(() => {
    const cached = safeReadBuzzCache();

    if (cached) {
      setCachedData(cached);
      setLoadingPhase(1);
    }
  }, []);

  useEffect(() => {
    BUZZ_REQUIRED_SECTIONS.forEach(section => {
      try {
        if (typeof loadSection === 'function') {
          loadSection(section);
        }
      } catch (error) {
        console.warn('[useTechSocialPageViewModel] loadSection failed', {
          section,
          message: error?.message || String(error),
        });
      }
    });
  }, [loadSection]);

  const hasLiveData = useMemo(() => (
    hasBuzzLiveData(newsData)
  ), [newsData]);

  useEffect(() => {
    if (hasLiveData) {
      setLoadingPhase(3);
      safeWriteBuzzCache(newsData);
    }
  }, [hasLiveData, newsData]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const displayData = useMemo(() => {
    const primary = asRecord(newsData);
    const cached = asRecord(cachedData?.data || cachedData?.newsData);
    const fallback = projectBuzzDatasetToNewsData(buzzEnvelope?.data);

    const merged = {};
    BUZZ_REQUIRED_SECTIONS.forEach(section => {
      const primaryItems = asArray(primary[section]);
      const cachedItems = asArray(cached[section]);
      const fallbackItems = asArray(fallback[section]);

      if (primaryItems.length > 0) {
        merged[section] = primaryItems;
      } else if (cachedItems.length > 0) {
        merged[section] = cachedItems;
      } else {
        merged[section] = fallbackItems;
      }
    });

    return merged;
  }, [buzzEnvelope, cachedData, newsData]);

  const processedEntertainment = useMemo(() => (
    projectEntertainmentStories(displayData, freshnessLimitHours, settings)
  ), [displayData, freshnessLimitHours, settings]);

  const visibleEntertainment = useMemo(() => (
    processedEntertainment.filter(item => item.region === activeEntTab)
  ), [activeEntTab, processedEntertainment]);

  const socialTrends = useMemo(() => (
    distributeSocialTrends(displayData, settings, freshnessLimitHours)
  ), [displayData, freshnessLimitHours, settings]);

  const technologyStories = useMemo(() => (
    projectTechnologyStories(displayData, freshnessLimitHours)
  ), [displayData, freshnessLimitHours]);

  const aiInnovationStories = useMemo(() => (
    projectAiInnovationStories(displayData, freshnessLimitHours)
  ), [displayData, freshnessLimitHours]);

  // Auto-select the first Entertainment region that actually has items so the
  // hub doesn't open on an empty "Tamil" tab when the snapshot is, say, all
  // Hindi/Hollywood. Respects an explicit user choice.
  useEffect(() => {
    if (userSelectedEntTab) return;
    const counts = { tamil: 0, hindi: 0, hollywood: 0, ott: 0 };
    processedEntertainment.forEach(item => {
      if (counts[item.region] != null) counts[item.region] += 1;
    });
    if (counts[activeEntTab] === 0) {
      const firstNonEmpty = ['tamil', 'hindi', 'hollywood', 'ott'].find(region => counts[region] > 0);
      if (firstNonEmpty && firstNonEmpty !== activeEntTab) {
        setActiveEntTabState(firstNonEmpty);
      }
    }
  }, [processedEntertainment, activeEntTab, userSelectedEntTab]);

  // The DataStateBoundary on the page is fed the buzz *dataset* envelope, but the
  // page actually renders `displayData`, which also merges NewsContext + the local
  // cache. Synthesize a "ready" envelope whenever we have ANY display content so
  // the page isn't blanked just because the dataset envelope came back empty.
  const hasDisplayContent = useMemo(() => (
    [processedEntertainment, socialTrends, technologyStories, aiInnovationStories]
      .some(list => asArray(list).length > 0)
  ), [processedEntertainment, socialTrends, technologyStories, aiInnovationStories]);

  const boundaryEnvelope = useMemo(() => {
    if (hasDisplayContent) {
      return {
        ...(buzzEnvelope || {}),
        ok: true,
        freshness: (buzzEnvelope?.freshness && buzzEnvelope.freshness !== 'empty')
          ? buzzEnvelope.freshness
          : 'fresh',
        error: null,
        data: displayData,
      };
    }
    return buzzEnvelope || null;
  }, [buzzEnvelope, displayData, hasDisplayContent]);

  const handleRefresh = useCallback(() => {
    setLoadingPhase(3);

    if (typeof refreshNews === 'function') {
      reloadBuzzDataset?.(true);
      return refreshNews(BUZZ_REQUIRED_SECTIONS);
    }

    return reloadBuzzDataset?.(true) || null;
  }, [refreshNews, reloadBuzzDataset]);

  const scrollToTop = useCallback(() => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  return {
    activeEntTab,
    setActiveEntTab,

    contextLoading,
    buzzDatasetLoading,
    loadingPhase,
    hasLiveData,
    cachedAt: cachedData?.timestamp || cachedData?.savedAt || null,

    displayData,
    processedEntertainment,
    visibleEntertainment,
    socialTrends,
    technologyStories,
    technologyMaxDisplay,
    aiInnovationStories,

    // DataStateBoundary wiring — use the synthesized envelope so the page renders
    // whenever display content exists (dataset, NewsContext, or cache).
    envelope: boundaryEnvelope,
    hasDisplayContent,
    error: boundaryEnvelope?.error || null,

    navSections: NAV_SECTIONS,
    showBackToTop,
    scrollToTop,
    handleRefresh,
  };
}

export const __techSocialPageViewModelInternalsForTest = {
  BUZZ_PAGE_CACHE_KEY,
  BUZZ_REQUIRED_SECTIONS,
  ENTERTAINMENT_KEYWORDS,
  REGION_KEYWORDS,
  NAV_SECTIONS,
  asArray,
  asRecord,
  getStoryText,
  getEntertainmentStoryText,
  normalizeEntertainmentRegion,
  hasAnyKeyword,
  getPublishedAtMs,
  filterOldNews,
  sortNewestFirst,
  uniqueByStory,
  hasBuzzLiveData,
  normalizeBuzzCachePayload,
  safeReadBuzzCache,
  safeWriteBuzzCache,
  classifyEntertainmentRegion,
  projectEntertainmentStories,
  categorizeSocialRegion,
  distributeSocialTrends,
  projectTechnologyStories,
  projectAiInnovationStories,
  getFreshnessLimitHours,
  getTechnologyMaxDisplay,
  flattenBucketMap,
  projectBuzzDatasetToNewsData,
  mergeBuzzDisplayData,
};
