import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDataset } from '../data/orchestrator/useDataset.js';
import { useSettings } from '../context/SettingsContext';
import { useMountedRef } from '../hooks/useMountedRef.js';
import { geminiService } from '../services/geminiService';
import { extractArticleText } from '../utils/articleExtractor';
import { summarizeText } from '../utils/extractiveSummary';

const SOURCE_META = Object.freeze({
  THE_HINDU: { id: 'THE_HINDU', label: 'The Hindu', lang: 'en' },
  INDIAN_EXPRESS: { id: 'INDIAN_EXPRESS', label: 'Indian Express', lang: 'en' },
  DINAMANI: { id: 'DINAMANI', label: 'Dinamani', lang: 'ta' },
  DAILY_THANTHI: { id: 'DAILY_THANTHI', label: 'Daily Thanthi', lang: 'ta' },
});

const DEFAULT_SOURCE_ID = 'THE_HINDU';
const MAX_AUTO_SUMMARY_ARTICLES = 8;
const MAX_TITLE_TRANSLATIONS = 60;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSection(page, articles = [], extra = {}) {
  return {
    page: page || extra.page || 'Latest',
    articles: asArray(articles),
    summary: extra.summary || '',
    summary_ta: extra.summary_ta || '',
    summary_method: extra.summary_method || extra.summaryMethod || null,
    error: extra.error || null,
    ...extra,
  };
}

function normalizeSourceSections(sections) {
  if (Array.isArray(sections)) {
    return sections.map(section => normalizeSection(
      section?.page || section?.name || section?.section || 'Latest',
      section?.articles || section?.items || section?.stories || [],
      section || {}
    ));
  }

  if (sections && typeof sections === 'object') {
    return Object.entries(sections).map(([page, value]) => {
      if (Array.isArray(value)) {
        return normalizeSection(page, value);
      }

      return normalizeSection(
        value?.page || page,
        value?.articles || value?.items || value?.stories || [],
        value || {}
      );
    });
  }

  return [];
}

function sectionsObjectToPaperSections(sections = {}) {
  if (!sections || typeof sections !== 'object') return [];

  return Object.entries(sections)
    .map(([page, articles]) => normalizeSection(page, articles))
    .filter(section => section.articles.length > 0 || section.summary || section.summary_ta || section.error);
}

function layoutGroupsToPaperSections(layoutGroups = {}) {
  if (!layoutGroups || typeof layoutGroups !== 'object') return [];

  return Object.entries(layoutGroups)
    .map(([page, articles]) => normalizeSection(page, articles))
    .filter(section => section.articles.length > 0);
}

function inferSourcesFromDatasetData(data = {}) {
  if (data.sources && typeof data.sources === 'object') {
    return data.sources;
  }

  if (data.raw?.sources && typeof data.raw.sources === 'object') {
    return data.raw.sources;
  }

  if (Array.isArray(data.paperSections)) {
    return {
      [DEFAULT_SOURCE_ID]: data.paperSections,
    };
  }

  if (Array.isArray(data.sections)) {
    return {
      [DEFAULT_SOURCE_ID]: data.sections,
    };
  }

  const fromSections = sectionsObjectToPaperSections(data.sections);
  if (fromSections.length > 0) {
    return {
      [DEFAULT_SOURCE_ID]: fromSections,
    };
  }

  const fromLayout = layoutGroupsToPaperSections(data.layoutGroups);
  if (fromLayout.length > 0) {
    return {
      [DEFAULT_SOURCE_ID]: fromLayout,
    };
  }

  if (Array.isArray(data.frontPage) && data.frontPage.length > 0) {
    return {
      [DEFAULT_SOURCE_ID]: [
        normalizeSection('Front Page', data.frontPage),
      ],
    };
  }

  if (Array.isArray(data.topStories) && data.topStories.length > 0) {
    return {
      [DEFAULT_SOURCE_ID]: [
        normalizeSection('Top Stories', data.topStories),
      ],
    };
  }

  return {};
}

function normalizeSources(rawSources = {}) {
  if (!rawSources || typeof rawSources !== 'object') return {};

  return Object.fromEntries(
    Object.entries(rawSources).map(([sourceId, sections]) => [
      sourceId,
      normalizeSourceSections(sections),
    ])
  );
}

function getAvailableSources(sources = {}) {
  const sourceIds = Object.keys(sources);

  if (sourceIds.length === 0) {
    return Object.values(SOURCE_META);
  }

  return sourceIds.map(sourceId => {
    return SOURCE_META[sourceId] || {
      id: sourceId,
      label: sourceId
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, char => char.toUpperCase()),
      lang: 'en',
    };
  });
}

