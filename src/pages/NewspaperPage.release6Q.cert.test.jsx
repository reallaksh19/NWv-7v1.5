import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  __newspaperPageViewModelInternalsForTest,
} from '../viewModels/useNewspaperPageViewModel.js';

const read = path => fs.readFileSync(path, 'utf8');

function hasHookCall(content, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(content);
}

describe('Release 6Q NewspaperPage ViewModel binding', () => {
  const page = read('src/pages/NewspaperPage.jsx');
  const vm = read('src/viewModels/useNewspaperPageViewModel.js');

  it('NewspaperPage no longer owns settings/service/data orchestration imports', () => {
    expect(page).not.toContain("from '../context/SettingsContext'");
    expect(page).not.toContain("from '../services/geminiService'");
    expect(page).not.toContain("from '../utils/articleExtractor'");
    expect(page).not.toContain("from '../utils/extractiveSummary'");
    expect(page).not.toContain("from '../services/virtualPaperService'");
    expect(page).not.toContain("from '../services/proxyManager'");
    expect(hasHookCall(page, 'useSettings')).toBe(false);
    expect(page).toContain('useNewspaperPageViewModel');
  });

  it('NewspaperPage no longer calls data/AI/fallback services directly', () => {
    expect(page).not.toContain('fetch(`${DATA_URL}?t=${Date.now()}`)');
    expect(page).not.toContain('geminiService.');
    expect(page).not.toContain('extractArticleText(');
    expect(page).not.toContain('summarizeText(');
    expect(page).not.toContain('virtualPaperService.');
  });

  it('ViewModel owns newspaper fetch, fallback, AI generation and translation', () => {
    [
      "from '../context/SettingsContext'",
      "from '../services/geminiService'",
      "from '../utils/articleExtractor'",
      "from '../utils/extractiveSummary'",
      "from '../services/virtualPaperService'",
      'fetchStaticNewspaperData',
      'fetchFallbackVirtualPaper',
      'fetchFallbackPaper',
      'fetchFallbackRSS: fetchFallbackPaper',
      'clearTimeout',
      'geminiService.generateSummary',
      'geminiService.translateTexts',
      'extractArticleText',
      'summarizeText',
      'virtualPaperService.getVirtualPaper',
      'generateClientSummary',
      'handleGenerateAll',
    ].forEach(token => {
      expect(vm).toContain(token);
    });

    expect(vm).not.toContain('proxyManager');
  });

  it('NewspaperPage preserves existing UI contracts', () => {
    expect(page).toContain('<NewspaperCard');
    expect(page).toContain('digestMode');
    expect(page).toContain('FaLanguage');
    expect(page).toContain('FaBolt');
    expect(page).toContain('Add Key to Enable');
    expect(page).toContain('Daily Brief');
    expect(page).toContain('Array.isArray(section.articles)');
  });

  it('summary lookup chooses dynamic, server, then extractive summaries', () => {
    const {
      getSectionSummaryResult,
    } = __newspaperPageViewModelInternalsForTest;

    expect(getSectionSummaryResult({
      section: { page: 'Front', summary: 'server summary' },
      activeSource: 'THE_HINDU',
      isTranslated: true,
      dynamicSummaries: {},
      clientSummaries: {},
    })).toEqual({
      text: 'server summary',
      method: 'server',
    });

    expect(getSectionSummaryResult({
      section: { page: 'Front' },
      activeSource: 'THE_HINDU',
      isTranslated: true,
      dynamicSummaries: { Front: { summary: 'ai summary' } },
      clientSummaries: {},
    })).toEqual({
      text: 'ai summary',
      method: 'gemini',
    });

    expect(getSectionSummaryResult({
      section: { page: 'Front' },
      activeSource: 'THE_HINDU',
      isTranslated: true,
      dynamicSummaries: {},
      clientSummaries: { THE_HINDU_Front: 'extractive summary' },
    })).toEqual({
      text: 'extractive summary',
      method: 'extractive',
    });
  });

  it('summary lookup prefers Tamil summary when not translated', () => {
    const {
      getSectionSummaryResult,
    } = __newspaperPageViewModelInternalsForTest;

    expect(getSectionSummaryResult({
      section: {
        page: 'Front',
        summary: 'English summary',
        summary_ta: 'Tamil summary',
        summary_method: 'server',
      },
      activeSource: 'DINAMANI',
      isTranslated: false,
      dynamicSummaries: {},
      clientSummaries: {},
    })).toEqual({
      text: 'Tamil summary',
      method: 'server',
    });
  });

  it('source metadata falls back safely', () => {
    const {
      getSourceMeta,
      SOURCES,
    } = __newspaperPageViewModelInternalsForTest;

    expect(getSourceMeta('DINAMANI')).toEqual(SOURCES.DINAMANI);
    expect(getSourceMeta('UNKNOWN')).toEqual(SOURCES.THE_HINDU);
  });
});
