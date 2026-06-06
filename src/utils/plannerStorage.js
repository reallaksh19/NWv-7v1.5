import { deduplicatePlanningItems, isLikelyDuplicateStory } from './similarity.js';
import { getRuntimeCapabilities } from "../runtime/runtimeCapabilities.js";
import { toLocalDateKey } from './dateKey.js';
import {
    makeStorageWriteFailure,
    safeGetJson,
    safeSetJson,
} from '../data/safeStorage.js';

const PLANNER_KEY = 'upAhead_planner';
const BLACKLIST_KEY = 'upAhead_blacklist';
const API_BASE = '/api';
const STATIC_PLAN_URL = `${import.meta.env.BASE_URL || './'}data/user_plan.json`;
const STATIC_BLACKLIST_URL = `${import.meta.env.BASE_URL || './'}data/blacklist.json`;

function isStaticHostRuntime() { return getRuntimeCapabilities().isStaticHost; }

function hash(value) {
    let h = 0;
    if (!value) return '0';
    for (let i = 0; i < value.length; i++) {
        h = (h << 5) - h + value.charCodeAt(i);
        h |= 0;
    }
    return h.toString();
}

function generateCanonicalId(title, dateStr) {
    const slug = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return hash(`${slug}-${dateStr}`);
}

function normalizeDateKey(value) {
    if (!value) return 'nodate';
    return toLocalDateKey(value) || 'nodate';
}

function resolveOccurrenceDateKey(item, fallbackDate = null) {
    return normalizeDateKey(item?.eventDateKey || item?.eventDate || item?.planDate || fallbackDate || item?.extractedDate || item?.date || item?.releaseDate || item?.publishDate || item?.pubDate);
}

function getItemKey(itemOrId) {
    if (typeof itemOrId === 'string') return itemOrId.trim();
    if (!itemOrId || typeof itemOrId !== 'object') return '';
    if (itemOrId.hiddenKey) return String(itemOrId.hiddenKey).trim();
    if (itemOrId.canonicalId) return String(itemOrId.canonicalId).trim();
    if (itemOrId.title) return generateCanonicalId(itemOrId.title, resolveOccurrenceDateKey(itemOrId));
    return String(itemOrId.id || itemOrId.link || '').trim();
}

function normalizePlanItem(item, fallbackDate = null) {
    if (!item || typeof item !== 'object') return null;
    const eventDateKey = resolveOccurrenceDateKey(item, fallbackDate);
    const hiddenKey = getItemKey({ ...item, eventDateKey });
    if (!hiddenKey) return null;
    return {
        ...item,
        id: item.id || hiddenKey,
        hiddenKey: hiddenKey,
        canonicalId: item.canonicalId || hiddenKey,
        title: item.title,
        category: item.category || 'events',
        type: item.type || 'event',
        eventDateKey: eventDateKey === 'nodate' ? null : eventDateKey,
        eventDate: item.eventDate || (eventDateKey !== 'nodate' ? new Date(eventDateKey).toISOString() : null),
        locationCanonical: item.locationCanonical || item.location || '',
        sourceMode: item.sourceMode || 'live',
        state: item.state || 'saved',
        planDate: item.planDate || (eventDateKey !== 'nodate' ? eventDateKey : fallbackDate || null)
    };
}

function deduplicatePlanItems(items) { return deduplicatePlanningItems(items || []); }
function hasSimilarPlanItem(items, candidate) { return (items || []).some(existing => getItemKey(existing) === getItemKey(candidate) || isLikelyDuplicateStory(existing, candidate)); }
function normalizeBlacklistData(list) { return Array.isArray(list) ? [...new Set(list.map(entry => getItemKey(entry)).filter(Boolean))] : []; }
function normalizePlanData(planData) {
    if (!planData || typeof planData !== 'object') return {};
    return Object.fromEntries(Object.entries(planData).filter(([, items]) => Array.isArray(items)).map(([date, items]) => [date, deduplicatePlanItems(items.map(item => normalizePlanItem(item, date)).filter(Boolean))]).filter(([, items]) => items.length > 0));
}
function readLocalPlan() { return normalizePlanData(safeGetJson(PLANNER_KEY, {})); }
function pruneStaleEntries(planData, maxAgeMs) {
    const cutoff = toLocalDateKey(new Date(Date.now() - maxAgeMs));
    return Object.fromEntries(Object.entries(planData).filter(([date]) => date >= cutoff));
}
function writeLocalPlan(planData) {
    const normalized = normalizePlanData(planData);
    const pruned = pruneStaleEntries(normalized, 30 * 24 * 60 * 60 * 1000); // drop entries >30 days old
    if (!safeSetJson(PLANNER_KEY, pruned)) {
        return makeStorageWriteFailure(PLANNER_KEY);
    }
    return { ok: true, plan: pruned };
}
function readLocalBlacklist() { return normalizeBlacklistData(safeGetJson(BLACKLIST_KEY, [])); }
function writeLocalBlacklist(list) {
    const normalized = normalizeBlacklistData(list);
    if (!safeSetJson(BLACKLIST_KEY, normalized)) {
        return makeStorageWriteFailure(BLACKLIST_KEY);
    }
    return { ok: true, list: normalized };
}
function pruneBlacklistedFromPlan(planData, blacklist) { const normalizedPlan = normalizePlanData(planData); const blacklistSet = blacklist instanceof Set ? blacklist : new Set(normalizeBlacklistData(blacklist)); return Object.fromEntries(Object.entries(normalizedPlan).map(([date, items]) => [date, items.filter(item => !blacklistSet.has(getItemKey(item)))]).filter(([, items]) => items.length > 0)); }
function mergePlans(basePlan, incomingPlan) { const merged = { ...normalizePlanData(basePlan) }; Object.entries(normalizePlanData(incomingPlan)).forEach(([date, items]) => { if (!merged[date]) merged[date] = []; items.forEach(item => { const normalizedItem = normalizePlanItem(item, date); if (normalizedItem && !hasSimilarPlanItem(merged[date], normalizedItem)) merged[date].push(normalizedItem); }); merged[date] = deduplicatePlanItems(merged[date]); }); return merged; }

