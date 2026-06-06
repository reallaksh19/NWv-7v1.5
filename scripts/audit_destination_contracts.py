#!/usr/bin/env python3
"""
audit_destination_contracts.py — NWv-7 destination contract baseline audit.

Phase 0 of the destination-covered static pipeline. Produces a *source-level*
map of every user-facing destination by cross-referencing the live repository
against a curated expectation registry, so later phases never build JSON that no
page reads (or fork a pipeline that already exists).

It auto-detects, at run time:
  - routes declared in        src/App.jsx
  - destinations exposed in    src/components/BottomNav.jsx
  - static JSON actually on    public/data + public/newsdata
  - schema versions accepted   src/adapters/*.js
  - outputs staged by          .github/workflows/*.yml

...then reconciles that reality against DESTINATION_REGISTRY (the corrected
wiring, which reuses existing files such as weather_snapshot.json,
market_snapshot.json, epaper_data.json and quality_dashboard.json rather than
inventing parallel *_latest.json siblings).

Emits:
  - reports/destination_contract_baseline.json   (machine)
  - reports/destination_contract_baseline.md      (human)

This audit is READ-ONLY with respect to application behavior and never exits
non-zero on contract divergence — like the Data Health philosophy, it *reports*
state, it does not gate deployment. It exits non-zero only if it cannot write
its own artifacts.
"""
from __future__ import annotations

import fnmatch
import json
import os
import re
import sys
import time
from pathlib import Path

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
REPO_ROOT = Path(__file__).resolve().parent.parent
APP_JSX = "src/App.jsx"
BOTTOM_NAV = "src/components/BottomNav.jsx"
ADAPTER_DIR = "src/adapters"
WORKFLOW_DIR = ".github/workflows"
DATA_DIRS = ["public/data", "public/newsdata"]

OUT_JSON = "reports/destination_contract_baseline.json"
OUT_MD = "reports/destination_contract_baseline.md"

SCHEMA_VERSION = 1


# --------------------------------------------------------------------------- #
# Safe IO helpers
# --------------------------------------------------------------------------- #
def read_text(rel: str) -> str:
    p = REPO_ROOT / rel
    try:
        return p.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def read_json(rel: str):
    p = REPO_ROOT / rel
    try:
        with p.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def exists(rel: str) -> bool:
    return (REPO_ROOT / rel).exists()


# --------------------------------------------------------------------------- #
# Detectors (live repository reality)
# --------------------------------------------------------------------------- #
def detect_routes() -> list[str]:
    """Every path="..." declared in App.jsx."""
    text = read_text(APP_JSX)
    routes = re.findall(r"""path=["']([^"']+)["']""", text)
    # de-dupe, preserve order
    seen, out = set(), []
    for r in routes:
        if r not in seen:
            seen.add(r)
            out.append(r)
    return out


def detect_nav() -> list[dict]:
    """Each { path: '...', label: '...' } entry in BottomNav.jsx."""
    text = read_text(BOTTOM_NAV)
    nav = []
    for m in re.finditer(
        r"""path:\s*['"]([^'"]+)['"]\s*,\s*label:\s*['"]([^'"]+)['"]""", text
    ):
        nav.append({"path": m.group(1), "label": m.group(2)})
    return nav


def scan_static_json() -> dict[str, dict]:
    """{ 'public/data/x.json': {sizeBytes, schemaVersion} } for every JSON file."""
    out: dict[str, dict] = {}
    for d in DATA_DIRS:
        base = REPO_ROOT / d
        if not base.is_dir():
            continue
        for p in sorted(base.glob("*.json")):
            rel = f"{d}/{p.name}"
            entry = {"sizeBytes": p.stat().st_size, "schemaVersion": None}
            data = read_json(rel)
            if isinstance(data, dict) and "schemaVersion" in data:
                entry["schemaVersion"] = data.get("schemaVersion")
            out[rel] = entry
    return out


