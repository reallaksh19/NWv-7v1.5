export const STORAGE_WRITE_FAILURE_REASON = 'storage-write-failed';
export const STORAGE_WRITE_FAILURE_MESSAGE = 'Storage is full or unavailable. Free some space and try again.';

export function makeStorageWriteFailure(key, error = null) {
  return {
    ok: false,
    reason: STORAGE_WRITE_FAILURE_REASON,
    error: STORAGE_WRITE_FAILURE_MESSAGE,
    key,
    cause: error?.message || (error ? String(error) : null),
  };
}

export function getSafeLocalStorage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage || null;
  } catch (error) {
    console.warn('[safeStorage] localStorage unavailable', {
      message: error?.message || String(error),
    });
    return null;
  }
}

export function safeGetJson(key, fallback = null) {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return fallback;

    const raw = storage.getItem(key);
    if (!raw) return fallback;

    return JSON.parse(raw);
  } catch (error) {
    console.warn('[safeStorage] read failed', {
      key,
      message: error?.message || String(error),
    });
    return fallback;
  }
}

export function safeSetJson(key, value) {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return false;

    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('[safeStorage] write failed', {
      key,
      message: error?.message || String(error),
    });
    return false;
  }
}

export function safeRemove(key) {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return false;

    storage.removeItem(key);
    return true;
  } catch (error) {
    console.warn('[safeStorage] remove failed', {
      key,
      message: error?.message || String(error),
    });
    return false;
  }
}
