"""
Insight JSON contract helpers.

Purpose:
  - enrich public/newsdata/insight_latest.json before the browser pipeline reads it
  - keep GitHub Pages static hosting simple
  - make collector quality visible and testable
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from typing import Any

COLLECTOR_VERSION = "insight-collector-json-v3"

SLOT_ORDER = ["now", "minus4h", "minus12h", "minus24h"]

ANGLE_PATTERNS = {
    "official_response": [
        r"\bofficials?\b", r"\bministry\b", r"\bregulator\b", r"\bgovernment\b",
        r"\bstatement\b", r"\bconfirmed?\b", r"\bapproved?\b", r"\brejected?\b",
        r"\bminister\b", r"\bspokesperson\b", r"\bgovernment confirms\b",
        r"\bcabinet (?:decides|approves|clears)\b", r"\bsupreme court\b", r"\bhigh court\b",
        r"\bsays\b", r"\bsaid\b", r"\bannounced?\b", r"\bdeclar(?:e|ed|es)\b",
        r"\bdenies\b", r"\bdenied\b", r"\bwarns?\b", r"\bwarned\b",
        r"\bpolice\b", r"\bauthorit(?:y|ies)\b", r"\bcommission\b", r"\bcommittee\b",
        r"\brbi\b", r"\bsebi\b", r"\bcbdt\b", r"\bcbi\b", r"\bed\b",
        r"\b(?:pm|cm|president|governor|secretary) (?:said|says|announces?)\b",
        r"\bpress (?:conference|briefing|release)\b",
    ],
    "market_reaction": [
        r"\bshares?\b", r"\bstocks?\b", r"\binvestors?\b", r"\bmarket\b",
        r"\bfell\b", r"\brose\b", r"\bsurged\b", r"\btumbled\b", r"\btrading\b",
        r"\bstocks rally\b", r"\bshares fall\b", r"\bbond yields?\b", r"\brupee\b",
        r"\bnifty\b", r"\bsensex\b", r"\bdow\b", r"\bnasdaq\b", r"\bs&p\b",
        r"\b(?:inflation|gdp|cpi|wpi|repo|policy) rate\b",
        r"\bcrude oil\b", r"\bgold price\b", r"\bsilver price\b",
        r"\b(?:fii|dii|fpi)\b", r"\bmutual funds?\b", r"\bipo\b",
        r"\bquarterly (?:results|earnings|profit)\b",
        r"\bgains?\b", r"\blosses?\b", r"\brally(?:ing|ies)?\b", r"\bsell-?off\b",
    ],
    "expert_analysis": [
        r"\banalysts?\b", r"\bexperts?\b", r"\banalysis\b", r"\bexplains?\b",
        r"\bwhy it matters\b", r"\bimplications?\b",
        r"\beconomists?\b", r"\bstudy (?:finds|says|shows)\b", r"\bresearch (?:shows|finds)\b",
        r"\bsurvey (?:shows|finds)\b", r"\b(?:report|paper) (?:reveals|finds|shows)\b",
        r"\bexplainer\b", r"\bdeep dive\b", r"\bbreakdown\b", r"\bdecoded?\b",
        r"\bwhat (?:it means|to know|happened)\b", r"\bhow (?:to|it works|the)\b",
        r"\bquestions?\s+answered\b", r"\bfaq\b",
    ],
    "reaction_public": [
        r"\busers?\b", r"\bpublic\b", r"\bresidents?\b", r"\bbacklash\b",
        r"\bcriticis(?:e|ed|es|ing|m)\b", r"\bprotests?\b", r"\bprotesters?\b",
        r"\boutrage\b", r"\boutcry\b", r"\bnetizens?\b",
        r"\btwitter reactions?\b", r"\bsocial media reacts?\b",
        r"\b(?:rally|march|demonstration|sit-in)\b",
        r"\bpetition\b", r"\bsigned by\b",
    ],
    "background_context": [
        r"\bexplainer\b", r"\btimeline\b", r"\bwhat led\b", r"\bcontext\b",
        r"\bkey points\b", r"\bthings to know\b", r"\bhow it started\b",
        r"\bbackground\b", r"\bhistory of\b", r"\bprimer on\b",
        r"\bchronology\b", r"\ball you need to know\b",
        r"\bwhy (?:india|this|the)\b", r"\beverything you need\b",
    ],
    "regional_followup": [
        r"\blocal\b", r"\bregional\b", r"\bcity\b", r"\bdistrict\b",
        r"\bchennai\b", r"\btrichy\b", r"\btamil nadu\b", r"\bmuscat\b", r"\boman\b",
        r"\b(?:in|at|near) (?:mumbai|delhi|bengaluru|bangalore|hyderabad|kolkata|pune|ahmedabad|jaipur|lucknow|coimbatore|madurai)\b",
        r"\bstate government\b", r"\bpanchayat\b", r"\bcorporation\b", r"\bmunicipal\b",
        r"\bgcc\b", r"\bgulf\b", r"\bdubai\b", r"\babu dhabi\b",
        r"\bkerala\b", r"\bkarnataka\b", r"\bandhra\b", r"\btelangana\b",
        r"\bmaharashtra\b", r"\bgujarat\b", r"\bup\b", r"\bbihar\b", r"\bpunjab\b",
    ],
    "fact_update": [
        r"\b(?:updates?|updated|latest)\b", r"\bnew figures?\b", r"\bdata shows?\b", r"\bnumbers?\b",
        r"\bpercent\b", r"\b%\b", r"\bmillion\b", r"\bbillion\b", r"\bcrore\b", r"\blakh\b",
        r"\btoll (?:rises?|reaches?|crosses?|now at)\b",
        r"\bdeath toll\b", r"\bcasualties?\b", r"\bkilled\b", r"\binjured\b", r"\bdead\b",
        r"\bcases (?:rise|fall|jump|cross)\b", r"\bsurpasses?\b", r"\brecords?\s+high\b",
        r"\bbreaking\b", r"\blive updates?\b", r"\bdeveloping (?:story|news)\b",
        r"\b\d+(?:[.,]\d+)?\s*(?:%|crore|lakh|million|billion|thousand|points?|basis points?)\b",
    ],
    "investigative_detail": [
        r"\binvestigation\b", r"\binvestigated?\b", r"\bprobe\b", r"\bprobed\b",
        r"\bwhistleblower\b", r"\bleaked? documents?\b", r"\bcourt filing\b",
        r"\bexpos(?:e|ed|es|ing)\b", r"\bexclusive\b", r"\brevealed?\b",
        r"\bscam\b", r"\bscandal\b", r"\bfraud\b", r"\barrest(?:ed|s)?\b",
        r"\braid(?:ed|s)?\b", r"\bsummon(?:ed|s)?\b", r"\bcharged\b",
        r"\ballegedly\b", r"\ballegations?\b", r"\bfir\b", r"\bchargesheet\b",
    ],
    "correction": [
        r"\bcorrection\b", r"\bclarified?\b", r"\bclarification\b",
        r"\bwalked back\b", r"\bupdated after\b", r"\bretract(?:ed|ion)?\b",
        r"\brevised?\b", r"\bamend(?:ed|ment|s)?\b",
    ],
    "opinion_editorial": [
        r"\bopinion\b", r"\beditorial\b", r"\bcolumn\b", r"\bview:\b", r"\bop-?ed\b",
        r"\bcommentary\b", r"\bperspective\b", r"\bguest essay\b",
        r"\bmy take\b", r"\bwhy (?:we|i|you should)\b",
    ],
}

NUMBER_RE = re.compile(
    r"(?:₹|\$|€|£)?\d+(?:,\d+)*(?:\.\d+)?\s*"
    r"(?:crore|lakh|million|billion|trillion|thousand|hours?|days?|weeks?|months?|years?|%|percent)?",
    re.I,
)

STOP_WORDS = {
    "about", "after", "again", "against", "ahead", "among", "around", "before",
    "being", "between", "could", "during", "every", "first", "from", "have",
    "into", "latest", "more", "news", "over", "said", "says", "their", "there",
    "these", "this", "those", "through", "under", "update", "when", "where",
    "which", "while", "with", "would", "will", "your",
}


def _text(story: dict[str, Any]) -> str:
    return f"{story.get('title', '')} {story.get('summary', '')}".strip()


def _tokens(text: str) -> list[str]:
    return [
        token
        for token in re.sub(r"[^a-zA-Z0-9\s-]", " ", text.lower()).split()
        if len(token) >= 4 and token not in STOP_WORDS and not token.isdigit()
    ]


def infer_angle_hints(story: dict[str, Any]) -> list[dict[str, Any]]:
    text = _text(story).lower()
    hints = []

    for angle, patterns in ANGLE_PATTERNS.items():
        matches = [pattern for pattern in patterns if re.search(pattern, text, re.I)]
        if matches:
            hints.append({
                "angle": angle,
                "score": round(min(1.0, 0.45 + 0.22 * len(matches)), 3),
                "matches": matches[:5],
            })

    if not hints:
        hints.append({
            "angle": "base_report",
            "score": 0.35,
            "matches": [],
        })

    return sorted(hints, key=lambda item: (-item["score"], item["angle"]))


def build_story_signals(story: dict[str, Any]) -> dict[str, Any]:
    text = _text(story)
    tokens = _tokens(text)
    token_counts = Counter(tokens)
    numbers = list(dict.fromkeys(match.group(0).strip() for match in NUMBER_RE.finditer(text)))

    return {
        "topicTokens": [token for token, _ in token_counts.most_common(12)],
        "numbers": numbers[:12],
        "angleHints": infer_angle_hints(story),
        "textLength": len(text),
        "hasSummary": bool(story.get("summary")),
        "sourceGroup": story.get("sourceGroup") or story.get("source") or "unknown_source",
    }


def enrich_story(story: dict[str, Any]) -> dict[str, Any]:
    enriched = dict(story)
    enriched.setdefault("sourceGroup", story.get("source") or "unknown_source")
    enriched.setdefault("source", story.get("sourceGroup") or "Unknown source")
    enriched.setdefault("category", story.get("category") or "general")
    enriched.setdefault("language", story.get("language") or "en")
    enriched["storySignals"] = build_story_signals(enriched)
    enriched["angleHints"] = enriched["storySignals"]["angleHints"]
    return enriched


def canonical_story_for_hash(story: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": story.get("id"),
        "title": story.get("title"),
        "summary": story.get("summary"),
        "url": story.get("url"),
        "publishedAt": story.get("publishedAt"),
        "sourceGroup": story.get("sourceGroup"),
        "contentHash": story.get("contentHash"),
        "fetchedForSlots": story.get("fetchedForSlots", []),
        "angleHints": story.get("angleHints", []),
        "topicTokens": story.get("storySignals", {}).get("topicTokens", []),
    }


def compute_snapshot_content_hash(stories: list[dict[str, Any]]) -> str:
    payload = json.dumps(
        [canonical_story_for_hash(story) for story in sorted(stories, key=lambda s: str(s.get("id", "")))],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def build_slot_quality(stories: list[dict[str, Any]], slot_meta: dict[str, Any]) -> dict[str, Any]:
    by_id = {story.get("id"): story for story in stories}
    quality = {}

    for slot in SLOT_ORDER:
        ids = slot_meta.get(slot, {}).get("storyIds", [])
        slot_stories = [by_id[sid] for sid in ids if sid in by_id]
        source_groups = {story.get("sourceGroup") or story.get("source") or "unknown" for story in slot_stories}
        angle_counts = Counter(
            (story.get("angleHints") or [{"angle": "base_report"}])[0]["angle"]
            for story in slot_stories
        )

        quality[slot] = {
            "storyCount": len(slot_stories),
            "sourceGroupCount": len(source_groups),
            "topAngles": [
                {"angle": angle, "count": count}
                for angle, count in angle_counts.most_common(8)
            ],
            "fetchedAt": slot_meta.get(slot, {}).get("fetchedAt", 0),
            "thin": len(slot_stories) < 8 or len(source_groups) < 3,
        }

    return quality


def build_source_diversity(stories: list[dict[str, Any]]) -> dict[str, Any]:
    counts = Counter(story.get("sourceGroup") or story.get("source") or "unknown" for story in stories)
    return {
        "sourceGroupCount": len(counts),
        "topSources": [
            {"sourceGroup": source, "count": count}
            for source, count in counts.most_common(12)
        ],
    }


def optimize_insight_snapshot(snapshot: dict[str, Any], ts: int) -> dict[str, Any]:
    stories = [enrich_story(story) for story in snapshot.get("stories", [])]
    slot_meta = snapshot.get("slotMeta", {})

    optimized = dict(snapshot)
    optimized["schemaVersion"] = 3
    optimized["collectorVersion"] = COLLECTOR_VERSION
    optimized["generatedAt"] = ts
    optimized["fetchedAt"] = snapshot.get("fetchedAt", ts)
    optimized["stories"] = stories
    optimized["slotQuality"] = build_slot_quality(stories, slot_meta)
    optimized["sourceDiversity"] = build_source_diversity(stories)
    optimized["contentHash"] = compute_snapshot_content_hash(stories)

    return optimized
