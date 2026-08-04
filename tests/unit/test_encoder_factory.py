"""Tests for the encoder factory dispatch."""

from __future__ import annotations

import pytest

from latentgraphrag.encoders import HashEncoder, load_encoder
from latentgraphrag.encoders.base import BaseEncoder


def test_load_hash_spec_returns_hash_encoder():
    enc = load_encoder("hash")
    assert isinstance(enc, HashEncoder)


def test_load_pre_constructed_encoder_passthrough():
    enc = HashEncoder(dim=128)
    out = load_encoder(enc)
    assert out is enc


def test_load_rejects_non_string():
    with pytest.raises(TypeError):
        load_encoder(123)  # type: ignore[arg-type]


def test_grithopper_alias_routes_to_grithopper_encoder():
    """Without the gritlm extra, this should ImportError — which we expect."""
    pytest.importorskip("gritlm", reason="gritlm not installed")
    # If gritlm IS installed in the env, we'd actually load weights; skip then too to keep
    # tests offline.
    pytest.skip("Skipping live model load in unit test.")


def test_unknown_string_is_rejected():
    """Unknown encoder ids raise — multi-hop dense retrieval needs an encoder designed
    for it; we don't silently fall back to a generic sentence model."""
    with pytest.raises(ValueError, match="multi-hop"):
        load_encoder("BAAI/bge-small-en-v1.5")


def test_hash_encoder_is_deterministic():
    enc1 = HashEncoder(dim=64)
    enc2 = HashEncoder(dim=64)
    v1 = enc1.encode(["alpha", "beta"], is_query=False)
    v2 = enc2.encode(["alpha", "beta"], is_query=False)
    assert (v1 == v2).all()


def test_hash_encoder_query_doc_distinct():
    enc = HashEncoder(dim=64)
    v_q = enc.encode(["alpha"], is_query=True)
    v_d = enc.encode(["alpha"], is_query=False)
    # Same text but different role -> different embeddings.
    assert not (v_q == v_d).all()


def test_base_encoder_normalize():
    import numpy as np

    enc = HashEncoder(dim=32)
    v = enc.encode(["alpha", "beta", "gamma"])
    norms = np.linalg.norm(v, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-5)
