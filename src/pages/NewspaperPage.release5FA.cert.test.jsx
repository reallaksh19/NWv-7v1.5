import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('NewspaperPage Release 5F-A migration', () => {
  const src = fs.readFileSync('src/pages/NewspaperPage.jsx', 'utf8');

  it('uses Newspaper ViewModel and DataStateBoundary', () => {
    expect(src).toContain('useNewspaperTabViewModel');
    expect(src).toContain('DataStateBoundary');
  });

  it('does not import SettingsContext directly', () => {
    expect(src).not.toContain("from '../context/SettingsContext'");
    expect(src).not.toContain('useSettings');
  });

  it('does not perform page-level static JSON/RSS/service fetching', () => {
    expect(src).not.toContain('DATA_URL');
    expect(src).not.toContain('FALLBACK_FEEDS');
    expect(src).not.toContain('fetchData');
    expect(src).not.toContain('fetchFallbackRSS');
    expect(src).not.toContain('virtualPaperService');
    expect(src).not.toContain('proxyManager');
  });

  it('does not import Gemini/extractive services directly', () => {
    expect(src).not.toContain('geminiService');
    expect(src).not.toContain('extractArticleText');
    expect(src).not.toContain('summarizeText');
  });

  it('keeps newspaper UI controls', () => {
    expect(src).toContain('Generate All Summaries');
    expect(src).toContain('Digest View');
    expect(src).toContain('Translate to English');
    expect(src).toContain('NewspaperCard');
    expect(src).toContain('Daily Brief');
  });

  it('routes refresh through ViewModel reload', () => {
    expect(src).toContain('handleRefresh');
    expect(src).toContain('reload(true)');
    expect(src).toContain('onClick={handleRefresh}');
  });

  it('passes dataset error into DataStateBoundary', () => {
    expect(src).toContain('errorMessage={error || "Failed to load today');
  });

  it('uses hasGeminiKey from ViewModel instead of checking sourceMeta', () => {
    expect(src).toContain('hasGeminiKey');
    expect(src).toContain('!hasGeminiKey');
    expect(src).not.toContain('sourceMeta?.geminiKey');
  });
});
