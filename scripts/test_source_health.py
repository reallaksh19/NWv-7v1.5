"""Tests for the source_health merge logic."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from source_health import (
    merge_source_health,
    apply_source_health,
    zero_item_warnings,
    ZERO_ITEM_WARN_STREAK,
)


def test_first_run_with_items_marks_ok():
    rec = merge_source_health(None, {'ok': True, 'items': 5, 'feedUrl': 'http://x'}, ts=1000)
    assert rec['status'] == 'ok'
    assert rec['ok'] is True
    assert rec['items'] == 5
    assert rec['zeroItemRuns'] == 0
    assert rec['lastNonZeroSuccess'] == 1000
    assert rec['lastSuccess'] == 1000
    assert rec['lastCheckedAt'] == 1000
    assert rec['feedUrl'] == 'http://x'


def test_zero_items_increments_streak_and_marks_warn():
    rec1 = merge_source_health(None, {'ok': True, 'items': 0}, ts=1000)
    assert rec1['status'] == 'warn'
    assert rec1['zeroItemRuns'] == 1
    assert rec1['lastZeroItemAt'] == 1000
    assert 'lastNonZeroSuccess' not in rec1

    rec2 = merge_source_health(rec1, {'ok': True, 'items': 0}, ts=2000)
    assert rec2['zeroItemRuns'] == 2
    assert rec2['lastZeroItemAt'] == 2000


def test_recovery_from_zero_streak_resets_counter():
    rec1 = merge_source_health(None, {'ok': True, 'items': 0}, ts=1000)
    rec2 = merge_source_health(rec1, {'ok': True, 'items': 0}, ts=2000)
    rec3 = merge_source_health(rec2, {'ok': True, 'items': 7}, ts=3000)
    assert rec3['status'] == 'ok'
    assert rec3['zeroItemRuns'] == 0
    assert rec3['lastNonZeroSuccess'] == 3000
    assert rec3['lastZeroItemAt'] == 2000  # preserved from earlier streak


def test_exception_marks_fail_and_increments_streak():
    rec = merge_source_health(
        {'lastNonZeroSuccess': 500},
        {'ok': False, 'items': 0, 'error': 'connection timeout'},
        ts=1000,
    )
    assert rec['status'] == 'fail'
    assert rec['ok'] is False
    assert rec['zeroItemRuns'] == 1
    assert rec['lastFailure'] == 1000
    assert rec['lastError'] == 'connection timeout'
    assert rec['lastNonZeroSuccess'] == 500  # preserved


def test_zero_item_warnings_triggers_at_threshold():
    sources = {
        'fine':  {'zeroItemRuns': 0},
        'noisy': {'zeroItemRuns': ZERO_ITEM_WARN_STREAK - 1},
        'silent': {'zeroItemRuns': ZERO_ITEM_WARN_STREAK, 'lastZeroItemAt': 12345},
        'dead':   {'zeroItemRuns': 10, 'lastZeroItemAt': 99999},
    }
    warnings = zero_item_warnings(sources)
    assert len(warnings) == 2
    assert any('silent' in w for w in warnings)
    assert any('dead' in w and '10' in w for w in warnings)


def test_apply_source_health_merges_batch():
    existing = {
        'a': {'zeroItemRuns': 2, 'lastZeroItemAt': 100},
        'b': {'zeroItemRuns': 0, 'lastNonZeroSuccess': 200},
    }
    new = {
        'a': {'ok': True, 'items': 0},
        'b': {'ok': True, 'items': 4},
        'c': {'ok': False, 'items': 0, 'error': 'boom'},
    }
    merged = apply_source_health(existing, new, ts=3000)
    assert merged['a']['zeroItemRuns'] == 3
    assert merged['a']['lastZeroItemAt'] == 3000
    assert merged['b']['zeroItemRuns'] == 0
    assert merged['b']['lastNonZeroSuccess'] == 3000
    assert merged['c']['status'] == 'fail'
    assert merged['c']['lastError'] == 'boom'
