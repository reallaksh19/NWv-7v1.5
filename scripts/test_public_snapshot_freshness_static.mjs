import fs from 'fs';
import path from 'path';

const DATA_DIR = 'public/data';
const CLOCK_SKEW_MS = Number(process.env.SNAPSHOT_CLOCK_SKEW_MINUTES || 15) * 60 * 1000;

const DOMAIN_MAX_AGE_HOURS = {
  'weather_snapshot.json': Number(process.env.WEATHER_SNAPSHOT_MAX_AGE_HOURS || 48),
  'market_snapshot.json': Number(process.env.MARKET_SNAPSHOT_MAX_AGE_HOURS || 96),
  'mutual_fund_snapshot.json': Number(process.env.MUTUAL_FUND_SNAPSHOT_MAX_AGE_HOURS || 168),
  'fx_snapshot.json': Number(process.env.FX_SNAPSHOT_MAX_AGE_HOURS || 96),
};

const WEATHER_CITY_KEYS = ['chennai', 'trichy', 'muscat', 'colombo'];
const DEFAULT_MAX_AGE_HOURS = Number(process.env.SNAPSHOT_DEFAULT_MAX_AGE_HOURS || 168);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function payloadTimestamp(payload) {
  return parseTimestamp(
    payload?.fetchedAt ||
    payload?.generatedAt ||
    payload?.generated_at ||
    payload?.timestamp ||
    payload?.updatedAt
  );
}

function snapshotFiles() {
  assert(fs.existsSync(DATA_DIR), `Missing data directory: ${DATA_DIR}`);

  const allowList = process.env.SNAPSHOT_FRESHNESS_FILES
    ? new Set(process.env.SNAPSHOT_FRESHNESS_FILES.split(',').map(f => f.trim()).filter(Boolean))
    : null;

  return fs
    .readdirSync(DATA_DIR)
    .filter(fileName =>
      fileName.includes('snapshot') &&
      fileName.endsWith('.json') &&
      (!allowList || allowList.has(fileName))
    )
    .sort();
}

function assertFresh({ label, timestamp, maxAgeHours, now }) {
  assert(timestamp, `${label} missing freshness timestamp`);

  const ageMs = now - timestamp;
  assert(
    ageMs >= -CLOCK_SKEW_MS,
    `${label} timestamp is in the future: ${new Date(timestamp).toISOString()}`
  );

  const ageHours = ageMs / 36e5;
  assert(
    ageHours <= maxAgeHours,
    `${label} too stale: ${ageHours.toFixed(1)}h old; max allowed ${maxAgeHours}h`
  );

  return Number(Math.max(0, ageHours).toFixed(2));
}

function assertWeatherCitiesFresh(snapshot, fileName, maxAgeHours, now) {
  return WEATHER_CITY_KEYS.map(cityKey => {
    const cityPayload = snapshot?.[cityKey];
    assert(cityPayload && typeof cityPayload === 'object', `${fileName}.${cityKey} missing`);

    const timestamp = payloadTimestamp(cityPayload);
    return {
      label: `${fileName}.${cityKey}`,
      ageHours: assertFresh({
        label: `${fileName}.${cityKey}`,
        timestamp,
        maxAgeHours,
        now,
      }),
    };
  });
}

const now = Date.now();
const checked = [];

for (const fileName of snapshotFiles()) {
  const fullPath = path.join(DATA_DIR, fileName);
  const snapshot = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const maxAgeHours = DOMAIN_MAX_AGE_HOURS[fileName] || DEFAULT_MAX_AGE_HOURS;
  const timestamp = payloadTimestamp(snapshot);

  const result = {
    fileName,
    maxAgeHours,
    ageHours: timestamp ? assertFresh({ label: fileName, timestamp, maxAgeHours, now }) : null,
  };

  if (fileName === 'weather_snapshot.json') {
    result.cities = assertWeatherCitiesFresh(snapshot, fileName, maxAgeHours, now);
    if (!timestamp) {
      result.ageHours = Math.max(...result.cities.map(city => city.ageHours));
    }
  } else {
    assert(timestamp, `${fileName} missing top-level freshness timestamp`);
  }

  checked.push(result);
}

assert(checked.length > 0, 'No public/data/*snapshot*.json files found');

console.log(JSON.stringify({
  status: 'PASS',
  checked,
}, null, 2));

console.log('PASS: public snapshot freshness');
