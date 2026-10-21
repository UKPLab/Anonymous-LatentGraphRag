"""ReAct agent: loop, follow-up requests, context handling, seed placement (fake LLM, no network)."""

import pathlib
import sys
import types

_ROOT = pathlib.Path(__file__).resolve().parents[1]
try:  # the package root may import optional components; load the subpackages directly if it fails
    import latentgraphrag  # noqa: F401
except Exception:  # pragma: no cover
    _pkg = types.ModuleType("latentgraphrag")
    _pkg.__path__ = [str(_ROOT / "latentgraphrag")]
    sys.modules["latentgraphrag"] = _pkg

import pytest

from latentgraphrag.agent import (ChatResult, ReActAgent, SearchContext, SearchHit, SearchResult, Seed, prompts,
                                  shrink_observations)
from latentgraphrag.evaluation import Reader


class FakeLLM:
    """Calls ``responder(messages, max_tokens)``; it returns a ChatResult or raises."""

    def __init__(self, responder):
        self.responder = responder
        self.calls = []

    def chat(self, messages, *, max_tokens, temperature, frequency_penalty):
        self.calls.append({"messages": [dict(m) for m in messages], "max_tokens": max_tokens,
                           "temperature": temperature, "frequency_penalty": frequency_penalty})
        return self.responder(messages, max_tokens)


class FakeTool:
    def __init__(self):
        self.queries = []

    def start(self, question, seed):
        return SearchContext(question)

    def search(self, query, context):
        self.queries.append(query)
        return SearchResult(hits=[SearchHit(f"d{j}", f"result {j} for {query}") for j in range(5)])


def is_followup(messages):
    return messages[-1]["role"] == "user" and messages[-1]["content"].startswith(
        tuple(prompts.FOLLOWUP_OPENINGS.values()))


def test_standard_system_prompt_is_the_released_agent_prompt():
    assert prompts.POLICIES["standard"][0] == (
        "You are a deep research agent. Answer the question by interacting with a local knowledge base. "
        "Actions (one per turn):\n  SEARCH: <query>   -> returns top-5 documents\n"
        "Search to find candidates, read the most relevant documents, then finish with a line:\n"
        "  Exact Answer: <your single best answer>\nBe efficient; answer as soon as you have enough evidence.")


def test_documents_turn_with_and_without_seed():
    assert prompts.documents_turn(["A", "B"], "Q?") == "Documents:\n[1] A\n\n[2] B\n\nQuestion: Q?"
    assert prompts.documents_turn([], "Q?") == "Documents:\n\n\nQuestion: Q?"


def test_search_results_turn():
    assert prompts.search_results_turn(["x", "y"], "Q?", prompts.STANDARD_CONTINUE) == (
        "Search results:\n[+1] x\n\n[+2] y\nContinue (SEARCH / Exact Answer).\nQuestion: Q?")
    assert prompts.search_results_turn(["x"], "Q?", None) == (
        "Search results:\n[+1] x\nNo searches left. Answer now from the documents. "
        "End with: Exact Answer: <answer>.\nQuestion: Q?")


def test_loop_stops_after_ten_searches_and_forces_the_answer():
    def responder(messages, mt):
        if is_followup(messages):
            return ChatResult(text="Exact Answer: bar", finish_reason="stop")
        return ChatResult(text="SEARCH: foo", finish_reason="stop", prompt_tokens=10, completion_tokens=2)

    llm, tool = FakeLLM(responder), FakeTool()
    t = ReActAgent(llm, tool, retry_sleep=0).run("Q?", Seed.from_texts(["s1", "s2"]))
    assert t.tool_calls == 10 and len(tool.queries) == 10
    assert [s.action for s in t.steps] == ["search"] * 10 + ["answer"]
    obs = [m["content"] for m in llm.calls[-1]["messages"] if m["content"].startswith("Search results:")]
    assert all("Continue (SEARCH / Exact Answer)." in o for o in obs[:9]) and "No searches left." in obs[9]
    # the eleventh turn asked to search again with none left: one follow-up for the answer only
    assert llm.calls[-1]["messages"][-1]["content"] == (
        "No searches are left. Stop reasoning and reply with exactly one line: Exact Answer: <answer>.")
    assert llm.calls[-1]["max_tokens"] == 512
    assert t.output == "SEARCH: foo\n[no searches left; forced action]\nExact Answer: bar"
    assert t.final_answer == "bar"
    assert t.steps[-1].forced == "nosearch:Exact Answer: bar"
    assert t.tokens_in == 110 and t.tokens_out == 22


