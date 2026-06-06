import { describe, expect, it } from 'vitest';
import { evaluateUpAheadSlo } from './upAheadSlo.js';

describe('upAheadSlo', () => {
  const now = new Date('2026-05-28T10:00:00Z').getTime();

  it('fails empty up-ahead data', () => {
    const result = evaluateUpAheadSlo({ now });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('upAhead_empty');
  });

  it('passes visible up-ahead content with briefing and evidence', () => {
    const result = evaluateUpAheadSlo({
      now,
      plan: [{ title: 'Plan' }],
      offers: [{ title: 'Offer', expiryAt: '2026-05-29T10:00:00Z' }],
      releases: [],
      events: [{ title: 'Event', eventDate: '2026-05-29T10:00:00Z' }],
      alerts: [],
      weatherAlerts: [{ title: 'Rain' }],
      combinedAlerts: [{ title: 'Rain' }],
      festivals: [],
      civics: [],
      briefing: { text: 'Briefing' },
      evidence: { sources: [] },
    });

    expect(result.passed).toBe(true);
    expect(result.metrics.totalVisible).toBeGreaterThan(0);
  });

  it('warns expired offers and events', () => {
    const result = evaluateUpAheadSlo({
      now,
      offers: [{ title: 'Old offer', expiryAt: '2026-05-20T10:00:00Z' }],
      events: [{ title: 'Old event', eventDate: '2026-05-20T10:00:00Z' }],
      combinedAlerts: [{ title: 'Live alert' }],
      alerts: [{ title: 'Live alert' }],
      briefing: { text: 'Briefing' },
      evidence: { sources: [] },
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('upAhead_expired_offers:1');
    expect(result.warnings).toContain('upAhead_expired_events:1');
  });

  it('fails when all visible dated content is expired', () => {
    const result = evaluateUpAheadSlo({
      now,
      offers: [{ title: 'Old offer', expiryAt: '2026-05-20T10:00:00Z' }],
      events: [{ title: 'Old event', eventDate: '2026-05-20T10:00:00Z' }],
      briefing: { text: 'Briefing' },
      evidence: { sources: [] },
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('upAhead_all_visible_content_expired');
  });
});
