"""
fetch_tmdb_releases.py — TMDB upcoming movie/TV releases for UpAhead.

Fetches structured release data (real dates, overviews, posters) from TMDB's
free API. Requires TMDB_API_KEY environment variable (set as GitHub secret).

Returns a list of items compatible with the UpAhead up_ahead.json schema,
ready to be merged into the 'movies' section by fetch_upahead_events.py.

If TMDB_API_KEY is missing, returns [] so the fallback RSS path still works.
"""
from __future__ import annotations

import os
import re
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")
TMDB_BASE    = "https://api.themoviedb.org/3"
TMDB_IMG     = "https://image.tmdb.org/t/p/w300"
REQUEST_TIMEOUT = 12

# Languages/regions to fetch — ordered by priority
TMDB_TARGETS = [
    {"region": "IN", "language": "ta", "label": "Tamil",   "priority": 1},
    {"region": "IN", "language": "ml", "label": "Malayalam","priority": 1},
    {"region": "IN", "language": "hi", "label": "Hindi",   "priority": 2},
    {"region": "IN", "language": "te", "label": "Telugu",  "priority": 2},
    {"region": "OM", "language": "en", "label": "Muscat",  "priority": 3},
]


def _tmdb_get(path: str, params: dict) -> Optional[dict]:
    if not TMDB_API_KEY:
        return None
    try:
        params["api_key"] = TMDB_API_KEY
        r = requests.get(f"{TMDB_BASE}{path}", params=params, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        print(f"  [tmdb] {path}: {exc}")
        return None


def _parse_release_date(date_str: str) -> Optional[int]:
    """Convert YYYY-MM-DD to epoch ms."""
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except ValueError:
        return None


def _is_within_window(release_ms: Optional[int], ts: int, days_ahead: int = 30) -> bool:
    if not release_ms:
        return False
    return (ts - 86400_000) <= release_ms <= (ts + days_ahead * 86400_000)


def _build_item(movie: dict, target: dict, ts: int) -> Optional[dict]:
    title     = movie.get("title") or movie.get("name") or ""
    overview  = (movie.get("overview") or "")[:300]
    poster    = movie.get("poster_path")
    date_str  = movie.get("release_date") or movie.get("first_air_date") or ""
    release_ms = _parse_release_date(date_str)

    if not title or not release_ms:
        return None
    if not _is_within_window(release_ms, ts, days_ahead=30):
        return None

    now_utc = datetime.now(timezone.utc)
    expiry  = release_ms + 24 * 3600_000  # expire day after release

    return {
        "id":              f"tmdb_{movie.get('id', '')}_{target['language']}",
        "title":           f"{title} ({target['label']})",
        "summary":         overview,
        "url":             f"https://www.themoviedb.org/movie/{movie.get('id', '')}",
        "source":          "TMDB",
        "sourceGroup":     "tmdb",
        "category":        "movies",
        "publishedAt":     ts,
        "eventStartAt":    release_ms,
        "eventEndAt":      None,
        "expiryAt":        expiry,
        "dateConfidence":  "high",
        "dateSource":      "tmdb_api",
        "city":            None,
        "region":          "india" if target["region"] == "IN" else "oman",
        "localityScore":   0.6,
        "posterUrl":       f"{TMDB_IMG}{poster}" if poster else None,
        "plannerEligible": _is_within_window(release_ms, ts, days_ahead=7),
        "suppressionReason": None,
        "actionabilityScore": 0.7,
    }


def fetch_tmdb_releases(ts: Optional[int] = None) -> list[dict]:
    """
    Returns a list of upcoming movie releases from TMDB.
    Returns [] if TMDB_API_KEY is not set.
    """
    if not TMDB_API_KEY:
        print("  [tmdb] TMDB_API_KEY not set — skipping TMDB fetch")
        return []

    if ts is None:
        ts = int(time.time() * 1000)

    seen_ids: set[str] = set()
    items: list[dict] = []

    now_dt  = datetime.now(timezone.utc)
    from_dt = now_dt.strftime("%Y-%m-%d")
    to_dt   = (now_dt + timedelta(days=30)).strftime("%Y-%m-%d")

    for target in TMDB_TARGETS:
        data = _tmdb_get("/movie/upcoming", {
            "region":   target["region"],
            "language": f"{target['language']}-{target['region']}",
            "page":     1,
        })

        if not data:
            continue

        movies = data.get("results", [])
        print(f"  [tmdb] {target['label']} ({target['region']}): {len(movies)} upcoming movies")

        for movie in movies:
            mid = str(movie.get("id", ""))
            key = f"{mid}_{target['language']}"
            if key in seen_ids:
                continue
            seen_ids.add(key)

            item = _build_item(movie, target, ts)
            if item:
                items.append(item)

    items.sort(key=lambda x: x.get("eventStartAt") or 0)
    print(f"  [tmdb] total eligible releases: {len(items)}")
    return items