def detect_adapter_schemas() -> dict[str, list[int]]:
    """Best-effort: schema versions each adapter accepts, via `schema === N`
    and `schemaVersion ... === N` patterns."""
    out: dict[str, list[int]] = {}
    base = REPO_ROOT / ADAPTER_DIR
    if not base.is_dir():
        return out
    for p in sorted(base.glob("*.js")):
        if ".cert." in p.name or ".test." in p.name:
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        versions = set()
        for m in re.finditer(r"schema(?:Version)?[^=\n]{0,40}===\s*(\d+)", text):
            versions.add(int(m.group(1)))
        for m in re.finditer(r"===\s*(\d+)\s*\|\|[^=\n]{0,20}===\s*(\d+)", text):
            versions.add(int(m.group(1)))
            versions.add(int(m.group(2)))
        if versions:
            out[f"{ADAPTER_DIR}/{p.name}"] = sorted(versions)
    return out


def detect_int(rel: str, pattern: str):
    m = re.search(pattern, read_text(rel))
    return int(m.group(1)) if m else None


def parse_workflows() -> dict[str, dict]:
    """{ workflow_file: {runs: [scripts...], staged: [tokens...]} }."""
    out: dict[str, dict] = {}
    base = REPO_ROOT / WORKFLOW_DIR
    if not base.is_dir():
        return out
    for p in sorted(base.glob("*.yml")):
        text = p.read_text(encoding="utf-8", errors="ignore")
        runs = re.findall(r"(?:python|node)\s+(scripts/[A-Za-z0-9_./-]+)", text)
        staged: list[str] = []
        for m in re.finditer(r"git add\s+(.+)", text):
            for tok in m.group(1).split():
                tok = tok.strip().strip("\\").strip()
                if tok:
                    staged.append(tok)
        out[p.name] = {"runs": sorted(set(runs)), "staged": staged}
    return out


def staged_match(path: str, staged_tokens: list[str]) -> bool:
    """Does any `git add` token cover `path` (exact, directory-prefix, or glob)?"""
    for tok in staged_tokens:
        if tok == path:
            return True
        if tok.endswith("/") and path.startswith(tok):
            return True
        if "*" in tok and fnmatch.fnmatch(path, tok):
            return True
    return False