def test_cut_turn_gets_one_followup():
    def responder(messages, mt):
        if is_followup(messages):
            return ChatResult(text="Exact Answer: X", finish_reason="stop", prompt_tokens=3, completion_tokens=1)
        return ChatResult(text="long reasoning", finish_reason="length", prompt_tokens=5, completion_tokens=8192)

    llm = FakeLLM(responder)
    t = ReActAgent(llm, FakeTool(), retry_sleep=0).run("Q?")
    assert llm.calls[0]["max_tokens"] == 8192 and llm.calls[0]["frequency_penalty"] == 0.4
    assert llm.calls[0]["temperature"] == 0.0
    assert llm.calls[1]["messages"][-1]["content"] == (
        "Your previous message was cut off at the length limit. Stop reasoning and reply with exactly one line: "
        "either SEARCH: <query> or Exact Answer: <answer>.")
    assert t.final_answer == "X" and t.tool_calls == 0
    assert t.steps[0].forced == "cut:Exact Answer: X"
    assert t.tokens_in == 8 and t.tokens_out == 8193


def test_final_answer_keeps_following_lines():
    llm = FakeLLM(lambda m, mt: ChatResult(text="Reasoning.\nExact Answer: a\nand b", finish_reason="stop"))
    t = ReActAgent(llm, FakeTool(), retry_sleep=0).run("Q?")
    assert t.final_answer == "a\nand b" and len(llm.calls) == 1


def test_dangling_search_marker_is_neutralized():
    def responder(messages, mt):
        if is_followup(messages):
            return ChatResult(text="Exact Answer: z", finish_reason="stop")
        return ChatResult(text="SEARCH:", finish_reason="stop")

    tool = FakeTool()
    t = ReActAgent(FakeLLM(responder), tool, retry_sleep=0).run("Q?")
    assert t.output == "SEARCH -\n[no valid action; forced action]\nExact Answer: z"
    assert tool.queries == [] and t.final_answer == "z"


def test_context_error_retries_with_the_largest_fitting_max_tokens():
    state = {"n": 0}

    def responder(messages, mt):
        state["n"] += 1
        if state["n"] == 1:
            raise RuntimeError("This model's maximum context length is 65536 tokens. However, you requested "
                               "68000 tokens (60000 in the messages, 8000 in the completion).")
        return ChatResult(text="Exact Answer: ok", finish_reason="stop")

    llm = FakeLLM(responder)
    t = ReActAgent(llm, FakeTool(), retry_sleep=0).run("Q?")
    assert llm.calls[1]["max_tokens"] == 65536 - 60000 - 64
    assert t.steps[0].max_tokens_cut == 65536 - 60000 - 64 and t.final_answer == "ok"


def test_context_overflow_shrinks_earlier_search_results():
    def responder(messages, mt):
        if sum(len(m["content"]) for m in messages) > 2600:
            raise RuntimeError("maximum context length exceeded")
        if is_followup(messages):
            return ChatResult(text="Exact Answer: done", finish_reason="stop")
        n_obs = sum(m["content"].startswith("Search results:") for m in messages)
        return ChatResult(text=f"SEARCH: q{n_obs}" if n_obs < 3 else "Exact Answer: done", finish_reason="stop")

    class LongTool(FakeTool):
        def search(self, query, context):
            return SearchResult(hits=[SearchHit(None, "w" * 400) for _ in range(5)])

    t = ReActAgent(FakeLLM(responder), LongTool(), retry_sleep=0).run("Q?")
    assert t.final_answer == "done"
    assert max(s.context_shrink for s in t.steps) >= 1


