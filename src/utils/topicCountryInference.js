const COUNTRY_TOPIC_MAP = [
  {
    match: /\b(sri\s*lanka|colombo|columbo|ceylon|lk)\b/i,
    country: 'LK',
    lang: 'en',
    label: 'Sri Lanka',
  },
  {
    match: /\b(oman|muscat|masqat|om)\b/i,
    country: 'OM',
    lang: 'en',
    label: 'Oman',
  },
  {
    match: /\b(india|delhi|mumbai|chennai|trichy|tiruchirappalli|in)\b/i,
    country: 'IN',
    lang: 'en',
    label: 'India',
  },
];

export function inferTopicCountryEdition(topic = '', fallback = {}) {
  const text = String(topic || '').trim();

  for (const entry of COUNTRY_TOPIC_MAP) {
    if (entry.match.test(text)) {
      return {
        country: entry.country,
        lang: entry.lang,
        label: entry.label,
      };
    }
  }

  return {
    country: fallback.country || 'IN',
    lang: fallback.lang || 'en',
    label: fallback.label || 'India',
  };
}
