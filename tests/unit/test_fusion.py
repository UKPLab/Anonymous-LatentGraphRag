"""Tests for the two fusion methods (RRF and Agreement)."""

from __future__ import annotations

from latentgraphrag.fusion import AgreementFusion, RRFFusion


def test_rrf_combines_two_rankings():
    """RRF should produce a ranking that mixes both input lists."""
    doc_ranked = [("d1", 0.9), ("d2", 0.8), ("d3", 0.7)]
    mem_ranked = [("m1", 0.95), ("m2", 0.6), ("m3", 0.5)]
    memory_to_doc = {"m1": "d3", "m2": "d4", "m3": "d1"}

    fused = RRFFusion(rrf_k=10).fuse(doc_ranked, mem_ranked, memory_to_doc=memory_to_doc)
    fused_dict = dict(fused)
    # d3 should be boosted: it's #3 in doc ranking AND #1 in mem ranking via m1.
    assert "d3" in fused_dict
    assert "d4" in fused_dict  # appears only in mem ranking
    # Ranking is sorted descending.
    scores = [s for _, s in fused]
    assert scores == sorted(scores, reverse=True)


def test_rrf_rejects_bad_k():
    import pytest

    with pytest.raises(ValueError):
        RRFFusion(rrf_k=0)


def test_agreement_fuses_both_views():
    """A doc retrieved by both views should outscore docs retrieved by only one view."""
    # d1 scores well in BOTH views; d2 only in doc view; d3 only in mem view.
    doc_ranked = [("d1", 0.9), ("d2", 0.1)]
    mem_ranked = [("m1", 0.9), ("m2", 0.1)]
    memory_to_doc = {"m1": "d1", "m2": "d4"}  # d4 ≠ any doc-view doc

    result = AgreementFusion(gamma=0.0).fuse(doc_ranked, mem_ranked, memory_to_doc=memory_to_doc)
    ids, scores = zip(*result)
    # d1 (high in both views) should rank first
    assert ids[0] == "d1"
    # scores are sorted descending
    assert list(scores) == sorted(scores, reverse=True)


def test_agreement_positive_gamma_boosts_intersected_docs():
    doc_ranked = [("d1", 0.5), ("d2", 0.3)]
    mem_ranked = [("m1", 0.4)]
    memory_to_doc = {"m1": "d1"}  # d1 appears in both sides

    fused_zero = dict(AgreementFusion(gamma=0.0).fuse(doc_ranked, mem_ranked, memory_to_doc=memory_to_doc))
    fused_pos = dict(AgreementFusion(gamma=0.3).fuse(doc_ranked, mem_ranked, memory_to_doc=memory_to_doc))
    # d1 (intersected) should get a +0.3 boost.
    assert fused_pos["d1"] == fused_zero["d1"] + 0.3
    # d2 (not intersected) should be unchanged.
    assert fused_pos["d2"] == fused_zero["d2"]


def test_agreement_negative_gamma_penalizes_agreement():
    """Negative γ should produce a lower fused score than γ=0 for an intersected doc."""
    doc_ranked = [("d1", 0.5), ("d2", 0.3)]
    mem_ranked = [("m1", 0.4), ("m2", 0.1)]
    memory_to_doc = {"m1": "d1", "m2": "d2"}  # both in intersection

    fused_zero = dict(AgreementFusion(gamma=0.0).fuse(doc_ranked, mem_ranked, memory_to_doc=memory_to_doc))
    fused_neg = dict(AgreementFusion(gamma=-0.5).fuse(doc_ranked, mem_ranked, memory_to_doc=memory_to_doc))
    # Every intersected doc should be penalised relative to γ=0
    assert fused_neg["d1"] < fused_zero["d1"]
    assert fused_neg["d2"] < fused_zero["d2"]
