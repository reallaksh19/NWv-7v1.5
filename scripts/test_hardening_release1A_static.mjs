import fs from 'node:fs';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const read = (path) => fs.readFileSync(path, 'utf8');

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const main = read('src/pages/MainPage.jsx');
const news = read('src/context/NewsContext.jsx');
const refresh = read('src/pages/RefreshPage.jsx');
const rss = read('src/services/rssAggregator.js');

const srcFiles = walkFiles('src');
const refreshNewsTrueHits = srcFiles.filter(path =>
  /refreshNews\s*\(\s*true\s*\)/.test(read(path))
);

pass(
  refreshNewsTrueHits.length === 0,
  `refreshNews(true) remains in: ${refreshNewsTrueHits.join(', ')}`
);

pass(main.includes('Promise.allSettled'), 'MainPage must use Promise.allSettled');

pass(news.includes('Array.isArray(specificSections)'), 'NewsContext missing Array.isArray guard');
pass(
  news.includes("specificSections.filter(s => typeof s === 'string')"),
  'NewsContext must filter section names safely'
);

pass(refresh.includes("useMarket"), 'RefreshPage missing useMarket');
pass(refresh.includes('refreshMarket(true)'), 'RefreshPage missing refreshMarket(true)');
pass(refresh.includes('Promise.allSettled'), 'RefreshPage must use Promise.allSettled');
pass(refresh.includes('finally'), 'RefreshPage must use try/finally so loading state cannot get stuck');

pass(rss.includes('function normalizeSourceText'), 'rssAggregator missing normalizeSourceText helper');
pass(
  rss.includes('cleanSource(normalizeSourceText(source))'),
  'normalizeItem must coerce source before cleanSource'
);
pass(
  rss.includes("typeof sourceName !== 'string'"),
  'cleanSource must defensively coerce non-string input'
);
pass(
  rss.includes('const sourceText = normalizeSourceText(sourceName)'),
  'isSourceAllowed must normalize sourceName'
);
pass(
  rss.includes('const mappedName = normalizeSourceText(name)'),
  'isSourceAllowed must normalize SETTINGS_MAPPING values'
);
pass(
  !/\b\w+\.source\.includes\s*\(/.test(rss),
  'unguarded .source.includes remains'
);
pass(
  rss.includes('const src = normalizeSourceText(item.source)'),
  'rssAggregator must normalize item.source in rankAndFilter'
);

console.log('PASS: Release 1A static hardening gates');
