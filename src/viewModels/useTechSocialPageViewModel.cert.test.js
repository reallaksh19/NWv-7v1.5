import { describe, expect, it } from 'vitest';
import { __techSocialPageViewModelInternalsForTest } from './useTechSocialPageViewModel.js';

const {
  mergeBuzzDisplayData,
  projectBuzzDatasetToNewsData,
  projectTechnologyStories,
  projectAiInnovationStories,
  classifyEntertainmentRegion,
  projectEntertainmentStories,
} = __techSocialPageViewModelInternalsForTest;

describe('TechSocial page Buzz dataset fallback', () => {
  it('projects Buzz dataset tech and AI cards into legacy page news shape', () => {
    const result = projectBuzzDatasetToNewsData({
      techCards: [{ id: 'tech-1', title: 'Startup funding round' }],
      aiCards: [{ id: 'ai-1', title: 'OpenAI model update' }],
      sourceSections: {
        technology: [{ id: 'tech-2', title: 'Chip startup ships accelerator' }],
      },
    });

    expect(result.technology.map(item => item.id)).toEqual(['tech-1', 'ai-1', 'tech-2']);
  });

  it('uses adapter technology only when legacy NewsContext technology is empty', () => {
    const result = mergeBuzzDisplayData(
      { technology: [], entertainment: [{ id: 'legacy-ent' }] },
      { technology: [{ id: 'adapter-tech' }], entertainment: [{ id: 'adapter-ent' }] }
    );

    expect(result.technology.map(item => item.id)).toEqual(['adapter-tech']);
    expect(result.entertainment.map(item => item.id)).toEqual(['legacy-ent']);
  });

  it('renders adapter AI-heavy technology in both Tech and AI projections', () => {
    const displayData = {
      technology: [
        { id: '1', title: 'OpenAI releases startup tools', publishedAt: Date.now() },
      ],
    };

    expect(projectTechnologyStories(displayData, 72)).toHaveLength(1);
    expect(projectAiInnovationStories(displayData, 72)).toHaveLength(1);
  });

  it('does not route generic India or city stories into entertainment language tabs', () => {
    expect(classifyEntertainmentRegion({
      title: 'Siddaramaiah meets Congress high command',
      source: 'India News',
    })).toBeNull();

    expect(classifyEntertainmentRegion({
      title: 'Chennai traffic diversion announced',
      source: 'Local Desk',
    })).toBeNull();
  });

  it('does not let explicit feed regions override story text signals', () => {
    expect(classifyEntertainmentRegion({
      title: 'Bollywood title inside a Tamil entertainment feed',
      region: 'tamil',
    })).toBe('hindi');
  });

  it('filters unclassified entertainment rows out of visible tab data', () => {
    const stories = projectEntertainmentStories({
      entertainment: [
        { id: 'politics', title: 'UN-honoured TN farmer story', source: 'India News', publishedAt: Date.now() },
        { id: 'ott', title: 'Netflix releases new limited series', publishedAt: Date.now() },
      ],
    });

    expect(stories.map(item => item.id)).toEqual(['ott']);
  });
});
