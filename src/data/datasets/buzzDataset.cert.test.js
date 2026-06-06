import { describe, expect, it } from 'vitest';
import { __buzzDatasetInternalsForTest } from './buzzDataset.js';

const { classifyEntertainment, classifyEntertainmentItem, splitTechnologyCards } = __buzzDatasetInternalsForTest;

describe('Buzz dataset technology recovery', () => {
  it('keeps Tech & Startups populated when every technology story is AI-related', () => {
    const result = splitTechnologyCards([
      { id: '1', title: 'OpenAI launches new coding agent' },
      { id: '2', title: 'AI chip startup raises fresh funding' },
    ]);

    expect(result.aiCards).toHaveLength(2);
    expect(result.techCards).toHaveLength(2);
  });

  it('splits non-AI technology stories into Tech while preserving AI cards', () => {
    const result = splitTechnologyCards([
      { id: '1', title: 'Startup launches payments app' },
      { id: '2', title: 'Machine learning model improves search' },
    ]);

    expect(result.techCards.map(item => item.id)).toEqual(['1']);
    expect(result.aiCards.map(item => item.id)).toEqual(['2']);
  });

  it('places entertainment stories in one trusted region and drops unrelated rows', () => {
    expect(classifyEntertainmentItem({
      id: 'explicit',
      title: 'Amitabh Bachchan update',
      region: 'tamil',
    })).toBe('hindi');

    const result = classifyEntertainment([
      { id: 'tamil', title: 'Vijay Tamil cinema update' },
      { id: 'ott', title: 'Netflix releases a new limited series' },
      { id: 'noise', title: 'Siddaramaiah meets Congress high command', source: 'India News' },
    ]);

    expect(result.tamil.map(item => item.id)).toEqual(['tamil']);
    expect(result.ott.map(item => item.id)).toEqual(['ott']);
    expect(Object.values(result).flat().map(item => item.id)).not.toContain('noise');
  });
});
