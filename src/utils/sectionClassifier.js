/* eslint-disable */
import { SECTION_KEYWORDS } from '../data/sectionKeywords.js';
import { ENTITY_OVERRIDES } from '../data/entityOverrides.js';
import { getSettings } from './storage.js';

/**
 * Returns the effective keyword map, merging user additions from
 * settings.sectionKeywords[section] into the built-in defaults.
 * User keywords are ADDITIVE — defaults always apply.
 */
function getEffectiveKeywords(settingsObj) {
    const userOverrides = settingsObj?.sectionKeywords || {};
    if (!Object.keys(userOverrides).length) return SECTION_KEYWORDS;

    const merged = {};
    for (const [section, defaults] of Object.entries(SECTION_KEYWORDS)) {
        const userAdded = userOverrides[section];
        merged[section] = Array.isArray(userAdded) && userAdded.length > 0
            ? [...defaults, ...userAdded.filter(k => !defaults.includes(k))]
            : defaults;
    }
    return merged;
}

/**
 * Classifies an article into a section based on content
 *
 * Algorithm:
 * 1. Check entity overrides (exact match)
 * 2. Score all sections by keyword matches (default + user-configured)
 * 3. Return highest scoring section (if score >= threshold)
 * 4. Return null if no match (caller should fallback to original section)
 *
 * @param {string} title
 * @param {string} description
 * @param {string} source
 * @param {object} [settingsOverride] - Optional settings; if omitted, loaded from storage
 * @returns {string|null} - The detected section key or null
 */
export function classifySection(title, description, source = '', settingsOverride = null) {
    // Combine text for analysis
    const text = `${title} ${description}`.toLowerCase();

    // Step 1: Entity Override Check
    // We iterate through keys to find if any entity is present in the text
    // Fixed: Use word boundaries to prevent partial matches (e.g. "Vijay" in "Vijayapura")
    for (const [entity, section] of Object.entries(ENTITY_OVERRIDES)) {
        // Escape special regex chars in entity name
        const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(text)) {
            return section;
        }
    }

    // Step 2: Keyword Scoring (with user additions merged in)
    let resolvedSettings = settingsOverride;
    if (!resolvedSettings) {
        try { resolvedSettings = getSettings(); } catch { resolvedSettings = null; }
    }
    const effectiveKeywords = getEffectiveKeywords(resolvedSettings);
    const scores = {};
    // Initialize scores
    Object.keys(effectiveKeywords).forEach(key => scores[key] = 0);

    for (const [section, keywords] of Object.entries(effectiveKeywords)) {
        keywords.forEach(keyword => {
            // Use word boundary check for short words OR common false-positive stems (like "star" in "starved")
            // For longer phrases, simple includes is usually fine and faster
            const kLower = keyword.toLowerCase();

            // STRICT MODE: Words <= 4 chars OR specifically flagged words should use regex boundaries
            // Added 'vijay', 'ajith', 'suriya', 'vikram' to prevent matching city names like 'Vijayapura', 'Vikramgad'
            const strictWords = ['star', 'hero', 'mass', 'play', 'act', 'cast', 'plot', 'vijay', 'ajith', 'suriya', 'vikram', 'release'];
            const useRegex = kLower.length <= 3 || strictWords.includes(kLower);

            if (useRegex) {
                 // Regex boundary check
                 const regex = new RegExp(`\\b${kLower}\\b`, 'i');
                 if (regex.test(text)) {
                     scores[section]++;
                 }
            } else {
                if (text.includes(kLower)) {
                    scores[section]++;
                }
            }
        });
    }

    // Step 3: Find highest scoring section
    const sortedSections = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
    const topSection = sortedSections[0];
    const topScore = scores[topSection];

    // Threshold: require at least 2 keyword matches to confidently re-classify
    if (topScore >= 2) {
        return topSection;
    }

    // Step 4: No strong match
    return null;
}

/**
 * Testing Function (Can be called from console)
 */
export function testClassification() {
    const testCases = [
        { title: "Chennai floods affect thousands in Velachery", expected: "chennai" },
        { title: "Modi announces new economic policy in Delhi", expected: "india" },
        { title: "Rajinikanth new movie release date confirmed", expected: "entertainment" },
        { title: "CSK wins IPL final against MI", expected: "sports" },
        { title: "Apple launches new iPhone 16 with AI features", expected: "technology" },
        { title: "Sensex crosses 80000 mark as Nifty soars", expected: "business" },
        { title: "UN condemns Russia actions in Ukraine war", expected: "world" },
        { title: "Generic news about nothing specific", expected: null }
    ];

    console.log("--- Starting Classification Tests ---");
    let passed = 0;
    testCases.forEach(({ title, expected }) => {
        const result = classifySection(title, '');
        const pass = result === expected;
        const icon = pass ? '✅' : '❌';
        console.log(`${icon} "${title}" → ${result} (expected: ${expected})`);
        if (pass) passed++;
    });

    console.log(`Test Results: ${passed}/${testCases.length} passed`);
    console.log("-------------------------------------");
}
