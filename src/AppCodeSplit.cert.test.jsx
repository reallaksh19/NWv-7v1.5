import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('src/App.jsx', 'utf8');

describe('App route code splitting', () => {
  it('loads route pages through React.lazy inside Suspense', () => {
    expect(source).toContain('React.lazy');
    expect(source).toContain('<Suspense');
    expect(source).toContain("import('./pages/MainPage')");
    expect(source).toContain("import('./pages/InsightPage')");
    expect(source).toContain("import('./pages/DataHealthPage')");
  });

  it('does not statically import page modules into the app shell', () => {
    expect(source).not.toMatch(/import\s+\w+Page\s+from\s+['"]\.\/pages\//);
    expect(source).not.toContain("import TopicDetail from './pages/TopicDetail'");
  });
});
