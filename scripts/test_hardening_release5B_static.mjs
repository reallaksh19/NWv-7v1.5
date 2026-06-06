import fs from 'node:fs';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const exists = path => fs.existsSync(path);
const read = path => fs.readFileSync(path, 'utf8');

const release5ADatasets = [
  'src/data/datasets/sectionsDataset.js',
  'src/data/datasets/buzzDataset.js',
  'src/data/datasets/upAheadDataset.js',
  'src/data/datasets/newspaperDataset.js',
  'src/data/datasets/plannerDataset.js',
  'src/data/datasets/followingDataset.js',
  'src/data/datasets/insightDataset.js',
  'src/data/datasets/mainDataset.js',
];

release5ADatasets.forEach(path => {
  pass(exists(path), `Missing Release 5A prerequisite: ${path}`);
});

const sectionsDataset = read('src/data/datasets/sectionsDataset.js');
const upAheadDataset = read('src/data/datasets/upAheadDataset.js');
const mainDataset = read('src/data/datasets/mainDataset.js');

pass(
  sectionsDataset.includes('maxSections'),
  'Release 5A prerequisite not corrected: sectionsDataset must bound default section loading with maxSections'
);

pass(
  upAheadDataset.includes('weatherAlerts'),
  'Release 5A prerequisite not corrected: upAheadDataset must expose weatherAlerts'
);

pass(
  upAheadDataset.includes('combinedAlerts'),
  'Release 5A prerequisite not corrected: upAheadDataset must expose combinedAlerts'
);

pass(
  mainDataset.includes('adapterOnly'),
  'Release 5A prerequisite not corrected: mainDataset must expose adapterOnly'
);

pass(
  mainDataset.includes('includeInsight') && mainDataset.includes('options.includeInsight === true'),
  'Release 5A prerequisite not corrected: mainDataset must not run Insight by default'
);

const sloFiles = [
  'src/data/slo/sectionsSlo.js',
  'src/data/slo/buzzSlo.js',
  'src/data/slo/upAheadSlo.js',
  'src/data/slo/newspaperSlo.js',
  'src/data/slo/plannerSlo.js',
  'src/data/slo/followingSlo.js',
  'src/data/slo/insightSlo.js',
  'src/data/slo/mainSlo.js',
];

sloFiles.forEach(path => {
  pass(exists(path), `Missing Release 5B SLO file: ${path}`);

  const src = read(path);
  pass(src.includes('export function evaluate'), `${path} must export an evaluate* SLO function`);
  pass(src.includes('passed'), `${path} must return passed`);
  pass(src.includes('score'), `${path} must return score`);
  pass(src.includes('reasons'), `${path} must return reasons`);
  pass(src.includes('warnings'), `${path} must return warnings`);
  pass(src.includes('metrics'), `${path} must return metrics`);
});

pass(exists('src/data/slo/index.js'), 'Release 5B must add SLO registry src/data/slo/index.js');

const sloRegistry = read('src/data/slo/index.js');

[
  'market',
  'qualityDashboard',
  'sourceHealth',
  'sections',
  'buzz',
  'upAhead',
  'newspaper',
  'planner',
  'following',
  'insight',
  'main',
].forEach(name => {
  pass(sloRegistry.includes(`${name}:`), `SLO registry missing ${name}`);
});

pass(sloRegistry.includes('Object.freeze'), 'SLO registry must be frozen');
pass(sloRegistry.includes('getDatasetSloEvaluator'), 'SLO registry missing getDatasetSloEvaluator');

[
  'src/data/slo/index.cert.test.js',
  'src/data/slo/sectionsSlo.cert.test.js',
  'src/data/slo/buzzSlo.cert.test.js',
  'src/data/slo/upAheadSlo.cert.test.js',
  'src/data/slo/newspaperSlo.cert.test.js',
  'src/data/slo/plannerSlo.cert.test.js',
  'src/data/slo/followingSlo.cert.test.js',
  'src/data/slo/insightSlo.cert.test.js',
  'src/data/slo/mainSlo.cert.test.js',
].forEach(path => {
  pass(exists(path), `Missing Release 5B SLO cert test: ${path}`);
});

const sectionsSlo = read('src/data/slo/sectionsSlo.js');
pass(
  sectionsSlo.includes('duplicateHints.length > Math.max(5, totalSectionItems * 0.2)'),
  'sectionsSlo duplicate pressure must use totalSectionItems denominator'
);
pass(
  sectionsSlo.includes('sections_low_section_diversity'),
  'sectionsSlo must warn on low section diversity'
);

