"""
breaking_news_core.py — pure, network-free breaking-news detection.

Computed server-side (in the workflow) where the cross-source view is clean and
there are no CORS limits, so the browser can *trust* these flags instead of
recomputing them from a thin client-side window (which almost never fires on
snapshot data because of its < 60-min, multi-source-within-session gate).

A clustered story is flagged "breaking" when EITHER:
  (A) multi-source velocity — >= MIN_SOURCES distinct source groups report the
      same story within VELOCITY_WINDOW_MS, OR
  (B) severity lexicon — a recent story (<= SEVERITY_MAX_AGE_MS old) whose text
      matches a high-severity term (killed / strike / missile / earthquake / …).

Trigger (B) is guarded against entertainment franchise false-positives so a game
reveal like "God of War" is not mistaken for an actual war (see ENTERTAINMENT_GUARD).

Kept import-light and deterministic so it can be unit-tested without network.
"""
import re

H_MS = 3_600_000

# ── Tunables ──────────────────────────────────────────────────────────────────
MIN_SOURCES = 2                        # distinct source groups for velocity trigger
VELOCITY_WINDOW_MS = 90 * 60 * 1000    # co-reporting must fall within 90 min
SEVERITY_MAX_AGE_MS = 6 * H_MS         # severity trigger only for stories < 6 h old
SHARED_TOKEN_THRESHOLD = 3             # min shared significant tokens to cluster
MAX_BREAKING = 8                       # cap emitted breaking items

SEVERITY_TERMS = [
    'killed', 'dead', 'death toll', 'casualt', 'injured', 'wounded',
    'strike', 'airstrike', 'missile', 'drone attack', 'attack', 'explosion',
    'blast', 'bombing', 'shooting', 'gunman', 'hostage',
    'earthquake', 'tsunami', 'cyclone', 'hurricane', 'flood', 'wildfire', 'landslide',
    'evacuat', 'state of emergency', 'lockdown', 'outbreak', 'pandemic',
    'invasion', 'ceasefire', 'coup', 'assassinat', ' war ',
    'resigns', 'resignation', 'impeach', 'verdict', 'arrested',
    'crash', 'derail', 'collapse',
    'recession', 'market crash', 'default', 'bankrupt',
]

STOPWORDS = {
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
    'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'to', 'was', 'were',
    'will', 'with', 'after', 'over', 'amid', 'says', 'say', 'new', 'live', 'latest',
    'update', 'updates', 'breaking', 'report', 'reports', 'watch', 'video', 'news',
}

# 'war' is a severity signal but also appears in entertainment IP titles
# ("God of War", "Call of Duty", "State of Play"). Guard that false-positive class.
ENTERTAINMENT_GUARD = re.compile(
    r'\b(god of war|call of duty|state of play|gameplay|trailer|teaser|'
    r'box office|web series|season \d|episode \d|streaming|ott release)\b',
    re.IGNORECASE,
)


# ── Text helpers ──────────────────────────────────────────────────────────────
def normalize_title(title):
    text = (title or '').lower()
    text = re.sub(r'[^a-z0-9 ]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def significant_tokens(title):
    return [w for w in normalize_title(title).split(' ')
            if len(w) > 2 and w not in STOPWORDS]


def severity_hits(text):
    # Pad so the ' war ' (space-bounded) term can match at string edges too.
    low = f' {(text or "").lower()} '
    return [term.strip() for term in SEVERITY_TERMS if term in low]


def _distinct_sources(items):
    return {
        str(item.get('sourceGroup') or item.get('source') or '').strip().lower()
        for item in items
        if (item.get('sourceGroup') or item.get('source'))
    } - {''}


# ── Clustering ────────────────────────────────────────────────────────────────
def cluster_stories(stories):
    """Greedy single-pass clustering by shared significant title tokens.

    New stories are compared against each cluster's *seed* tokens (the first
    member) rather than a growing union, which keeps clusters tight and avoids
    runaway over-merging.
    """
    clusters = []  # each: {'seed': [tokens], 'items': [story, ...]}
    for story in stories:
        toks = set(significant_tokens(story.get('title', '')))
        placed = False
        for cluster in clusters:
            if len(set(cluster['seed']) & toks) >= SHARED_TOKEN_THRESHOLD:
                cluster['items'].append(story)
                placed = True
                break
        if not placed:
            clusters.append({'seed': list(toks), 'items': [story]})
    return [cluster['items'] for cluster in clusters]


# ── Verdict ───────────────────────────────────────────────────────────────────
def decide_breaking(cluster, now_ms):
    items = sorted(cluster, key=lambda x: x.get('publishedAt', 0), reverse=True)
    rep = items[0]
    text = f"{rep.get('title', '')} {rep.get('summary', '')}"

    pub_times = [i.get('publishedAt', 0) for i in items if i.get('publishedAt')]
    first_seen = min(pub_times) if pub_times else now_ms
    last_seen = max(pub_times) if pub_times else now_ms
    age_ms = max(0, now_ms - last_seen)

    sources = _distinct_sources(items)
    source_count = max(len(sources), 1)

    reasons = []
    score = 0.0

    # Trigger A — multi-source velocity
    span_ms = last_seen - first_seen if last_seen > first_seen else 0
    if source_count >= MIN_SOURCES and span_ms <= VELOCITY_WINDOW_MS:
        reasons.append('multi_source_velocity')
        score += min(source_count, 5) * 1.0

    # Trigger B — severity lexicon (recent + not an entertainment title)
    hits = severity_hits(text)
    if hits and age_ms <= SEVERITY_MAX_AGE_MS and not ENTERTAINMENT_GUARD.search(text):
        reasons.append('severity_lexicon')
        score += min(len(hits), 4) * 1.5

    # Recency bonus — newer stories rank higher within the breaking set.
    score += max(0.0, 1.0 - (age_ms / (12 * H_MS)))

    return {
        'isBreaking': bool(reasons),
        'breakingScore': round(score, 3),
        'reasons': reasons,
        'sourceCount': source_count,
        'sources': sorted(sources),
        'firstSeen': first_seen,
    }


def build_breaking_items(stories, now_ms):
    """Cluster -> flag -> emit a ranked, capped list of breaking items."""
    breaking = []
    for cluster in cluster_stories(stories):
        verdict = decide_breaking(cluster, now_ms)
        if not verdict['isBreaking']:
            continue
        rep = sorted(cluster, key=lambda x: x.get('publishedAt', 0), reverse=True)[0]
        item = dict(rep)
        item.update({
            'isBreaking': True,
            'breakingScore': verdict['breakingScore'],
            'breakingReasons': verdict['reasons'],
            'sourceCount': verdict['sourceCount'],
            'allSources': verdict['sources'],
            'firstSeen': verdict['firstSeen'],
        })
        breaking.append(item)

    breaking.sort(
        key=lambda x: (x.get('breakingScore', 0), x.get('publishedAt', 0)),
        reverse=True,
    )
    return breaking[:MAX_BREAKING]
