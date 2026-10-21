"""Search tools and seeds (hand-made index, no model)."""

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

import numpy as np

from latentgraphrag.agent import DenseSearchTool, RankFileFusedSearchTool, Seed, SeedDoc

E = np.eye(8, dtype=np.float32)
TEXTS = [f"doc {i} " + "x" * 3000 for i in range(8)]


def enc_for(weights):
    return lambda q: np.asarray(weights, dtype=np.float32)


def test_dense_search_returns_top_k_capped():
    tool = DenseSearchTool(E, TEXTS, ids=[f"id{i}" for i in range(8)],
                           query_encoder=enc_for([0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6]))
    r = tool.search("q")
    assert r.ids == ["id1", "id3", "id5", "id7", "id6"]
    assert all(len(t) == 2000 for t in r.texts)
    assert r.top_positions == [1, 3, 5, 7, 6, 4, 2, 0] and r.top_scores[0] == 0.9


def test_fused_tool_rrf_and_novelty():
    base = DenseSearchTool(E, TEXTS, query_encoder=enc_for([8, 7, 6, 5, 4, 3, 2, 1]))  # live order 0..7
    tool = RankFileFusedSearchTool(base, {"  The   Question? ": [7, 6, 5, 4]}, k=3, match_seed_text=False)
    ctx = tool.start("the question?", Seed.empty())
    first = tool.search("q", ctx)
    # live rank r and fixed rank r each give 1/(61+r): 0 (1/61), 7 (1/68+1/61), 1, 6, …
    sc = {i: 1 / (61 + i) for i in range(8)}
    for r, i in enumerate([7, 6, 5, 4]):
        sc[i] += 1 / (61 + r)
    expected = sorted(range(8), key=lambda i: -sc[i])[:3]
    assert first.ids == expected
    second = tool.search("q", ctx)
    assert not set(second.ids) & set(first.ids)


def test_fused_tool_counts_seed_as_shown():
    base = DenseSearchTool(E, TEXTS, query_encoder=enc_for([8, 7, 6, 5, 4, 3, 2, 1]))
    tool = RankFileFusedSearchTool(base, {}, k=2, position_of={"p0": 0})
    seed = Seed((SeedDoc(TEXTS[0][:2200], "p0"), SeedDoc(TEXTS[1][:2200], None)))
    ctx = tool.start("q", seed)
    assert ctx.shown == {0, 1}  # id-mapped and text-matched
    assert tool.search("q", ctx).ids == [2, 3]


def test_seed_from_ranking():
    s = Seed.from_ranking(["b", "a", "c"], {"a": "A" * 3000, "b": "B", "c": "C"}, k=2)
    assert s.ids == ["b", "a"] and s.texts[1] == "A" * 2200 and len(s) == 2
    assert not Seed.empty()
