"""Tests for the parquet-backed MemoryIndex.

Covers both the numpy fallback path and (when faiss is installed) the FAISS path.
"""

from __future__ import annotations

import os

import numpy as np
import pytest

from latentgraphrag.encoders.base import HashEncoder
from latentgraphrag.memory.index import MemoryIndex, _faiss_available

# FAISS can segfault on macOS due to OpenMP runtime conflicts with PyTorch.
# Run FAISS tests only when explicitly enabled (CI/Linux/conda-forge environments).
_RUN_FAISS = os.environ.get("LATENTGRAPHRAG_TEST_FAISS", "0") == "1"


def _make_index(tmp_path, *, device: str, n: int = 100, dim: int = 64):
    enc = HashEncoder(dim=dim)
    texts = [f"sentence number {i} about topic {i % 7}" for i in range(n)]
    hash_ids = [f"item-{i:04d}" for i in range(n)]
    embeddings = enc.encode(texts)
    idx = MemoryIndex(tmp_path / "memo.parquet", device=device)
    idx.upsert(hash_ids, texts, embeddings)
    return idx, enc, texts, hash_ids


def test_numpy_backend_returns_top_k(tmp_path):
    idx, enc, texts, _ = _make_index(tmp_path, device="numpy", n=50)
    q = enc.encode([texts[7]], is_query=True)
    scores, indices = idx.search(q, k=5)
    assert scores.shape == (1, 5)
    assert indices.shape == (1, 5)
    # Returned indices are valid positions in the corpus.
    for i in indices[0].tolist():
        assert 0 <= i < 50
    # Scores are sorted descending.
    diffs = np.diff(scores[0])
    assert (diffs <= 1e-5).all()


def test_numpy_self_retrieval_finds_self_when_same_role(tmp_path):
    """When the query is encoded with the same role as the doc, top-1 == self."""
    idx, enc, texts, _ = _make_index(tmp_path, device="numpy", n=20)
    q = enc.encode([texts[5]], is_query=False)  # same role as docs
    scores, indices = idx.search(q, k=1)
    assert indices[0, 0] == 5
    assert scores[0, 0] > 0.99


def test_numpy_backend_batched_queries(tmp_path):
    idx, enc, texts, _ = _make_index(tmp_path, device="numpy", n=40)
    queries = enc.encode(texts[:3], is_query=True)
    scores, indices = idx.search(queries, k=4)
    assert scores.shape == (3, 4)
    # Scores must be sorted descending per row.
    for row in scores:
        diffs = np.diff(row)
        assert (diffs <= 1e-5).all()


def test_dim_mismatch_raises(tmp_path):
    enc = HashEncoder(dim=32)
    idx = MemoryIndex(tmp_path / "bad.parquet", device="numpy")
    idx.upsert(["a"], ["x"], enc.encode(["x"]))
    with pytest.raises(ValueError, match="dim mismatch"):
        bigger = HashEncoder(dim=64).encode(["y"])
        idx.upsert(["b"], ["y"], bigger)


def test_round_trip_via_parquet(tmp_path):
    idx, enc, _, hash_ids = _make_index(tmp_path, device="numpy", n=20)
    # Re-open the same parquet from disk in a fresh index.
    idx2 = MemoryIndex(tmp_path / "memo.parquet", device="numpy")
    assert len(idx2) == 20
    assert idx2.hash_ids == hash_ids


@pytest.mark.skipif(
    not (_faiss_available() and _RUN_FAISS),
    reason="set LATENTGRAPHRAG_TEST_FAISS=1 to enable (faiss-cpu can segfault on macOS w/ PyTorch)",
)
def test_faiss_cpu_matches_numpy(tmp_path):
    """FAISS CPU index should return the same top-k as the numpy brute-force baseline."""
    idx_np, enc, texts, _ = _make_index(tmp_path / "np", device="numpy", n=60)
    idx_fa, _, _, _ = _make_index(tmp_path / "fa", device="cpu", n=60)
    q = enc.encode([texts[3], texts[42]], is_query=True)
    s_np, i_np = idx_np.search(q, k=5)
    s_fa, i_fa = idx_fa.search(q, k=5)
    assert i_np.tolist() == i_fa.tolist()
    assert np.allclose(s_np, s_fa, atol=1e-4)


@pytest.mark.skipif(
    not (_faiss_available() and _RUN_FAISS),
    reason="set LATENTGRAPHRAG_TEST_FAISS=1 to enable (faiss-cpu can segfault on macOS w/ PyTorch)",
)
def test_faiss_sidecar_is_built_and_loaded(tmp_path):
    idx_fa, enc, texts, _ = _make_index(tmp_path, device="cpu", n=30)
    q = enc.encode([texts[0]], is_query=True)
    idx_fa.search(q, k=3)  # forces build
    assert idx_fa._faiss_sidecar_path().exists()
    # Re-open from disk — sidecar should be reused without rebuilding.
    idx_fa2 = MemoryIndex(idx_fa.parquet_path, device="cpu")
    idx_fa2.search(q, k=3)
    assert idx_fa2._faiss_index is not None
