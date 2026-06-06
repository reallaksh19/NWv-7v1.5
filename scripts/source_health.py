"""
source_health.py — unified per-feed health tracking with zero-item streak detection.

Previously, fetchers overwrote the source_health.json record on every run with
{ok, items, lastSuccess}. That lost two important signals:
  1. Consecutive zero-item runs (silent feeds that aren't failing but aren't useful)
  2. Distinction between "feed is up but empty" (warn) and "feed errored" (fail)

merge_source_health() carries forward streak counters and last-good timestamps
across runs so the policy layer can spot persistently silent feeds and back off.

Schema (per source group):
  ok                 bool   — successful HTTP/parse this run
  status             str    — 'ok' | 'warn' | 'fail'
  items              int    — items returned this run
  zeroItemRuns       int    — consecutive runs returning zero items (resets on success)
  lastZeroItemAt     int    — ms timestamp of most recent zero-item run
  lastNonZeroSuccess int    — ms timestamp of most recent run with items > 0
  lastSuccess        int    — kept for back-compat: same as lastNonZeroSuccess
  lastFailure        int    — ms timestamp of most recent exception
  lastError          str    — exception message from most recent failure (truncated)
  lastCheckedAt      int    — ms timestamp of most recent run (success or failure)
  feedUrl            str    — canonical feed URL (debugging)
  section            str    — optional section tag for section feeds
"""
from __future__ import annotations

from typing import Any

ZERO_ITEM_WARN_STREAK = 3


def merge_source_health(
    previous: dict[str, Any] | None,
    current: dict[str, Any],
    ts: int,
) -> dict[str, Any]:
    """
    Fold a single fetch result (current) into the previous health record.
    Pass an empty dict (or None) for the first run.

    current dict accepts:
      ok        bool (required)
      items     int (default 0)
      error     str (optional; for failed fetches)
      feedUrl   str (optional)
      section   str (optional)
    """
    prev = dict(previous or {})
    record: dict[str, Any] = {
        'ok':                 bool(current.get('ok')),
        'items':              int(current.get('items', 0) or 0),
        'lastCheckedAt':      ts,
        'zeroItemRuns':       int(prev.get('zeroItemRuns', 0) or 0),
        'lastZeroItemAt':     prev.get('lastZeroItemAt'),
        'lastNonZeroSuccess': prev.get('lastNonZeroSuccess'),
        'lastSuccess':        prev.get('lastSuccess'),
        'lastFailure':        prev.get('lastFailure'),
        'lastError':          prev.get('lastError'),
        'feedUrl':            current.get('feedUrl') or prev.get('feedUrl'),
        'section':            current.get('section') or prev.get('section'),
    }

    if current.get('ok'):
        if record['items'] > 0:
            record['zeroItemRuns']       = 0
            record['lastNonZeroSuccess'] = ts
            record['lastSuccess']        = ts
            record['status']             = 'ok'
            record['lastError']          = None
        else:
            record['zeroItemRuns']       = record['zeroItemRuns'] + 1
            record['lastZeroItemAt']     = ts
            record['status']             = 'warn'
    else:
        record['zeroItemRuns'] = record['zeroItemRuns'] + 1
        record['lastFailure']  = ts
        record['lastError']    = (str(current.get('error') or 'unknown'))[:200]
        record['status']       = 'fail'

    return {k: v for k, v in record.items() if v is not None}


def apply_source_health(
    existing_sources: dict[str, dict[str, Any]],
    new_results: dict[str, dict[str, Any]],
    ts: int,
) -> dict[str, dict[str, Any]]:
    """
    Fold a batch of new per-group results into the existing source_health map.
    Returns a new merged map (does not mutate inputs).
    """
    merged = dict(existing_sources or {})
    for group, result in (new_results or {}).items():
        merged[group] = merge_source_health(existing_sources.get(group), result, ts)
    return merged


def zero_item_warnings(sources: dict[str, dict[str, Any]], threshold: int = ZERO_ITEM_WARN_STREAK) -> list[str]:
    """
    Return a list of human-readable warnings for any source group whose
    zero-item streak meets or exceeds `threshold`. Use to surface in
    quality reports / CI logs.
    """
    warnings: list[str] = []
    for group, rec in (sources or {}).items():
        runs = int((rec or {}).get('zeroItemRuns', 0) or 0)
        if runs >= threshold:
            last_zero = rec.get('lastZeroItemAt')
            warnings.append(
                f"feed '{group}' has returned zero items for {runs} consecutive runs"
                + (f" (last zero at {last_zero})" if last_zero else "")
            )
    return warnings
