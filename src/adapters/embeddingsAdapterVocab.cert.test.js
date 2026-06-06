import { describe, expect, it } from 'vitest';
import { getEmbeddings } from './embeddingsAdapter.js';
import { cosineSimilarity } from '../insight/src/dedup/dedup.ts';

describe('fixed embedding vocabulary India coverage certification', () => {
  it('gives Indian political stories useful non-zero coverage', async () => {
    const [vec] = await getEmbeddings([
      'CM Siddaramaiah resigns Congress supports new CM Bengaluru',
    ]);
    const nonZero = vec.filter(value => value > 0).length;

    expect(nonZero).toBeGreaterThanOrEqual(10);
  });

  it('keeps unrelated Indian events below the duplicate similarity band', async () => {
    const [politics, aviation] = await getEmbeddings([
      'CM Siddaramaiah resigns Congress party Bengaluru',
      'Air India flight returns Delhi technical snag',
    ]);

    expect(cosineSimilarity(politics, aviation)).toBeLessThan(0.7);
  });
});
