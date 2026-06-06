// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import plannerStorage, { isPlannerStorageSuccess } from './plannerStorage.js';
import { addFollowedTopic, addReadArticle, getSettings } from './storage.js';

function failLocalStorageWrites() {
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError');
  });
}

describe('storage write failures', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(plannerStorage, 'savePlanToApi').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('returns an explicit planner failure when quota blocks a save', () => {
    failLocalStorageWrites();

    const result = plannerStorage.addItem('2026-05-30', {
      title: 'Quota blocked event',
      eventDateKey: '2026-05-30',
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'storage-write-failed',
    });
    expect(result.error).toContain('Storage is full');
    expect(isPlannerStorageSuccess(result)).toBe(false);
    expect(plannerStorage.getPlan()).toEqual({});
  });

  it('returns an explicit topic/history failure when settings cannot be saved', () => {
    failLocalStorageWrites();

    expect(addFollowedTopic({ name: 'Markets', query: 'Markets' })).toMatchObject({
      ok: false,
      reason: 'storage-write-failed',
    });

    expect(addReadArticle({ id: 'story-1', title: 'Important story' })).toMatchObject({
      ok: false,
      reason: 'storage-write-failed',
    });

    expect(getSettings().followedTopics).toEqual([]);
    expect(getSettings().readingHistory).toEqual([]);
  });
});