const buzzSlo = read('src/data/slo/buzzSlo.js');
pass(
  buzzSlo.includes('presentSurfaceCount'),
  'buzzSlo must compute presentSurfaceCount'
);
pass(
  buzzSlo.includes('buzz_surface_diversity_low'),
  'buzzSlo must warn on low surface diversity'
);

const upAheadSlo = read('src/data/slo/upAheadSlo.js');
pass(upAheadSlo.includes('countExpired'), 'upAheadSlo must include expired item detection');
pass(upAheadSlo.includes('upAhead_expired_offers'), 'upAheadSlo must warn on expired offers');
pass(upAheadSlo.includes('upAhead_expired_events'), 'upAheadSlo must warn on expired events');
pass(upAheadSlo.includes('upAhead_all_visible_content_expired'), 'upAheadSlo must fail when all visible content is expired');

const insightSlo = read('src/data/slo/insightSlo.js');
pass(
  insightSlo.includes("source === 'stale-snapshot'"),
  'insightSlo must warn specifically on stale-snapshot'
);
pass(
  !insightSlo.includes('insight_stale_or_pregenerated'),
  'insightSlo must not warn merely because staleLabel exists'
);
pass(
  insightSlo.includes('insight_story_count_below_target'),
  'insightSlo must warn when story count is below target'
);
pass(
  insightSlo.includes('insight_source_group_count_below_target'),
  'insightSlo must warn when source group count is below target'
);
pass(
  insightSlo.includes('insight_usable_parent_count_below_target'),
  'insightSlo must warn when usable parent count is below target'
);

const plannerSlo = read('src/data/slo/plannerSlo.js');
pass(plannerSlo.includes('planner_plannedItems_not_array'), 'plannerSlo must fail malformed plannedItems');
pass(plannerSlo.includes('planner_blacklist_not_array'), 'plannerSlo must fail malformed blacklist');
pass(plannerSlo.includes('planner_calendarExportableItems_not_array'), 'plannerSlo must fail malformed calendarExportableItems');
pass(plannerSlo.includes('planner_invalidItems_not_array'), 'plannerSlo must fail malformed invalidItems');

const followingSlo = read('src/data/slo/followingSlo.js');
pass(
  followingSlo.includes("reasons.push('following_no_articles_returned')"),
  'followingSlo must fail followed topics with zero articles'
);

const mainSlo = read('src/data/slo/mainSlo.js');
pass(mainSlo.includes('main_insufficient_visible_modules'), 'mainSlo must fail insufficient visible modules');
pass(mainSlo.includes('visibleModuleCount'), 'mainSlo must compute visible module count');
pass(mainSlo.includes('frontPage.length >= 5'), 'mainSlo must require meaningful front-page threshold');
pass(
  mainSlo.includes("reasons.push('main_adapter_only_flag_missing')"),
  'mainSlo must fail when adapterOnly flag is missing'
);

// Note: Tab view models and SLO integrations were added in later releases (5C-5G, expected)

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release5B'] === 'node scripts/test_hardening_release5B_static.mjs',
  'package.json missing test:hardening:release5B script'
);

pass(
  typeof pkg.scripts?.['test:slo-release5'] === 'string',
  'package.json missing test:slo-release5 script'
);

[
  'index.cert.test.js',
  'sectionsSlo.cert.test.js',
  'buzzSlo.cert.test.js',
  'upAheadSlo.cert.test.js',
  'newspaperSlo.cert.test.js',
  'plannerSlo.cert.test.js',
  'followingSlo.cert.test.js',
  'insightSlo.cert.test.js',
  'mainSlo.cert.test.js',
].forEach(testFile => {
  pass(
    pkg.scripts['test:slo-release5'].includes(testFile),
    `package.json test:slo-release5 missing ${testFile}`
  );
});

pass(!pkg.dependencies?.['date-fns'], 'Release 5B must not add date-fns');
pass(!pkg.dependencies?.lodash, 'Release 5B must not add lodash');
pass(!pkg.dependencies?.zod, 'Release 5B must not add zod');

const workflowDir = '.github/workflows';

if (exists(workflowDir)) {
  const workflowFiles = fs.readdirSync(workflowDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

  for (const file of workflowFiles) {
    const content = read(`${workflowDir}/${file}`);
    pass(!content.includes('release5B'), `Release 5B must not modify workflows: ${file}`);
  }
}

console.log('PASS: Release 5B final corrected SLO-only gates');
