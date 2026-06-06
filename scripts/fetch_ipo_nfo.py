"""
fetch_ipo_nfo.py — scrape upcoming/live/recent IPO + NFO data.

Sources:
  - Chittorgarh IPO tables (primary, structured HTML)
  - BSE upcoming IPO JSON endpoint (cross-validation)
  - AMFI NFO listing (already in AMFI nav worker but scraped fresh here)

Returns a dict:
  { ipo: { upcoming, live, recent }, nfo: [...], fetchedAt, sourceHealth }

Called by market_snapshot_worker.py inside run_worker().
"""
from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup

REQUEST_TIMEOUT = 14
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122 Safari/537.36 NWv7MarketBot/2.0"
    ),
    "Accept": "text/html,*/*",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_get(url: str) -> Optional[requests.Response]:
    for attempt in range(2):
        try:
            r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            r.raise_for_status()
            return r
        except Exception as exc:
            if attempt == 0:
                time.sleep(3)
            else:
                print(f"  [ipo_nfo] fetch failed {url}: {exc}")
    return None


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _parse_date(date_str: str) -> Optional[str]:
    """Try common date formats; return ISO string or None."""
    for fmt in ("%d-%b-%Y", "%b %d, %Y", "%d/%m/%Y", "%Y-%m-%d", "%d %b %Y", "%d-%b-%y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


# ── Chittorgarh IPO scraper ───────────────────────────────────────────────────

_CHITTORGARH_URLS = {
    "upcoming": "https://www.chittorgarh.com/report/ipo-subscription-status-live-data/87/",
    "recent":   "https://www.chittorgarh.com/report/recently-closed-ipo-list/85/",
}


def _parse_chittorgarh_table(soup: BeautifulSoup, category: str) -> list[dict]:
    results = []
    table = soup.find("table")
    if not table:
        return results

    headers = [_clean(th.get_text()) for th in table.find_all("th")]

    for row in table.find_all("tr")[1:]:
        cells = [_clean(td.get_text()) for td in row.find_all("td")]
        if len(cells) < 3:
            continue

        def _col(names: list[str]) -> str:
            for name in names:
                for i, h in enumerate(headers):
                    if name.lower() in h.lower() and i < len(cells):
                        return cells[i]
            return ""

        name    = _col(["IPO Name", "Company", "Name"])
        price   = _col(["Price Band", "Issue Price", "Price"])
        open_dt = _col(["Open Date", "Open", "Opening"])
        close_dt= _col(["Close Date", "Close", "Closing"])
        size    = _col(["Issue Size", "Size", "Amount"])
        status  = _col(["Status", "GMP", "Subscription"])
        listing = _col(["Listing Date", "Listing"])

        if not name or name.lower() in ("ipo name", "company name", "name"):
            continue

        item: dict[str, Any] = {
            "name":       name,
            "category":   category,
            "priceRange": price or None,
            "openDate":   _parse_date(open_dt) if open_dt else None,
            "closeDate":  _parse_date(close_dt) if close_dt else None,
            "listingDate":_parse_date(listing) if listing else None,
            "issueSize":  size or None,
            "status":     status or None,
        }
        results.append(item)

    return results


def fetch_ipo_chittorgarh() -> tuple[dict, str]:
    """Returns ({ upcoming, live, recent }, error_or_empty_string)."""
    all_items: dict[str, list] = {"upcoming": [], "live": [], "recent": []}
    errors = []

    for bucket, url in _CHITTORGARH_URLS.items():
        r = _safe_get(url)
        if not r:
            errors.append(f"chittorgarh/{bucket} fetch failed")
            continue
        try:
            soup = BeautifulSoup(r.text, "html.parser")
            items = _parse_chittorgarh_table(soup, bucket)
            # Items from the "upcoming" page include both live + upcoming
            for item in items:
                od = item.get("openDate") or ""
                cd = item.get("closeDate") or ""
                today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                if od and od > today:
                    all_items["upcoming"].append(item)
                elif cd and cd >= today:
                    all_items["live"].append(item)
                else:
                    all_items[bucket].append(item)
            print(f"  [ipo_nfo] chittorgarh/{bucket}: {len(items)} items")
        except Exception as exc:
            errors.append(f"chittorgarh/{bucket} parse error: {exc}")

    return all_items, "; ".join(errors)


# ── BSE upcoming IPO (JSON) ───────────────────────────────────────────────────

_BSE_IPO_URL = (
    "https://api.bseindia.com/BseIndiaAPI/api/IPOIssues/w?"
    "Type=UpcomingIPO&CategoryCode=E&issueType=P"
)


def fetch_ipo_bse() -> list[dict]:
    r = _safe_get(_BSE_IPO_URL)
    if not r:
        return []
    try:
        data = r.json()
        items = data if isinstance(data, list) else data.get("Table", data.get("data", []))
        out = []
        for row in items[:20]:
            name = _clean(row.get("COMPANY_NAME") or row.get("companyName") or "")
            if not name:
                continue
            out.append({
                "name":       name,
                "category":   "upcoming",
                "openDate":   _parse_date(str(row.get("OPEN_DATE") or row.get("openDate") or "")),
                "closeDate":  _parse_date(str(row.get("CLOSE_DATE") or row.get("closeDate") or "")),
                "priceRange": str(row.get("PRICE_BAND") or row.get("priceRange") or ""),
                "issueSize":  str(row.get("ISSUE_SIZE") or row.get("issueSize") or ""),
                "source":     "BSE",
            })
        print(f"  [ipo_nfo] bse: {len(out)} upcoming IPOs")
        return out
    except Exception as exc:
        print(f"  [ipo_nfo] bse parse error: {exc}")
        return []


# ── AMFI NFO scraper ──────────────────────────────────────────────────────────

_AMFI_NFO_URL = "https://www.amfiindia.com/new-fund-offer"


def fetch_nfo_amfi() -> list[dict]:
    r = _safe_get(_AMFI_NFO_URL)
    if not r:
        return []
    try:
        soup = BeautifulSoup(r.text, "html.parser")
        results = []
        table = soup.find("table")
        if not table:
            return results
        for row in table.find_all("tr")[1:]:
            cells = [_clean(td.get_text()) for td in row.find_all("td")]
            if len(cells) < 3:
                continue
            name = cells[0] if cells else ""
            if not name or name.lower() == "scheme name":
                continue
            results.append({
                "name":      name,
                "openDate":  _parse_date(cells[1]) if len(cells) > 1 else None,
                "closeDate": _parse_date(cells[2]) if len(cells) > 2 else None,
                "category":  cells[3] if len(cells) > 3 else None,
                "source":    "AMFI",
            })
        print(f"  [ipo_nfo] amfi nfo: {len(results)} NFOs")
        return results[:30]
    except Exception as exc:
        print(f"  [ipo_nfo] amfi nfo parse error: {exc}")
        return []


# ── Public API ────────────────────────────────────────────────────────────────

def fetch_ipo_nfo_data() -> dict:
    """
    Fetch IPO and NFO data from Chittorgarh + BSE + AMFI.
    Returns a dict suitable for merging into market_snapshot.json.
    """
    ipo_data, ipo_errors = fetch_ipo_chittorgarh()

    # Cross-validate with BSE: add any BSE IPOs not already in our list
    bse_upcoming = fetch_ipo_bse()
    known_names = {item["name"].lower() for item in ipo_data["upcoming"] + ipo_data["live"]}
    for item in bse_upcoming:
        if item["name"].lower() not in known_names:
            ipo_data["upcoming"].append(item)

    nfo = fetch_nfo_amfi()

    result: dict[str, Any] = {
        "ipo": {
            "upcoming": ipo_data["upcoming"],
            "live":     ipo_data["live"],
            "recent":   ipo_data["recent"],
        },
        "nfo": nfo,
        "fetchedAt":   int(time.time() * 1000),
        "lastCheckedAt": datetime.now(timezone.utc).isoformat(),
    }

    if ipo_errors:
        result["ipoFetchErrors"] = ipo_errors

    total_ipo = len(ipo_data["upcoming"]) + len(ipo_data["live"]) + len(ipo_data["recent"])
    print(f"  [ipo_nfo] total: {total_ipo} IPOs, {len(nfo)} NFOs")
    return result
