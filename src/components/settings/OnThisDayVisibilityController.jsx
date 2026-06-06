/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react';

const HIDDEN_ATTR = 'data-nw-hidden-on-this-day';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isOnThisDayText(text) {
  const value = normalizeText(text);
  return (
    value === 'on this day' ||
    value.startsWith('on this day ') ||
    value.includes(' on this day ')
  );
}

function findContainer(node) {
  if (!node || !node.closest) return null;

  return (
    node.closest('[data-on-this-day]') ||
    node.closest('[data-widget="on-this-day"]') ||
    node.closest('[data-testid*="on-this-day" i]') ||
    node.closest('[class*="on-this-day" i]') ||
    node.closest('[id*="on-this-day" i]') ||
    node.closest('section') ||
    node.closest('article') ||
    node.closest('.card') ||
    node.closest('.panel') ||
    node.closest('.widget') ||
    node.parentElement
  );
}

function findOnThisDayContainers(root = document) {
  const containers = new Set();

  try {
    root
      .querySelectorAll('[data-on-this-day], [data-widget="on-this-day"], [data-testid*="on-this-day" i], [class*="on-this-day" i], [id*="on-this-day" i]')
      .forEach(node => containers.add(node));
  } catch {
    // Ignore unsupported selector edge cases.
  }

  const textCandidates = root.querySelectorAll('h1,h2,h3,h4,h5,h6,header,button,summary,[role="heading"]');

  textCandidates.forEach(node => {
    if (isOnThisDayText(node.textContent)) {
      const container = findContainer(node);
      if (container) containers.add(container);
    }
  });

  return [...containers].filter(node => {
    if (!node || !node.style) return false;
    if (node.closest?.('.settings-page')) return false;
    return true;
  });
}

function hideOnThisDay(root = document) {
  findOnThisDayContainers(root).forEach(node => {
    if (!node.hasAttribute(HIDDEN_ATTR)) {
      node.setAttribute(HIDDEN_ATTR, 'true');
      node.setAttribute('aria-hidden', 'true');
      node.style.display = 'none';
    }
  });
}

function showOnThisDay(root = document) {
  root.querySelectorAll('[' + HIDDEN_ATTR + '="true"]').forEach(node => {
    node.removeAttribute(HIDDEN_ATTR);
    node.removeAttribute('aria-hidden');
    node.style.display = '';
  });
}

export default function OnThisDayVisibilityController({
  shouldShowOnThisDayWidget = false,
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    if (shouldShowOnThisDayWidget) {
      showOnThisDay(document);
      return undefined;
    }

    hideOnThisDay(document);

    if (typeof MutationObserver === 'undefined') {
      return () => {
        showOnThisDay(document);
      };
    }

    const observer = new MutationObserver(() => {
      hideOnThisDay(document);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      showOnThisDay(document);
    };
  }, [shouldShowOnThisDayWidget]);

  return null;
}

export const __onThisDayTestUtils = {
  findOnThisDayContainers,
  hideOnThisDay,
  showOnThisDay,
  isOnThisDayText,
};
