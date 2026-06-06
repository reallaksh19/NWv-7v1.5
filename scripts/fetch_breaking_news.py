"""
fetch_breaking_news.py — lightweight breaking-news mini-snapshot (L4a).

Runs on a short cadence (~15 min, breaking_refresh.yml) *independently* of the
hourly sections refresh, so genuinely breaking stories are not left behind in
the gap between full section runs. Writes public/newsdata/breaking_latest.json.

Breaking is decided server-side by breaking_news_core (multi-source velocity +
severity lexicon), where the cross-source view is clean and there are no CORS
limits — the browser trusts these flags rather than recomputing them.

Deploy-churn guard: the file is only rewritten when the breaking *content* hash
changes, so a steady-state (nothing new breaking) does not spam commits/deploys.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

import feedparser
import requests
from prefetch_common import (
    H_MS, now_ms, read_json, write_json,
    normalize_basic_story, is_suppressed, compute_content_hash,
)
from section_source_policy import get_section_feeds_map
from breaking_news_core import build_breaking_items

BREAKING_PATH = 'public/newsdata/breaking_latest.json'

# High-velocity sections to scan. Kept small so the job stays light enough to
# run every ~15 min without hammering sources.
BREAKING_SECTIONS = ['topStories', 'world', 'india']
RETAIN_HOURS = 12
MAX_ITEMS_PER_FEED = 15


def fetch_feed_items(url, source, source_group, section, ts):
    items = []
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        feed = feedparser.parse(response.content)
        for entry in feed.entries[:MAX_ITEMS_PER_FEED]:
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
                items.append(item)
    except Exception as exc:
        print(f'  [warn] {source_group} ({section}): {exc}')
    return items


def collect_stories(ts):
    cutoff = ts - RETAIN_HOURS * H_MS
    feeds_map = get_section_feeds_map()

    collected = []
    for section in BREAKING_SECTIONS:
        for url, source, source_group in feeds_map.get(section, []):
            collected.extend(fetch_feed_items(url, source, source_group, section, ts))

    # De-dup by story id (keep most recent), drop stale.
    by_id = {}
    for item in sorted(collected, key=lambda x: x.get('publishedAt', 0), reverse=True):
        if item.get('publishedAt', 0) < cutoff:
            continue
        sid = item.get('id')
        if sid and sid not in by_id:
            by_id[sid] = item
    return list(by_id.values())


def main():
    ts = now_ms()
    print(f'Scanning breaking feeds (ts={ts})…')

    stories = collect_stories(ts)
    breaking = build_breaking_items(stories, ts)
    content_hash = compute_content_hash(breaking)

    snapshot = {
        'schemaVersion': 1,
        'fetchedAt':     ts,
        'contentHash':   content_hash,
        'breaking':      breaking,
    }

    existing = read_json(BREAKING_PATH, {})
    if existing.get('schemaVersion') == 1 and existing.get('contentHash') == content_hash:
        # Steady state — same breaking set as last run. Leave the file untouched
        # so the commit step finds no diff and we avoid needless Pages deploys.
        print(f'No change in breaking set (hash={content_hash}) — leaving snapshot untouched.')
        return

    write_json(BREAKING_PATH, snapshot)
    print(f'Done. scanned={len(stories)} breaking={len(breaking)} contentHash={content_hash}')
    for item in breaking:
        reasons = ','.join(item.get('breakingReasons', []))
        print(f'  • [{item.get("breakingScore")}] ({reasons}) {item.get("title")}')


if __name__ == '__main__':
    main()
