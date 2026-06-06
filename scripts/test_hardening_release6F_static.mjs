/**
 * Release 6F static gate (prerequisite stub for 6G).
 * Releases 6B–6F established earlier ViewModel binding markers
 * that Release 6G preserves.
 */
import fs from 'node:fs';

const pass = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
};

const exists = path => fs.existsSync(path);

// Core files that must exist before 6G can run
[
  'src/viewModels/useMainTabViewModel.js',
  'src/pages/MainPage.jsx',
  'src/components/Header.jsx',
  'src/components/TimelineHeader.jsx',
  'src/components/ThemeToggle.jsx',
].forEach(path => {
  pass(exists(path), `Release 6F prerequisite missing: ${path}`);
});

console.log('PASS: Release 6F prerequisite gate');
