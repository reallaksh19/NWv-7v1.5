import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('FollowingPage Release 5F-C migration', () => {
  const src = fs.readFileSync('src/pages/FollowingPage.jsx', 'utf8');

  it('uses Following ViewModel and DataStateBoundary', () => {
    expect(src).toContain('useFollowingTabViewModel');
    expect(src).toContain('DataStateBoundary');
  });

  it('does not import TopicContext directly', () => {
    expect(src).not.toContain("from '../context/TopicContext");
    expect(src).not.toContain('useTopics');
  });

  it('does not contain page-level projection helpers', () => {
    expect(src).not.toContain('function getTopicStats');
    expect(src).not.toContain('useMemo');
    expect(src).not.toContain('sortedTopics = useMemo');
  });

  it('does not call refreshTopics directly', () => {
    expect(src).not.toContain('refreshTopics(false)');
    expect(src).not.toContain('refreshTopics(true)');
  });

  it('keeps Following UI components and sections', () => {
    expect(src).toContain('TopicSearch');
    expect(src).toContain('TopicCard');
    expect(src).toContain('Personal topic desk');
    expect(src).toContain('Suggested for you');
    expect(src).toContain('Your Topics');
    expect(src).toContain('No topics followed yet');
  });

  it('routes suggestion and refresh through ViewModel wrappers', () => {
    expect(src).toContain('handleSuggestionClick');
    expect(src).toContain('handleRefresh');
    expect(src).toContain('refresh(false)');
  });

  it('uses robust normalized suggestion keys', () => {
    expect(src).toContain('key={`${suggestion.query || suggestion.word}-${index}`}');
  });

  it('treats empty following state as ready UI', () => {
    expect(src).toContain('treatEmptyAsReady={true}');
  });
});
