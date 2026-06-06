import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { geminiService } from '../services/geminiService';
import { extractArticleText } from '../utils/articleExtractor';
import { summarizeText } from '../utils/extractiveSummary';
import { virtualPaperService } from '../services/virtualPaperService';

const DATA_URL = `${import.meta.env.BASE_URL}data/epaper_data.json`;

export const SOURCES = {
  THE_HINDU: { id: 'THE_HINDU', label: 'The Hindu', lang: 'en' },
  INDIAN_EXPRESS: { id: 'INDIAN_EXPRESS', label: 'Indian Express', lang: 'en' },
  DINAMANI: { id: 'DINAMANI', label: 'Dinamani', lang: 'ta' },
  DAILY_THANTHI: { id: 'DAILY_THANTHI', label: 'Daily Thanthi', lang: 'ta' },
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getSourceMeta(sourceId) {
  return SOURCES[sourceId] || SOURCES.THE_HINDU;
}

function getSummaryLookupKey(activeSource, sectionPage) {
  return `${activeSource}_${sectionPage}`;
}

function getSectionSummaryResult({
  section,
  activeSource,
  isTranslated,
  dynamicSummaries,
  clientSummaries,
}) {
  if (!section) return null;

  const dynamic = dynamicSummaries?.[section.page];

  if (dynamic) {
    if (isTranslated && dynamic.summary) {
      return { text: dynamic.summary, method: 'gemini' };
    }

    if (!isTranslated && dynamic.summary_ta) {
      return { text: dynamic.summary_ta, method: 'gemini' };
    }

    if (dynamic.summary) {
      return { text: dynamic.summary, method: 'gemini' };
    }
  }

  if (isTranslated) {
    if (section.summary) {
      return {
        text: section.summary,
        method: section.summary_method || 'server',
      };
    }

    if (section.summary_ta) {
      return {
        text: section.summary_ta,
        method: section.summary_method || 'server',
      };
    }
  } else {
    if (section.summary_ta) {
      return {
        text: section.summary_ta,
        method: section.summary_method || 'server',
      };
    }

    if (section.summary) {
      return {
        text: section.summary,
        method: section.summary_method || 'server',
      };
    }
  }

  const clientKey = getSummaryLookupKey(activeSource, section.page);

  if (clientSummaries?.[clientKey]) {
    return {
      text: clientSummaries[clientKey],
      method: 'extractive',
    };
  }

  return null;
}

async function fetchStaticNewspaperData() {
  const response = await fetch(`${DATA_URL}?t=${Date.now()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }

  const json = await response.json();

  if (!json || !json.sources) {
    throw new Error('Invalid data format');
  }

  return {
    sources: json.sources,
    lastUpdated: json.lastUpdated,
  };
}

async function fetchFallbackVirtualPaper({
  sourceKeys = Object.keys(SOURCES),
  timeoutMs = 15000,
} = {}) {
  const sources = {};
  let timeoutId = null;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
  });

  const fetchPromises = sourceKeys.map(async sourceKey => {
    try {
      const sections = await virtualPaperService.getVirtualPaper(sourceKey);

      if (Array.isArray(sections) && sections.length > 0) {
        sources[sourceKey] = sections;
      }
    } catch (error) {
      console.warn(`Virtual Paper failed for ${sourceKey}:`, error?.message || String(error));
    }
  });

  try {
    await Promise.race([
      Promise.all(fetchPromises),
      timeoutPromise,
    ]);
  } catch (error) {
    console.warn('Virtual Paper fetch timed out or failed:', error);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  if (Object.keys(sources).length === 0) {
    throw new Error('Failed to generate Virtual Paper. Please check connection.');
  }

  return sources;
}

export function useNewspaperPageViewModel() {
  const { settings } = useSettings();

  const [activeSource, setActiveSource] = useState(SOURCES.THE_HINDU.id);
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isTranslated, setIsTranslated] = useState(false);
  const [dynamicSummaries, setDynamicSummaries] = useState({});
  const [dynamicTitles, setDynamicTitles] = useState({});
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isTranslatingTitles, setIsTranslatingTitles] = useState(false);
  const [digestMode, setDigestMode] = useState(false);
  const [clientSummaries, setClientSummaries] = useState({});
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const summaryLineLimit = settings?.newspaper?.summaryLineLimit || 50;
  const geminiKey = settings?.geminiKey || '';
  const hasGeminiKey = Boolean(geminiKey);

  const sourceMeta = useMemo(() => (
    getSourceMeta(activeSource)
  ), [activeSource]);

  const isTamilSource = sourceMeta.lang === 'ta';
  const showTranslationControls = isTamilSource;

  const fetchFallbackPaper = useCallback(async () => (
    fetchFallbackVirtualPaper()
  ), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const json = await fetchStaticNewspaperData();
      setData(json.sources);
      setLastUpdated(json.lastUpdated);
    } catch (fetchError) {
      console.warn('JSON fetch failed, trying Virtual Paper fallback...', fetchError);

      try {
        const fallbackData = await fetchFallbackPaper();
        setData(fallbackData);
        setLastUpdated(new Date().toISOString());
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
        setError("Failed to load today's paper. Please check your internet connection.");
      }
    } finally {
      setLoading(false);
    }
  }, [fetchFallbackPaper]);

  const generateClientSummary = useCallback(async (sectionPage, articles) => {
    const key = getSummaryLookupKey(activeSource, sectionPage);

    if (clientSummaries[key]) return null;

    const firstArticle = asArray(articles)[0];

    if (!firstArticle?.link) return null;

    try {
      const text = await extractArticleText(firstArticle.link);

      if (text && text.length > 200) {
        const summary = await summarizeText(text, 6);

        if (summary) {
          setClientSummaries(prev => ({
            ...prev,
            [key]: summary,
          }));
        }

        return summary;
      }
    } catch {
      // Best-effort fallback only.
    }

    return null;
  }, [activeSource, clientSummaries]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const generateMissingSummaries = async () => {
      if (!data || !data[activeSource]) return;
      if (!geminiKey) return;

      const currentSections = asArray(data[activeSource]);
      const isTamil = getSourceMeta(activeSource).lang === 'ta';

      for (const section of currentSections) {
        const needsSummary = (!section.summary && !section.summary_ta) || section.error;
        const alreadyGenerated = dynamicSummaries[section.page];

        if (needsSummary && !alreadyGenerated && !isGeneratingSummary) {
          setIsGeneratingSummary(true);

          try {
            console.log(`Generating fallback summary for ${section.page}...`);

            const result = await geminiService.generateSummary(
              section.articles,
              geminiKey,
              isTamil
            );

            setDynamicSummaries(prev => ({
              ...prev,
              [section.page]: result,
            }));
          } catch (summaryError) {
            console.error(`Failed to generate summary for ${section.page}:`, summaryError);
          } finally {
            setIsGeneratingSummary(false);
          }
        }
      }
    };

    generateMissingSummaries();
  }, [activeSource, data, dynamicSummaries, geminiKey, isGeneratingSummary]);

  useEffect(() => {
    const translateVisibleTitles = async () => {
      if (!isTranslated) return;
      if (!data || !data[activeSource]) return;
      if (getSourceMeta(activeSource).lang === 'en') return;
      if (!geminiKey) return;

      const currentSections = asArray(data[activeSource]);
      const titlesToTranslate = [];
      const articleMap = [];

      currentSections.forEach(section => {
        asArray(section.articles).forEach(article => {
          const hasServerTranslation = article?.title_en;
          const hasDynamicTranslation = dynamicTitles[article?.link];

          if (article?.title && !hasServerTranslation && !hasDynamicTranslation) {
            titlesToTranslate.push(article.title);
            articleMap.push(article.link);
          }
        });
      });

      if (titlesToTranslate.length > 0 && !isTranslatingTitles) {
        setIsTranslatingTitles(true);

        try {
          console.log(`Translating ${titlesToTranslate.length} titles...`);

          const chunkSize = 15;

          for (let i = 0; i < titlesToTranslate.length; i += chunkSize) {
            const batch = titlesToTranslate.slice(i, i + chunkSize);
            const results = await geminiService.translateTexts(batch, geminiKey);

            setDynamicTitles(prev => {
              const updates = { ...prev };

              results.forEach((translatedTitle, idx) => {
                const originalIdx = i + idx;

                if (articleMap[originalIdx]) {
                  updates[articleMap[originalIdx]] = translatedTitle;
                }
              });

              return updates;
            });
          }
        } catch (translationError) {
          console.error('Translation failed:', translationError);
        } finally {
          setIsTranslatingTitles(false);
        }
      }
    };

    translateVisibleTitles();
  }, [
    activeSource,
    data,
    dynamicTitles,
    geminiKey,
    isTranslated,
    isTranslatingTitles,
  ]);

  const getSectionSummary = useCallback((section) => (
    getSectionSummaryResult({
      section,
      activeSource,
      isTranslated,
      dynamicSummaries,
      clientSummaries,
    })
  ), [
    activeSource,
    clientSummaries,
    dynamicSummaries,
    isTranslated,
  ]);

  const handleGenerateAll = useCallback(async () => {
    if (!data || !data[activeSource]) return;

    setIsGeneratingAll(true);

    try {
      const sections = asArray(data[activeSource]);

      const tasks = sections.map(async section => {
        const key = getSummaryLookupKey(activeSource, section.page);
        const hasGemini = dynamicSummaries[section.page];
        const hasClient = clientSummaries[key];
        const hasServer = (getSourceMeta(activeSource).lang === 'ta' && !isTranslated)
          ? section.summary_ta
          : section.summary;

        if (hasGemini || hasClient || hasServer) return;

        if (geminiKey) {
          try {
            const result = await geminiService.generateSummary(
              section.articles,
              geminiKey,
              getSourceMeta(activeSource).lang === 'ta'
            );

            setDynamicSummaries(prev => ({
              ...prev,
              [section.page]: result,
            }));
          } catch (generationError) {
            console.error(`Gemini Gen Failed for ${section.page}:`, generationError);
          }
        } else {
          try {
            await generateClientSummary(section.page, section.articles);
          } catch (clientError) {
            console.error(`Client Summary Failed for ${section.page}:`, clientError);
          }
        }
      });

      await Promise.allSettled(tasks);
    } finally {
      setIsGeneratingAll(false);
    }
  }, [
    activeSource,
    clientSummaries,
    data,
    dynamicSummaries,
    geminiKey,
    generateClientSummary,
    isTranslated,
  ]);

  useEffect(() => {
    if (!data || !data[activeSource]) return;

    const firstSection = asArray(data[activeSource])[0];

    if (firstSection && !firstSection.summary && !firstSection.summary_ta && !geminiKey) {
      generateClientSummary(firstSection.page, firstSection.articles);
    }
  }, [activeSource, data, geminiKey, generateClientSummary]);

  const handleSourceChange = useCallback((sourceId) => {
    setActiveSource(sourceId);
    setIsTranslated(false);
  }, []);

  const toggleDigestMode = useCallback(() => {
    setDigestMode(prev => !prev);
  }, []);

  const toggleTranslation = useCallback(() => {
    setIsTranslated(prev => !prev);
  }, []);

  const currentSections = useMemo(() => (
    data ? asArray(data[activeSource]) : []
  ), [activeSource, data]);

  return {
    sources: SOURCES,
    activeSource,
    sourceMeta,
    currentSections,
    data,
    lastUpdated,
    loading,
    error,

    isTranslated,
    dynamicSummaries,
    dynamicTitles,
    isGeneratingSummary,
    isTranslatingTitles,
    digestMode,
    clientSummaries,
    isGeneratingAll,
    summaryLineLimit,
    hasGeminiKey,

    isTamilSource,
    showTranslationControls,

    fetchData,
    // Normalized reload interface: reload(force) and handleRefresh align with
    // useNewspaperTabViewModel pattern (reloadDataset(force))
    handleRefresh: fetchData,
    reload: () => fetchData(),
    fetchFallbackPaper,
    fetchFallbackRSS: fetchFallbackPaper,
    generateClientSummary,
    getSectionSummary,
    handleGenerateAll,
    handleSourceChange,
    toggleDigestMode,
    toggleTranslation,
  };
}

export const __newspaperPageViewModelInternalsForTest = {
  DATA_URL,
  SOURCES,
  asArray,
  getSourceMeta,
  getSummaryLookupKey,
  getSectionSummaryResult,
  fetchStaticNewspaperData,
  fetchFallbackVirtualPaper,
};
