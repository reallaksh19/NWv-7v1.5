import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const COMPONENTS_WITH_INTERNALS = [
  ['src/components/DataStateBoundary.jsx', 'src/components/DataStateBoundary.internals.js'],
  ['src/components/data-state/DataFreshnessBadge.jsx', 'src/components/data-state/DataFreshnessBadge.internals.js'],
  ['src/components/data-state/DataSloBadge.jsx', 'src/components/data-state/DataSloBadge.internals.js'],
  ['src/components/data-state/DataSourceBadge.jsx', 'src/components/data-state/DataSourceBadge.internals.js'],
  ['src/components/data-state/DataStateBanner.jsx', 'src/components/data-state/DataStateBanner.internals.js'],
  ['src/components/data-state/DataStateMeta.jsx', 'src/components/data-state/DataStateMeta.internals.js'],
  ['src/components/settings/TravelLocationSettingsPanel.jsx', 'src/components/settings/TravelLocationSettingsPanel.internals.js'],
  ['src/components/weather/WeatherLocationManager.jsx', 'src/components/weather/WeatherLocationManager.internals.js'],
];

describe('React Refresh component export boundaries', () => {
  it('keeps test internals out of component modules', () => {
    COMPONENTS_WITH_INTERNALS.forEach(([componentPath, internalsPath]) => {
      const componentSource = readFileSync(componentPath, 'utf8');

      expect(componentSource).not.toContain('InternalsForTest');
      expect(existsSync(internalsPath)).toBe(true);
    });
  });
});
