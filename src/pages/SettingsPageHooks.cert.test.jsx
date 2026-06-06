import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = fs.readFileSync('src/pages/SettingsPage.jsx', 'utf8');

function functionBlock(name) {
  const pattern = new RegExp(`const\\s+${name}\\s*=\\s*\\(\\)\\s*=>\\s*\\{[\\s\\S]*?\\n\\s*\\};`);
  return src.match(pattern)?.[0] || '';
}

describe('SettingsPage ranking hooks', () => {
  it('keeps stateful ranking subsections as real components, not nested render functions', () => {
    expect(src).toContain('function MainRankingContent');
    expect(src).toContain('function BuzzRankingContent');
    expect(functionBlock('renderMainContent')).not.toContain('useState(');
    expect(functionBlock('renderBuzzContent')).not.toContain('useState(');
  });
});