export function isPlannerStorageSuccess(result) {
    return result === true || result?.ok === true;
}

export function getPlannerStorageError(result, fallback = 'Planner storage operation failed') {
    return typeof result?.error === 'string' ? result.error : fallback;
}

async function fetchRemotePlan() {
    if (!isStaticHostRuntime()) {
        try {
            const apiResponse = await fetch(`${API_BASE}/user_plan`);
            if (apiResponse.ok) return normalizePlanData(await apiResponse.json());
        } catch (e) {
            console.warn('[PlannerStorage] API plan fetch unavailable', e);
        }
    }
    try {
        const staticResponse = await fetch(STATIC_PLAN_URL);
        if (staticResponse.ok) return normalizePlanData(await staticResponse.json());
    } catch (e) {
        console.warn('[PlannerStorage] Static plan fetch unavailable', e);
    }
    return {};
}

async function fetchRemoteBlacklist() {
    if (!isStaticHostRuntime()) {
        try {
            const apiResponse = await fetch(`${API_BASE}/blacklist`);
            if (apiResponse.ok) return normalizeBlacklistData(await apiResponse.json());
        } catch (e) {
            console.warn('[PlannerStorage] API blacklist fetch unavailable', e);
        }
    }
    try {
        const staticResponse = await fetch(STATIC_BLACKLIST_URL);
        if (staticResponse.ok) return normalizeBlacklistData(await staticResponse.json());
    } catch (e) {
        console.warn('[PlannerStorage] Static blacklist fetch unavailable', e);
    }
    return [];
}