# --------------------------------------------------------------------------- #
# Curated expectation registry — the *reconciled* wiring.
#
# migrationStatus:
#   MIGRATED     — already served by a committed static JSON the page reads
#   DERIVED      — built client-side from other MIGRATED feeds (optional static later)
#   NOT_MIGRATED — no static source yet; a genuine build target
#   LOCAL_ONLY   — no data pipeline required (device-local / routing only)
# --------------------------------------------------------------------------- #
DESTINATION_REGISTRY: list[dict] = [
    {
        "destination": "Main",
        "route": "/",
        "navLabel": "Main",
        "destinationType": "feed",
        "migrationStatus": "MIGRATED",
        "expectedStaticJson": [
            "public/newsdata/sections_latest.json",
            "public/newsdata/breaking_latest.json",
        ],
        "producers": ["scripts/fetch_sections_stories.py", "scripts/fetch_breaking_news.py"],
        "workflows": ["news_prefetch.yml", "breaking_refresh.yml"],
        "validators": ["scripts/validate_sections_prefetch_output.py"],
        "consumers": ["src/adapters/sectionsSnapshotFetcher.js", "src/adapters/breakingSnapshotFetcher.js"],
        "note": "Collector retains 24h but adapter accepts 36h — the 24-36h band is never populated.",
    },
    {
        "destination": "Insight",
        "route": "/insight",
        "navLabel": "Insight",
        "destinationType": "feed",
        "migrationStatus": "MIGRATED",
        "expectedStaticJson": ["public/newsdata/insight_latest.json"],
        "producers": ["scripts/fetch_insight_stories.py"],
        "workflows": ["news_prefetch.yml"],
        "validators": ["scripts/validate_insight_prefetch_output.py"],
        "consumers": ["src/adapters/insightSnapshotFetcher.js"],
        "note": "Flat stories[]; slotMeta intentionally not used for display. Clusters must stay additive.",
    },
    {
        "destination": "Up Ahead",
        "route": "/up-ahead",
        "navLabel": "Up Ahead",
        "destinationType": "actionable",
        "migrationStatus": "MIGRATED",
        "expectedStaticJson": ["public/data/up_ahead.json"],
        "producers": ["scripts/fetch_upahead_events.py", "scripts/fetch_festivals.py"],
        "workflows": ["upahead_refresh.yml"],
        "validators": [],
        "consumers": ["src/services/upAheadService.js"],
        "note": "Already enforces [now-1d, now+7d]; planner eligibility [-6h, +7d]. Needs explicit horizon contract + lifecycle objects.",
    },
    {
        "destination": "Planner",
        "route": "/my-planner",
        "navLabel": "Planner",
        "destinationType": "actionable_local",
        "migrationStatus": "DERIVED",
        "expectedStaticJson": ["public/data/up_ahead.json"],
        "producers": ["scripts/fetch_upahead_events.py"],
        "workflows": ["upahead_refresh.yml"],
        "validators": [],
        "consumers": ["src/viewModels/useMyPlannerPageViewModel.js"],
        "note": "Derived from up_ahead.json + device-local saved plan. Optional static planner_latest.json is the only genuinely new output here.",
    },
    {
        "destination": "Market",
        "route": "/markets",
        "navLabel": "Market",
        "destinationType": "snapshot",
        "migrationStatus": "MIGRATED",
        "expectedStaticJson": [
            "public/data/market_snapshot.json",
            "public/data/market_metrics.json",
            "public/data/mutual_fund_snapshot.json",
            "public/data/fx_snapshot.json",
        ],
        "producers": ["scripts/market_snapshot_worker.py"],
        "workflows": ["market_refresh.yml"],
        "validators": [],
        "consumers": ["src/context/MarketContext.jsx", "src/services/indianMarketStableService.js"],
        "note": "Fully migrated to market_snapshot.json. Do NOT introduce market_latest.json — add envelope + validity in place.",
    },
    {
        "destination": "Weather",
        "route": "/weather",
        "navLabel": "Weather",
        "destinationType": "utility",
        "migrationStatus": "MIGRATED",
        "expectedStaticJson": ["public/data/weather_snapshot.json"],
        "producers": ["scripts/weather_snapshot_worker.py"],
        "workflows": ["weather_refresh.yml"],
        "validators": [],
        "consumers": ["src/services/weatherService.js"],
        "note": "Already static-first: weatherService reads weather_snapshot.json. Do NOT introduce weather_latest.json/fetch_weather_static.py.",
    },
    {
        "destination": "Buzz",
        "route": "/tech-social",
        "navLabel": "Buzz",
        "destinationType": "feed_trend",
        "migrationStatus": "DERIVED",
        "expectedStaticJson": [],
        "producers": [],
        "workflows": [],
        "validators": [],
        "consumers": [
            "src/viewModels/useTechSocialPageViewModel.js",
            "src/data/datasets/buzzDataset.js",
        ],
        "note": (
            "DERIVED, not greenfield: buzzDataset.load() builds trends from "
            "loadSectionsDataset() (technology/entertainment/social + viral-filtered "
            "world/india/local) with a live rssAggregator fallback for technology. A "
            "precomputed buzz_latest.json is OPTIONAL enrichment that must fall back to "
            "this derived path, shaped to the buzzDataset/buzzSlo buckets."
        ),
    },
    {
        "destination": "Newspaper",
        "route": "/newspaper",
        "navLabel": "Newspaper",
        "destinationType": "derived",
        "migrationStatus": "MIGRATED",
        "expectedStaticJson": ["public/data/epaper_data.json"],
        "producers": ["scripts/daily_brief.py"],
        "workflows": ["daily_brief.yml"],
        "validators": [],
        "consumers": ["src/viewModels/useNewspaperPageViewModel.js"],
        "note": "Already produced by daily_brief.py -> epaper_data.json. Edition builder should extend this, not create newspaper_latest.json in parallel.",
    },
    {
        "destination": "Following",
        "route": "/following",
        "navLabel": "Following",
        "destinationType": "derived",
        "migrationStatus": "DERIVED",
        "expectedStaticJson": [],
        "producers": [],
        "workflows": [],
        "validators": [],
        "consumers": ["src/viewModels/useFollowingTabViewModel.js"],
        "note": "followedTopics is device-local; stories derived from migrated Sections/Insight at runtime. Static topic index is optional enrichment.",
    },
    {
        "destination": "Topic Detail",
        "route": "/following/:topicId",
        "navLabel": None,
        "destinationType": "derived",
        "migrationStatus": "DERIVED",
        "expectedStaticJson": [],
        "producers": [],
        "workflows": [],
        "validators": [],
        "consumers": ["src/viewModels/useTopicDetailViewModel.js"],
        "note": "Sub-route of Following; derived. Not bottom-nav visible.",
    },
    {
        "destination": "Data Health",
        "route": "/data-health",
        "navLabel": None,
        "destinationType": "status",
        "migrationStatus": "MIGRATED",
        "expectedStaticJson": [
            "public/newsdata/quality_dashboard.json",
            "public/newsdata/insight_quality_report.json",
        ],
        "producers": ["scripts/generate_quality_dashboard.mjs"],
        "workflows": ["news_prefetch.yml"],
        "validators": ["scripts/validate_quality_dashboard.mjs"],
        "consumers": ["src/data/datasets/qualityDashboardDataset.js"],
        "note": "Already served by quality_dashboard.json. Any unified dashboard should extend this file, not add data_health_dashboard.json beside it.",
    },
    {
        "destination": "Refresh",
        "route": "/refresh",
        "navLabel": "Refresh",
        "destinationType": "status",
        "migrationStatus": "DERIVED",
        "expectedStaticJson": ["public/newsdata/source_health.json"],
        "producers": [],
        "workflows": ["news_prefetch.yml"],
        "validators": [],
        "consumers": ["src/viewModels/useRefreshPageViewModel.js"],
        "note": "Runtime freshness view. Could surface a small refresh_status.json, but reuse source_health + prefetch_commit_manifest first.",
    },
    {
        "destination": "Settings",
        "route": "/settings",
        "navLabel": "Settings",
        "destinationType": "local",
        "migrationStatus": "LOCAL_ONLY",
        "expectedStaticJson": [],
        "producers": [],
        "workflows": [],
        "validators": [],
        "consumers": ["src/pages/SettingsPage.jsx"],
        "note": "Device-local preferences. No data pipeline.",
    },
    {
        "destination": "More",
        "route": "/more",
        "navLabel": "More",
        "destinationType": "local_routing",
        "migrationStatus": "LOCAL_ONLY",
        "expectedStaticJson": [],
        "producers": [],
        "workflows": [],
        "validators": [],
        "consumers": ["src/pages/MorePage.jsx"],
        "note": "Navigation/diagnostics hub. No data pipeline.",
    },
]


