import { DEFAULT_SETTINGS } from '../utils/storage.js';
import plannerStorage from '../utils/plannerStorage.js';
import { fetchIntelligentUpAheadData } from './intelligentUpAheadFetcher.js';
import { toDateKey } from '../utils/dateDisplay.js';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities.js';

export const CACHE_KEY = 'upAhead_cache';

const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6h — aligned to 5×/day pre-fetch cadence
const STATIC_UPAHEAD_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function normalizeDateKey(value) {
  const key = toDateKey(value, null);
  return key || null;
}

function getItemKey(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  return String(item.hiddenKey || item.canonicalId || item.id || item.link || item.title || '').trim();
}

function uniqByKey(items = []) {
  const seen = new Set();
  const output = [];
  for (const item of items || []) {
    const key = getItemKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function hasItems(items = []) {
  return Array.isArray(items) && items.some(Boolean);
}

function getStartOfTodayMs() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function toTimeMs(value) {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDisplayDateMs(item) {
  return toTimeMs(
    item?.eventDate ||
    item?.eventDateKey ||
    item?.date ||
    item?.releaseDate ||
    item?.planDate ||
    item?.eventStartAt ||
    item?.expiryAt
  );
}

function isPastDatedDisplayItem(item, todayMs = getStartOfTodayMs()) {
  const eventMs = getDisplayDateMs(item);
  return eventMs > 0 && eventMs < todayMs;
}

function filterPastDatedDisplayItems(items = [], todayMs = getStartOfTodayMs()) {
  return uniqByKey(items || []).filter(item => !isPastDatedDisplayItem(item, todayMs));
}

function isStaticUpAheadFresh(data, maxAgeMs = STATIC_UPAHEAD_MAX_AGE_MS) {
  const fetchedAt = toTimeMs(data?.fetchedAt || data?.lastUpdated);
  if (!fetchedAt) return true;
  return Date.now() - fetchedAt <= maxAgeMs;
}

function getItemType(category) {
  const value = String(category || '').toLowerCase();
  const map = {
    movies: 'movie',
    movie: 'movie',
    events: 'event',
    event: 'event',
    festivals: 'festival',
    festival: 'festival',
    alerts: 'alert',
    alert: 'alert',
    sports: 'sport',
    shopping: 'shopping',
    offer: 'shopping',
    civic: 'civic',
    weather_alerts: 'weather_alert',
    weather_alert: 'weather_alert',
    airlines: 'airline',
    airline_offer: 'airline'
  };
  return map[value] || 'event';
}

function categorySectionKey(category) {
  const value = String(category || '').toLowerCase();
  const map = {
    movie: 'movies',
    movies: 'movies',
    event: 'events',
    events: 'events',
    festival: 'festivals',
    festivals: 'festivals',
    alert: 'alerts',
    alerts: 'alerts',
    civic: 'civic',
    sports: 'sports',
    shopping: 'shopping',
    weather_alert: 'weather_alerts',
    weather_alerts: 'weather_alerts',
    offer: 'shopping',
    airline_offer: 'airlines',
    airlines: 'airlines'
  };
  return map[value] || value || 'events';
}

function getDayLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatPlanLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return `${getOrdinal(d.getDate())} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
}

function generateWeeklyPlan(timeline = []) {
  const plan = [];
  const blacklist = plannerStorage.getBlacklist ? plannerStorage.getBlacklist() : new Set();
  const persistedPlan = plannerStorage.getPlan ? plannerStorage.getPlan() : {};
  const timelineByDate = new Map((timeline || []).map(day => [day.date, day.items || []]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateKey = d.toISOString().slice(0, 10);
    const timelineItems = (timelineByDate.get(dateKey) || [])
      .filter(item => !blacklist.has(getItemKey(item)))
      .filter(item => item.plannerEligible !== false)
      .map(item => ({
        id: item.id || getItemKey(item),
        hiddenKey: getItemKey(item),
        title: item.title,
        type: item.type || getItemType(item.category),
        icon: item.icon || '📅',
        link: item.link,
        description: item.description,
        isOffer: item.type === 'shopping' || item.type === 'airline'
      }));

    const savedItems = (persistedPlan[dateKey] || [])
      .filter(item => !blacklist.has(getItemKey(item)))
      .map(item => ({
        id: item.id || getItemKey(item),
        hiddenKey: getItemKey(item),
        title: item.title,
        type: item.type || item.category || 'event',
        icon: item.icon || '📅',
        link: item.link,
        description: item.description,
        isOffer: Boolean(item.isOffer) || ['shopping', 'airline', 'airlines'].includes(String(item.type || item.category || '').toLowerCase())
      }));

    const merged = uniqByKey([...savedItems, ...timelineItems]).slice(0, 10);

    plan.push({
      day: d.toLocaleDateString('en-US', { weekday: 'long' }),
      date: formatPlanLabel(dateKey),
      items: merged
    });
  }

  return plan;
}

function buildLegacyDisplayFromRanked(items = [], meta = {}) {
  const sections = {
    movies: [],
    festivals: [],
    alerts: [],
    events: [],
    sports: [],
    shopping: [],
    civic: [],
    weather_alerts: [],
    airlines: []
  };

  const timelineMap = new Map();

  for (const item of items || []) {
    if (!item) continue;
    const sectionKey = categorySectionKey(item.category);
    const eventDateKey = item.eventDateKey || normalizeDateKey(item.eventDate) || null;
    const displayItem = {
      id: item.canonicalId || item.rawSourceId || item.link || item.title,
      hiddenKey: item.canonicalId || item.rawSourceId || item.link || item.title,
      canonicalId: item.canonicalId || item.rawSourceId || item.link || item.title,
      title: item.title,
      link: item.link,
      description: item.description || item.summary || '',
      date: eventDateKey,
      releaseDate: eventDateKey,
      planDate: eventDateKey,
      category: sectionKey,
      source: item.sourceDomain || item.source || sectionKey,
      city: item.city || null,
      region: item.region || null,
      locationCanonical: item.locationCanonical || item.city || item.region || null,
      dateConfidence: item.dateConfidence || 'none',
      decisionTrace: item.decisionTrace || [],
      plannerEligible: Boolean(item.plannerEligible && eventDateKey),
      displayEligible: item.displayEligible !== false,
      publishedAt: item.publishedAt || item.publishDate || null
    };

    if (displayItem.displayEligible && sections[sectionKey]) {
      sections[sectionKey].push(displayItem);
    }

    if (item.upAheadEligible && eventDateKey) {
      if (!timelineMap.has(eventDateKey)) {
        timelineMap.set(eventDateKey, {
          date: eventDateKey,
          dayLabel: getDayLabel(eventDateKey),
          items: []
        });
      }
      timelineMap.get(eventDateKey).items.push({
        id: displayItem.id,
        hiddenKey: displayItem.hiddenKey,
        sourceId: item.rawSourceId || displayItem.id,
        type: getItemType(item.category),
        title: item.title,
        description: displayItem.description,
        tags: [sectionKey],
        link: item.link,
        category: sectionKey,
        icon: null,
        locationCanonical: item.locationCanonical || null,
        dateConfidence: item.dateConfidence || 'none',
        plannerEligible: displayItem.plannerEligible
      });
    }
  }

  const timeline = Array.from(timelineMap.values())
    .map(day => ({
      ...day,
      items: uniqByKey(day.items)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Cap each section, but reserve slots for location-tagged items. Without this,
  // a section full of fresh city-agnostic items (e.g. national "Prime Day" offers)
  // fills all 20 slots and evicts every local Chennai/Muscat offer before the view
  // model can split them into the Online vs Offline tabs — leaving Offline empty.
  const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || ''));
  const isLocated = (item) => Boolean(item?.city || item?.locationCanonical || item?.region);
  Object.keys(sections).forEach((key) => {
    const deduped = uniqByKey(sections[key]);
    const located = deduped.filter(isLocated).sort(byDate).slice(0, 20);
    const global = deduped.filter(item => !isLocated(item)).sort(byDate).slice(0, 20);
    sections[key] = [...global, ...located];
  });

  const weekly_plan = generateWeeklyPlan(timeline);

  return {
    timeline,
    sections,
    weekly_plan,
    lastUpdated: new Date().toISOString(),
    auditSummary: meta.auditSummary || null,
    dropReport: meta.dropReport || []
  };
}

export function isActualWeatherAlertText(text, upAheadSettings = null) {
  const rules = upAheadSettings?.weatherAlertRules || DEFAULT_SETTINGS.upAhead.weatherAlertRules;
  const lower = String(text || '').toLowerCase();
  const weatherWords = [
    ...(rules.contextKeywords || []),
    ...(rules.ambiguousKeywords || []),
    ...((upAheadSettings?.keywords?.weather_alerts) || DEFAULT_SETTINGS.upAhead.keywords.weather_alerts || [])
  ];
  let matches = 0;
  for (const word of weatherWords) {
    if (lower.includes(String(word).toLowerCase())) matches += 1;
  }
  return matches >= (rules.minimumMatches || 2);
}

export function isActualOfferText(text, upAheadSettings = null) {
  const rules = upAheadSettings?.offerRules || DEFAULT_SETTINGS.upAhead.offerRules;
  const lower = String(text || '').toLowerCase();
  let matches = 0;
  for (const word of rules.offerKeywords || []) {
    if (lower.includes(String(word).toLowerCase())) matches += 1;
  }
  return matches >= (rules.minimumMatches || 1);
}

function transformPythonItemsToDisplay(items = []) {
  const ranked = items
    .filter(Boolean)
    .map(it => {
      const category = categorySectionKey(it.category);
      // Only assign a display event-date from a REAL event timestamp. Offers
      // (shopping/airlines) and civic notices are dateless "current awareness"
      // items — assigning them expiryAt (48h after an often-stale publish date)
      // pushed them past `filterPastDatedDisplayItems`, deleting them before they
      // ever reached their section. They now flow through and are recency-ranked
      // by the view model instead.
      const eventTs = it.eventStartAt || it.eventEndAt || null;
      const eventDate = eventTs ? new Date(eventTs) : null;
      const hasEventDate = eventDate && !Number.isNaN(eventDate.getTime());
      const eventDateIso = hasEventDate ? eventDate.toISOString() : null;
      const eventDateKey = hasEventDate ? eventDateIso.slice(0, 10) : null;
      return {
        canonicalId:       it.id || it.url || it.title,
        rawSourceId:       it.id || it.url || it.title,
        title:             it.title,
        summary:           it.summary,
        description:       it.summary,
        link:              it.url,
        category,
        publishDate:       it.publishedAt ? new Date(it.publishedAt).toISOString() : null,
        publishedAt:       it.publishedAt || null,
        eventDate:         eventDateIso,
        eventDateKey,
        dateConfidence:    it.dateConfidence || (eventDateKey ? 'exact' : 'none'),
        city:              it.city || null,
        region:            it.region || null,
        locationCanonical: it.city || it.region || null,
        sourceDomain:      it.source,
        source:            it.source,
        displayEligible:   it.displayEligible !== false,
        upAheadEligible:   Boolean(eventDateKey),
        plannerEligible:   Boolean(it.plannerEligible && eventDateKey),
        decisionTrace:     it.decisionTrace || [],
      };
    });
  return buildLegacyDisplayFromRanked(ranked, { auditSummary: null, dropReport: [] });
}

export function sanitizeUpAheadData(data) {
  if (!data || typeof data !== 'object') return null;

  // Python prefetch schema: {schemaVersion, fetchedAt, contentHash, items:[]}
  if (Array.isArray(data.items) && !data.timeline && !data.sections) {
    return sanitizeUpAheadData(transformPythonItemsToDisplay(data.items));
  }

  const timeline = Array.isArray(data.timeline)
    ? data.timeline
        .filter(Boolean)
        .map(day => ({ ...day, items: filterPastDatedDisplayItems(day.items || []) }))
        .filter(day => (day.items || []).length > 0)
    : [];
  const sections = data.sections && typeof data.sections === 'object'
    ? Object.fromEntries(Object.entries(data.sections).map(([key, items]) => [key, uniqByKey(items || [])]))
    : {};
  Object.keys(sections).forEach((key) => {
    sections[key] = filterPastDatedDisplayItems(sections[key] || []);
  });
  const weekly_plan = Array.isArray(data.weekly_plan) ? data.weekly_plan : generateWeeklyPlan(timeline);
  const filteredWeeklyPlan = weekly_plan.map(day => ({
    ...day,
    items: filterPastDatedDisplayItems(day.items || []),
  }));
  const hasSectionItems = Object.values(sections).some(items => hasItems(items));
  const hasWeeklyItems = filteredWeeklyPlan.some(day => hasItems(day.items));
  if (timeline.length === 0 && !hasSectionItems && !hasWeeklyItems) {
    return null;
  }
  return { ...data, timeline, sections, weekly_plan: filteredWeeklyPlan };
}

export function loadFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = sanitizeUpAheadData(JSON.parse(cached));
    if (!parsed) return null;
    const age = Date.now() - new Date(parsed.lastUpdated || 0).getTime();
    if (age > CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveToCache(data) {
  try {
    const sanitized = sanitizeUpAheadData(data);
    if (!sanitized) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore cache failures
  }
}

export function clearUpAheadCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore cache failures
  }
}

export async function fetchStaticUpAheadData(upAheadSettings = {}) {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const response = await fetch(`${cleanBase}data/up_ahead.json`, { cache: 'no-cache' });
    if (!response.ok) return null;
    const parsed = await response.json();
    // When snapshot mode is forced (static host or ?preferSnapshots=true), serve the
    // static snapshot even if stale — there is no live backend to fall back to, and
    // showing stale civic/event data beats showing only festival placeholders.
    const { preferSnapshots } = getRuntimeCapabilities();
    if (!isStaticUpAheadFresh(parsed) && !preferSnapshots) {
      console.warn('[UpAheadService] Ignoring stale static Up Ahead snapshot', {
        fetchedAt: parsed?.fetchedAt || parsed?.lastUpdated,
      });
      return sanitizeUpAheadData(buildFestivalFallbackData(
        upAheadSettings?.locations || DEFAULT_SETTINGS.upAhead.locations || ['Chennai', 'Muscat'],
        new Date()
      ));
    }
    return sanitizeUpAheadData(parsed);
  } catch {
    return null;
  }
}

function makeFestivalItem({ id, title, date, location, description }) {
  return {
    id: `festival-${id}-${date}-${location}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    hiddenKey: `festival-${id}-${date}-${location}`,
    canonicalId: `festival-${id}-${date}-${location}`,
    title,
    link: '',
    description,
    date,
    releaseDate: date,
    planDate: date,
    category: 'festivals',
    type: 'festival',
    source: 'Festival calendar',
    locationCanonical: location,
    dateConfidence: 'calendar',
    plannerEligible: true,
    displayEligible: true,
  };
}

function getFestivalFallbackItems(locations = [], asOfDate = new Date()) {
  const selected = new Set((locations || []).map(location => String(location || '').toLowerCase()));
  const includeIndia = selected.size === 0 || selected.has('chennai') || selected.has('trichy') || selected.has('india');
  const includeOman = selected.size === 0 || selected.has('muscat') || selected.has('oman');
  const todayKey = normalizeDateKey(asOfDate);

  const indiaFestivals = [
    { id: 'muharram', title: 'Muharram', date: '2026-06-17', location: 'Chennai', description: 'Major public holiday observed in India.' },
    { id: 'independence-day', title: 'Independence Day', date: '2026-08-15', location: 'Chennai', description: 'National holiday in India.' },
    { id: 'onam', title: 'Onam', date: '2026-08-26', location: 'Chennai', description: 'Regional festival widely followed across South India.' },
    { id: 'ganesh-chaturthi', title: 'Ganesh Chaturthi', date: '2026-09-14', location: 'Chennai', description: 'Festival observance and local events expected.' },
    { id: 'gandhi-jayanti', title: 'Gandhi Jayanti', date: '2026-10-02', location: 'Chennai', description: 'National holiday in India.' },
    { id: 'diwali', title: 'Diwali', date: '2026-11-08', location: 'Chennai', description: 'Major festival and public-holiday period.' },
    { id: 'christmas', title: 'Christmas', date: '2026-12-25', location: 'Chennai', description: 'Public holiday and festival observance.' },
  ];

  const omanFestivals = [
    { id: 'islamic-new-year', title: 'Islamic New Year', date: '2026-06-17', location: 'Muscat', description: 'Expected holiday period; official dates may vary by moon sighting.' },
    { id: 'prophets-birthday', title: "Prophet's Birthday", date: '2026-08-25', location: 'Muscat', description: 'Expected holiday period; official dates may vary by moon sighting.' },
    { id: 'oman-national-day', title: 'Oman National Day', date: '2026-11-18', location: 'Muscat', description: 'National holiday in Oman.' },
  ];

  return [
    ...(includeIndia ? indiaFestivals : []),
    ...(includeOman ? omanFestivals : []),
  ]
    .filter(item => !todayKey || item.date >= todayKey)
    .map(makeFestivalItem)
    .slice(0, 12);
}

function buildFestivalFallbackData(locations, asOfDate = new Date()) {
  const festivals = getFestivalFallbackItems(locations, asOfDate);
  const timeline = festivals.map(item => ({
    date: item.date,
    dayLabel: getDayLabel(item.date),
    items: [{
      id: item.id,
      hiddenKey: item.hiddenKey,
      sourceId: item.id,
      type: 'festival',
      title: item.title,
      description: item.description,
      tags: ['festivals'],
      link: item.link,
      category: 'festivals',
      icon: null,
      locationCanonical: item.locationCanonical,
      dateConfidence: item.dateConfidence,
      plannerEligible: true,
    }],
  }));

  return {
    timeline,
    sections: {
      festivals,
    },
    weekly_plan: generateWeeklyPlan(timeline),
    lastUpdated: new Date().toISOString(),
    auditSummary: { fallback: 'festival_calendar' },
    dropReport: [],
  };
}

export function mergeUpAheadData(baseData, newData) {
  const base = sanitizeUpAheadData(baseData) || { timeline: [], sections: {}, weekly_plan: [] };
  const incoming = sanitizeUpAheadData(newData);
  if (!incoming) return sanitizeUpAheadData(base);
  const timelineMap = new Map();

  for (const day of [...(base.timeline || []), ...(incoming.timeline || [])]) {
    if (!timelineMap.has(day.date)) {
      timelineMap.set(day.date, { ...day, items: uniqByKey(day.items || []) });
    } else {
      const existing = timelineMap.get(day.date);
      existing.items = uniqByKey([...(existing.items || []), ...(day.items || [])]);
    }
  }

  const sections = { ...(base.sections || {}) };
  for (const [key, items] of Object.entries(incoming.sections || {})) {
    sections[key] = uniqByKey([...(sections[key] || []), ...(items || [])]);
  }

  const timeline = Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const merged = {
    timeline,
    sections,
    weekly_plan: generateWeeklyPlan(timeline),
    lastUpdated: incoming.lastUpdated || base.lastUpdated || new Date().toISOString(),
    auditSummary: incoming.auditSummary || base.auditSummary || null,
    dropReport: incoming.dropReport || base.dropReport || []
  };

  return sanitizeUpAheadData(merged);
}

export async function fetchLiveUpAheadData(upAheadSettings = {}) {
  const categories = Object.entries(upAheadSettings.categories || DEFAULT_SETTINGS.upAhead.categories)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key);
  const locations = Array.isArray(upAheadSettings.locations) && upAheadSettings.locations.length > 0
    ? upAheadSettings.locations
    : (DEFAULT_SETTINGS.upAhead.locations || ['Chennai', 'Muscat']);

  try {
    const result = await fetchIntelligentUpAheadData({
      categories,
      locations,
      plannerWindowDays: 7,
      asOfDate: new Date(),
      mode: 'offline',
      settings: { upAhead: upAheadSettings }
    });

    // NOTE: We deliberately do NOT auto-persist ranked items into the planner.
    // The planner is for MANUAL additions only (user taps "+ Plan"); automatic
    // suggestions belong in the "Suggested" feed. Auto-persisting here was the
    // cause of the planner silently filling with weather/power-cut alerts.
    const display = buildLegacyDisplayFromRanked(result.rankedItems || [], {
      auditSummary: result.auditSummary,
      dropReport: result.dropReport
    });

    if (!hasItems(display.sections?.festivals)) {
      return mergeUpAheadData(
        display,
        buildFestivalFallbackData(locations, new Date())
      );
    }

    return display;
  } catch (error) {
    console.error('[UpAheadService] Intelligent fetch failed', error);
    return {
      timeline: [],
      sections: {
        movies: [],
        festivals: [],
        alerts: [],
        events: [],
        sports: [],
        shopping: [],
        civic: [],
        weather_alerts: [],
        airlines: []
      },
      weekly_plan: generateWeeklyPlan([]),
      lastUpdated: new Date().toISOString(),
      auditSummary: { total: 0, dropped: 0, error: error?.message || 'unknown' },
      dropReport: []
    };
  }
}

export const __upAheadServiceInternalsForTest = {
  isStaticUpAheadFresh,
  filterPastDatedDisplayItems,
  getFestivalFallbackItems,
};
