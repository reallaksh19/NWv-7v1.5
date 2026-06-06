"""
fetch_market_news.py — lightweight market-news RSS fetcher for the Market tab.

Pulls from trusted Indian business/market RSS feeds and returns a deduped
list of up to 15 fresh stories for market_snapshot.json → marketNews key.

Called by market_snapshot_worker.py inside run_worker().
"""
from __future__ import annotations

import hashlib
import html as html_lib
import re
import time
from typing import Optional

import xml.etree.ElementTree as ET

import requests

REQUEST_TIMEOUT = 12
MARKET_NEWS_FEEDS = [
    ("https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
     "Economic Times Markets", "economic_times"),
    ("https://www.moneycontrol.com/rss/markets.xml",
     "Moneycontrol Markets", "moneycontrol"),
    ("https://www.thehindubusinessline.com/markets/feeder/default.rss",
     "Business Line Markets", "business_line"),
    ("https://www.livemint.com/rss/markets",
     "Mint Markets", "livemint"),
    ("https://news.google.com/rss/search?q=Indian+stock+market+today&hl=en-IN&gl=IN&ceid=IN:en",
     "Google News Markets", "google_news"),
]

SUPPRESS_RE = re.compile(
    r"\b(photo gallery|viral|shocking|clickbait|sponsored|advertisement)\b",
    re.I,
)

MAX_STORIES  = 15
MAX_AGE_SECS = 12 * 3600  # drop stories older than 12 h


def _strip_html(text: str) -> str:
    text = html_lib.unescape(text or "")
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _story_id(url: str) -> str:
    canonical = re.sub(r"[?#].*$", "", (url or "").lower().rstrip("/"))
    return hashlib.sha1(canonical.encode()).hexdigest()[:16]


def fetch_market_news() -> list[dict]:
    """
    Returns up to MAX_STORIES recent market news items, deduped by URL.
    Never raises — returns [] on total failure.
    """
    results: list[dict] = []
    seen: set[str] = set()
    now = time.time()

    for url, source, source_group in MARKET_NEWS_FEEDS:
        try:
            for attempt in range(2):
                try:
                    resp = requests.get(url, timeout=REQUEST_TIMEOUT)
                    resp.raise_for_status()
                    break
                except Exception:
                    if attempt == 0:
                        time.sleep(3)
                    else:
                        raise

            # Parse RSS/Atom with stdlib XML — no external dependency
            try:
                root = ET.fromstring(resp.content)
            except ET.ParseError:
                continue

            ns = {"atom": "http://www.w3.org/2005/Atom"}
            # RSS 2.0
            items = root.findall(".//item")
            # Atom fallback
            if not items:
                items = root.findall(".//atom:entry", ns) or root.findall(".//entry")

            for entry in items[:10]:
                def _text_of(tag: str) -> str:
                    el = entry.find(tag) or entry.find(f"atom:{tag}", ns)
                    return el.text or "" if el is not None else ""

                title   = _strip_html(_text_of("title"))
                summary = _strip_html(_text_of("description") or _text_of("summary"))
                link_el = entry.find("link")
                link    = (link_el.text or link_el.get("href", "")) if link_el is not None else _text_of("link")
                pub_raw = _text_of("pubDate") or _text_of("published") or _text_of("updated")

                if not title or not link:
                    continue

                text = f"{title} {summary}".lower()
                if SUPPRESS_RE.search(text):
                    continue

                try:
                    from email.utils import parsedate_to_datetime
                    pub_ms = int(parsedate_to_datetime(pub_raw).timestamp() * 1000)
                except Exception:
                    try:
                        from datetime import datetime
                        pub_ms = int(datetime.fromisoformat(pub_raw.replace("Z", "+00:00")).timestamp() * 1000)
                    except Exception:
                        pub_ms = int(now * 1000)

                if (now - pub_ms / 1000) > MAX_AGE_SECS:
                    continue

                sid = _story_id(link)
                if sid in seen:
                    continue
                seen.add(sid)

                results.append({
                    "id":          sid,
                    "title":       title,
                    "summary":     summary[:300],
                    "url":         link,
                    "source":      source,
                    "sourceGroup": source_group,
                    "publishedAt": pub_ms,
                })

        except Exception as exc:
            print(f"  [market_news] {source}: {exc}")

    # Sort newest first, cap
    results.sort(key=lambda x: x["publishedAt"], reverse=True)
    print(f"  [market_news] {len(results[:MAX_STORIES])} stories fetched")
    return results[:MAX_STORIES]
