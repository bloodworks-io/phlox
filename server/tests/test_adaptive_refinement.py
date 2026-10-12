"""Tests for adaptive-refinement change-ratio logic."""

import pytest

from server.nlp_tools.adaptive_refinement import calculate_content_change_ratio


class TestCalculateContentChangeRatio:
    def test_both_empty_is_no_change(self):
        assert calculate_content_change_ratio("", "") == 0.0

    def test_one_side_empty_is_full_change(self):
        assert calculate_content_change_ratio("", "new content") == 1.0
        assert calculate_content_change_ratio("old content", "") == 1.0

    def test_identical_content_is_no_change(self):
        assert calculate_content_change_ratio("same", "same") == 0.0

    def test_completely_different_content_is_full_change(self):
        assert calculate_content_change_ratio("aaaa", "bbbb") == 1.0

    def test_partial_change_follows_levenshtein_ratio(self):
        # kitten -> sitting has edit distance 3 over length 7
        assert calculate_content_change_ratio("kitten", "sitting") == pytest.approx(
            3 / 7
        )

    def test_ratio_is_symmetric(self):
        a, b = "The patient presents with fatigue.", "The patient presents with tiredness."
        assert calculate_content_change_ratio(a, b) == pytest.approx(
            calculate_content_change_ratio(b, a)
        )

    def test_small_edits_stay_below_the_default_threshold(self):
        # The default trigger threshold is 0.4; a one-word tweak is under it
        ratio = calculate_content_change_ratio(
            "Patient reports chest pain on exertion.",
            "Patient reports chest pain at rest.",
        )
        assert ratio < 0.4
