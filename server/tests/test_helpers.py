"""Tests for the pure helpers in server.utils.helpers."""

from datetime import datetime

import pytest

from server.utils.helpers import (
    calculate_age,
    clean_think_tags,
    format_name,
    split_name,
)


class TestCalculateAge:
    def test_birthday_not_yet_reached_this_year(self):
        assert calculate_age("1990-06-15", "2026-06-14") == 35

    def test_birthday_on_encounter_date_counts(self):
        assert calculate_age("1990-06-15", "2026-06-15") == 36

    def test_birthday_already_passed_this_year(self):
        assert calculate_age("1990-06-15", "2026-10-12") == 36

    def test_leap_year_dob_before_feb_29(self):
        # Feb 28 is before the Feb 29 birthday, so the year doesn't count yet
        assert calculate_age("2000-02-29", "2024-02-28") == 23

    def test_leap_year_dob_after_feb_29(self):
        assert calculate_age("2000-02-29", "2024-03-01") == 24

    def test_uses_today_when_no_encounter_date(self):
        # Jan 1 has always passed by any point later in the year
        age = calculate_age("1900-01-01")
        assert age == datetime.today().year - 1900

    def test_missing_dob_raises(self):
        with pytest.raises(ValueError, match="DOB is missing"):
            calculate_age("")

    def test_invalid_dob_format_raises(self):
        with pytest.raises(ValueError, match="Invalid date format"):
            calculate_age("15/06/1990", "2026-01-01")

    def test_invalid_encounter_date_format_raises(self):
        with pytest.raises(ValueError, match="Invalid date format"):
            calculate_age("1990-06-15", "yesterday")


class TestFormatName:
    def test_joins_last_and_first(self):
        assert format_name("Jane", "Doe") == "Doe, Jane"

    def test_strips_whitespace(self):
        assert format_name(" Jane ", " Doe ") == "Doe, Jane"

    def test_last_only(self):
        assert format_name(None, "Doe") == "Doe"

    def test_first_only(self):
        assert format_name("Jane", None) == "Jane"

    def test_both_missing_is_blank(self):
        assert format_name(None, None) == ""


class TestSplitName:
    def test_legacy_format_last_comma_first(self):
        assert split_name("Doe, Jane") == ("Jane", "Doe")

    def test_plain_first_last(self):
        assert split_name("Jane Doe") == ("Jane", "Doe")

    def test_middle_names_stay_with_the_first(self):
        assert split_name("Jane Marie Doe") == ("Jane Marie", "Doe")

    def test_bare_name_is_treated_as_last(self):
        assert split_name("Cher") == ("", "Cher")

    def test_empty_inputs(self):
        assert split_name(None) == ("", "")
        assert split_name("   ") == ("", "")

    def test_roundtrips_format_name(self):
        first, last = split_name("Doe, Jane")
        assert format_name(first, last) == "Doe, Jane"


class TestCleanThinkTags:
    def test_plain_string_passes_through(self):
        assert clean_think_tags("no tags here") == "no tags here"

    @pytest.mark.parametrize(
        ("open_tag", "close_tag"),
        [
            ("<think>", "</think>"),
            ("<thinking>", "</thinking>"),
            ("<reason>", "</reason>"),
            ("<reasoning>", "</reasoning>"),
            ("<thought>", "</thought>"),
            ("<Thought>", "</Thought>"),
            ("<|begin_of_thought|>", "<|end_of_thought|>"),
        ],
    )
    def test_removes_every_recognised_tag_variant(self, open_tag, close_tag):
        text = f"before{open_tag}reasoning{close_tag}after"
        assert clean_think_tags(text) == "beforeafter"

    @pytest.mark.xfail(
        reason="_remove_think_tags computes pos via text.find('>', end) + 1, "
        "but the ◁think▷ close tag contains no ASCII '>', so pos wraps to 0 "
        "and the text before the block is duplicated",
        strict=True,
    )
    def test_removes_unicode_think_variant(self):
        text = "before◁think▷reasoning◁/think▷after"
        assert clean_think_tags(text) == "beforeafter"

    def test_unclosed_tag_drops_the_rest_of_the_string(self):
        assert clean_think_tags("keep<think>streaming partial") == "keep"

    def test_removes_multiple_blocks_in_one_string(self):
        text = "a<think>one</think>b<think>two</think>c"
        assert clean_think_tags(text) == "abc"

    def test_cleans_and_strips_message_contents(self):
        messages = [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "<think>plan</think>\nanswer\n"},
        ]
        cleaned = clean_think_tags(messages)
        assert cleaned[0]["content"] == "hi"
        assert cleaned[1]["content"] == "answer"

    def test_keeps_non_string_content_untouched(self):
        # Vision-style messages carry content as a list of parts
        vision = [{"role": "user", "content": [{"type": "text", "text": "hi"}]}]
        assert clean_think_tags(vision) == vision

    def test_keeps_messages_without_content_key(self):
        messages = [{"role": "assistant"}]
        assert clean_think_tags(messages) == messages

    def test_does_not_mutate_the_input(self):
        original = {"role": "assistant", "content": "<think>x</think>y"}
        snapshot = dict(original)
        clean_think_tags([original])
        assert original == snapshot
