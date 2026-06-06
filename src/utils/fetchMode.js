const STORAGE_KEY = 'nw_fetch_mode';

export const FETCH_MODES = Object.freeze({
  HYBRID: 'hybrid',
  LIVE: 'live',
});

export function getFetchMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === FETCH_MODES.LIVE ? FETCH_MODES.LIVE : FETCH_MODES.HYBRID;
  } catch {
    return FETCH_MODES.HYBRID;
  }
}

export function setFetchMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode === FETCH_MODES.LIVE ? FETCH_MODES.LIVE : FETCH_MODES.HYBRID);
  } catch {
    // storage unavailable
  }
}

export function isLiveMode() {
  return getFetchMode() === FETCH_MODES.LIVE;
}
