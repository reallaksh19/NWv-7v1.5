const ENTITY_MAP = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&#34;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
};

export function decodeHtmlEntities(value) {
  let text = String(value || '');

  for (const [entity, replacement] of Object.entries(ENTITY_MAP)) {
    text = text.split(entity).join(replacement);
  }

  text = text.replace(/&#(\d+);/g, (_, code) => {
    const number = Number(code);
    return Number.isFinite(number) ? String.fromCharCode(number) : '';
  });

  return text;
}

export function sanitizeHtmlText(value, options = {}) {
  const maxLength = options.maxLength || 0;

  let text = decodeHtmlEntities(value)
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\s*\/\s*(p|div|li|ol|ul|h\d)\s*>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/([.,;:!?]){2,}/g, '$1')
    .trim();

  if (maxLength > 0 && text.length > maxLength) {
    text = text.slice(0, maxLength).trimEnd() + '…';
  }

  return text;
}
