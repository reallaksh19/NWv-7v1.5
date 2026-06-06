"""Tests for breaking_news_core (server-side breaking detection)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from breaking_news_core import (
    H_MS,
    build_breaking_items,
    cluster_stories,
    decide_breaking,
    severity_hits,
    significant_tokens,
)

NOW = 1_700_000_000_000


def _story(title, source_group, age_min, summary=''):
    return {
        'title': title,
        'summary': summary,
        'sourceGroup': source_group,
        'source': source_group,
        'publishedAt': NOW - age_min * 60_000,
    }


def test_significant_tokens_drops_stopwords_and_short_words():
    toks = significant_tokens('The latest update on Iran missile attack')
    assert 'the' not in toks
    assert 'latest' not in toks  # stopword
    assert 'iran' in toks
    assert 'missile' in toks


def test_severity_hits_detects_conflict_terms():
    assert 'missile' in severity_hits('Iran missile strike on base')
    assert 'killed' in severity_hits('Seven killed in bus crash')
    assert severity_hits('Local council debates parking policy') == []


def test_clustering_groups_same_story_across_sources():
    stories = [
        _story('Iran missile strike hits US airbase in Gulf', 'hindu', 20),
        _story('US airbase in Gulf hit by Iran missile strike', 'bbc', 25),
        _story('Local school wins state quiz championship', 'dtnext', 30),
    ]
    clusters = cluster_stories(stories)
    sizes = sorted(len(c) for c in clusters)
    assert sizes == [1, 2]  # the two missile stories cluster, the quiz stands alone


def test_multi_source_velocity_triggers_breaking():
    cluster = [
        _story('Major earthquake hits region, buildings collapse', 'hindu', 15),
        _story('Earthquake strikes region as buildings collapse', 'bbc', 20),
    ]
    verdict = decide_breaking(cluster, NOW)
    assert verdict['isBreaking'] is True
    assert 'multi_source_velocity' in verdict['reasons']
    assert verdict['sourceCount'] == 2


def test_severity_lexicon_triggers_single_source_breaking():
    cluster = [_story('Powerful earthquake kills dozens in coastal city', 'hindu', 30)]
    verdict = decide_breaking(cluster, NOW)
    assert verdict['isBreaking'] is True
    assert 'severity_lexicon' in verdict['reasons']


def test_god_of_war_is_not_treated_as_breaking_war():
    # Single-source entertainment reveal containing the word "War" must NOT trip
    # the severity lexicon (entertainment guard), nor velocity (one source).
    cluster = [_story(
        'God of War Laufey Revealed With Extended Gameplay Trailer', 'gadgets360', 30,
        summary='God of War Laufey was revealed at State of Play',
    )]
    verdict = decide_breaking(cluster, NOW)
    assert verdict['isBreaking'] is False


def test_old_severity_story_does_not_trigger():
    cluster = [_story('Missile strike reported near border', 'hindu', 10 * 60)]  # 10h old
    verdict = decide_breaking(cluster, NOW)
    assert 'severity_lexicon' not in verdict['reasons']


def test_build_breaking_items_ranks_and_caps():
    stories = [
        _story('Major earthquake kills dozens as buildings collapse in city', 'hindu', 10),
        _story('Earthquake kills dozens, buildings collapse across city', 'bbc', 12),
        _story('City council approves new park budget', 'dtnext', 40),
        _story('God of War Laufey trailer revealed at State of Play', 'gadgets360', 15),
    ]
    breaking = build_breaking_items(stories, NOW)
    titles = [b['title'].lower() for b in breaking]
    assert any('earthquake' in t for t in titles)
    assert all('god of war' not in t for t in titles)       # guarded out
    assert all('park budget' not in t for t in titles)      # not breaking
    # earthquake cluster has both velocity + severity -> top of list
    assert 'earthquake' in breaking[0]['title'].lower()
    assert breaking[0]['isBreaking'] is True
    assert breaking[0]['sourceCount'] >= 2


if __name__ == '__main__':
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith('test_') and callable(fn):
            try:
                fn()
                print(f'  PASS {name}')
            except AssertionError as exc:
                failures += 1
                print(f'  FAIL {name}: {exc}')
    if failures:
        print(f'{failures} test(s) failed')
        sys.exit(1)
    print('All breaking_news_core tests passed.')
