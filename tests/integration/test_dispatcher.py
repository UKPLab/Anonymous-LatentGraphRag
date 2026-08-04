"""End-to-end smoke test for the orthogonal-axes dispatcher.

Builds a small corpus with memories and runs every reasonable (corpus × search × fusion)
combination through ``LatentGraphRAG.retrieve()``, checking that each returns sane shapes
and that the validation rules from §A.5 still hold.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from latentgraphrag import LatentGraphRAG, LatentGraphRAGConfig
from latentgraphrag.llm.base import BaseLLM


class _FixedLLM(BaseLLM):
    """Stub LLM matching the new paper-canonical few-shot OpenIE prompts."""

    def _route(self, system: str) -> str:
        if "extract named entities" in system:
            return json.dumps({"named_entities": ["Alice", "Paris", "Bob", "Berlin"]})
        if "construct an RDF" in system:
            return json.dumps(
                {
                    "triples": [
                        ["Alice", "lives in", "Paris"],
                        ["Bob", "knows", "Alice"],
                        ["Bob", "works in", "Berlin"],
                    ]
                }
            )
        if "natural-language sentence" in system:
            return "A verbalized fact sentence."
        return "{}"

    def complete(self, *, system: str, user: str, **kwargs) -> str:  # noqa: ARG002
        return self._route(system)

    def complete_chat(self, messages, **kwargs) -> str:  # noqa: ARG002
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        return self._route(system)


@pytest.fixture
def built_rag(tmp_path: Path) -> LatentGraphRAG:
    docs = [
        "Alice lives in Paris. She is a researcher.",
        "Bob knows Alice and works in Berlin.",
        "Charlie travels often between Paris and Berlin.",
        "Dora is a friend of Alice and Bob.",
        "The cafe in Paris is famous for its croissants.",
    ]
    cfg = LatentGraphRAGConfig(
        chunk_size=64, chunk_overlap=8, save_dir=str(tmp_path), faiss_device="numpy",
    )
    rag = LatentGraphRAG(
        encoder=None,
        openie_llm=_FixedLLM(),
        verbalizer_llm=_FixedLLM(),
        config=cfg,
    )
    rag.build_graph(docs, save_dir=str(tmp_path))
    return rag


# --------------------------------------------------- single-view combos


@pytest.mark.parametrize(
    "corpus,search",
    [
        ("document_only", "single_hop"),
        ("document_only", "full_expansion"),
        ("document_only", "beamdr"),
        ("document_only", "mmr"),
        ("memory_only", "single_hop"),
        ("memory_only", "full_expansion"),
        ("memory_only", "beamdr"),
        ("joint_index", "single_hop"),
        ("joint_index", "full_expansion"),
    ],
)
def test_single_view_combinations(built_rag: LatentGraphRAG, corpus: str, search: str) -> None:
    out = built_rag.retrieve(
        ["where does alice live?"],
        corpus=corpus,
        search=search,
        k=5,
        max_hops=2,
        branching=2,
        beam_width=5 if search == "beamdr" else None,
    )
    assert len(out) == 1
    assert len(out[0].documents) >= 1
    assert len(out[0].scores) == len(out[0].documents)


# --------------------------------------------------- dual-tree combos


@pytest.mark.parametrize(
    "search,fusion",
    [
        ("full_expansion", "rrf"),
        ("full_expansion", "agreement"),
        ("beamdr", "rrf"),
        ("beamdr", "agreement"),
        ("mmr", "rrf"),
        ("mmr", "agreement"),
    ],
)
def test_dual_tree_with_fusion(built_rag: LatentGraphRAG, search: str, fusion: str) -> None:
    out = built_rag.retrieve(
        ["who knows alice?"],
        corpus="dual_tree",
        search=search,
        fusion=fusion,
        k=5,
        max_hops=2,
        branching=2,
        beam_width=5,
        gamma=0.1,
    )
    assert len(out) == 1
    # Dual_tree must return doc-level ids, not memory ids.
    for d in out[0].documents:
        assert not d.startswith("memory-")


def test_dual_tree_cross_view_beam(built_rag: LatentGraphRAG) -> None:
    """cross_view_beam is the paper's special dual-index search (fusion='none')."""
    out = built_rag.retrieve(
        ["who lives in paris?"],
        corpus="dual_tree",
        search="cross_view_beam",
        k=5,
        max_hops=2,
        branching=2,
        beam_width=5,
    )
    assert len(out) == 1
    assert len(out[0].documents) >= 1


def test_paper_canonical_full_dual_tree_agreement(built_rag: LatentGraphRAG) -> None:
    """The paper's best MuSiQue R@10 config: dual_tree + full_expansion + agreement."""
    out = built_rag.retrieve(
        ["where does alice live?"],
        corpus="dual_tree",
        search="full_expansion",
        fusion="agreement",
        k=10,
        max_hops=4,
        branching_doc=3,
        branching_memory=5,
        gamma=0.0,
    )
    assert len(out) == 1
    assert len(out[0].documents) >= 1