function resolveActiveSource(activeSource, sources = {}) {
  if (sources[activeSource]) return activeSource;

  const first = Object.keys(sources)[0];
  return first || DEFAULT_SOURCE_ID;
}

function getSourceMeta(sourceId) {
  return SOURCE_META[sourceId] || {
    id: sourceId,
    label: sourceId || 'Daily Brief',
    lang: 'en',
  };
}

function getSectionSummary({
  section,
  activeSource,
  isTranslated,
  dynamicSummaries,
  clientSummaries,
}) {
  const dynamic = dynamicSummaries?.[section.page];

  if (dynamic) {
    if (isTranslated && dynamic.summary) return { text: dynamic.summary, method: 'gemini' };
    if (!isTranslated && dynamic.summary_ta) return { text: dynamic.summary_ta, method: 'gemini' };
    if (dynamic.summary) return { text: dynamic.summary, method: 'gemini' };
    if (dynamic.summary_ta) return { text: dynamic.summary_ta, method: 'gemini' };
  }

  if (isTranslated) {
    if (section.summary) return { text: section.summary, method: section.summary_method || 'server' };
    if (section.summary_ta) return { text: section.summary_ta, method: section.summary_method || 'server' };
  } else {
    if (section.summary_ta) return { text: section.summary_ta, method: section.summary_method || 'server' };
    if (section.summary) return { text: section.summary, method: section.summary_method || 'server' };
  }

  const clientKey = `${activeSource}_${section.page}`;
  if (clientSummaries?.[clientKey]) {
    return { text: clientSummaries[clientKey], method: 'extractive' };
  }

  return null;
}

function getArticleTitle(article, isTranslated, dynamicTitles = {}) {
  if (!article) return '';

  if (isTranslated) {
    return dynamicTitles[article.link] || article.title_en || article.title;
  }

  return article.title;
}

function getArticleWithDynamicTitle(article, dynamicTitles = {}) {
  if (!article || typeof article !== 'object') return article;

  return {
    ...article,
    title_en: dynamicTitles[article.link] || article.title_en,
  };
}

function hasMissingSummary(section) {
  return (!section?.summary && !section?.summary_ta) || Boolean(section?.error);
}