const plannerStorage = {
    sync: async () => {
        try {
            const remoteBlacklist = await fetchRemoteBlacklist();
            const localBlacklist = plannerStorage.getBlacklist();
            const mergedBlacklist = new Set([...localBlacklist, ...remoteBlacklist]);
            const blacklistWrite = writeLocalBlacklist([...mergedBlacklist]);
            if (!isPlannerStorageSuccess(blacklistWrite)) return blacklistWrite;
            const remotePlan = await fetchRemotePlan();
            const mergedPlan = pruneBlacklistedFromPlan(mergePlans(remotePlan, readLocalPlan()), mergedBlacklist);
            return writeLocalPlan(mergedPlan);
        } catch (e) {
            console.warn('[PlannerStorage] Sync failed', e);
            return { ok: false, reason: 'sync-failed', error: e?.message || String(e) };
        }
    },
    loadBlacklistFromApi: async () => {
        try {
            const remoteBlacklist = await fetchRemoteBlacklist();
            const mergedBlacklist = new Set([...readLocalBlacklist(), ...remoteBlacklist]);
            const result = writeLocalBlacklist([...mergedBlacklist]);
            if (!isPlannerStorageSuccess(result)) return result;
            return mergedBlacklist;
        } catch (e) {
            console.warn('[PlannerStorage] Blacklist load from API failed', e);
            return new Set(readLocalBlacklist());
        }
    },
    loadPlanFromApi: async () => {
        try {
            const remotePlan = await fetchRemotePlan();
            const mergedPlan = pruneBlacklistedFromPlan(mergePlans(remotePlan, readLocalPlan()), plannerStorage.getBlacklist());
            const result = writeLocalPlan(mergedPlan);
            if (!isPlannerStorageSuccess(result)) return result;
            return mergedPlan;
        } catch (e) {
            console.warn('[PlannerStorage] Plan load from API failed', e);
            return pruneBlacklistedFromPlan(readLocalPlan(), plannerStorage.getBlacklist());
        }
    },
    getPlan: () => readLocalPlan(),
    getUpcomingDays: (days = 14) => {
        try {
            const parsed = readLocalPlan();
            const today = toLocalDateKey(new Date());
            return Object.entries(parsed).filter(([date]) => date >= today).sort((a, b) => a[0].localeCompare(b[0])).slice(0, days).map(([date, items]) => ({ date, items }));
        } catch (e) {
            console.error('Failed to read planner storage', e);
            return [];
        }
    },
    addItem: (date, item) => {
        try {
            const parsed = readLocalPlan();
            const normalizedItem = normalizePlanItem({ ...item, planDate: item?.planDate || date, eventDateKey: item?.eventDateKey || date, eventDate: item?.eventDate || date }, date);
            if (!normalizedItem) return { ok: false, reason: 'invalid-item', error: 'Planner item is invalid' };
            if (!parsed[date]) parsed[date] = [];
            if (!hasSimilarPlanItem(parsed[date], normalizedItem)) {
                parsed[date].push(normalizedItem);
                parsed[date] = deduplicatePlanItems(parsed[date]);
                const result = writeLocalPlan(parsed);
                if (!isPlannerStorageSuccess(result)) return result;
                plannerStorage.savePlanToApi(parsed);
                return { ok: true, item: normalizedItem };
            } else if (import.meta.env.DEV) {
                console.debug('[Planner] dedupe_skip', {
                    date,
                    title: normalizedItem.title,
                    eventDateKey: normalizedItem.eventDateKey
                });
            }
            return { ok: false, reason: 'duplicate', error: 'Planner item is already saved' };
        } catch (e) { console.error('Failed to add item to planner', e); return { ok: false, reason: 'planner-add-failed', error: e?.message || String(e) }; }
    },
    removeItem: (date, itemId) => {
        try {
            const parsed = readLocalPlan();
            const itemKey = getItemKey(itemId);
            if (parsed[date]) {
                parsed[date] = parsed[date].filter(i => getItemKey(i) !== itemKey);
                if (parsed[date].length === 0) delete parsed[date];
                const result = writeLocalPlan(parsed);
                if (!isPlannerStorageSuccess(result)) return result;
                plannerStorage.savePlanToApi(parsed);
                return { ok: true };
            }
            return { ok: false, reason: 'not-found', error: 'Planner item was not found' };
        } catch (e) { console.error('Failed to remove item', e); return { ok: false, reason: 'planner-remove-failed', error: e?.message || String(e) }; }
    },
    merge: (dates, newItems) => {
        try {
            const parsed = readLocalPlan();
            let changed = false;
            dates.forEach(date => {
                if (!parsed[date]) parsed[date] = [];
                (newItems || []).forEach(rawItem => {
                    const item = normalizePlanItem(rawItem, date);
                    if (item && !hasSimilarPlanItem(parsed[date], item)) { parsed[date].push(item); changed = true; }
                });
                parsed[date] = deduplicatePlanItems(parsed[date]);
            });
            if (changed) {
                const result = writeLocalPlan(parsed);
                if (!isPlannerStorageSuccess(result)) return result;
                plannerStorage.savePlanToApi(parsed);
            }
            return { ok: true, changed };
        } catch (e) { console.error('Merge failed', e); return { ok: false, reason: 'planner-merge-failed', error: e?.message || String(e) }; }
    },
    savePlanToApi: async (planData) => {
        try {
            const normalizedPlan = pruneBlacklistedFromPlan(normalizePlanData(planData), plannerStorage.getBlacklist());
            const result = writeLocalPlan(normalizedPlan);
            if (!isPlannerStorageSuccess(result)) return result;
            if (isStaticHostRuntime()) return true;
            await fetch(`${API_BASE}/user_plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalizedPlan) });
            return true;
        } catch (e) { console.warn('API save plan error:', e); return false; }
    },
    addToBlacklist: (id) => {
        try {
            const key = getItemKey(id);
            if (!key) return;
            const list = readLocalBlacklist();
            if (!list.includes(key)) {
                list.push(key);
                const blacklistWrite = writeLocalBlacklist(list);
                if (!isPlannerStorageSuccess(blacklistWrite)) return blacklistWrite;
                const prunedPlan = pruneBlacklistedFromPlan(readLocalPlan(), new Set(list));
                const planWrite = writeLocalPlan(prunedPlan);
                if (!isPlannerStorageSuccess(planWrite)) return planWrite;
                plannerStorage.saveBlacklistToApi(list);
                plannerStorage.savePlanToApi(prunedPlan);
                return { ok: true };
            }
            return { ok: true, skipped: true };
        } catch (e) { console.error('Failed to blacklist', e); return { ok: false, reason: 'blacklist-failed', error: e?.message || String(e) }; }
    },
    getBlacklist: () => { try { return new Set(readLocalBlacklist()); } catch { return new Set(); } },
    saveBlacklistToApi: async (list) => {
        try {
            const normalizedList = normalizeBlacklistData(list);
            const result = writeLocalBlacklist(normalizedList);
            if (!isPlannerStorageSuccess(result)) return result;
            if (isStaticHostRuntime()) return true;
            await fetch(`${API_BASE}/blacklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalizedList) });
            return true;
        } catch (e) { console.warn('API save blacklist error:', e); return false; }
    }
};

export default plannerStorage;
