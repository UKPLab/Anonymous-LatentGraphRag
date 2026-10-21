"""BrowseComp grader: template, response extraction, verdict parsing, retries (fake LLM)."""

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

from latentgraphrag.agent import ChatResult
from latentgraphrag.evaluation import GRADER_TEMPLATE, BrowseCompGrader, final_answer_response, parse_verdict


class FakeLLM:
    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.prompts = []

    def chat(self, messages, *, max_tokens, temperature, frequency_penalty):
        self.prompts.append(messages[0]["content"])
        o = self.outputs.pop(0)
        if isinstance(o, Exception):
            raise o
        return ChatResult(text=o)


def test_template_is_the_official_one():
    assert GRADER_TEMPLATE.startswith("Judge whether the following [response] to [question] is correct")
    assert "i.e. if there if there is any inconsistency" in GRADER_TEMPLATE  # the official text's own repetition
    assert "between 0|\\\\%| and 100|\\\\%| from [response]" in GRADER_TEMPLATE
    assert {"{question}", "{response}", "{correct_answer}"} <= {s for s in ("{question}", "{response}",
                                                                            "{correct_answer}") if s in GRADER_TEMPLATE}


def test_final_answer_response():
    assert final_answer_response("bla\nExact Answer: Paris  \nmore\nExact Answer: Rome\ntail") == "Exact Answer: Rome"
    assert final_answer_response("x" * 3000) == "x" * 2000


def test_parse_verdict():
    assert parse_verdict("extracted_final_answer: Rome\nreasoning: ...\ncorrect: **yes**") == (True, "Rome")
    assert parse_verdict("correct: yes\n...\ncorrect: No") == (False, "")
    assert parse_verdict("nothing") == (None, "")


def test_grader_uses_the_final_answer_line_and_retries():
    llm = FakeLLM([RuntimeError("boom"), "no verdict", "extracted_final_answer: Rome\ncorrect: yes"])
    g = BrowseCompGrader(llm, retry_sleep=0)
    v = g.grade("Q?", "long reasoning\nExact Answer: Rome\nextra", "Rome")
    assert v.correct is True and v.extracted == "Rome" and v.score == 1.0
    assert "[response]: Exact Answer: Rome\n" in llm.prompts[-1]
    assert "[correct_answer]: Rome\n" in llm.prompts[-1]


def test_missing_verdict_counts_as_incorrect():
    v = BrowseCompGrader(FakeLLM(["x"] * 4), retry_sleep=0).grade("Q?", "Exact Answer: a", "b")
    assert v.correct is None and v.score == 0.0