function getLastUpdatedLabel(lastUpdated) {
  if (!lastUpdated) return null;

  const date = new Date(lastUpdated);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function useNewspaperTabViewModel() {
  const {
    envelope,
    loading,
    error: datasetError,
    reload: reloadDataset,
  } = useDataset('newspaper');

  const settingsContext = useSettings();
  const settings = settingsContext?.settings || {};
  const mountedRef = useMountedRef();
  const autoSummaryAttemptedRef = useRef(new Set());

  const [activeSource, setActiveSource] = useState(DEFAULT_SOURCE_ID);
  const [isTranslated, setIsTranslated] = useState(false);
  const [dynamicSummaries, setDynamicSummaries] = useState({});
  const [dynamicTitles, setDynamicTitles] = useState({});
  const [clientSummaries, setClientSummaries] = useState({});
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isTranslatingTitles, setIsTranslatingTitles] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const envelopeData = envelope?.data;
  const data = useMemo(() => (
    envelopeData || {}
  ), [envelopeData]);
  const hasGeminiKey = Boolean(settings.geminiKey);

  const normalizedSources = useMemo(() => {
    return normalizeSources(inferSourcesFromDatasetData(data));
  }, [data]);

  const availableSources = useMemo(() => {
    return getAvailableSources(normalizedSources);
  }, [normalizedSources]);

  const resolvedActiveSource = useMemo(() => {
    return resolveActiveSource(activeSource, normalizedSources);
  }, [activeSource, normalizedSources]);

  const sourceMeta = useMemo(() => {
    return getSourceMeta(resolvedActiveSource);
  }, [resolvedActiveSource]);

  const currentSections = useMemo(() => {
    return asArray(normalizedSources[resolvedActiveSource]);
  }, [normalizedSources, resolvedActiveSource]);

  const isTamilSource = sourceMeta.lang === 'ta';
  const showTranslationControls = isTamilSource;
  const summaryLineLimit = settings.newspaper?.summaryLineLimit || 50;
  const lastUpdated = data.lastUpdated || data.raw?.lastUpdated || envelope?.fetchedAt || null;
  const lastUpdatedLabel = getLastUpdatedLabel(lastUpdated);

  const reload = useCallback((force = true) => {
    return reloadDataset(force);
  }, [reloadDataset]);

  const selectSource = useCallback((sourceId) => {
    setActiveSource(sourceId);
    setIsTranslated(false);
  }, []);

  const toggleTranslation = useCallback(() => {
    setIsTranslated(prev => !prev);
  }, []);

  const getSummaryForSection = useCallback((section) => {
    return getSectionSummary({
      section,
      activeSource: resolvedActiveSource,
      isTranslated,
      dynamicSummaries,
      clientSummaries,
    });
  }, [clientSummaries, dynamicSummaries, isTranslated, resolvedActiveSource]);

  const getTitleForArticle = useCallback((article) => {
    return getArticleTitle(article, isTranslated, dynamicTitles);
  }, [dynamicTitles, isTranslated]);

  const getCardArticle = useCallback((article) => {
    return getArticleWithDynamicTitle(article, dynamicTitles);
  }, [dynamicTitles]);

  const generateClientSummary = useCallback(async (sectionPage, articles) => {
    const key = `${resolvedActiveSource}_${sectionPage}`;

    if (clientSummaries[key]) return null;

    const firstArticle = articles?.[0];

    if (!firstArticle?.link) return null;

    try {
      const text = await extractArticleText(firstArticle.link);

      if (text && text.length > 200) {
        const summary = await summarizeText(text, 6);

        if (summary && mountedRef.current) {
          setClientSummaries(prev => ({
            ...prev,
            [key]: summary,
          }));

          return summary;
        }
      }
    } catch (error) {
      console.warn('[useNewspaperTabViewModel] client summary failed', {
        sectionPage,
        message: error?.message || String(error),
      });
    }

    return null;
  }, [clientSummaries, mountedRef, resolvedActiveSource]);

  const handleGenerateAll = useCallback(async () => {
    if (!currentSections.length) return;

    setIsGeneratingAll(true);

    try {
      const tasks = currentSections.map(async section => {
        const key = `${resolvedActiveSource}_${section.page}`;
        const hasGemini = dynamicSummaries[section.page];
        const hasClient = clientSummaries[key];
        const hasServer = (sourceMeta.lang === 'ta' && !isTranslated)
          ? section.summary_ta
          : section.summary;

        if (hasGemini || hasClient || hasServer) return;

        if (hasGeminiKey) {
          try {
            const result = await geminiService.generateSummary(
              asArray(section.articles).slice(0, MAX_AUTO_SUMMARY_ARTICLES),
              settings.geminiKey,
              sourceMeta.lang === 'ta'
            );

            if (mountedRef.current) {
              setDynamicSummaries(prev => ({
                ...prev,
                [section.page]: result,
              }));
            }
          } catch (error) {
            console.warn('[useNewspaperTabViewModel] Gemini summary failed', {
              section: section.page,
              message: error?.message || String(error),
            });
          }

          return;
        }

        await generateClientSummary(section.page, section.articles);
      });

      await Promise.allSettled(tasks);
    } finally {
      if (mountedRef.current) {
        setIsGeneratingAll(false);
      }
    }
  }, [
    clientSummaries,
    currentSections,
    dynamicSummaries,
    generateClientSummary,
    hasGeminiKey,
    isTranslated,
    mountedRef,
    resolvedActiveSource,
    settings.geminiKey,
    sourceMeta.lang,
  ]);

  useEffect(() => {
    const generateMissingSummaries = async () => {
      if (!currentSections.length) return;
      if (!hasGeminiKey) return;
      if (isGeneratingSummary) return;

      const autoSummaryKey = `${resolvedActiveSource}:${isTranslated ? 'translated' : 'original'}`;

      if (autoSummaryAttemptedRef.current.has(autoSummaryKey)) return;
      autoSummaryAttemptedRef.current.add(autoSummaryKey);

      const section = currentSections.find(item => {
        return hasMissingSummary(item) && !dynamicSummaries[item.page];
      });

      if (!section) return;

      setIsGeneratingSummary(true);

      try {
        const result = await geminiService.generateSummary(
          asArray(section.articles).slice(0, MAX_AUTO_SUMMARY_ARTICLES),
          settings.geminiKey,
          sourceMeta.lang === 'ta'
        );

        if (mountedRef.current) {
          setDynamicSummaries(prev => ({
            ...prev,
            [section.page]: result,
          }));
        }
      } catch (error) {
        console.warn('[useNewspaperTabViewModel] dynamic summary failed', {
          section: section.page,
          message: error?.message || String(error),
        });
      } finally {
        if (mountedRef.current) {
          setIsGeneratingSummary(false);
        }
      }
    };

    generateMissingSummaries();
  }, [
    currentSections,
    dynamicSummaries,
    hasGeminiKey,
    isGeneratingSummary,
    isTranslated,
    mountedRef,
    resolvedActiveSource,
    settings.geminiKey,
    sourceMeta.lang,
  ]);

  useEffect(() => {
    const translateVisibleTitles = async () => {
      if (!isTranslated) return;
      if (!currentSections.length) return;
      if (sourceMeta.lang === 'en') return;
      if (!hasGeminiKey) return;
      if (isTranslatingTitles) return;

      const titlesToTranslate = [];
      const articleMap = [];

      currentSections.forEach(section => {
        asArray(section.articles).forEach(article => {
          const hasServerTranslation = article.title_en;
          const hasDynamicTranslation = dynamicTitles[article.link];

          if (!hasServerTranslation && !hasDynamicTranslation && article.title) {
            titlesToTranslate.push(article.title);
            articleMap.push(article.link);
          }
        });
      });

      if (titlesToTranslate.length === 0) return;

      const cappedTitles = titlesToTranslate.slice(0, MAX_TITLE_TRANSLATIONS);
      const cappedArticleMap = articleMap.slice(0, MAX_TITLE_TRANSLATIONS);

      setIsTranslatingTitles(true);

      try {
        const chunkSize = 15;

        for (let i = 0; i < cappedTitles.length; i += chunkSize) {
          const batch = cappedTitles.slice(i, i + chunkSize);
          const results = await geminiService.translateTexts(batch, settings.geminiKey);

          if (!mountedRef.current) return;

          setDynamicTitles(prev => {
            const updates = { ...prev };

            results.forEach((translatedTitle, idx) => {
              const originalIdx = i + idx;
              const link = cappedArticleMap[originalIdx];

              if (link) {
                updates[link] = translatedTitle;
              }
            });

            return updates;
          });
        }
      } catch (error) {
        console.warn('[useNewspaperTabViewModel] title translation failed', {
          message: error?.message || String(error),
        });
      } finally {
        if (mountedRef.current) {
          setIsTranslatingTitles(false);
        }
      }
    };

    translateVisibleTitles();
  }, [
    currentSections,
    dynamicTitles,
    hasGeminiKey,
    isTranslated,
    isTranslatingTitles,
    mountedRef,
    settings.geminiKey,
    sourceMeta.lang,
  ]);

  useEffect(() => {
    if (!currentSections.length) return;
    if (hasGeminiKey) return;

    const firstSection = currentSections[0];

    if (firstSection && !firstSection.summary && !firstSection.summary_ta) {
      generateClientSummary(firstSection.page, firstSection.articles);
    }
  }, [currentSections, generateClientSummary, hasGeminiKey]);

  const error = datasetError || envelope?.error || null;

  return {
    envelope,
    data,
    loading,
    error,
    reload,
    activeSource: resolvedActiveSource,
    selectSource,
    sources: availableSources,
    sourceMeta,
    currentSections,
    isTamilSource,
    showTranslationControls,
    isTranslated,
    toggleTranslation,
    summaryLineLimit,
    lastUpdated,
    lastUpdatedLabel,
    getSummaryForSection,
    getTitleForArticle,
    getCardArticle,
    handleGenerateAll,
    isGeneratingAll,
    isGeneratingSummary,
    isTranslatingTitles,
    hasGeminiKey,
    source: envelope?.source || null,
    freshness: envelope?.freshness || null,
    slo: envelope?.slo || null,
    warnings: [
      ...(Array.isArray(envelope?.validation?.warnings) ? envelope.validation.warnings : []),
      ...(Array.isArray(envelope?.slo?.warnings) ? envelope.slo.warnings : []),
    ],
    diagnostics: envelope?.diagnostics || [],
  };
}

export const __newspaperViewModelInternalsForTest = {
  SOURCE_META,
  DEFAULT_SOURCE_ID,
  MAX_AUTO_SUMMARY_ARTICLES,
  MAX_TITLE_TRANSLATIONS,
  asArray,
  normalizeSection,
  normalizeSourceSections,
  sectionsObjectToPaperSections,
  layoutGroupsToPaperSections,
  inferSourcesFromDatasetData,
  normalizeSources,
  getAvailableSources,
  resolveActiveSource,
  getSourceMeta,
  getSectionSummary,
  getArticleTitle,
  getArticleWithDynamicTitle,
  hasMissingSummary,
  getLastUpdatedLabel,
};
