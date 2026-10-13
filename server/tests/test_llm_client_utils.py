"""Tests for the LLM client JSON utilities."""

import json

from server.llm_client.utils import ensure_system_messages_first, repair_json


class TestRepairJson:
    def test_empty_input_returns_empty_string(self):
        assert repair_json("") == ""
        assert repair_json(None) == ""

    def test_valid_json_passes_through(self):
        result = repair_json('{"a": 1}')
        assert json.loads(result) == {"a": 1}

    def test_strips_think_tags_before_parsing(self):
        result = repair_json('<think>chain of thought</think>\n{"a": 1}')
        assert json.loads(result) == {"a": 1}

    def test_repairs_single_quotes_and_trailing_commas(self):
        result = repair_json("{'a': 1,}")
        assert json.loads(result) == {"a": 1}

    def test_repairs_wrapped_json_from_code_fences(self):
        result = repair_json('```json\n{"a": 1}\n```')
        assert json.loads(result) == {"a": 1}


class TestEnsureSystemMessagesFirst:
    def test_leading_system_messages_are_kept_in_order(self):
        messages = [
            {"role": "system", "content": "s1"},
            {"role": "system", "content": "s2"},
            {"role": "user", "content": "u"},
            {"role": "assistant", "content": "a"},
        ]
        assert ensure_system_messages_first(messages) == messages

    def test_drops_system_messages_after_the_first_non_system_message(self):
        messages = [
            {"role": "user", "content": "u"},
            {"role": "system", "content": "late"},
            {"role": "assistant", "content": "a"},
        ]
        result = ensure_system_messages_first(messages)
        assert result == [
            {"role": "user", "content": "u"},
            {"role": "assistant", "content": "a"},
        ]

    def test_keeps_early_systems_but_drops_later_ones(self):
        messages = [
            {"role": "system", "content": "s1"},
            {"role": "user", "content": "u1"},
            {"role": "system", "content": "s2"},
            {"role": "user", "content": "u2"},
        ]
        result = ensure_system_messages_first(messages)
        assert [m["content"] for m in result] == ["s1", "u1", "u2"]

    def test_no_system_messages_is_unchanged(self):
        messages = [
            {"role": "user", "content": "u"},
            {"role": "assistant", "content": "a"},
        ]
        assert ensure_system_messages_first(messages) == messages

    def test_empty_list(self):
        assert ensure_system_messages_first([]) == []
