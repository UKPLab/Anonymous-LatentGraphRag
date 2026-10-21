"""Parity with the research evaluator that produced the paper's retrieval numbers.

The paper's rankings were computed by a self-contained evaluator that re-implements RDR. This test runs
that evaluator and :class:`latentgraphrag.LatentGraphRAG` side by side on a synthetic corpus with one
deterministic fake encoder, and requires identical rankings for the document view, the projected memory
view and the fused ranking. Because the fake encoder hashes the exact text it is given, any difference in
how a query state is rendered (instruction, observation layout, truncation) changes the vectors and fails
the test; the model's weights are the only thing it does not exercise.

The evaluator is not part of this repository. Point ``LGR_EVALUATOR`` at its file to run the test:

    LGR_EVALUATOR=/path/to/analysis_eval_readout_lgr_e3.py pytest tests/parity
"""

from __future__ import annotations

import hashlib
import importlib.util
import os
import random

import numpy as np
import pytest

torch = pytest.importorskip("torch")
EVALUATOR = os.environ.get("LGR_EVALUATOR")
pytestmark = pytest.mark.skipif(not EVALUATOR or not os.path.exists(EVALUATOR or ""),
                                reason="set LGR_EVALUATOR to the paper evaluator to run parity")

DIM = 48


def _vec(text: str) -> np.ndarray:
    seed = int(hashlib.sha256(text.encode()).hexdigest()[:16], 16)
    v = np.random.default_rng(seed).standard_normal(DIM).astype(np.float32)
    return v / np.linalg.norm(v)


class _Tok:
    """Whitespace tokenizer; the synthetic texts stay below every token cap."""

    def encode(self, text, add_special_tokens=False):
        return list(range(len(text.split())))

    def decode(self, ids, skip_special_tokens=True):  # pragma: no cover - texts are never truncated
        raise AssertionError("synthetic texts must not be truncated")


class FakeRDREncoder:
    """Encoder object for rdr: rendered states and documents in, hashed unit vectors out."""

    tokenizer = _Tok()
    seen: list = []

    def encode_queries(self, texts, batch_size=None, show_progress_bar=False):
        self.seen.extend(texts)
        return torch.from_numpy(np.stack([_vec(t) for t in texts]))

    def encode_documents(self, texts, batch_size=None, show_progress_bar=False):
        return torch.from_numpy(np.stack([_vec(t) for t in texts]))

    def truncate(self, text, max_tokens):
        if not max_tokens or len(text.split()) <= max_tokens:
            return text
        raise AssertionError("synthetic texts must not be truncated")


def _load_evaluator():
    os.environ.update(RO_TOPN="200", RO_TEMP="0.02", RO_MINMAX="0", LGR_TF="1", TREE_HOPS="4",
                      TREE_BRANCHING="3", TREE_MEM_BRANCHING="3", LGR_MEM_MMR="1", LGR_MAGG="max",
                      LGR_MW="0.5", MULTIVIEW_K="1")
    spec = importlib.util.spec_from_file_location("paper_evaluator", EVALUATOR)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    class FakeEvaluatorEncoder(mod.NativeEmbeddingEncoder):
        def __init__(self):  # no model: only the evaluator's own query rendering runs
            self.tokenizer = _Tok()
            self.query_length_stats = {}
            self.query_batch_size = self.passage_batch_size = 64
            self.query_max_length = self.passage_max_length = 4096
            self.embedding_dimension = DIM
            self.seen = []

        def _encode(self, prompts, max_length, progress=None, batch_size=None):
            self.seen.extend(prompts)
            return np.stack([_vec(p) for p in prompts])

    return mod, FakeEvaluatorEncoder()


def _corpus(n_docs=150, n_mem=420, seed=7):
    rnd = random.Random(seed)
    words = [f"w{i}" for i in range(400)]
    docs = {f"d{i:03d}": " ".join(rnd.choices(words, k=rnd.randint(8, 40))) for i in range(n_docs)}
    ids = list(docs)
    mem_map = {}
    while len(mem_map) < n_mem:
        text = " ".join(rnd.choices(words, k=rnd.randint(3, 9))) + "."
        mem_map.setdefault(text, rnd.sample(ids, rnd.choice((1, 1, 1, 2, 3))))
    questions = [" ".join(rnd.choices(words, k=rnd.randint(6, 14))) + "?" for _ in range(8)]
    return docs, mem_map, questions


