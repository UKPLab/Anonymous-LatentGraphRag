"""Phase-1 end-to-end smoke test.

Builds a graph from 5 mock documents using:
    - the deterministic ``HashEncoder``
    - the ``EchoLLM`` that echoes the user prompt back (so OpenIE will parse a stable
      JSON shape, exercising the verbalizer fallback too)

Verifies that:
    1. ``build_graph`` produces persisted artifacts (graph file, memories.parquet,
       embeddings, manifest).
    2. ``LatentGraphRAG.load`` round-trips the same artifacts.
    3. ``retrieve`` over ``document_only`` returns the top chunks.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from latentgraphrag import LatentGraphRAG, LatentGraphRAGConfig


class _FixedLLM:
    """Deterministic LLM that returns hardcoded NER + triples + verbalizations.

    Recognizes both ``complete()`` (used by the verbalizer) and ``complete_chat()``
    (used by the paper-canonical few-shot OpenIE prompts) — see
    ``latentgraphrag.prompts.openie.build_ner_messages`` etc.
    """

    def __init__(self) -> None:
        self.calls = 0

    def _route(self, system: str) -> str:
        if "extract named entities" in system:
            return json.dumps({"named_entities": ["Alice", "Paris", "Bob"]})
        if "construct an RDF" in system:
            return json.dumps(
                {
                    "triples": [
                        ["Alice", "lives in", "Paris"],
                        ["Bob", "knows", "Alice"],
                    ]
                }
            )
        if "natural-language sentence" in system:
            return "A verbalized sentence."
        return "{}"

    def complete(self, *, system: str, user: str, **kwargs) -> str:  # noqa: ARG002
        self.calls += 1
        return self._route(system)

    def complete_chat(self, messages, **kwargs) -> str:  # noqa: ARG002
        self.calls += 1
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        return self._route(system)

    def batch_complete_chat(self, messages_list, **kwargs):  # noqa: ARG002
        return [self.complete_chat(m) for m in messages_list]


def test_end_to_end_phase1(tmp_path: Path) -> None:
    docs = [
        "Alice lives in Paris. She is a researcher.",
        "Bob knows Alice and works in Berlin.",
        "Charlie travels often between Paris and Berlin.",
        "Dora is a friend of Alice and Bob.",
        "The cafe in Paris is famous for its croissants.",
    ]

    fixed_llm = _FixedLLM()
    cfg = LatentGraphRAGConfig(
        chunk_size=64,
        chunk_overlap=8,
        save_dir=str(tmp_path),
        faiss_device="numpy",  # CI / local-mac safe; FAISS path is tested separately.
    )
    rag = LatentGraphRAG(
        encoder=None,
        openie_llm=fixed_llm,  # type: ignore[arg-type]
        verbalizer_llm=fixed_llm,  # type: ignore[arg-type]
        config=cfg,
    )
    result = rag.build_graph(docs, save_dir=str(tmp_path))

    # 1. Build produced artifacts.
    assert (tmp_path / "graph.picklez").exists()
    assert (tmp_path / "manifest.json").exists()
    assert (tmp_path / "memories.parquet").exists()
    assert (tmp_path / "embeddings" / "chunks.parquet").exists()
    assert (tmp_path / "embeddings" / "memories.parquet").exists()

    assert len(result.chunks) >= 5
    assert len(result.memories) >= 5  # at least 2 per doc

    # 2. Round-trip via load().
    rag2 = LatentGraphRAG.load(str(tmp_path))
    assert rag2.store is not None
    assert rag2.chunks_index is not None
    assert rag2.memories_index is not None
    assert len(rag2.chunks_index) == len(rag.chunks_index)
    assert len(rag2.memories_index) == len(rag.memories_index)

    # 3. Document-only retrieval returns top chunks.
    out = rag2.retrieve(
        queries=["Where does Alice live?"],
        corpus="document_only",
        search="single_hop",
        k=3,
    )
    assert len(out) == 1
    assert len(out[0].documents) >= 1
    assert len(out[0].scores) == len(out[0].documents)


def test_from_documents_skips_openie(tmp_path: Path) -> None:
    """A document-only index needs no LLM at all."""
    docs = ["alpha beta gamma " * 30, "delta epsilon zeta " * 30]
    cfg = LatentGraphRAGConfig(
        chunk_size=64,
        chunk_overlap=8,
        save_dir=str(tmp_path),
        faiss_device="numpy",
    )
    rag = LatentGraphRAG.from_documents(documents=docs, config=cfg, save_dir=str(tmp_path))
    assert rag.chunks_index is not None
    assert rag.memories_index is None or len(rag.memories_index) == 0
    out = rag.retrieve(["alpha"], corpus="document_only", search="single_hop", k=2)
    assert len(out[0].documents) >= 1
