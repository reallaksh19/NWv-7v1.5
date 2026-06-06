import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  DEFAULT_WEATHER_CITIES,
} from '../services/weatherLocations.js';
import {
  __weatherTabViewModelInternalsForTest,
} from './useWeatherTabViewModel.js';

const {
  resolveActiveWeatherCity,
} = __weatherTabViewModelInternalsForTest;

describe('S-1 weather active city derived state', () => {
  const source = fs.readFileSync('src/viewModels/useWeatherTabViewModel.js', 'utf8');

  it('does not repair an invalid active city by setting state from an effect', () => {
    expect(source).not.toMatch(/useEffect\(\(\) => \{\s*if \(cities\.length > 0 && !cities\.includes\(activeCity\)\) \{\s*setActiveCityState/s);
  });

  it('derives the displayed active city from the requested city and configured cities', () => {
    expect(resolveActiveWeatherCity('muscat', ['chennai', 'trichy'])).toBe('chennai');
    expect(resolveActiveWeatherCity('columbo', ['colombo', 'chennai'])).toBe('colombo');
    expect(resolveActiveWeatherCity(null, [])).toBe(DEFAULT_WEATHER_CITIES[0]);
  });
});
