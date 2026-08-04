"""Tests for the retrieve() validation rules from plan §A.5."""

import pytest

from latentgraphrag import LatentGraphRAG, LatentGraphRAGConfig


def _docs_only_rag(tmp_path):
    cfg = LatentGraphRAGConfig(
        openie_llm=None,
        verbalizer_llm=None,
        chunk_size=64,
        chunk_overlap=8,
        save_dir=str(tmp_path),
        faiss_device="numpy",
    )
    rag = LatentGraphRAG.from_documents(
        documents=["alpha beta gamma " * 30, "delta epsilon zeta " * 30],
        config=cfg,
        save_dir=str(tmp_path),
    )
    return rag


def test_fusion_requires_dual_tree(tmp_path):
    rag = _docs_only_rag(tmp_path)
    with pytest.raises(ValueError, match="dual_tree"):
        rag.retrieve(["q"], corpus="document_only", fusion="rrf")


def test_cross_view_beam_requires_dual_tree(tmp_path):
    rag = _docs_only_rag(tmp_path)
    with pytest.raises(ValueError, match="cross_view_beam"):
        rag.retrieve(["q"], corpus="document_only", search="cross_view_beam")


def test_memory_modes_require_built_memory_index(tmp_path):
    rag = _docs_only_rag(tmp_path)
    with pytest.raises(ValueError, match="relational memory"):
        rag.retrieve(["q"], corpus="memory_only")
    with pytest.raises(ValueError, match="relational memory"):
        rag.retrieve(["q"], corpus="dual_tree")


def test_invalid_corpus_rejected(tmp_path):
    rag = _docs_only_rag(tmp_path)
    with pytest.raises(ValueError, match="Invalid corpus"):
        rag.retrieve(["q"], corpus="bogus")  # type: ignore[arg-type]


def test_invalid_search_rejected(tmp_path):
    rag = _docs_only_rag(tmp_path)
    with pytest.raises(ValueError, match="Invalid search"):
        rag.retrieve(["q"], search="bogus")  # type: ignore[arg-type]