def test_shrink_levels():
    obs = lambda n: prompts.search_results_turn(["a" * 1000, "b" * 1000], "Q?", prompts.STANDARD_CONTINUE)
    msgs = [{"role": "system", "content": "s"}, {"role": "user", "content": obs(1)},
            {"role": "assistant", "content": "x"}, {"role": "user", "content": obs(2)}]
    m1 = [dict(m) for m in msgs]
    shrink_observations(m1, 1)
    assert m1[1]["content"] == ("Search results:\n" + "[+1] " + "a" * 595 + "\n\n" + "[+2] " + "b" * 595
                                + "\nContinue (SEARCH / Exact Answer).\nQuestion: Q?")
    assert m1[3]["content"] == msgs[3]["content"]
    m3 = [dict(m) for m in msgs]
    shrink_observations(m3, 3)
    assert all(len(p) == 250 for p in m3[3]["content"].split("\n")[1:4:2] if p.startswith("[+"))
    m4 = [dict(m) for m in msgs]
    shrink_observations(m4, 4)
    assert m4[1]["content"] == ("Search results: [omitted to fit the context window]"
                                "\nContinue (SEARCH / Exact Answer).\nQuestion: Q?")
    assert m4[3]["content"] == msgs[3]["content"]


def test_seed_as_simulated_first_search():
    llm = FakeLLM(lambda m, mt: ChatResult(text="Exact Answer: a", finish_reason="stop"))
    agent = ReActAgent(llm, FakeTool(), seed_placement="search_turn", retry_sleep=0)
    t = agent.run("Q?", Seed.from_texts(["s1", "s2"]))
    m = llm.calls[0]["messages"]
    assert m[0]["content"] == prompts.STANDARD_SYSTEM
    assert m[1]["content"] == "Documents:\n\n\nQuestion: Q?"
    assert m[2] == {"role": "assistant", "content": "SEARCH: Q?"}
    assert m[3]["content"] == "Search results:\n[+1] s1\n\n[+2] s2\nContinue (SEARCH / Exact Answer).\nQuestion: Q?"
    assert t.tool_calls == 0


def test_seed_aware_policy_prompts():
    llm = FakeLLM(lambda m, mt: ChatResult(text="SEARCH: x" if len(m) == 2 else "Exact Answer: y",
                                           finish_reason="stop"))
    t = ReActAgent(llm, FakeTool(), policy="seed_aware", retry_sleep=0).run("Q?")
    assert llm.calls[0]["messages"][0]["content"] == prompts.SEED_AWARE_SYSTEM
    assert llm.calls[1]["messages"][-1]["content"].endswith("\nNow answer or SEARCH.\nQuestion: Q?")
    assert t.tool_calls == 1 and t.final_answer == "y"


def test_reader_never_searches_and_asks_for_the_answer_line_only():
    def responder(messages, mt):
        if is_followup(messages):
            return ChatResult(text="Exact Answer: r", finish_reason="stop")
        return ChatResult(text="I would SEARCH: something", finish_reason="stop")

    llm = FakeLLM(responder)
    t = Reader(llm, retry_sleep=0).read("Q?", Seed.from_texts(["s"]))
    assert llm.calls[0]["messages"][0]["content"] == "Use the documents to answer. End with: Exact Answer: <answer>."
    assert llm.calls[1]["messages"][-1]["content"] == (
        "Your previous message did not contain a valid action. Stop reasoning and reply with exactly one line: "
        "Exact Answer: <answer>.")
    assert t.tool_calls == 0 and t.final_answer == "r" and len(t.steps) == 1


def test_trace_record_layout():
    llm = FakeLLM(lambda m, mt: ChatResult(text="SEARCH: x" if len(m) == 2 else "Exact Answer: y",
                                           finish_reason="stop", prompt_tokens=1, completion_tokens=1))
    t = ReActAgent(llm, FakeTool(), retry_sleep=0).run("Q?", Seed.from_texts(["s"], ids=[7]))
    rec = t.to_trace_record("q1", gold_answer="y", correct=True)
    assert set(rec) == {"qid", "q", "gold_answer", "answer", "correct", "loose", "tools", "judge", "tok_in", "tok_out",
                        "seed", "traj"}
    assert rec["seed"] == ["7"] and rec["traj"][0]["ret"] == ["d0", "d1", "d2", "d3", "d4"]
    assert rec["traj"][1] == {"i": 1, "act": "answer", "txt": "Exact Answer: y", "q": None, "ret": []}
    row = t.to_runner_row("q1", "y")
    assert row["tool_calls"] == 1 and row["trajectory"][0]["search_query"] == "x"


def test_invalid_configuration():
    with pytest.raises(ValueError):
        ReActAgent(FakeLLM(lambda m, mt: None), None)
    with pytest.raises(ValueError):
        ReActAgent(FakeLLM(lambda m, mt: None), FakeTool(), policy="nope")
