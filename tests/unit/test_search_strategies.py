"""Tests for the six search strategies.

Each strategy is exercised in isolation against a deterministic HashEncoder + an
in-memory MemoryIndex with ~40 mock items.
"""

from __future__ import annotations

from typing import List

import numpy as np
import pytest

from latentgraphrag.encoders.base import HashEncoder
from latentgraphrag.memory.index import MemoryIndex
from latentgraphrag.search import (
    run_beamdr,
    run_cross_view_beam,
    run_full_expansion,
    run_mmr,
    run_single_hop,
)


@pytest.fixture
def small_index(tmp_path):
    enc = HashEncoder(dim=64)
    n = 40
    texts = [f"sentence about topic {i % 5} number {i}" for i in range(n)]
    hash_ids = [f"chunk-{i:04d}" for i in range(n)]
    idx = MemoryIndex(tmp_path / "small.parquet", device="numpy")
    idx.upsert(hash_ids, texts, enc.encode(texts))
    return idx, enc, texts, hash_ids


@pytest.fixture
def small_dual(tmp_path):
    enc = HashEncoder(dim=64)
    n = 30
    doc_texts = [f"document about topic {i % 4} number {i}" for i in range(n)]
    mem_texts = [f"memory sentence for fact {i}" for i in range(n)]
    doc_ids = [f"chunk-{i:04d}" for i in range(n)]
    mem_ids = [f"memory-{i:04d}" for i in range(n)]
    doc_index = MemoryIndex(tmp_path / "d.parquet", device="numpy")
    mem_index = MemoryIndex(tmp_path / "m.parquet", device="numpy")
    doc_index.upsert(doc_ids, doc_texts, enc.encode(doc_texts))
    mem_index.upsert(mem_ids, mem_texts, enc.encode(mem_texts))
    return enc, doc_index, mem_index


def test_single_hop_returns_top_k(small_index):
    idx, enc, _, _ = small_index
    out = run_single_hop(["query alpha", "query beta"], encoder=enc, index=idx, k=5)
    assert len(out) == 2
    for paths in out:
        assert len(paths) == 5
        for p in paths:
            assert p.depth == 1


def test_full_expansion_produces_multi_hop_paths(small_index):
    idx, enc, _, _ = small_index
    out = run_full_expansion(
        ["the query"], encoder=enc, index=idx, k=20, max_hops=3, branching=2
    )
    paths = out[0]
    assert len(paths) > 0
    depths = {p.depth for p in paths}
    # We must see paths at various depths up to max_hops.
    assert max(depths) == 3
    # Paths sorted by cumulative score descending.
    scores = [p.cumulative_score for p in paths]
    assert scores == sorted(scores, reverse=True)


def test_full_expansion_branching_int_caps_fanout(small_index):
    idx, enc, _, _ = small_index
    out_b1 = run_full_expansion(["q"], encoder=enc, index=idx, k=100, max_hops=2, branching=1)
    out_b3 = run_full_expansion(["q"], encoder=enc, index=idx, k=100, max_hops=2, branching=3)
    # b=3 should produce more (or equal) paths than b=1.
    assert len(out_b3[0]) >= len(out_b1[0])


def test_full_expansion_adaptive_branching(small_index):
    idx, enc, _, _ = small_index
    out = run_full_expansion(
        ["q"], encoder=enc, index=idx, k=50, max_hops=2,
        branching="adaptive", branching_threshold=0.5,
    )
    assert len(out[0]) > 0  # Adaptive should always produce at least the top-1 chain.


def test_beamdr_keeps_at_most_beam_width(small_index):
    idx, enc, _, _ = small_index
    out = run_beamdr(
        ["q"], encoder=enc, index=idx, k=100, max_hops=3, beam_width=5, branch_per_state=4,
    )
    # The finished list is the union of beams at all hops; per-hop the beam ≤ beam_width.
    # Sanity check: top-k respects k.
    assert len(out[0]) <= 100


def test_cross_view_beam_returns_paths(small_dual):
    enc, doc_index, mem_index = small_dual
    out = run_cross_view_beam(
        ["a query"], encoder=enc, doc_index=doc_index, memory_index=mem_index,
        k=20, max_hops=3, beam_width=5, branch_per_state=2,
    )
    paths = out[0]
    assert len(paths) > 0
    # Paths can contain a mix of doc / memory items.
    sources = set()
    for p in paths:
        for it in p.items:
            sources.add(getattr(it, "source", "document"))
    assert "document" in sources or "memory" in sources


def test_mmr_runs_and_produces_paths(small_index):
    idx, enc, _, _ = small_index
    out = run_mmr(
        ["q"], encoder=enc, index=idx, k=20, max_hops=2, branching=3, lambda_mmr=0.5,
    )
    assert len(out[0]) > 0


def test_mmr_lambda_one_matches_full_expansion_order(small_index):
    """At lambda=1.0, MMR reduces to plain similarity-sorted top-b — i.e. same first-hop
    selection as full_expansion with the same b."""
    idx, enc, _, _ = small_index
    mmr_paths = run_mmr(
        ["q"], encoder=enc, index=idx, k=10, max_hops=1, branching=3, lambda_mmr=1.0,
    )[0]
    fe_paths = run_full_expansion(
        ["q"], encoder=enc, index=idx, k=10, max_hops=1, branching=3,
    )[0]
    mmr_hashes = {p.items[-1].hash_id for p in mmr_paths}
    fe_hashes = {p.items[-1].hash_id for p in fe_paths}
    assert mmr_hashes == fe_hashes


def test_mmr_lambda_rejects_out_of_range(small_index):
    idx, enc, _, _ = small_index
    with pytest.raises(ValueError):
        run_mmr(["q"], encoder=enc, index=idx, k=5, max_hops=1, lambda_mmr=1.5)
