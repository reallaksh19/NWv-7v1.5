/**
 * Generates random "Topline" content:
 * - Flashback (On this day)
 * - Trending (Keywords from news)
 * - Quick Fact
 * - Weather Insight
 */

import { quickFactsService } from '../services/quickFactsService';

function isOnThisDayKey(key = '') {
  const normalized = String(key).toLowerCase().replace(/[\s_-]+/g, '');
  return normalized.includes('onthisday') || normalized.includes('todayinhistory');
}

function removeOnThisDaySections(newsData = {}) {
  const result = { ...newsData };

  for (const key of Object.keys(result)) {
    if (isOnThisDayKey(key)) {
      result[key] = [];
    }
  }

  result.onThisDay = [];
  result.todayInHistory = [];

  return result;
}

export async function fetchOnThisDay() {
    try {
        const facts = await quickFactsService.fetchDailyFacts();
        if (facts && facts.length > 0) {
            // Return a random fact from the fetched list
            const event = facts[Math.floor(Math.random() * facts.length)];
            return {
                text: `On this day in ${event.year}: ${event.text}`,
                year: event.year,
                isDynamic: true
            };
        }
        return null;
    } catch (e) {
        console.warn('OnThisDay fetch failed:', e);
        return null;
    }
}

function getTrending(newsData) {
    // Extract words from headlines
    const words = [];
    const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'dead', 'kills', 'says', 'india', 'world', 'chennai', 'tamil', 'nadu']);

    // Aggregate all headlines
    const allNews = [
        ...(newsData.world || []),
        ...(newsData.india || []),
        ...(newsData.tech || [])
    ];

    if (allNews.length === 0) return null;

    allNews.forEach(item => {
        if (!item.title) return;
        const clean = item.title.replace(/[^\w\s]/gi, '').toLowerCase().split(/\s+/);
        clean.forEach(w => {
            if (w.length > 3 && !stopWords.has(w)) words.push(w);
        });
    });

    // Count frequency
    const freq = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);

    // Sort
    const sorted = Object.entries(freq).sort((a,b) => b[1] - a[1]);
    const top3 = sorted.slice(0, 3).map(x => x[0]);

    if (top3.length === 0) return null;

    return {
        type: 'TRENDING',
        icon: '🔥',
        text: `Trending now: #${top3.join(', #')}`
    };
}

function getWeatherInsight(weatherData) {
    if (!weatherData || Object.keys(weatherData).length === 0) return null;

    // Pick first available city
    const city = Object.keys(weatherData)[0];
    const data = weatherData[city];

    if (!data || !data.current) return null;

    const temp = data.current.temp;
    const cond = data.current.condition.toLowerCase();

    let text = "";
    if (temp > 35) text = `It's a scorcher today at ${temp}°C. Stay hydrated!`;
    else if (temp < 20) text = `Cooler vibes today at ${temp}°C.`;
    else if (cond.includes('rain')) text = "Rainy skies today. Don't forget your umbrella.";
    else text = `Currently ${temp}°C and ${cond}. A pleasant day ahead?`;

    return {
        type: 'WEATHER INSIGHT',
        icon: '🌤️',
        text: text
    };
}

export function generateTopline(newsData, weatherData, onThisDayEvent = null, options = {}) {
  const includeOnThisDay = options.includeOnThisDay === true;
  const sourceData = includeOnThisDay ? newsData : removeOnThisDaySections(newsData);
  const opts = [];

  // 1. Fact (Use dynamic if available, only when On This Day is enabled)
  if (includeOnThisDay && onThisDayEvent && onThisDayEvent.isDynamic) {
    const dynamicFact = {
      type: 'ON THIS DAY',
      icon: '📅',
      text: onThisDayEvent.text
    };

    opts.push(dynamicFact);
    opts.push(dynamicFact);
    opts.push(dynamicFact);
  }

  // 2. Trending (if news available) - Add once
  const trending = getTrending(sourceData);
  if (trending) opts.push(trending);

  // 3. Weather (if available) - Add once
  const weather = getWeatherInsight(weatherData);
  if (weather) opts.push(weather);

  if (opts.length === 0) return null;

  // Random Pick
  return opts[Math.floor(Math.random() * opts.length)];
}
