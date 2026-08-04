"""Verify the batched search is mathematically equivalent to the sequential variant.

This is the test that lets us trust `rag.retrieve(..., batched=True)` for big runs:
the batched code reorders operations across queries (hop-synchronous) but must
produce the same retrieval paths as the sequential code on identical inputs.

We compare on a small deterministic corpus using the HashEncoder so results are
reproducible across machines.
"""

from __future__ import annotations

import numpy as np
import pytest

from latentgraphrag.encoders.base import HashEncoder
from latentgraphrag.memory.index import MemoryIndex
from latentgraphrag.search import run_full_expansion, run_full_expansion_batched


def _make_index(tmp_path, n: int = 80, dim: int = 64):
    enc = HashEncoder(dim=dim)
    texts = [f"item {i} topic {i % 9}" for i in range(n)]
    ids = [f"doc-{i:04d}" for i in range(n)]
    idx = MemoryIndex(tmp_path / "idx.parquet", device="numpy")
    idx.upsert(ids, texts, enc.encode(texts))
    return idx, enc


def _paths_equal(a, b) -> bool:
    """Compare two lists of SearchPath: same length, same item hashes per path, same scores."""
    if len(a) != len(b):
        return False
    for pa, pb in zip(a, b):
        if pa.hash_ids != pb.hash_ids:
            return False
        if not np.isclose(pa.cumulative_score, pb.cumulative_score, atol=1e-5):
            return False
    return True


def test_full_expansion_batched_matches_sequential(tmp_path):
    """Single query: batched must produce identical paths to sequential."""
    idx, enc = _make_index(tmp_path)
    queries = ["query about topic 3"]

    seq = run_full_expansion(
        queries, encoder=enc, index=idx, k=20, max_hops=3, branching=2
    )
    bat = run_full_expansion_batched(
        queries, encoder=enc, index=idx, k=20, max_hops=3, branching=2
    )

    assert len(seq) == len(bat) == 1
    assert _paths_equal(seq[0], bat[0])


def test_full_expansion_batched_multi_query(tmp_path):
    """Multiple queries: batched must produce per-query results matching sequential."""
    idx, enc = _make_index(tmp_path)
    queries = [
        "first query about topic 1",
        "second query about topic 5",
        "third query different content",
        "fourth query",
    ]

    seq = run_full_expansion(
        queries, encoder=enc, index=idx, k=30, max_hops=3, branching=3
    )
    bat = run_full_expansion_batched(
        queries, encoder=enc, index=idx, k=30, max_hops=3, branching=3
    )

    assert len(seq) == len(bat) == 4
    for i, (s, b) in enumerate(zip(seq, bat)):
        assert _paths_equal(s, b), f"query {i} diverged: seq={[p.hash_ids for p in s[:3]]} bat={[p.hash_ids for p in b[:3]]}"


def test_full_expansion_batched_adaptive(tmp_path):
    """Adaptive branching must also be batched-equivalent."""
    idx, enc = _make_index(tmp_path, n=60)
    queries = ["one", "two", "three"]
    seq = run_full_expansion(
        queries, encoder=enc, index=idx, k=20, max_hops=2,
        branching="adaptive", branching_threshold=0.05,
    )
    bat = run_full_expansion_batched(
        queries, encoder=enc, index=idx, k=20, max_hops=2,
        branching="adaptive", branching_threshold=0.05,
    )
    for s, b in zip(seq, bat):
        assert _paths_equal(s, b)


def test_full_expansion_batched_chunked_encode(tmp_path):
    """Chunked encoding (encode_chunk_size set) must still produce identical results."""
    idx, enc = _make_index(tmp_path)
    queries = ["alpha", "beta", "gamma", "delta", "epsilon"]
    bat_one = run_full_expansion_batched(
        queries, encoder=enc, index=idx, k=20, max_hops=2, branching=2,
        encode_chunk_size=None,
    )
    bat_chunks = run_full_expansion_batched(
        queries, encoder=enc, index=idx, k=20, max_hops=2, branching=2,
        encode_chunk_size=4,  # force chunking
    )
    for a, b in zip(bat_one, bat_chunks):
        assert _paths_equal(a, b)


def test_full_expansion_batched_empty_frontier(tmp_path):
    """When a query's frontier collapses to empty (everything seen / no matches), the
    batched path must handle it cleanly without crashing or mixing into other queries."""
    enc = HashEncoder(dim=64)
    texts = ["only one item"]
    ids = ["doc-0"]
    idx = MemoryIndex(tmp_path / "tiny.parquet", device="numpy")
    idx.upsert(ids, texts, enc.encode(texts))

    queries = ["whatever", "anything"]
    bat = run_full_expansion_batched(
        queries, encoder=enc, index=idx, k=10, max_hops=3, branching=2
    )
    # Each query should retrieve the single available item at hop 0, then have an
    # empty frontier from hop 1 onward (since the only item is already seen).
    for paths in bat:
        assert len(paths) == 1
        assert paths[0].items[0].hash_id == "doc-0"


def test_retrieve_batched_flag_routes_through_dispatcher(tmp_path):
    """End-to-end: `rag.retrieve(..., batched=True)` should return the same documents
    as `batched=False` (modulo path-tied score order at the very tail)."""
    from latentgraphrag import LatentGraphRAG, LatentGraphRAGConfig

    cfg = LatentGraphRAGConfig(
        openie_llm=None,
        verbalizer_llm=None,
        chunk_size=64,
        chunk_overlap=8,
        save_dir=str(tmp_path),
        faiss_device="numpy",
    )
    docs = [
        "alpha beta gamma " * 30,
        "delta epsilon zeta " * 30,
        "eta theta iota " * 30,
        "kappa lambda mu " * 30,
    ]
    rag = LatentGraphRAG.from_documents(documents=docs, config=cfg, save_dir=str(tmp_path))

    seq = rag.retrieve(
        ["query about alpha", "query about kappa"],
        corpus="document_only",
        search="full_expansion",
        max_hops=2,
        branching=2,
        k=5,
        batched=False,
    )
    bat = rag.retrieve(
        ["query about alpha", "query about kappa"],
        corpus="document_only",
        search="full_expansion",
        max_hops=2,
        branching=2,
        k=5,
        batched=True,
    )
    for s, b in zip(seq, bat):
        # The dispatcher dedupes paths to per-document scores; both modes should
        # converge to the same top-k document set.
        assert set(s.documents) == set(b.documents)
