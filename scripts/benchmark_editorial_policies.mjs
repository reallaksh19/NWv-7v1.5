/**
 * Editorial Policies Benchmark
 *
 * Runs both audit and apply modes against real fixture data and prints a
 * comparison table. A human reviews the output before editorialPolicies.enabled
 * is flipped to true by default (Release 6C manual gate).
 *
 * Usage:
 *   node scripts/benchmark_editorial_policies.mjs
 *   node scripts/benchmark_editorial_policies.mjs --fixture public/data/sections_latest.json
 */

import fs from 'node:fs';
import path from 'node:path';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

// --- Parse CLI args ---
const args = process.argv.slice(2);
const fixtureFlag = args.indexOf('--fixture');
const fixturePath = fixtureFlag !== -1
  ? args[fixtureFlag + 1]
  : null;

// --- Load fixture ---
function tryLoadFixture(candidates) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        return { path: candidate, data: JSON.parse(fs.readFileSync(candidate, 'utf8')) };
      } catch {
        continue;
      }
    }
  }
  return null;
}

const fixture = fixturePath
  ? { path: fixturePath, data: JSON.parse(fs.readFileSync(fixturePath, 'utf8')) }
  : tryLoadFixture([
      'public/data/sections_latest.json',
      'public/data/insight_latest.json',
      'public/data/newsdata_latest.json',
    ]);

if (!fixture) {
  console.warn('No fixture file found. Generating synthetic benchmark data.');
}

// --- Build item list ---
function buildItems(raw) {
  if (!raw) return generateSyntheticItems(200);

  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.frontPage)) return raw.frontPage;
  if (Array.isArray(raw.items)) return raw.items;
  if (raw.data && Array.isArray(raw.data.frontPage)) return raw.data.frontPage;

  // Try sections object
  const sections = raw.sections || raw;
  const all = [];
  for (const key of Object.keys(sections)) {
    const arr = sections[key];
    if (Array.isArray(arr)) {
      all.push(...arr.map(item => ({ ...item, _section: key })));
    }
  }
  return all.length > 0 ? all : generateSyntheticItems(200);
}

function generateSyntheticItems(count) {
  const sources = ['bbc.com', 'ndtv.com', 'thehindu.com', 'aljazeera.com', 'indianexpress.com'];
  const now = Date.now();
  const items = [];
  for (let i = 0; i < count; i++) {
    const ageHours = Math.random() * 48; // 0–48 hours old
    // Skew: first source contributes 40% of items
    const sourceIndex = Math.random() < 0.40 ? 0 : Math.floor(Math.random() * sources.length);
    items.push({
      id: `item-${i}`,
      title: `Story ${i}`,
      source: sources[sourceIndex],
      publishedAt: now - ageHours * 3_600_000,
      impactScore: Math.random(),
    });
  }
  return items;
}

const items = buildItems(fixture?.data);

if (items.length === 0) fail('No items to benchmark — fixture may be empty or malformed');

// --- Run policies inline (no import needed — pure functions) ---

const DEFAULT_DOMINANCE_THRESHOLD = 0.35;
const DEFAULT_STALE_AGE_MS = 24 * 60 * 60 * 1000;

function getSourceKey(item) {
  return String(item?.source || item?.sourceDomain || 'unknown').toLowerCase().trim();
}

function auditDominance(items, settings = {}) {
  const threshold = settings?.editorialPolicies?.sourceDominanceThreshold ?? DEFAULT_DOMINANCE_THRESHOLD;
  const total = items.length;
  const sourceCounts = {};
  for (const item of items) {
    const key = getSourceKey(item);
    sourceCounts[key] = (sourceCounts[key] || 0) + 1;
  }
  const dominant = Object.entries(sourceCounts)
    .filter(([, c]) => c / total > threshold)
    .map(([src, c]) => ({ source: src, count: c, share: c / total }));
  const drops = [];
  for (const { source, count, share } of dominant) {
    const allowed = Math.floor(total * threshold);
    let marked = 0;
    for (let i = items.length - 1; i >= 0 && marked < count - allowed; i--) {
      if (getSourceKey(items[i]) === source) { drops.push(items[i].id); marked++; }
    }
  }
  return { drops, sourceCounts, dominant, threshold };
}

function auditStale(items, settings = {}, now = Date.now()) {
  const staleMs = settings?.editorialPolicies?.staleAgeMs ?? DEFAULT_STALE_AGE_MS;
  const cutoff = now - staleMs;
  const drops = items.filter(i => Number(i.publishedAt || 0) > 0 && i.publishedAt < cutoff).map(i => i.id);
  return { drops, staleMs, cutoff };
}

// --- Benchmark ---
console.log('\n════════════════════════════════════════════════════════════');
console.log('  Editorial Policies Benchmark');
console.log(`  Fixture: ${fixture?.path || '(synthetic)'}`);
console.log(`  Items: ${items.length}`);
console.log('════════════════════════════════════════════════════════════\n');

const dom = auditDominance(items);
const stale = auditStale(items);
const combinedDropIds = new Set([...dom.drops, ...stale.drops]);
const afterPolicies = items.filter(i => !combinedDropIds.has(i.id));

// Source distribution
const sortedSources = Object.entries(dom.sourceCounts)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 10);

console.log('Source Distribution (top 10):');
console.log('─'.repeat(60));
for (const [src, count] of sortedSources) {
  const pct = ((count / items.length) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(count / items.length * 40));
  const flag = count / items.length > DEFAULT_DOMINANCE_THRESHOLD ? ' ⚠️  DOMINANT' : '';
  console.log(`  ${src.padEnd(30)} ${String(count).padStart(4)} (${pct.padStart(5)}%)  ${bar}${flag}`);
}

console.log('\nBefore policies:');
console.log(`  Total items:        ${items.length}`);
const beforeSourceShare = sortedSources[0]
  ? `${sortedSources[0][0]} @ ${((sortedSources[0][1] / items.length) * 100).toFixed(0)}%`
  : 'n/a';
console.log(`  Top source share:   ${beforeSourceShare}`);

console.log('\nAfter policies (would remove):');
console.log(`  Total items:        ${afterPolicies.length} (-${items.length - afterPolicies.length})`);
console.log(`  Dominance drops:    ${dom.drops.length}`);
console.log(`  Stale drops:        ${stale.drops.length}`);

const afterSources = {};
for (const item of afterPolicies) {
  const k = getSourceKey(item);
  afterSources[k] = (afterSources[k] || 0) + 1;
}
const topAfter = Object.entries(afterSources).sort(([, a], [, b]) => b - a)[0];
const afterSourceShare = topAfter
  ? `${topAfter[0]} @ ${((topAfter[1] / afterPolicies.length) * 100).toFixed(0)}%`
  : 'n/a';
console.log(`  Top source share:   ${afterSourceShare}`);

console.log('\n════════════════════════════════════════════════════════════');
console.log('  To enable editorial policies: set editorialPolicies.enabled = true in Settings');
console.log('  Review the output above before enabling in production.');
console.log('════════════════════════════════════════════════════════════\n');
