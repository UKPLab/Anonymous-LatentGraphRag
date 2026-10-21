"""Retrieve-then-read: a fixed reader answers from the top ten documents of a retriever, without search.

The reader is the agent's controller model with the read-only prompt; its first turn is identical to
the agent's (the seed as numbered documents, then the question). A turn without an ``Exact Answer:``
line receives one follow-up request for the answer line. Context fitting is off, as in the paper.
"""

from __future__ import annotations

from typing import Optional

from ..agent.llm import ChatModel
from ..agent.react import CONTEXT_LENGTH, FOLLOWUP_MAX_TOKENS, FREQUENCY_PENALTY, MAX_TOKENS, ReActAgent
from ..agent.seed import Seed
from ..agent.trajectory import Trajectory


class Reader:
    """Read-only answering from a seed.

    Args:
        llm: Reader model (paper: Qwen3.5-122B-A10B).
        max_tokens: Generation cap (paper: 8,192).
        followup_max_tokens: Cap of the follow-up request (paper: 512).
        frequency_penalty: Paper: 0.4.
        context_length: Server context window (paper: 65,536).
        retry_sleep: Seconds between retries after a non-context error.
    """

    def __init__(self, llm: ChatModel, max_tokens: int = MAX_TOKENS, followup_max_tokens: int = FOLLOWUP_MAX_TOKENS,
                 frequency_penalty: float = FREQUENCY_PENALTY, context_length: int = CONTEXT_LENGTH,
                 retry_sleep: float = 3.0) -> None:
        self._agent = ReActAgent(llm, search_tool=None, max_searches=0, policy="read_only", max_tokens=max_tokens,
                                 followup_max_tokens=followup_max_tokens, frequency_penalty=frequency_penalty,
                                 context_length=context_length, fit_context=False, retry_sleep=retry_sleep)

    @property
    def system_prompt(self) -> str:
        return self._agent.system_prompt

    def read(self, question: str, seed: Optional[Seed] = None) -> Trajectory:
        """Answer ``question`` from ``seed`` (top-10 documents); returns a one-step trajectory."""
        return self._agent.run(question, seed)