def test_rankings_match_paper_evaluator():
    from latentgraphrag import LatentGraphRAG, MemoryInventory

    mod, ev_enc = _load_evaluator()
    docs, mem_map, questions = _corpus()
    inventory = MemoryInventory.from_map(mem_map, kind="triple")

    lgr = LatentGraphRAG(FakeRDREncoder(), index_device="cpu", query_batch_size=64, inflight=1)
    index = lgr.build(docs, inventory, show_progress_bar=False)
    results = lgr.search(questions, index, k=None)

    doc_ids = list(index.doc_of)
    doc_texts = [docs[d] for d in doc_ids]
    doc_matrix = index.documents.embeddings.float()
    mem_matrix = index.memories.embeddings.float()
    wanted = {"G_sum_D", "G_sum_M", "G_mnz_D+M"}
    for q, res in zip(questions, results):
        ev = mod.latent_graph_rankings(q, doc_texts, doc_ids, doc_matrix, mem_matrix, inventory.texts, mem_map,
                                       ev_enc, "fixed512", False, "per_parent", wanted=wanted)
        assert ev["G_sum_D"] == [d for d, _ in sorted(res.document_view.items(), key=lambda kv: -kv[1])], q
        assert ev["G_sum_M"] == [d for d, _ in sorted(res.memory_view.items(), key=lambda kv: -kv[1])], q
        assert ev["G_mnz_D+M"] == [d for d, _ in res.ranking], q


def test_query_states_render_identically():
    """Every text the evaluator encoded for the two trees, LatentGraphRAG encoded too (and vice versa)."""
    from latentgraphrag import LatentGraphRAG, MemoryInventory

    mod, ev_enc = _load_evaluator()
    docs, mem_map, questions = _corpus(seed=11)
    inventory = MemoryInventory.from_map(mem_map, kind="proposition")
    rdr_enc = FakeRDREncoder()
    rdr_enc.seen = []
    lgr = LatentGraphRAG(rdr_enc, index_device="cpu", query_batch_size=64, inflight=1)
    index = lgr.build(docs, inventory, show_progress_bar=False)
    lgr.search(questions[:3], index, k=10)

    doc_ids = list(index.doc_of)
    ev_enc.seen = []
    for q in questions[:3]:
        ro = mod._ro_new(index.documents.embeddings.float())
        mod.tree_trace(q, [docs[d] for d in doc_ids], index.documents.embeddings.float(), ev_enc, 3,
                       mod.DOC_FIRST, mod.DOC_LATER, hops=4, prompt_mode="fixed512", readouts=ro)
        rom = mod._ro_new(index.memories.embeddings.float())
        mod.tree_trace(q, inventory.texts, index.memories.embeddings.float(), ev_enc, 3, mod.DOC_FIRST,
                       mod.DOC_LATER, hops=4, prompt_mode="fixed512", mmr=True, readouts=rom)
    assert sorted(ev_enc.seen) == sorted(rdr_enc.seen)


_OPS = {"combsum": "sum", "combmnz": "mnz", "z": "z", "rrf": "rrf", "max": "max"}


def _chunked(docs):
    """Split every document into one to three chunks; chunk ids are positions, groups are document ids."""
    rnd = random.Random(3)
    texts, groups = [], []
    for d, t in docs.items():
        words = t.split()
        cuts = sorted(rnd.sample(range(1, len(words)), k=min(len(words) - 1, rnd.choice((0, 1, 2)))))
        for a, b in zip([0] + cuts, cuts + [len(words)]):
            texts.append(" ".join(words[a:b]))
            groups.append(d)
    return texts, groups


@pytest.mark.parametrize("chunked", [False, True])
@pytest.mark.parametrize("projection", ["max", "sum"])
def test_every_view_and_operator_matches(chunked, projection):
    from latentgraphrag import PAPER, LatentGraphRAG, MemoryInventory

    mod, ev_enc = _load_evaluator()
    os.environ.update(LGR_MAGG=projection, LGR_JOINT_B="3")
    docs, mem_map, questions = _corpus(n_docs=120, n_mem=360, seed=23)
    questions = questions[:4]
    inventory = MemoryInventory.from_map(mem_map, kind="triple")
    if chunked:
        texts, groups = _chunked(docs)
        corpus = dict(enumerate(texts))
    else:
        texts, groups, corpus = list(docs.values()), None, docs

    names = [f"G_sum_{v}" for v in ("D", "M", "J")]
    names += [f"G_{op}_{v}" for op in _OPS.values() for v in ("D+M", "D+J")]
    base = LatentGraphRAG(FakeRDREncoder(), config=PAPER.with_(projection=projection), index_device="cpu",
                          query_batch_size=64, inflight=1)
    index = base.build(corpus, inventory, groups=groups, show_progress_bar=False)
    doc_ids = list(index.doc_of)
    ev = [mod.latent_graph_rankings(q, texts, doc_ids, index.documents.embeddings.float(),
                                    index.memories.embeddings.float(), inventory.texts, mem_map, ev_enc, "fixed512",
                                    False, "per_parent", wanted=set(names)) for q in questions]

    for view in ("D", "M", "J"):
        got = base.search(questions, index, k=None, view=view)
        for q, e, g in zip(questions, ev, got):
            assert e[f"G_sum_{view}"] == [d for d, _ in g.ranking], (view, q)
    for method, op in _OPS.items():
        lgr = LatentGraphRAG(FakeRDREncoder(), config=PAPER.with_(projection=projection, fusion=method),
                             index_device="cpu", query_batch_size=64, inflight=1)
        for view in ("D+M", "D+J"):
            got = lgr.search(questions, index, k=None, view=view)
            for q, e, g in zip(questions, ev, got):
                assert e[f"G_{op}_{view}"] == [d for d, _ in g.ranking], (view, method, q)
