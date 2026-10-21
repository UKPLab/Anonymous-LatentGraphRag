"""The paper's ReAct controller: a seeded agent that may search up to ten times.

Faithful port of the paper's runner. Per turn the controller generates greedily (temperature 0,
frequency penalty 0.4, reasoning disabled, at most 8,192 tokens). A turn without a valid action (no
``Exact Answer:`` line and no usable ``SEARCH:`` line, e.g. cut at the token limit) receives exactly
one follow-up request for a single action line (at most 512 tokens). A ``SEARCH: <query>`` line runs
the search tool while searches remain; the observation after the last allowed search asks for the
answer. If a prompt exceeds the context window, the call is retried once with the largest
``max_tokens`` that still fits (at least 1,024); if it still fails, earlier search results are shortened
step by step (600, then 250 characters per document, then omitted) and the call is repeated.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Dict, List, Optional

from . import prompts as P
from .llm import ChatModel, ChatResult, Message
from .seed import Seed
from .tools import SearchContext, SearchTool
from .trajectory import Step, Trajectory

MAX_SEARCHES = 10
MAX_TOKENS = 8192
FOLLOWUP_MAX_TOKENS = 512
FREQUENCY_PENALTY = 0.4
CONTEXT_LENGTH = 65536

_SEARCH_LINE = re.compile(r"SEARCH:\s*(.+)")
_SEARCH_ANY = re.compile(r"SEARCH:\s*\S")
_CONTEXT_ERROR = "maximum context length"


def final_answer_text(output: str) -> str:
    """Text after the last ``Exact Answer:`` up to the end of the output; the whole output without one."""
    return re.sub(r"^.*Exact Answer:\s*", "", output, flags=re.S).strip() if "Exact Answer:" in output else output


def _prompt_tokens(err: str) -> Optional[int]:
    m = (re.search(r"(\d+) in the messages", err) or re.search(r"(\d+) input tokens", err)
         or re.search(r"prompt contains (?:at least )?(\d+)", err))
    return int(m.group(1)) if m else None


def _cut(content: str, cut: int) -> str:
    """Cut every document of one observation to ``cut`` characters (keeps the continuation tail)."""
    for mk in P._OBSERVATION_TAILS:
        if mk in content:
            body, tail = content.rsplit(mk, 1)
            tail = mk + tail
            break
    else:
        return content
    parts = re.split(r"\n\n(?=\[\+\d+\] )", body[len("Search results:\n"):])
    return "Search results:\n" + "\n\n".join(p[:cut] for p in parts) + tail


def shrink_observations(messages: List[Message], level: int) -> None:
    """Shorten earlier search results in place (levels 1–4), as the paper's context fitting does.

    Level 1 cuts every observation but the last to 600 characters per document, level 2 all of them,
    level 3 all to 250, level 4 omits every observation but the last.
    """
    idx = [i for i, m in enumerate(messages) if m["role"] == "user" and m["content"].startswith("Search results:")]
    for j, i in enumerate(idx):
        last = j == len(idx) - 1
        c = messages[i]["content"]
        if level == 1 and not last:
            c = _cut(c, 600)
        elif level == 2:
            c = _cut(c, 600)
        elif level == 3:
            c = _cut(c, 250)
        elif level == 4 and not last:
            mk = next((x for x in P._OBSERVATION_TAILS[:2] if x in c), P._OBSERVATION_TAILS[2])
            c = "Search results: [omitted to fit the context window]" + (mk + c.rsplit(mk, 1)[1] if mk in c else "")
        messages[i] = {"role": "user", "content": c}


@dataclass
class _TurnState:
    """Diagnostics of the current turn (the runner keeps these in a thread-local)."""

    last_error: str = ""
    forced: str = ""
    finish: str = ""
    max_tokens_cut: int = 0
    shrink: int = 0


class ReActAgent:
    """Seeded ReAct agent of the paper.

    Args:
        llm: Chat model (controller; paper: Qwen3.5-122B-A10B).
        search_tool: The search tool (paper: :class:`~latentgraphrag.agent.tools.DenseSearchTool`);
            ``None`` only together with ``max_searches=0``.
        max_searches: Search budget (paper: 10).
        policy: Prompt policy, a key of :data:`~latentgraphrag.agent.prompts.POLICIES`
            (``"standard"`` = main protocol, ``"seed_aware"``, ``"read_only"``, or an ablation key).
        seed_placement: ``"documents"`` (seed as documents in the first user turn; main protocol) or
            ``"search_turn"`` (seed as the result of a simulated first search with the question as query;
            not counted as a search). The standard system prompt is used with ``"search_turn"``.
        max_tokens: Generation cap per turn (paper: 8,192).
        followup_max_tokens: Cap of the follow-up request (paper: 512).
        frequency_penalty: Paper: 0.4.
        context_length: Server context window, used to size the retry after a context error (paper: 65,536).
        fit_context: Shorten earlier search results when a prompt exceeds the context window
            (on for the agent, off for the read-only reader, as in the paper's runners).
        retry_sleep: Seconds between retries after a non-context error (paper: 3).
    """

    def __init__(self, llm: ChatModel, search_tool: Optional[SearchTool], max_searches: int = MAX_SEARCHES,
                 policy: str = "standard", seed_placement: str = "documents", max_tokens: int = MAX_TOKENS,
                 followup_max_tokens: int = FOLLOWUP_MAX_TOKENS, frequency_penalty: float = FREQUENCY_PENALTY,
                 context_length: int = CONTEXT_LENGTH, fit_context: bool = True, retry_sleep: float = 3.0) -> None:
        if policy not in P.POLICIES:
            raise ValueError(f"unknown policy {policy!r}; choose from {sorted(P.POLICIES)}")
        if seed_placement not in ("documents", "search_turn"):
            raise ValueError("seed_placement must be 'documents' or 'search_turn'")
        if search_tool is None and max_searches > 0:
            raise ValueError("a search tool is required when max_searches > 0")
        self.llm = llm
        self.search_tool = search_tool
        self.max_searches = max_searches
        self.policy = policy
        self.seed_placement = seed_placement
        system, cont = P.POLICIES[policy]
        if seed_placement == "search_turn":
            system = P.STANDARD_SYSTEM
        self.system_prompt = system
        self.continue_line = cont
        self.max_tokens = max_tokens
        self.followup_max_tokens = followup_max_tokens
        self.frequency_penalty = frequency_penalty
        self.context_length = context_length
        self.fit_context = fit_context
        self.retry_sleep = retry_sleep

    # ------------------------------------------------------------------ generation
    def _create(self, messages: List[Message], max_tokens: int, st: _TurnState) -> ChatResult:
        """One call; on a context error retry once with the largest ``max_tokens`` that fits (>= 1,024)."""
        try:
            return self.llm.chat(messages, max_tokens=max_tokens, temperature=0.0,
                                 frequency_penalty=self.frequency_penalty)
        except Exception as ex:
            n = _prompt_tokens(str(ex)) if _CONTEXT_ERROR in str(ex) else None
            room = None if n is None else self.context_length - n - 64
            if room is None or room < 1024 or room >= max_tokens:
                raise
            st.max_tokens_cut = room
            return self.llm.chat(messages, max_tokens=room, temperature=0.0, frequency_penalty=self.frequency_penalty)

    @staticmethod
    def _count(acc: Dict[str, int], res: ChatResult) -> None:
        acc["in"] += res.prompt_tokens or 0
        acc["out"] += res.completion_tokens or 0

    def _force_action(self, messages: List[Message], text: str, finish: str, acc: Dict[str, int],
                      st: _TurnState) -> str:
        """One follow-up request when the turn has no valid action."""
        if "Exact Answer:" in text:
            return text
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        no_left = "No searches left" in last_user
        can_search = "SEARCH" in messages[0]["content"] and not no_left
        has_search = bool(_SEARCH_ANY.search(text))
        if can_search and has_search:
            return text
        why = "cut" if finish == "length" else ("nosearch" if (no_left and has_search) else "noaction")
        ask = P.followup_request(why, can_search)
        res: Optional[ChatResult] = None
        prev = text
        for k in range(3):
            try:
                res = self._create(messages + [{"role": "assistant", "content": prev}, {"role": "user", "content": ask}],
                                   self.followup_max_tokens, st)
                break
            except Exception as ex:
                if _CONTEXT_ERROR in str(ex):
                    prev = prev[-(4000 if k == 0 else 1000):]
                else:
                    time.sleep(self.retry_sleep)
        if res is None:
            st.forced = "followup_failed"
            return text
        self._count(acc, res)
        forced = (res.text or "").strip()
        st.forced = why + ":" + forced[:300]
        text = re.sub(r"SEARCH:(\s*)$", r"SEARCH -\1", text)  # a dangling empty 'SEARCH:' must not capture the marker
        return text + "\n[" + P.FORCED_MARKERS[why] + "; forced action]\n" + forced

    def _gen(self, messages: List[Message], acc: Dict[str, int], st: _TurnState) -> str:
        st.last_error = ""
        st.forced = ""
        st.finish = ""
        st.max_tokens_cut = 0
        for _ in range(3):
            try:
                res = self._create(messages, self.max_tokens, st)
                self._count(acc, res)
                st.finish = res.finish_reason or ""
                text = (res.text or "").strip() or (res.reasoning or "").strip()
                if messages[0]["role"] == "system":
                    text = self._force_action(messages, text, st.finish, acc, st)
                return text
            except Exception as ex:
                st.last_error = str(ex)
                if _CONTEXT_ERROR in str(ex):
                    return ""
                time.sleep(self.retry_sleep)
        return ""

    def _gen_fit(self, messages: List[Message], acc: Dict[str, int], st: _TurnState) -> str:
        text = self._gen(messages, acc, st)
        level = 0
        while not text and _CONTEXT_ERROR in st.last_error and level < 4:
            level += 1
            shrink_observations(messages, level)
            text = self._gen(messages, acc, st)
        st.shrink = level
        return text

    # ------------------------------------------------------------------ episode
    def initial_messages(self, question: str, seed: Seed) -> List[Message]:
        """System prompt and the first user turn(s) for this question and seed."""
        if self.seed_placement == "search_turn" and seed:
            return [{"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": P.documents_turn([], question)},
                    {"role": "assistant", "content": f"SEARCH: {question}"},
                    {"role": "user", "content": P.search_results_turn(seed.texts, question, self.continue_line)}]
        return [{"role": "system", "content": self.system_prompt},
                {"role": "user", "content": P.documents_turn(seed.texts, question)}]

    def run(self, question: str, seed: Optional[Seed] = None) -> Trajectory:
        """Run one episode and return its trajectory."""
        seed = seed if seed is not None else Seed.empty()
        seed = Seed(seed.docs[:10])
        messages = self.initial_messages(question, seed)
        ctx: Optional[SearchContext] = self.search_tool.start(question, seed) if self.search_tool is not None else None
        calls = 0
        out = ""
        acc = {"in": 0, "out": 0}
        steps: List[Step] = []
        for _ in range(self.max_searches + 1):
            st = _TurnState()
            out = self._gen_fit(messages, acc, st) if self.fit_context else self._gen(messages, acc, st)
            m = _SEARCH_LINE.search(out)
            step = Step(index=len(steps), assistant=out, finish=st.finish, forced=st.forced,
                        max_tokens_cut=st.max_tokens_cut, context_shrink=st.shrink,
                        gen_error="" if out else st.last_error[:300])
            if m and calls < self.max_searches:
                calls += 1
                query = m.group(1).strip()
                result = self.search_tool.search(query, ctx)  # type: ignore[union-attr]
                step.action = "search"
                step.search_query = query
                step.retrieved = result.texts
                step.retrieved_ids = result.ids
                step.top_positions = result.top_positions
                step.top_scores = result.top_scores
                messages.append({"role": "assistant", "content": out})
                messages.append({"role": "user", "content": P.search_results_turn(
                    result.texts, question, self.continue_line if calls < self.max_searches else None)})
                steps.append(step)
            else:
                step.action = "answer"
                steps.append(step)
                break
        return Trajectory(question=question, system_prompt=self.system_prompt, seed=seed, steps=steps, output=out,
                          final_answer=final_answer_text(out), tool_calls=calls, tokens_in=acc["in"],
                          tokens_out=acc["out"], policy=self.policy, seed_placement=self.seed_placement)
