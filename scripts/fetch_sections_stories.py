"""
fetch_sections_stories.py — news sections pre-fetch.

Populates public/newsdata/sections_latest.json with 10 section keys:
  topStories, india, tn, trichy, muscat, world, business, technology, sports, entertainment

Runs on the same schedule as fetch_insight_stories.py (news_prefetch.yml).
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

import feedparser
import requests
from prefetch_common import (
    H_MS, DAY_MS, now_ms, read_json, write_json,
    normalize_basic_story, is_suppressed, compute_content_hash
)
from section_source_policy import get_section_feeds_map, build_section_quality, write_section_source_policy_report

# ── Paths ─────────────────────────────────────────────────────────────────────
SECTIONS_PATH      = 'public/newsdata/sections_latest.json'
SOURCE_HEALTH_PATH = 'public/newsdata/source_health.json'
SECTION_SOURCE_POLICY_REPORT_PATH = 'public/newsdata/section_source_policy_report.json'

SECTION_CACHE_MAX_AGE_MS = 2 * H_MS   # re-fetch each run (sections refresh every ~2 h)
STORY_RETAIN_HOURS       = 24          # stories older than 24h are dropped

# ── Section source policy / feed registry ─────────────────────────────────────
# Section feeds are loaded from config/section_sources.json so source mix can be
# tuned without changing fetcher code.
SECTION_FEEDS = get_section_feeds_map()

MAX_STORIES_PER_SECTION = 30
MIN_STORIES_PER_SECTION = 10  # backfill from parent section when count falls below this

# Backfill map: if a city section is thin, pull extras from the named parent section
SECTION_BACKFILL = {
    'trichy':  'tn',       # pull TN stories if Trichy feed is thin
    'muscat':  'world',    # pull World/Gulf stories if Muscat feed is thin
}

DEFAULT_SECTIONS_SNAPSHOT = {
    'schemaVersion': 1,
    'fetchedAt':     0,
    'contentHash':   '',
    'sections': {s: [] for s in SECTION_FEEDS},
}


def fetch_section(section: str, feeds: list, ts: int) -> tuple[list, dict]:
    results, source_health = [], {}
    for url, source, source_group in feeds:
        try:
            response = requests.get(url, timeout=15)
            response.raise_for_status()
            feed = feedparser.parse(response.content)
            feed_items = []
            for entry in feed.entries[:20]:
                pub = entry.get('published_parsed')
                pub_ms = int(time.mktime(pub) * 1000) if pub else ts
                raw = {
                    'title':       entry.get('title', ''),
                    'summary':     entry.get('summary', ''),
                    'url':         entry.get('link', ''),
                    'publishedAt': pub_ms,
                    'category':    section,
                    'region':      'in',
                }
                item = normalize_basic_story(raw, source, source_group)
                if not is_suppressed(item, 'any'):
                    feed_items.append(item)

            results.extend(feed_items)
            source_health[source_group] = {
                'ok': True,
                'items': len(feed_items),
                'feedUrl': url,
                'section': section,
            }
        except Exception as e:
            source_health[source_group] = {
                'ok': False,
                'error': str(e),
                'items': 0,
                'feedUrl': url,
                'section': section,
            }

    return results, source_health


def dedup_section(items: list) -> list:
    """Dedup by story ID, keep most recent on collision."""
    by_id: dict = {}
    for item in sorted(items, key=lambda x: x.get('publishedAt', 0), reverse=True):
        sid = item.get('id')
        if sid and sid not in by_id:
            by_id[sid] = item
    return list(by_id.values())


def main():
    ts     = now_ms()
    cutoff = ts - STORY_RETAIN_HOURS * H_MS

    print(f'Fetching sections (ts={ts})…')
    new_sections: dict = {}
    all_health: dict   = {}

    for section, feeds in SECTION_FEEDS.items():
        items, health = fetch_section(section, feeds, ts)
        all_health.update(health)
        # Drop stories older than 24 h
        fresh = [i for i in items if i.get('publishedAt', 0) >= cutoff]
        deduped = dedup_section(fresh)
        # Most recent first, capped
        deduped.sort(key=lambda x: x.get('publishedAt', 0), reverse=True)
        new_sections[section] = deduped[:MAX_STORIES_PER_SECTION]
        print(f'  [{section}] {len(new_sections[section])} stories')

    # Backfill under-populated city sections from their parent sections.
    # We only exclude stories already in the CHILD section (not globally) so that
    # parent-section stories can supplement a thin child section as intended.
    for child_section, parent_section in SECTION_BACKFILL.items():
        current = new_sections.get(child_section, [])
        if len(current) < MIN_STORIES_PER_SECTION and parent_section in new_sections:
            needed = MIN_STORIES_PER_SECTION - len(current)
            parent_pool = new_sections.get(parent_section, [])
            child_ids = {s.get('id') for s in current if s.get('id')}
            extras = []
            for story in parent_pool:
                if story.get('id') not in child_ids:
                    tagged = dict(story)
                    tagged['backfilledFrom'] = parent_section
                    extras.append(tagged)
                    child_ids.add(story.get('id'))
                    if len(extras) >= needed:
                        break
            if extras:
                new_sections[child_section] = current + extras
                print(f'  [{child_section}] backfilled +{len(extras)} from [{parent_section}] → {len(new_sections[child_section])} total')

    all_stories_flat = [item for items in new_sections.values() for item in items]
    section_quality = build_section_quality(new_sections)

    snapshot = {
        'schemaVersion': 2,
        'fetchedAt':     ts,
        'contentHash':   compute_content_hash(all_stories_flat),
        'sectionQuality': section_quality,
        'sections':      new_sections,
    }
    write_json(SECTIONS_PATH, snapshot)

    from source_health import apply_source_health, zero_item_warnings
    existing_health = read_json(SOURCE_HEALTH_PATH, {'lastChecked': 0, 'sources': {}})
    existing_health['sources'] = apply_source_health(existing_health.get('sources', {}), all_health, ts)
    existing_health['lastChecked'] = ts
    write_json(SOURCE_HEALTH_PATH, existing_health)
    write_section_source_policy_report(new_sections, all_health)

    warnings = zero_item_warnings(existing_health['sources'])
    for w in warnings:
        print(f'  [health-warn] {w}')

    total = sum(len(v) for v in new_sections.values())
    print(f'Done. total={total}, contentHash={snapshot["contentHash"]}')


if __name__ == '__main__':
    main()
