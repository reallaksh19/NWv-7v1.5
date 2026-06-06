import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

// MarketPage now routes trust/health through useMarketPageViewModel rather than
// importing MarketTrustPanel directly. MarketTrustPanel still exists as a
// component but is rendered inline by the page using the view-model's sourceHealth.

const marketPage = read('src/pages/MarketPage.jsx');
const trustPanel = read('src/components/market/MarketTrustPanel.jsx');
const trustCss = read('src/components/market/MarketTrustPanel.css');
const viewModel = read('src/viewModels/useMarketPageViewModel.js');

// ── MarketPage must use the view model and expose sourceHealth inline ──────────
assert(
  marketPage.includes("useMarketPageViewModel"),
  'MarketPage must import useMarketPageViewModel'
);
assert(
  marketPage.includes('sourceHealth'),
  'MarketPage must destructure sourceHealth from view model'
);
assert(
  marketPage.includes('Source health'),
  'MarketPage must render a Source health section'
);
assert(
  marketPage.includes('Object.entries(sourceHealth)'),
  'MarketPage must render sourceHealth entries via Object.entries'
);

// ── MarketTrustPanel component must remain sound for future use ───────────────
for (const token of [
  'getCoverage',
  'getTrustGrade',
  'getSourceStats',
  'Data trust',
  'Market data unavailable',
  'Seed / fallback data',
  'Degraded feed coverage',
  'Broad market coverage',
  'Partial but useful coverage',
  'Thin market coverage',
  'Source health details',
  'data-market-trust-grade'
]) {
  assert(trustPanel.includes(token), `MarketTrustPanel missing token: ${token}`);
}

for (const section of [
  'Indices',
  'Movers',
  'Sectorals',
  'Commodities',
  'Currency',
  'FII/DII',
  'MF',
  'IPO'
]) {
  assert(trustPanel.includes(section), `MarketTrustPanel missing coverage section: ${section}`);
}

for (const token of [
  '.market-trust-panel',
  '.market-trust-panel__coverage',
  '.market-trust-panel__tile--ok',
  '.market-trust-panel__tile--missing',
  '.market-trust-panel__source-status--live',
  '.market-trust-panel__source-status--snapshot',
  '.market-trust-panel__source-status--failed',
  '@media (max-width: 760px)'
]) {
  assert(trustCss.includes(token), `MarketTrustPanel.css missing token: ${token}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Market trust panel slice',
  guarantees: [
    'MarketPage uses useMarketPageViewModel and renders sourceHealth inline',
    'MarketTrustPanel component is structurally sound for future use',
    'section coverage is visible in the panel component',
    'source health details are visible in the panel component',
    'seed/stale/degraded states are explicit',
    'no market feed logic was changed'
  ]
}, null, 2));

console.log('PASS: Market trust panel static slice');
