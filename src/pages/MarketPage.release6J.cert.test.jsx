import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  __marketTabViewModelInternalsForTest,
} from '../viewModels/useMarketTabViewModel.js';

const { projectMarketData } = __marketTabViewModelInternalsForTest;

describe('Release 6J Market surface binding', () => {
  const marketPage = fs.readFileSync('src/pages/MarketPage.jsx', 'utf8');
  const quickMarket = fs.readFileSync('src/components/QuickMarket.jsx', 'utf8');
  const marketVm = fs.readFileSync('src/viewModels/useMarketTabViewModel.js', 'utf8');

  it('QuickMarket is prop-driven', () => {
    expect(quickMarket).not.toContain("from '../context/MarketContext'");
    expect(quickMarket).not.toContain("from '../context/SettingsContext'");
    expect(quickMarket).not.toContain('useMarket');
    expect(quickMarket).not.toContain('useSettings');
    expect(quickMarket).toContain('marketData = {}');
    expect(quickMarket).toContain('sessionState = null');
    expect(quickMarket).toContain('onRefreshMarket = null');
    expect(quickMarket).toContain('[QuickMarket] refresh failed');
  });

  it('QuickMarket receives sessionState rather than settings context', () => {
    expect(quickMarket).toContain('sessionState = null');
    expect(quickMarket).not.toContain('getMarketSessionState({');
    expect(quickMarket).not.toContain('settings?.market?.tradingHolidays');
  });

  it('MarketPage uses ViewModel instead of MarketContext/SettingsContext directly', () => {
    expect(marketPage).not.toContain("from '../context/MarketContext'");
    expect(marketPage).not.toContain("from '../context/SettingsContext'");
    expect(marketPage).not.toContain('useMarket()');
    expect(marketPage).not.toContain('useSettings()');
    expect(marketPage).toContain('useMarketTabViewModel');
  });

  it('MarketPage no longer owns market audit/session projection', () => {
    expect(marketPage).not.toContain('auditMarketTabQuality({');
    expect(marketPage).not.toContain('getMarketSessionState({');
  });

  it('Market ViewModel owns context, settings, boot, refresh, audit and session projection', () => {
    expect(marketVm).toContain("from '../context/MarketContext'");
    expect(marketVm).toContain("from '../context/SettingsContext'");
    expect(marketVm).toContain('useMarket');
    expect(marketVm).toContain('useSettings');
    expect(marketVm).toContain('ensureBoot');
    expect(marketVm).toContain('refreshMarket');
    expect(marketVm).toContain('auditMarketTabQuality');
    expect(marketVm).toContain('getMarketSessionState');
    expect(marketVm).toContain('quickMarketProps');
  });

  it('Market ViewModel owns full MarketPage projection', () => {
    [
      'marketSettings',
      'primaryIndices',
      'globalIndices',
      'displayedPrimaryIndices',
      'heroIndex',
      'heroSeries',
      'sessionState',
      'moverGainers',
      'moverLosers',
      'marketBreath',
      'sectoralIndices',
      'marketTabAudit',
      'navSections',
    ].forEach(token => {
      expect(marketVm).toContain(token);
    });
  });

  it('projectMarketData normalizes missing sections', () => {
    expect(projectMarketData(null)).toEqual({
      indices: [],
      globalIndices: [],
      commodities: [],
      currencies: [],
      ipo: {},
      mutualFunds: [],
      movers: {},
      sectorals: [],
      fiidii: {},
      sourceHealth: {},
      fetchedAt: undefined,
      sourceMode: undefined,
      isSnapshot: false,
      isStale: false,
      raw: {},
    });

    expect(projectMarketData({
      indices: [{ name: 'NIFTY 50' }],
      commodities: [{ name: 'Gold' }],
    })).toMatchObject({
      indices: [{ name: 'NIFTY 50' }],
      commodities: [{ name: 'Gold' }],
      currencies: [],
      ipo: {},
      mutualFunds: [],
      movers: {},
      sectorals: [],
      fiidii: {},
      sourceHealth: {},
    });
  });
});
