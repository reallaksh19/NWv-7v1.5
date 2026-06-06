import fs from 'node:fs';
import { execSync } from 'node:child_process';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const read = path => fs.readFileSync(path, 'utf8');

function exists(path) {
  return fs.existsSync(path);
}

function hasImportFrom(content, sourcePath) {
  const escaped = sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`from\\s+['"]${escaped}['"]`).test(content);
}

function hasHookCall(content, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(content);
}

function getChangedFiles() {
  try {
    return execSync('git diff --name-only', { encoding: 'utf8' })
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const requiredFiles = [
  'src/viewModels/useNewspaperPageViewModel.js',
  'src/pages/NewspaperPage.jsx',
  'src/pages/NewspaperPage.release6Q.cert.test.jsx',
  'scripts/test_hardening_release6Q_static.mjs',
];

requiredFiles.forEach(path => {
  pass(exists(path), `Required Release 6Q file missing: ${path}`);
});

const page = read('src/pages/NewspaperPage.jsx');
const vm = read('src/viewModels/useNewspaperPageViewModel.js');
const pkg = JSON.parse(read('package.json'));

pass(!hasImportFrom(page, '../context/SettingsContext'), 'NewspaperPage must not import SettingsContext');
pass(!hasImportFrom(page, '../services/geminiService'), 'NewspaperPage must not import geminiService');
pass(!hasImportFrom(page, '../utils/articleExtractor'), 'NewspaperPage must not import articleExtractor');
pass(!hasImportFrom(page, '../utils/extractiveSummary'), 'NewspaperPage must not import extractiveSummary');
pass(!hasImportFrom(page, '../services/virtualPaperService'), 'NewspaperPage must not import virtualPaperService');
pass(!hasImportFrom(page, '../services/proxyManager'), 'NewspaperPage must not import proxyManager');

pass(!hasHookCall(page, 'useSettings'), 'NewspaperPage must not call useSettings()');
pass(!page.includes('fetch(`${DATA_URL}?t=${Date.now()}`)'), 'NewspaperPage must not fetch static newspaper JSON directly');
pass(!page.includes('geminiService.'), 'NewspaperPage must not call geminiService directly');
pass(!page.includes('extractArticleText('), 'NewspaperPage must not extract article text directly');
pass(!page.includes('summarizeText('), 'NewspaperPage must not summarize text directly');
pass(!page.includes('virtualPaperService.'), 'NewspaperPage must not call virtualPaperService directly');
pass(page.includes('useNewspaperPageViewModel'), 'NewspaperPage must use Newspaper ViewModel');

[
  "from '../context/SettingsContext'",
  "from '../services/geminiService'",
  "from '../utils/articleExtractor'",
  "from '../utils/extractiveSummary'",
  "from '../services/virtualPaperService'",
  'useSettings',
  'fetchStaticNewspaperData',
  'fetchFallbackVirtualPaper',
  'fetchFallbackPaper',
  'fetchFallbackRSS: fetchFallbackPaper',
  'geminiService.generateSummary',
  'geminiService.translateTexts',
  'extractArticleText',
  'summarizeText',
  'virtualPaperService.getVirtualPaper',
  'getSectionSummaryResult',
  'handleGenerateAll',
  'generateClientSummary',
  'clearTimeout',
].forEach(token => {
  pass(vm.includes(token), `Newspaper ViewModel missing token: ${token}`);
});

pass(!vm.includes('proxyManager'), 'Newspaper ViewModel must not include unused proxyManager');
pass(vm.includes('finally'), 'Newspaper ViewModel must guard long-running generation/loading state with finally');

pass(page.includes('<NewspaperCard'), 'NewspaperPage must preserve NewspaperCard rendering');
pass(page.includes('digestMode'), 'NewspaperPage must preserve digest mode rendering');
pass(page.includes('FaLanguage'), 'NewspaperPage must preserve translation control');
pass(page.includes('FaBolt'), 'NewspaperPage must preserve generate-all control');
pass(page.includes('Add Key to Enable'), 'NewspaperPage must preserve Settings CTA for missing Gemini key');
pass(page.includes('Array.isArray(section.articles)'), 'NewspaperPage must guard malformed section.articles arrays');

const allowedChangedFiles = new Set([
  'src/viewModels/useNewspaperPageViewModel.js',
  'src/pages/NewspaperPage.jsx',
  'src/pages/NewspaperPage.release6Q.cert.test.jsx',
  'scripts/test_hardening_release6Q_static.mjs',
  'package.json',
]);

for (const file of getChangedFiles()) {
  pass(
    allowedChangedFiles.has(file),
    `Release 6Q unexpected changed file: ${file}`
  );
}

['date-fns', 'lodash', 'zod'].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6Q must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6Q must not add devDependency ${dep}`);
});

pass(
  pkg.scripts?.['test:hardening:release6Q'],
  'package.json missing test:hardening:release6Q script'
);

pass(
  pkg.scripts?.['test:newspaper-binding'],
  'package.json missing test:newspaper-binding script'
);

console.log('PASS: Release 6Q NewspaperPage ViewModel binding static gates');
