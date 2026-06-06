import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('InsightPage Release 5G migration', () => {
  const src = fs.readFileSync('src/pages/InsightPage.jsx', 'utf8');

  it('uses Insight ViewModel and DataStateBoundary', () => {
    expect(src).toContain('useInsightTabViewModel');
    expect(src).toContain('DataStateBoundary');
  });

  it('does not import pipeline/fetch/cache orchestration directly', () => {
    expect(src).not.toContain('runInsightPipeline');
    expect(src).not.toContain('createInsightFetcher');
    expect(src).not.toContain('recoverInsightRuntimeQuality');
    expect(src).not.toContain('repairInsightResult');
    expect(src).not.toContain('INSIGHT_OUTPUT_CONTRACT_VERSION');
  });

  it('does not define cache or refresh orchestration in the page', () => {
    expect(src).not.toContain('CACHE_KEY');
    expect(src).not.toContain('readCache');
    expect(src).not.toContain('writeCache');
    expect(src).not.toContain('REFRESH_EVERY');
    expect(src).not.toContain('HIDDEN_REFRESH');
    expect(src).not.toContain('visibilitychange');
    expect(src).not.toContain('setInterval');
  });

  it('preserves Insight concept diagnostics', () => {
    expect(src).toContain('ANGLE_DISPLAY_LABELS');
    expect(src).toContain('SNAPSHOT_DISPLAY_LABELS');
    expect(src).toContain('getInsightAuditRows');
    expect(src).toContain('getInsightAuditSummary');
    expect(src).toContain('getInsightRankingDiagnosticRows');
    expect(src).toContain('getInsightRankingDiagnosticSummary');
    expect(src).toContain('InsightDiagnosticsPanel');
    expect(src).toContain('InsightRankingDiagnosticsPanel');
    expect(src).toContain('InsightBehaviorEvidencePanel');
    expect(src).toContain('NewsdataRuntimeStatusPanel');
    expect(src).toContain('GradeBadge');
    expect(src).toContain('FreshBanner');
  });

  it('moves quality diagnostics into ranking icon popup and keeps compact signal visible', () => {
    expect(src).toContain('function InsightQualityPopupButton');
    expect(src).toContain('data-insight-quality-popup="ranking-icon"');
    expect(src).toContain('aria-label="Open Insight quality diagnostics"');
    expect(src).toContain('insight-quality-inline');
    expect(src).toContain('Signal <b>{diagnostics.signalScore}</b>');
    expect(src).not.toContain('<InsightDiagnosticsPanel diagnostics={diagnostics} />\n      <InsightAuditPanel');
  });

  it('uses robust story timestamp parsing', () => {
    expect(src).toContain('getStoryPublishedAtMs');
    expect(src).toContain('story?.publishedAt || story?.timestamp || story?.date || story?.pubDate');
  });

  it('does not treat empty Insight as ready', () => {
    expect(src).not.toContain('treatEmptyAsReady={true}');
    expect(src).toContain('treatEmptyAsReady={false}');
  });

  it('preserves empty and fresh-result UX', () => {
    expect(src).toContain('No Insights Available');
    expect(src).toContain('FreshBanner');
    expect(src).toContain('Running AI pipeline');
  });

  it('routes refresh through ViewModel refresh', () => {
    expect(src).toContain('handleRefresh');
    expect(src).toContain('refresh(false)');
    expect(src).toContain('onRefresh={handleRefresh}');
  });
});
