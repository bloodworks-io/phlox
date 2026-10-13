"""Tests for condition fuzzy-matching and prompt constraints in summarisation."""

from server.nlp_tools.summarisation import (
    _create_condition_prompt_with_constraints,
    _find_best_condition_match,
)


class TestFindBestConditionMatch:
    def test_exact_match_ignoring_case_and_padding(self):
        assert _find_best_condition_match("  Diabetes ", ["diabetes"]) == "diabetes"

    def test_close_typo_matches_within_threshold(self):
        # Levenshtein similarity "dibetes"/"diabetes" = 1 - 1/8 = 0.875
        assert _find_best_condition_match("Dibetes", ["diabetes"]) == "diabetes"

    def test_no_match_returns_none(self):
        assert _find_best_condition_match("Heart failure", ["Asthma"]) is None

    def test_unrelated_words_score_below_threshold(self):
        # Containment and similarity are both low for sibling conditions
        result = _find_best_condition_match(
            "Iron deficiency anaemia", ["anaemia of chronic disease"]
        )
        assert result is None

    def test_picks_the_best_of_multiple_candidates(self):
        existing = ["diabetes", "diabetes insipidus"]
        assert _find_best_condition_match("diabetes insipidus", existing) == "diabetes insipidus"

    def test_empty_inputs_return_none(self):
        assert _find_best_condition_match("", ["diabetes"]) is None
        assert _find_best_condition_match("Diabetes", []) is None

    def test_stricter_threshold_rejects_marginal_matches(self):
        assert _find_best_condition_match("Dibetes", ["diabetes"]) == "diabetes"
        assert _find_best_condition_match("Dibetes", ["diabetes"], threshold=0.95) is None

    def test_returns_the_original_casing_of_the_stored_condition(self):
        assert _find_best_condition_match("asthma", ["Asthma"]) == "Asthma"


class TestCreateConditionPromptWithConstraints:
    def test_fallback_prompts_without_existing_conditions(self):
        system, user = _create_condition_prompt_with_constraints([], "note text")
        assert "condition_name" in system
        assert "is_new_condition" not in system
        assert "note text" in user

    def test_constrained_prompts_list_existing_conditions(self):
        system, user = _create_condition_prompt_with_constraints(
            ["Asthma", "Diabetes"], "note text"
        )
        assert "is_new_condition" in system
        assert "- Asthma" in user
        assert "- Diabetes" in user
        assert "note text" in user

    def test_lists_at_most_twenty_conditions(self):
        conditions = [f"cond{i:02d}" for i in range(1, 26)]
        _, user = _create_condition_prompt_with_constraints(conditions, "note")
        assert "- cond01" in user
        assert "- cond20" in user
        assert "- cond21" not in user
        assert "(and 5 more)" in user

    def test_no_more_suffix_at_exactly_twenty_conditions(self):
        conditions = [f"cond{i:02d}" for i in range(1, 21)]
        _, user = _create_condition_prompt_with_constraints(conditions, "note")
        assert "- cond20" in user
        assert "more)" not in user