# --------------------------------------------------------------------------- #
# Audit
# --------------------------------------------------------------------------- #
def audit() -> dict:
    routes = detect_routes()
    nav = detect_nav()
    nav_paths = {n["path"] for n in nav}
    static_json = scan_static_json()
    adapter_schemas = detect_adapter_schemas()
    workflows = parse_workflows()

    # Flagship numeric gap: sections collector retain vs adapter max-age.
    sections_retain_h = detect_int(
        "scripts/fetch_sections_stories.py", r"STORY_RETAIN_HOURS\s*=\s*(\d+)"
    )
    sections_adapter_h = detect_int(
        "src/adapters/sectionsSnapshotFetcher.js", r"SECTION_ITEM_MAX_AGE_MS\s*=\s*(\d+)\s*\*"
    )

    all_run_scripts = {s for wf in workflows.values() for s in wf["runs"]}
    all_staged = [tok for wf in workflows.values() for tok in wf["staged"]]

    destinations = []
    warnings: list[str] = []
    errors: list[str] = []

    registry_routes = {d["route"] for d in DESTINATION_REGISTRY}

    for d in DESTINATION_REGISTRY:
        entry = dict(d)
        entry["routeDeclared"] = d["route"] in routes or d["route"].split(":")[0].rstrip("/") + "/" in [
            r for r in routes
        ] or any(r.split(":")[0] == d["route"].split(":")[0] for r in routes)
        entry["navVisible"] = d["route"] in nav_paths

        # static presence
        present = []
        missing = []
        for j in d["expectedStaticJson"]:
            if j in static_json:
                present.append({"path": j, **static_json[j]})
            elif exists(j):
                present.append({"path": j, "sizeBytes": (REPO_ROOT / j).stat().st_size, "schemaVersion": None})
            else:
                missing.append(j)
        entry["staticPresent"] = present
        entry["staticMissing"] = missing

        # producer wiring
        producers_wired = {p: (p in all_run_scripts) for p in d["producers"]}
        entry["producersWired"] = producers_wired

        # output staging
        staging = {j: staged_match(j, all_staged) for j in d["expectedStaticJson"]}
        entry["outputStaged"] = staging

        # adapter schema support (where the consumer is a scanned adapter)
        schemas = {}
        for c in d["consumers"]:
            if c in adapter_schemas:
                schemas[c] = adapter_schemas[c]
        if schemas:
            entry["adapterSchemas"] = schemas

        # ---- divergence warnings ----
        if d["migrationStatus"] == "MIGRATED" and missing:
            warnings.append(
                f"[{d['destination']}] marked MIGRATED but missing static JSON: {', '.join(missing)}"
            )
        for p, wired in producers_wired.items():
            if not wired and d["migrationStatus"] == "MIGRATED":
                warnings.append(f"[{d['destination']}] producer not wired into any workflow: {p}")
        for j, staged in staging.items():
            if not staged and j not in missing:
                warnings.append(f"[{d['destination']}] committed output not staged by any workflow: {j}")
        if d["route"] not in routes and ":" not in d["route"]:
            warnings.append(f"[{d['destination']}] registry route not found in App.jsx: {d['route']}")

        destinations.append(entry)

    # orphan routes / nav entries (declared in app but absent from registry)
    skip_routes = {"*"}
    for r in routes:
        base = r.split(":")[0]
        if r in registry_routes or base in {x.split(":")[0] for x in registry_routes} or r in skip_routes:
            continue
        warnings.append(f"[orphan-route] App.jsx route has no destination contract: {r}")
    for n in nav:
        if n["path"] not in registry_routes:
            warnings.append(f"[orphan-nav] BottomNav destination has no contract: {n['path']} ({n['label']})")

    # flagship numeric gap
    sections_gap = None
    if sections_retain_h is not None and sections_adapter_h is not None:
        sections_gap = {
            "collectorRetainHours": sections_retain_h,
            "adapterMaxAgeHours": sections_adapter_h,
            "gap": sections_adapter_h > sections_retain_h,
        }
        if sections_adapter_h > sections_retain_h:
            warnings.append(
                f"[Main] Sections collector retains {sections_retain_h}h but adapter accepts "
                f"{sections_adapter_h}h — {sections_adapter_h - sections_retain_h}h window never populated."
            )

    status_counts: dict[str, int] = {}
    for d in DESTINATION_REGISTRY:
        status_counts[d["migrationStatus"]] = status_counts.get(d["migrationStatus"], 0) + 1

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": int(time.time() * 1000),
        "summary": {
            "routesDetected": len(routes),
            "navDestinations": len(nav),
            "contractsDefined": len(DESTINATION_REGISTRY),
            "staticJsonFiles": len(static_json),
            "workflows": len(workflows),
            "migrationStatusCounts": status_counts,
            "warningCount": len(warnings),
            "errorCount": len(errors),
            "sectionsRetainGap": sections_gap,
        },
        "detected": {
            "routes": routes,
            "nav": nav,
            "adapterSchemas": adapter_schemas,
            "workflows": {k: {"runs": v["runs"], "staged": v["staged"]} for k, v in workflows.items()},
            "staticJson": static_json,
        },
        "destinations": destinations,
        "warnings": warnings,
        "errors": errors,
    }


