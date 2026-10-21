"""The record of one agent episode, serializable to the paper's run format and to the website traces."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from .seed import Seed


@dataclass
class Step:
    """One agent turn.

    Args:
        index: Position in the episode (0-based).
        assistant: The full assistant output of the turn, including a forced action if one was requested.
        action: ``"search"`` or ``"answer"``.
        finish: Finish reason of the turn's main call.
        forced: ``"<reason>:<first 300 chars of the forced action>"`` when a follow-up was requested,
            ``"followup_failed"`` when it failed, else empty.
        max_tokens_cut: The reduced ``max_tokens`` the turn was retried with after a context error (0: none).
        context_shrink: Shrink level applied to earlier search results to fit the context (0–4).
        gen_error: The generation error when the turn produced no text.
        search_query: The query of a search turn.
        retrieved: The documents shown to the agent.
        retrieved_ids: Their document ids.
        top_positions: Logged top of the live query ranking (index positions).
        top_scores: Their scores.
    """

    index: int
    assistant: str
    action: str = "answer"
    finish: str = ""
    forced: str = ""
    max_tokens_cut: int = 0
    context_shrink: int = 0
    gen_error: str = ""
    search_query: Optional[str] = None
    retrieved: List[str] = field(default_factory=list)
    retrieved_ids: List[Any] = field(default_factory=list)
    top_positions: List[int] = field(default_factory=list)
    top_scores: List[float] = field(default_factory=list)


@dataclass
class Trajectory:
    """A complete episode.

    Args:
        question: The question.
        system_prompt: The system prompt used.
        seed: The initial evidence.
        steps: Every turn.
        output: The last assistant output (what the grader and loose recall read).
        final_answer: Text after the last ``Exact Answer:`` up to the end of the output, or the whole
            output if there is no answer line.
        tool_calls: Searches the agent issued (the seed is not counted).
        tokens_in: Agent input tokens over all calls, follow-ups included.
        tokens_out: Agent output tokens over all calls.
        policy: Prompt policy name.
        seed_placement: ``"documents"`` (first user turn) or ``"search_turn"`` (simulated first search).
    """

    question: str
    system_prompt: str
    seed: Seed
    steps: List[Step]
    output: str
    final_answer: str
    tool_calls: int
    tokens_in: int = 0
    tokens_out: int = 0
    policy: str = "standard"
    seed_placement: str = "documents"

    def to_runner_row(self, query_id: Any = None, gold_answer: Optional[str] = None,
                      seed_method: Optional[str] = None) -> Dict[str, Any]:
        """The row layout of the paper's runner output files (without grading fields)."""
        traj = []
        for s in self.steps:
            row: Dict[str, Any] = {"step": s.index, "assistant": s.assistant, "finish": s.finish, "fx": s.forced,
                                   "mtcut": s.max_tokens_cut, "ctx_shrink": s.context_shrink,
                                   "gen_error": s.gen_error, "action": s.action}
            if s.action == "search":
                row.update({"search_query": s.search_query, "retrieved": list(s.retrieved),
                            "top1000_idx": list(s.top_positions), "top1000_score": list(s.top_scores)})
            traj.append(row)
        return {"query_id": query_id, "question": self.question, "gold_answer": gold_answer,
                "system_prompt": self.system_prompt, "seed_method": seed_method, "seed_docs": self.seed.texts,
                "n_seed_docs": len(self.seed), "tool_calls": self.tool_calls, "final_answer": self.final_answer,
                "trajectory": traj, "agent_tokens_in": self.tokens_in, "agent_tokens_out": self.tokens_out}

    def to_trace_record(self, qid: str, gold_answer: Optional[str] = None, correct: Optional[bool] = None,
                        loose: Optional[float] = None, judge: Optional[str] = None,
                        doc_id: Optional[Callable[[Any], Optional[str]]] = None) -> Dict[str, Any]:
        """The website's ``TraceRecord`` layout (``website/src/lib/traces.ts``).

        Args:
            qid: Question id.
            gold_answer: Gold answer string.
            correct: Grader verdict (MuSiQue, BrowseComp+), ``None`` if not graded.
            loose: Loose list recall (FanOutQA).
            judge: Grader output text.
            doc_id: Maps a hit/seed id to the website's document id (default: ``str``; ``None`` stays ``None``).
        """
        conv = doc_id or (lambda d: None if d is None else str(d))
        steps = []
        for s in self.steps:
            st: Dict[str, Any] = {"i": s.index, "act": s.action, "txt": s.assistant,
                                  "q": s.search_query if s.action == "search" else None,
                                  "ret": [conv(d) for d in s.retrieved_ids] if s.action == "search" else []}
            if s.gen_error:
                st["err"] = s.gen_error
            steps.append(st)
        return {"qid": qid, "q": self.question, "gold_answer": gold_answer, "answer": self.final_answer,
                "correct": correct, "loose": loose, "tools": self.tool_calls, "judge": judge,
                "tok_in": self.tokens_in, "tok_out": self.tokens_out, "seed": [conv(d) for d in self.seed.ids],
                "traj": steps}
