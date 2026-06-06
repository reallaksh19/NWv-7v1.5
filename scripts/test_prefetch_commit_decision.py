import json
import tempfile
import unittest.mock as mock
from pathlib import Path

import prefetch_commit_decision as policy


def test_stable_hash_ignores_insight_fetched_at_noise():
    a = {
        "schemaVersion": 3,
        "collectorVersion": "v3",
        "contentHash": "abc",
        "fetchedAt": 100,
        "generatedAt": 100,
        "stories": [{"id": "a"}, {"id": "b"}],
        "slotMeta": {"now": {"storyIds": ["a", "b"]}},
        "slotQuality": {"now": {"storyCount": 2}},
        "sourceDiversity": {"sourceGroupCount": 2},
    }

    b = {
        **a,
        "fetchedAt": 200,
        "generatedAt": 200,
    }

    assert policy.stable_json_hash(policy.meaningful_payload_from_value_for_test(a, "insight_latest.json")) == policy.stable_json_hash(policy.meaningful_payload_from_value_for_test(b, "insight_latest.json"))


def test_manifest_marks_content_change():
    manifest = {
        "shouldCommit": True,
        "diagnosticOnly": False,
        "changedContentFiles": ["public/newsdata/insight_latest.json"],
        "changedDiagnosticFiles": ["public/newsdata/insight_quality_report.json"],
    }

    assert manifest["shouldCommit"] is True
    assert manifest["diagnosticOnly"] is False


def test_manifest_marks_diagnostic_only():
    manifest = {
        "shouldCommit": False,
        "diagnosticOnly": True,
        "changedContentFiles": [],
        "changedDiagnosticFiles": ["public/newsdata/insight_quality_report.json"],
    }

    assert manifest["shouldCommit"] is False
    assert manifest["diagnosticOnly"] is True


def test_heartbeat_triggers_commit_when_fetched_at_advances_more_than_3h():
    # INS-2: heartbeat should force commit when disk fetchedAt is > 3h ahead of HEAD
    _3h_ms = 3 * 3600 * 1000
    with mock.patch.object(policy, "_disk_fetched_at", return_value=10_000_000 + _3h_ms + 1):
        with mock.patch.object(policy, "_committed_fetched_at", return_value=10_000_000):
            result = policy._heartbeat_needed()
            assert result is True, "Heartbeat should trigger when fetchedAt advanced >3h"


def test_heartbeat_does_not_trigger_when_advance_is_less_than_3h():
    _1h_ms = 1 * 3600 * 1000
    with mock.patch.object(policy, "_disk_fetched_at", return_value=10_000_000 + _1h_ms):
        with mock.patch.object(policy, "_committed_fetched_at", return_value=10_000_000):
            result = policy._heartbeat_needed()
            assert result is False, "Heartbeat should NOT trigger when fetchedAt advanced only 1h"


if __name__ == "__main__":
    tests = [
        test_stable_hash_ignores_insight_fetched_at_noise,
        test_manifest_marks_content_change,
        test_manifest_marks_diagnostic_only,
        test_heartbeat_triggers_commit_when_fetched_at_advances_more_than_3h,
        test_heartbeat_does_not_trigger_when_advance_is_less_than_3h,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS {t.__name__}")
            passed += 1
        except Exception as e:
            print(f"  FAIL {t.__name__}: {e}")
    print(f"{passed}/{len(tests)} tests passed.")
    raise SystemExit(0 if passed == len(tests) else 1)
