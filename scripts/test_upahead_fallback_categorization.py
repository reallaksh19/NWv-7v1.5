import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from up_ahead import classify_fallback_category, should_suppress_fallback_item


def test_audit_category_cases_match_python_fallback():
    cases = [
        ("Leo releasing on Oct 25 in theaters", "movie"),
        ("Standup Comedy in Chennai this weekend", "event"),
        ("Heavy rain alert for Tamil Nadu", "alert"),
        ("Road blockage at Anna Salai due to protest", "civic"),
        ("Discount sale at Phoenix Mall", "shopping"),
    ]

    for title, expected_category in cases:
        assert classify_fallback_category(title) == expected_category


def test_schedule_signal_words_do_not_suppress_movie_releases():
    title = "Leo locks release date on Oct 25; trailer launches today"

    assert classify_fallback_category(title) == "movie"
    assert should_suppress_fallback_item(title, "movie") is False
