"""Answer grading for MuSiQue and BrowseComp+: the official BrowseComp grader template.

The paper grades the agent's final answer, not its reasoning: the response shown to the grader is
``"Exact Answer: <text after the last 'Exact Answer:' up to the end of that line>"``; an output without
an answer line is graded on its last 2,000 characters. The same model grades at temperature 0 with
reasoning disabled; a missing verdict counts as incorrect.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Optional, Tuple

from ..agent.llm import ChatModel
from ..agent.trajectory import Trajectory

# Verbatim, including the template's own repeated "if there". The paper's grading run read this text
# from source, so the confidence line carries the escaped "\\%" as written here (raw string).
GRADER_TEMPLATE = r"""Judge whether the following [response] to [question] is correct or not based on the precise and unambiguous [correct_answer] below.

[question]: {question}

[response]: {response}

Your judgement must be in the format and criteria specified below:

extracted_final_answer: The final exact answer extracted from the [response]. Put the extracted answer as 'None' if there is no exact, final answer to extract from the response.

[correct_answer]: {correct_answer}

reasoning: Explain why the extracted_final_answer is correct or incorrect based on [correct_answer], focusing only on if there are meaningful differences between [correct_answer] and the extracted_final_answer. Do not comment on any background to the problem, do not attempt to solve the problem, do not argue for any answer different than [correct_answer], focus only on whether the answers match.

correct: Answer 'yes' if extracted_final_answer matches the [correct_answer] given above, or is within a small margin of error for numerical problems. Answer 'no' otherwise, i.e. if there if there is any inconsistency, ambiguity, non-equivalency, or if the extracted answer is incorrect.


confidence: The extracted answer confidence score between 0|\\%| and 100|\\%| from [response]. Put 100 if there is no confidence score available."""

_VERDICT = re.compile(r"correct:\s*\**\s*(yes|no)", re.I)
_EXTRACTED = re.compile(r"extracted_final_answer:\s*(.*)")


def final_answer_response(output: str) -> str:
    """What the grader sees: the final answer line, or the last 2,000 characters without one."""
    k = output.rfind("Exact Answer:")
    return ("Exact Answer: " + output[k + len("Exact Answer:"):].split("\n", 1)[0].strip()) if k >= 0 else output[-2000:]


def tail_response(output: str, n: int = 20000) -> str:
    """Earlier grading variant: the last ``n`` characters of the output (not used for the paper's tables)."""
    return output[-n:]


def parse_verdict(text: str) -> Tuple[Optional[bool], str]:
    """``(correct, extracted answer)`` from a grader output; ``correct`` is ``None`` without a verdict line."""
    m = _VERDICT.findall(text)
    x = _EXTRACTED.findall(text)
    return ((m[-1].lower() == "yes") if m else None), (x[0].strip() if x else "")


@dataclass
class Verdict:
    """A grading result. ``correct`` is ``None`` when the grader gave no verdict (counted as incorrect)."""

    correct: Optional[bool]
    extracted: str
    raw: str
    prompt: str

    @property
    def score(self) -> float:
        return 1.0 if self.correct else 0.0


class BrowseCompGrader:
    """The official BrowseComp grader, applied as in the paper.

    Args:
        llm: Grader model (paper: the controller model, Qwen3.5-122B-A10B).
        template: Grader template (default: :data:`GRADER_TEMPLATE`).
        response: ``"final_line"`` (paper) or ``"tail"`` (last 20,000 characters of the output).
        max_tokens: Generation cap of the grader (paper: 1,024).
        attempts: Calls before giving up on a missing verdict (paper: 4).
        retry_sleep: Seconds between attempts after an error (paper: 5).
    """

    def __init__(self, llm: ChatModel, template: str = GRADER_TEMPLATE, response: str = "final_line",
                 max_tokens: int = 1024, attempts: int = 4, retry_sleep: float = 5.0) -> None:
        if response not in ("final_line", "tail"):
            raise ValueError("response must be 'final_line' or 'tail'")
        self.llm = llm
        self.template = template
        self.response = response
        self.max_tokens = max_tokens
        self.attempts = attempts
        self.retry_sleep = retry_sleep

    def prompt(self, question: str, output: str, gold: str) -> str:
        shown = final_answer_response(output) if self.response == "final_line" else tail_response(output)
        return self.template.format(question=question, response=shown, correct_answer=gold)

    def grade(self, question: str, output: str, gold: str) -> Verdict:
        """Grade an agent output (its last assistant message) against the gold answer."""
        p = self.prompt(question, output, gold)
        for _ in range(self.attempts):
            try:
                res = self.llm.chat([{"role": "user", "content": p}], max_tokens=self.max_tokens, temperature=0.0,
                                    frequency_penalty=0.0)
                text = (res.text or "").strip()
                correct, extracted = parse_verdict(text)
                if correct is not None:
                    return Verdict(correct=correct, extracted=extracted, raw=text, prompt=p)
            except Exception:
                time.sleep(self.retry_sleep)
        return Verdict(correct=None, extracted="", raw="", prompt=p)

    def grade_trajectory(self, trajectory: Trajectory, gold: str) -> Verdict:
        return self.grade(trajectory.question, trajectory.output, gold)
