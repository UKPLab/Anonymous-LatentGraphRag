"""Answer and retrieval metrics on hand-computed cases."""

import pathlib
import sys
import types

_ROOT = pathlib.Path(__file__).resolve().parents[1]
try:
    import latentgraphrag  # noqa: F401
except Exception:  # pragma: no cover
    _pkg = types.ModuleType("latentgraphrag")
    _pkg.__path__ = [str(_ROOT / "latentgraphrag")]
    sys.modules["latentgraphrag"] = _pkg

import pytest

from latentgraphrag.evaluation import (final_answer_line, final_answer_text, loose_final, loose_list_recall,
                                       recall_at_k, retrieval_metrics)


def test_loose_list_recall_items():
    assert loose_list_recall("Paris and Berlin", "Paris; Berlin; Rome") == pytest.approx(2 / 3)
    assert loose_list_recall("anything", "") == 0.0
    assert loose_list_recall("Answer: PARIS!", ["paris", "rome"]) == 0.5  # list gold joined with '; '


def test_loose_list_recall_key_value_items():
    assert loose_list_recall("France: Paris", "France: Paris") == 1.0
    assert loose_list_recall("Paris", "France: Paris") == 0.0  # key tokens must occur too


def test_loose_list_recall_uses_substring_token_tests():
    # token occurrence is a substring test on the normalized response, as in the paper
    assert loose_list_recall("supercars", "car") == 1.0


def test_loose_final_reads_after_the_last_answer_line():
    out = "Berlin was considered.\nExact Answer: Paris\nRome"
    assert final_answer_text(out) == "Paris\nRome"
    assert loose_final(out, "Paris; Rome; Berlin") == pytest.approx(2 / 3)
    assert loose_list_recall(out, "Paris; Rome; Berlin") == 1.0
    assert final_answer_text("no line") == "no line"
    assert final_answer_line(out) == "Paris"


def test_recall_at_k_sets_and_groups():
    assert recall_at_k([1, 2, 3, 4], {2, 4, 9}, 2) == pytest.approx(1 / 3)
    assert recall_at_k([1, 2, 3], {"g1": {2, 7}, "g2": {8}}, 3) == 0.5


def test_retrieval_metrics_skip_questions_without_gold():
    m = retrieval_metrics([[1, 2], [3, 4], [5]], [{1}, set(), {9}], ks=(1, 2))
    assert m == {"recall@1": 0.5, "recall@2": 0.5, "queries_with_gold": 2}
