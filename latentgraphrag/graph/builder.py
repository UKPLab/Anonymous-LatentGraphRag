"""End-to-end graph construction.

Pipeline:
    documents -> Chunker -> chunks
                                |--> OpenIEExtractor -> (entities, triples) per chunk
                                                                |--> Verbalizer -> RelationalMemory list
    Everything is then stitched into a ``GraphStore`` with:
        - chunk nodes
        - entity nodes
        - memory nodes
        - chunk--entity edges (passage edges, paper Sec 3.2)
        - chunk--memory edges (provenance ``pi``, paper Sec 3.2)
        - entity--entity edges via triples (relation edges)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

from latentgraphrag.graph.chunker import Chunk, TokenChunker
from latentgraphrag.graph.openie import OpenIEExtractor, OpenIEResult
from latentgraphrag.graph.store import GraphStore
from latentgraphrag.graph.verbalizer import Verbalizer
from latentgraphrag.memory.memory import RelationalMemory
from latentgraphrag.utils.io import compute_mdhash_id
from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class BuildResult:
    """Output of ``GraphBuilder.build``."""

    chunks: List[Chunk]
    openie: List[OpenIEResult]
    memories: List[RelationalMemory]
    store: GraphStore


class GraphBuilder:
    """Top-level orchestrator that chunks, extracts, verbalizes, and builds the graph."""

    def __init__(
        self,
        *,
        chunker: TokenChunker,
        openie: Optional[OpenIEExtractor],
        verbalizer: Verbalizer,
    ) -> None:
        self.chunker = chunker
        self.openie = openie
        self.verbalizer = verbalizer

    @staticmethod
    def _entity_node_id(text: str) -> str:
        return compute_mdhash_id(text.lower().strip(), prefix="entity-")

    def build(
        self,
        documents: List[str],
        *,
        doc_ids: Optional[List[str]] = None,
    ) -> BuildResult:
        chunks = self.chunker.split_many(documents, doc_ids=doc_ids)
        logger.info("Chunking: %s docs -> %s chunks", len(documents), len(chunks))

        store = GraphStore()
        for ch in chunks:
            store.add_node(ch.hash_id, kind="chunk", text=ch.text, doc_id=ch.doc_id, position=ch.position)

        memories: List[RelationalMemory] = []
        openie_results: List[OpenIEResult] = []

        if self.openie is None:
            logger.info("OpenIE skipped (openie=None). Graph contains chunks only.")
            return BuildResult(chunks=chunks, openie=[], memories=[], store=store)

        # OpenIE in two batched stages (NER, then triples). Backends that implement
        # batched inference (vLLM) benefit from prefix caching across the batch.
        openie_results = self.openie.extract_many(chunks)

        for ch, ie in zip(chunks, openie_results):
            for ent in ie.entities:
                ent_id = self._entity_node_id(ent)
                store.add_node(ent_id, kind="entity", text=ent)
                store.add_edge(ch.hash_id, ent_id, kind="chunk_entity")

            for triple in ie.triples:
                sentence = self.verbalizer.verbalize_one(triple)
                mem = RelationalMemory.from_triple(
                    triple, sentence, chunk_id=ch.hash_id, doc_id=ch.doc_id
                )
                memories.append(mem)
                store.add_node(
                    mem.hash_id,
                    kind="memory",
                    text=mem.sentence,
                    head=mem.head,
                    relation=mem.relation,
                    tail=mem.tail,
                    chunk_id=mem.chunk_id,
                    doc_id=mem.doc_id,
                )
                store.add_edge(ch.hash_id, mem.hash_id, kind="chunk_memory")

                head_id = self._entity_node_id(mem.head)
                tail_id = self._entity_node_id(mem.tail)
                if mem.head and mem.head.lower().strip() not in {e.lower().strip() for e in ie.entities}:
                    store.add_node(head_id, kind="entity", text=mem.head)
                if mem.tail and mem.tail.lower().strip() not in {e.lower().strip() for e in ie.entities}:
                    store.add_node(tail_id, kind="entity", text=mem.tail)
                if head_id in store._name_to_index and tail_id in store._name_to_index:  # noqa: SLF001
                    store.add_edge(head_id, tail_id, kind="entity_relation", weight=1.0)

        logger.info(
            "Built graph: %s nodes (chunks=%s, entities=%s, memories=%s), %s edges",
            store.vcount(),
            sum(1 for _ in store.nodes_of_kind("chunk")),
            sum(1 for _ in store.nodes_of_kind("entity")),
            sum(1 for _ in store.nodes_of_kind("memory")),
            store.ecount(),
        )
        return BuildResult(chunks=chunks, openie=openie_results, memories=memories, store=store)
