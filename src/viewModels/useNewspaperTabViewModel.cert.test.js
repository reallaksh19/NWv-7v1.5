import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  __newspaperViewModelInternalsForTest,
} from './useNewspaperTabViewModel.js';

const {
  MAX_AUTO_SUMMARY_ARTICLES,
  MAX_TITLE_TRANSLATIONS,
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
} = __newspaperViewModelInternalsForTest;

describe('useNewspaperTabViewModel static checks', () => {
  const src = fs.readFileSync('src/viewModels/useNewspaperTabViewModel.js', 'utf8');

  it('uses newspaper dataset', () => {
    expect(src).toContain("useDataset('newspaper')");
  });

  it('does not own static JSON/RSS fetch orchestration', () => {
    expect(src).not.toContain('DATA_URL');
    expect(src).not.toContain('FALLBACK_FEEDS');
    expect(src).not.toContain('fetchFallbackRSS');
    expect(src).not.toContain('virtualPaperService');
    expect(src).not.toContain('proxyManager');
  });

  it('owns source projection, summary selection, translation helpers, and reload', () => {
    expect(src).toContain('inferSourcesFromDatasetData');
    expect(src).toContain('normalizeSourceSections');
    expect(src).toContain('getSectionSummary');
    expect(src).toContain('getArticleTitle');
    expect(src).toContain('handleGenerateAll');
    expect(src).toContain('reloadDataset(force)');
  });

  it('keeps Gemini and extractive fallback outside page', () => {
    expect(src).toContain('geminiService');
    expect(src).toContain('extractArticleText');
    expect(src).toContain('summarizeText');
  });

  it('guards async state and caps expensive AI operations', () => {
    expect(src).toContain('useMountedRef');
    expect(src).toContain('mountedRef.current');
    expect(src).toContain('MAX_AUTO_SUMMARY_ARTICLES');
    expect(src).toContain('MAX_TITLE_TRANSLATIONS');
    expect(src).toContain('autoSummaryAttemptedRef');
    expect(src).toContain('hasGeminiKey');
  });
});

describe('Newspaper ViewModel internals', () => {
  it('defines professional AI operation caps', () => {
    expect(MAX_AUTO_SUMMARY_ARTICLES).toBe(8);
    expect(MAX_TITLE_TRANSLATIONS).toBe(60);
  });

  it('normalizes one section', () => {
    const section = normalizeSection('Front Page', [{ title: 'A' }], { summary: 'S' });

    expect(section.page).toBe('Front Page');
    expect(section.articles).toHaveLength(1);
    expect(section.summary).toBe('S');
  });

  it('normalizes array-shaped source sections', () => {
    const result = normalizeSourceSections([
      { page: 'Front', articles: [{ title: 'A' }] },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].page).toBe('Front');
  });

  it('normalizes object-shaped source sections', () => {
    const result = normalizeSourceSections({
      Front: [{ title: 'A' }],
      Business: [{ title: 'B' }],
    });

    expect(result).toHaveLength(2);
    expect(result[0].page).toBe('Front');
    expect(result[0].articles).toHaveLength(1);
  });

  it('converts section bucket object to paper sections', () => {
    const result = sectionsObjectToPaperSections({
      lead: [{ title: 'Lead' }],
      business: [{ title: 'Biz' }],
    });

    expect(result).toHaveLength(2);
    expect(result[0].page).toBe('lead');
  });

  it('converts layout groups to paper sections', () => {
    const result = layoutGroupsToPaperSections({
      local: [{ title: 'Local' }],
    });

    expect(result[0].page).toBe('local');
    expect(result[0].articles).toHaveLength(1);
  });

  it('infers sources from explicit sources object', () => {
    const result = inferSourcesFromDatasetData({
      sources: {
        THE_HINDU: [{ page: 'Front', articles: [] }],
      },
    });

    expect(result.THE_HINDU).toHaveLength(1);
  });

  it('infers sources from layout groups if source object is absent', () => {
    const result = inferSourcesFromDatasetData({
      layoutGroups: {
        lead: [{ title: 'Lead' }],
      },
    });

    expect(result.THE_HINDU).toHaveLength(1);
  });

  it('normalizes source sections from object-shaped source maps', () => {
    const result = normalizeSources({
      THE_HINDU: {
        Front: [{ title: 'A' }],
      },
    });

    expect(result.THE_HINDU[0].page).toBe('Front');
    expect(result.THE_HINDU[0].articles).toHaveLength(1);
  });

  it('creates source metadata for unknown source ids', () => {
    const result = getAvailableSources({
      CUSTOM_SOURCE: [],
    });

    expect(result[0].id).toBe('CUSTOM_SOURCE');
    expect(result[0].label).toBe('Custom Source');
  });

  it('resolves active source with fallback', () => {
    expect(resolveActiveSource('MISSING', { THE_HINDU: [] })).toBe('THE_HINDU');
  });

  it('returns known source metadata', () => {
    expect(getSourceMeta('DINAMANI').lang).toBe('ta');
  });

  it('selects dynamic summary before server summary', () => {
    const result = getSectionSummary({
      section: {
        page: 'Front',
        summary: 'Server',
      },
      activeSource: 'THE_HINDU',
      isTranslated: false,
      dynamicSummaries: {
        Front: {
          summary: 'Dynamic',
        },
      },
      clientSummaries: {},
    });

    expect(result.text).toBe('Dynamic');
    expect(result.method).toBe('gemini');
  });

  it('uses client summary fallback', () => {
    const result = getSectionSummary({
      section: {
        page: 'Front',
      },
      activeSource: 'THE_HINDU',
      isTranslated: false,
      dynamicSummaries: {},
      clientSummaries: {
        THE_HINDU_Front: 'Extractive',
      },
    });

    expect(result.text).toBe('Extractive');
    expect(result.method).toBe('extractive');
  });

  it('chooses translated article title when requested', () => {
    const result = getArticleTitle(
      {
        title: 'Original',
        title_en: 'English',
        link: 'a',
      },
      true,
      {}
    );

    expect(result).toBe('English');
  });

  it('applies dynamic translated title to card article', () => {
    const result = getArticleWithDynamicTitle(
      {
        title: 'Original',
        link: 'a',
      },
      {
        a: 'Dynamic English',
      }
    );

    expect(result.title_en).toBe('Dynamic English');
  });

  it('returns malformed article unchanged in getArticleWithDynamicTitle', () => {
    expect(getArticleWithDynamicTitle(null, {})).toBe(null);
  });

  it('detects missing summary', () => {
    expect(hasMissingSummary({ articles: [] })).toBe(true);
    expect(hasMissingSummary({ summary: 'ok' })).toBe(false);
  });

  it('formats last updated label', () => {
    expect(getLastUpdatedLabel('2026-05-28T10:00:00Z')).toBeTruthy();
  });
});