# --------------------------------------------------------------------------- #
# Markdown render
# --------------------------------------------------------------------------- #
def render_markdown(data: dict) -> str:
    s = data["summary"]
    lines = []
    lines.append("# NWv-7 — Destination Contract Baseline")
    lines.append("")
    lines.append(f"_Generated by `scripts/audit_destination_contracts.py` (schema v{data['schemaVersion']})._")
    lines.append("")
    lines.append(
        f"- Routes detected: **{s['routesDetected']}** · "
        f"Bottom-nav destinations: **{s['navDestinations']}** · "
        f"Contracts: **{s['contractsDefined']}**"
    )
    lines.append(
        f"- Static JSON files: **{s['staticJsonFiles']}** · "
        f"Workflows: **{s['workflows']}** · "
        f"Warnings: **{s['warningCount']}** · Errors: **{s['errorCount']}**"
    )
    counts = ", ".join(f"{k}: {v}" for k, v in sorted(s["migrationStatusCounts"].items()))
    lines.append(f"- Migration status: {counts}")
    if s.get("sectionsRetainGap"):
        g = s["sectionsRetainGap"]
        flag = "⚠️ GAP" if g["gap"] else "ok"
        lines.append(
            f"- Sections retain vs adapter: collector **{g['collectorRetainHours']}h** "
            f"vs adapter **{g['adapterMaxAgeHours']}h** — {flag}"
        )
    lines.append("")
    lines.append("## Destination matrix")
    lines.append("")
    lines.append("| Destination | Route | Nav | Type | Status | Static JSON (present) | Staged | Producer wired |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for d in data["destinations"]:
        present = ", ".join(p["path"].split("/")[-1] for p in d["staticPresent"]) or "—"
        missing = ", ".join(m.split("/")[-1] for m in d["staticMissing"])
        if missing:
            present += f" (missing: {missing})"
        staged = d["outputStaged"]
        staged_str = "n/a" if not staged else ("✓" if all(staged.values()) else "partial")
        prod = d["producersWired"]
        prod_str = "n/a" if not prod else ("✓" if all(prod.values()) else "partial")
        nav = "✓" if d["navVisible"] else "—"
        lines.append(
            f"| {d['destination']} | `{d['route']}` | {nav} | {d['destinationType']} | "
            f"{d['migrationStatus']} | {present} | {staged_str} | {prod_str} |"
        )
    lines.append("")

    lines.append("## Per-destination notes")
    lines.append("")
    for d in data["destinations"]:
        lines.append(f"### {d['destination']} — `{d['route']}` ({d['migrationStatus']})")
        lines.append(f"- **Consumers:** {', '.join(d['consumers']) or '—'}")
        if d["expectedStaticJson"]:
            lines.append(f"- **Expected static JSON:** {', '.join(d['expectedStaticJson'])}")
        if d.get("adapterSchemas"):
            sc = "; ".join(f"{k.split('/')[-1]} → {v}" for k, v in d["adapterSchemas"].items())
            lines.append(f"- **Adapter schemas accepted:** {sc}")
        if d.get("note"):
            lines.append(f"- **Note:** {d['note']}")
        lines.append("")

    if data["warnings"]:
        lines.append("## Divergence warnings")
        lines.append("")
        for w in data["warnings"]:
            lines.append(f"- ⚠️ {w}")
        lines.append("")

    if data["errors"]:
        lines.append("## Errors")
        lines.append("")
        for e in data["errors"]:
            lines.append(f"- ❌ {e}")
        lines.append("")

    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main() -> int:
    data = audit()

    out_json = REPO_ROOT / OUT_JSON
    out_md = REPO_ROOT / OUT_MD
    try:
        out_json.parent.mkdir(parents=True, exist_ok=True)
        out_json.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        out_md.write_text(render_markdown(data), encoding="utf-8")
    except OSError as exc:
        print(f"ERROR: could not write audit artifacts: {exc}", file=sys.stderr)
        return 1

    s = data["summary"]
    print("destination contract baseline written:")
    print(f"  {OUT_JSON}")
    print(f"  {OUT_MD}")
    print(
        f"  contracts={s['contractsDefined']} routes={s['routesDetected']} "
        f"nav={s['navDestinations']} warnings={s['warningCount']} errors={s['errorCount']}"
    )
    for w in data["warnings"]:
        print(f"  WARN {w}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
