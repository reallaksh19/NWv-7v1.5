export const ON_THIS_DAY_DEFAULT_ENABLED = false;

export function shouldShowOnThisDay(settings = {}) {
  return Boolean(
    settings?.onThisDay?.enabled ??
    settings?.features?.onThisDay ??
    settings?.display?.showOnThisDay ??
    ON_THIS_DAY_DEFAULT_ENABLED
  );
}

export function revealOnThisDay(root = document) {
  if (!root?.querySelectorAll) return;

  root
    .querySelectorAll('[data-on-this-day], .on-this-day, [data-section="on-this-day"]')
    .forEach(node => {
      node.hidden = false;
      node.removeAttribute('aria-hidden');
      node.classList.remove('is-hidden');
    });
}

export function hideOnThisDay(root = document) {
  if (!root?.querySelectorAll) return;

  root
    .querySelectorAll('[data-on-this-day], .on-this-day, [data-section="on-this-day"]')
    .forEach(node => {
      node.hidden = true;
      node.setAttribute('aria-hidden', 'true');
      node.classList.add('is-hidden');
    });
}

export function applyOnThisDayVisibility(settings = {}, root = document) {
  const isOnThisDayEnabled = shouldShowOnThisDay(settings);

  if (isOnThisDayEnabled) {
    revealOnThisDay(root);
  } else {
    hideOnThisDay(root);
  }

  return isOnThisDayEnabled;
}

export function stripOnThisDayFromNewsData(newsData = {}, settings = {}) {
  if (shouldShowOnThisDay(settings)) return newsData;

  const clone = { ...newsData };

  for (const key of Object.keys(clone)) {
    const normalized = key.toLowerCase().replace(/[\s_-]+/g, '');
    if (normalized.includes('onthisday') || normalized.includes('todayinhistory')) {
      clone[key] = [];
    }
  }

  clone.onThisDay = [];
  clone.todayInHistory = [];

  return clone;
}
