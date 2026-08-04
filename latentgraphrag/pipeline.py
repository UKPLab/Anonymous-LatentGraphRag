"""The ``LatentGraphRAG`` main class.

This is the SentenceTransformers-style entry point. It wraps the three orthogonal axes
(corpus, search, fusion) and the offline pipeline (chunk -> OpenIE -> verbalize -> encode -> graph).

Phase 1: build_graph() + save() / load() + a validation-only retrieve() that enforces
the §A.5 rules. Phase 2 fills in the encoder + memory-index population. Phase 3 wires
the actual search strategies.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

from latentgraphrag.config import LatentGraphRAGConfig
from latentgraphrag.corpus.base import CorpusMode, CorpusView
from latentgraphrag.encoders.base import BaseEncoder, HashEncoder
from latentgraphrag.fusion.base import FusionMethod
from latentgraphrag.graph.builder import BuildResult, GraphBuilder
from latentgraphrag.graph.chunker import TokenChunker
from latentgraphrag.graph.openie import OpenIEExtractor
from latentgraphrag.graph.store import GraphStore
from latentgraphrag.graph.verbalizer import Verbalizer
from latentgraphrag.llm.base import BaseLLM
from latentgraphrag.memory.index import MemoryIndex
from latentgraphrag.memory.memory import RelationalMemory
from latentgraphrag.search.base import SearchStrategy
from latentgraphrag.utils.io import ensure_dir, read_json, write_json
from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class RetrievalResult:
    """The output of ``LatentGraphRAG.retrieve()``.

    Attributes:
        query: the input query string.
        documents: top-k ranked document ids.
        scores: top-k scores aligned with ``documents``.
        memories: top relational memories surfaced along the way (may be empty).
        paths: full retrieval paths (one per top-1 path; useful for debugging).
    """

    query: str
    documents: List[str] = field(default_factory=list)
    scores: List[float] = field(default_factory=list)
    memories: List[str] = field(default_factory=list)
    paths: List[List[Any]] = field(default_factory=list)


_VALID_CORPUS = {"document_only", "memory_only", "joint_index", "dual_tree"}
_VALID_SEARCH = {
    "full_expansion",
    "beamdr",
    "cross_view_beam",
    "mmr",
    "single_hop",
}
_VALID_FUSION = {"rrf", "agreement", "none", None}


class LatentGraphRAG:
    """Drop-in pipeline for LatentGraphRAG.

    Quick start::

        rag = LatentGraphRAG(encoder="GritHopper-7B", openie_llm="gpt-4o-mini")
        rag.build_graph(documents=[...], save_dir="./my_corpus")
        results = rag.retrieve(
            queries=["..."],
            corpus="dual_tree",
            search="full_expansion",
            fusion="agreement",
        )
    """

    def __init__(
        self,
        *,
        encoder: Union[str, BaseEncoder, None] = None,
        openie_llm: Union[str, BaseLLM, None] = None,
        verbalizer_llm: Union[str, BaseLLM, None] = None,
        config: Optional[LatentGraphRAGConfig] = None,
        chunker: Optional[TokenChunker] = None,
    ) -> None:
        self.config = config or LatentGraphRAGConfig()
        if encoder is not None:
            self._encoder_spec = encoder
        else:
            self._encoder_spec = self.config.encoder

        self._openie_spec = openie_llm if openie_llm is not None else self.config.openie_llm
        self._verbalizer_spec = (
            verbalizer_llm if verbalizer_llm is not None else self.config.verbalizer_llm
        )

        self._chunker = chunker or TokenChunker(
            chunk_size=self.config.chunk_size,
            chunk_overlap=self.config.chunk_overlap,
        )

        self._encoder: Optional[BaseEncoder] = None
        self._openie_llm: Optional[BaseLLM] = None
        self._verbalizer_llm: Optional[BaseLLM] = None

        self.save_dir: Optional[Path] = None
        self.store: Optional[GraphStore] = None
        self.chunks_index: Optional[MemoryIndex] = None
        self.memories_index: Optional[MemoryIndex] = None
        self.memories: List[RelationalMemory] = []

    # ------------------------------------------------------------------ resolvers

    def _resolve_encoder(self) -> BaseEncoder:
        if self._encoder is not None:
            return self._encoder
        spec = self._encoder_spec
        if isinstance(spec, BaseEncoder):
            self._encoder = spec
            return spec
        from latentgraphrag.encoders.factory import load_encoder

        try:
            self._encoder = load_encoder(spec)
        except ImportError as exc:
            logger.warning(
                "Cannot load encoder %r (%s). Falling back to HashEncoder for tests.",
                spec,
                exc,
            )
            self._encoder = HashEncoder()
        return self._encoder

    def _resolve_openie_llm(self) -> Optional[BaseLLM]:
        if self._openie_llm is not None:
            return self._openie_llm
        spec = self._openie_spec
        if spec is None:
            return None
        if not isinstance(spec, str):
            # Duck-typed LLM (anything with a .complete(system, user) -> str method)
            self._openie_llm = spec  # type: ignore[assignment]
            return self._openie_llm
        try:
            from latentgraphrag.llm.openai import OpenAILLM

            self._openie_llm = OpenAILLM(
                model=spec,
                api_key=self.config.openai_api_key,
                base_url=self.config.openai_base_url,
                temperature=self.config.openie_temperature,
                timeout_s=self.config.openie_timeout_s,
            )
            return self._openie_llm
        except ImportError:
            logger.warning(
                "openai package not installed; pass an LLM instance explicitly or "
                "install with `pip install latentgraphrag[openai]`."
            )
            return None

    def _resolve_verbalizer_llm(self) -> Optional[BaseLLM]:
        if self._verbalizer_llm is not None:
            return self._verbalizer_llm
        spec = self._verbalizer_spec
        if spec is None:
            return None
        if not isinstance(spec, str):
            self._verbalizer_llm = spec  # type: ignore[assignment]
            return self._verbalizer_llm
        try:
            from latentgraphrag.llm.openai import OpenAILLM

            self._verbalizer_llm = OpenAILLM(
                model=spec,
                api_key=self.config.openai_api_key,
                base_url=self.config.openai_base_url,
                temperature=self.config.verbalizer_temperature,
                max_tokens=self.config.verbalizer_max_tokens,
            )
            return self._verbalizer_llm
        except ImportError:
            logger.warning(
                "openai package not installed for verbalizer; template fallback will be used."
            )
            return None

    # ------------------------------------------------------------------ build

    def build_graph(
        self,
        documents: List[str],
        *,
        save_dir: Optional[str] = None,
        doc_ids: Optional[List[str]] = None,
    ) -> BuildResult:
        """Build a relational-memory graph from ``documents`` and persist to ``save_dir``."""
        save_dir = save_dir or self.config.save_dir
        self.save_dir = ensure_dir(save_dir)

        openie_llm = self._resolve_openie_llm()
        verbalizer_llm = self._resolve_verbalizer_llm()

        openie = OpenIEExtractor(
            llm=openie_llm,
            cache_path=str(self.save_dir / "openie_cache.json"),
        ) if openie_llm is not None else None
        verbalizer = Verbalizer(llm=verbalizer_llm)

        builder = GraphBuilder(chunker=self._chunker, openie=openie, verbalizer=verbalizer)
        result = builder.build(documents, doc_ids=doc_ids)
        self.store = result.store
        self.memories = result.memories

        encoder = self._resolve_encoder()
        chunk_texts = [c.text for c in result.chunks]
        chunk_hash_ids = [c.hash_id for c in result.chunks]
        if chunk_texts:
            chunk_embeddings = encoder.encode(chunk_texts, is_query=False)
            self.chunks_index = MemoryIndex(
                self.save_dir / "embeddings" / "chunks.parquet",
                device=self.config.faiss_device,
                index_type=self.config.faiss_index_type,
            )
            self.chunks_index.upsert(chunk_hash_ids, chunk_texts, chunk_embeddings)

        if result.memories:
            mem_texts = [m.sentence for m in result.memories]
            mem_hash_ids = [m.hash_id for m in result.memories]
            mem_embeddings = encoder.encode(mem_texts, is_query=False)
            self.memories_index = MemoryIndex(
                self.save_dir / "embeddings" / "memories.parquet",
                device=self.config.faiss_device,
                index_type=self.config.faiss_index_type,
            )
            self.memories_index.upsert(mem_hash_ids, mem_texts, mem_embeddings)

        self.store.save(self.save_dir / "graph.picklez")
        self._save_memories_table(result.memories)
        self._save_manifest()

        return result

    @classmethod
    def from_documents(
        cls,
        documents: List[str],
        *,
        encoder: Union[str, BaseEncoder, None] = None,
        save_dir: Optional[str] = None,
        config: Optional[LatentGraphRAGConfig] = None,
    ) -> "LatentGraphRAG":
        """Convenience: build a document-only index (no OpenIE)."""
        cfg = config or LatentGraphRAGConfig()
        cfg.openie_llm = None
        cfg.verbalizer_llm = None
        rag = cls(encoder=encoder, config=cfg)
        rag.build_graph(documents=documents, save_dir=save_dir)
        return rag

    # ------------------------------------------------------------------ persist

    def _save_memories_table(self, memories: List[RelationalMemory]) -> None:
        import pandas as pd

        if not memories:
            return
        df = pd.DataFrame(
            {
                "hash_id": [m.hash_id for m in memories],
                "head": [m.head for m in memories],
                "relation": [m.relation for m in memories],
                "tail": [m.tail for m in memories],
                "sentence": [m.sentence for m in memories],
                "chunk_id": [m.chunk_id for m in memories],
                "doc_id": [m.doc_id for m in memories],
            }
        )
        df.to_parquet(self.save_dir / "memories.parquet", index=False)

    def _save_manifest(self) -> None:
        manifest = {
            "format_version": 1,
            "encoder": str(self._encoder_spec),
            "openie_llm": str(self._openie_spec),
            "verbalizer_llm": str(self._verbalizer_spec),
            "chunk_size": self.config.chunk_size,
            "chunk_overlap": self.config.chunk_overlap,
            "n_chunks": len(self.chunks_index) if self.chunks_index else 0,
            "n_memories": len(self.memories_index) if self.memories_index else 0,
            "faiss_index_type": self.config.faiss_index_type,
            "faiss_device": self.config.faiss_device,
        }
        write_json(manifest, self.save_dir / "manifest.json")

    def save(self, save_dir: Optional[str] = None) -> None:
        target = ensure_dir(save_dir or self.save_dir)
        self.save_dir = target
        if self.store is not None:
            self.store.save(target / "graph.picklez")
        self._save_memories_table(self.memories)
        self._save_manifest()

    @classmethod
    def load(cls, save_dir: str, *, config: Optional[LatentGraphRAGConfig] = None) -> "LatentGraphRAG":
        path = Path(save_dir)
        if not path.exists():
            raise FileNotFoundError(f"Save dir does not exist: {save_dir}")
        manifest = read_json(path / "manifest.json")
        cfg = config or LatentGraphRAGConfig(
            encoder=manifest.get("encoder", "GritHopper-7B"),
            openie_llm=manifest.get("openie_llm"),
            verbalizer_llm=manifest.get("verbalizer_llm"),
            chunk_size=manifest.get("chunk_size", 512),
            chunk_overlap=manifest.get("chunk_overlap", 50),
            save_dir=str(path),
            faiss_device=manifest.get("faiss_device", "auto"),
            faiss_index_type=manifest.get("faiss_index_type", "auto"),
        )
        rag = cls(config=cfg)
        rag.save_dir = path
        graph_path = path / "graph.picklez"
        if graph_path.exists():
            rag.store = GraphStore.load(graph_path)
        chunks_pq = path / "embeddings" / "chunks.parquet"
        memories_pq = path / "embeddings" / "memories.parquet"
        if chunks_pq.exists():
            rag.chunks_index = MemoryIndex(
                chunks_pq, device=cfg.faiss_device, index_type=cfg.faiss_index_type
            )
        if memories_pq.exists():
            rag.memories_index = MemoryIndex(
                memories_pq, device=cfg.faiss_device, index_type=cfg.faiss_index_type
            )
        mem_table = path / "memories.parquet"
        if mem_table.exists():
            import pandas as pd

            df = pd.read_parquet(mem_table)
            rag.memories = [
                RelationalMemory(
                    hash_id=row.hash_id,
                    head=row.head,
                    relation=row.relation,
                    tail=row.tail,
                    sentence=row.sentence,
                    chunk_id=row.chunk_id,
                    doc_id=row.doc_id,
                )
                for row in df.itertuples()
            ]
        return rag

    # ------------------------------------------------------------------ retrieve

    def retrieve(
        self,
        queries: List[str],
        *,
        corpus: CorpusMode = "document_only",
        search: SearchStrategy = "full_expansion",
        search_memory: Optional[SearchStrategy] = None,
        fusion: Optional[FusionMethod] = None,
        k: int = 10,
        max_hops: int = 4,
        branching: Union[int, str] = 3,
        branching_doc: Optional[int] = None,
        branching_memory: Optional[int] = None,
        beam_width: Optional[int] = None,
        beam_width_memory: Optional[int] = None,
        gamma: float = 0.0,
        rrf_k: int = 60,
        lambda_mmr: float = 0.7,
        lambda_mmr_memory: Optional[float] = None,
        branching_threshold: float = 0.05,
        batched: bool = False,
        encode_chunk_size: Optional[int] = None,
        verify: bool = False,  # noqa: ARG002 — reserved for verify=True dual-tree variant
        global_dedup: bool = True,
        normalize_scores: bool = True,
        z_normalize: bool = True,
    ) -> List[RetrievalResult]:
        """Run retrieval. See §A.4 for paper-canonical combinations.

        Dispatches based on the three orthogonal axes:
            corpus  ∈ {document_only, memory_only, joint_index, dual_tree}
            search  ∈ {full_expansion, beamdr, cross_view_beam, mmr, single_hop}
            fusion  ∈ {rrf, agreement, None}  (dual_tree only)

        Additional fidelity flags (all default to paper-matching behaviour):
            global_dedup: Exclude globally-seen items from all frontier paths, not just
                within-path duplicates. Matches the paper experiment script.
            normalize_scores: Min-max normalise FAISS cosine scores per hop before the
                cumulative product. Matches the paper experiment script.
            z_normalize: Apply z-score normalisation inside AgreementFusion (Z-Agreement).
                Set to False to reproduce the plain-additive "Agreement" ablation rows.

        Returns ``List[RetrievalResult]``, one per query, sorted by score descending.
        """
        self._validate(
            corpus=corpus,
            search=search,
            fusion=fusion,
            branching=branching,
            beam_width=beam_width,
        )

        encoder = self._resolve_encoder()
        if corpus == "dual_tree":
            return self._retrieve_dual_tree(
                queries,
                encoder=encoder,
                search=search,
                search_memory=search_memory or search,
                fusion=fusion,
                k=k,
                max_hops=max_hops,
                branching=branching,
                branching_doc=branching_doc,
                branching_memory=branching_memory,
                beam_width=beam_width,
                beam_width_memory=beam_width_memory,
                gamma=gamma,
                rrf_k=rrf_k,
                lambda_mmr=lambda_mmr,
                lambda_mmr_memory=lambda_mmr_memory if lambda_mmr_memory is not None else lambda_mmr,
                branching_threshold=branching_threshold,
                batched=batched,
                encode_chunk_size=encode_chunk_size,
                global_dedup=global_dedup,
                normalize_scores=normalize_scores,
                z_normalize=z_normalize,
            )
        return self._retrieve_single_view(
            queries,
            encoder=encoder,
            corpus=corpus,
            search=search,
            k=k,
            max_hops=max_hops,
            branching=branching,
            beam_width=beam_width,
            lambda_mmr=lambda_mmr,
            branching_threshold=branching_threshold,
            batched=batched,
            encode_chunk_size=encode_chunk_size,
            global_dedup=global_dedup,
            normalize_scores=normalize_scores,
        )

    # ------------------------------------------------------------------ dispatchers

    def _retrieve_single_view(
        self,
        queries: List[str],
        *,
        encoder: BaseEncoder,
        corpus: CorpusMode,
        search: SearchStrategy,
        k: int,
        max_hops: int,
        branching: Union[int, str],
        beam_width: Optional[int],
        lambda_mmr: float,
        branching_threshold: float,
        batched: bool = False,
        encode_chunk_size: Optional[int] = None,
        global_dedup: bool = True,
        normalize_scores: bool = True,
    ) -> List[RetrievalResult]:
        from latentgraphrag.search import (
            run_beamdr,
            run_full_expansion,
            run_full_expansion_batched,
            run_mmr,
            run_single_hop,
        )

        view = CorpusView.from_mode(corpus)
        index = self._build_or_get_view_index(view)
        if index is None or len(index) == 0:
            return [RetrievalResult(query=q) for q in queries]

        if search == "single_hop":
            paths = run_single_hop(queries, encoder=encoder, index=index, k=k)
        elif search == "full_expansion":
            if batched:
                paths = run_full_expansion_batched(
                    queries,
                    encoder=encoder,
                    index=index,
                    k=k,
                    max_hops=max_hops,
                    branching=branching,
                    branching_threshold=branching_threshold,
                    encode_chunk_size=encode_chunk_size,
                    global_dedup=global_dedup,
                    normalize_scores=normalize_scores,
                )
            else:
                paths = run_full_expansion(
                    queries,
                    encoder=encoder,
                    index=index,
                    k=k,
                    max_hops=max_hops,
                    branching=branching,
                    branching_threshold=branching_threshold,
                    global_dedup=global_dedup,
                    normalize_scores=normalize_scores,
                )
        elif search == "beamdr":
            paths = run_beamdr(
                queries,
                encoder=encoder,
                index=index,
                k=k,
                max_hops=max_hops,
                beam_width=beam_width or 10,
                branch_per_state=int(branching) if isinstance(branching, int) else 3,
            )
        elif search == "mmr":
            paths = run_mmr(
                queries,
                encoder=encoder,
                index=index,
                k=k,
                max_hops=max_hops,
                branching=int(branching) if isinstance(branching, int) else 3,
                lambda_mmr=lambda_mmr,
                global_dedup=global_dedup,
                normalize_scores=normalize_scores,
            )
        else:
            raise ValueError(
                f"search={search!r} is not supported with corpus={corpus!r}."
            )

        return self._paths_to_results(queries, paths, k=k, projection_view=view)

    def _retrieve_dual_tree(
        self,
        queries: List[str],
        *,
        encoder: BaseEncoder,
        search: SearchStrategy,
        search_memory: SearchStrategy,
        fusion: Optional[FusionMethod],
        k: int,
        max_hops: int,
        branching: Union[int, str],
        branching_doc: Optional[int],
        branching_memory: Optional[int],
        beam_width: Optional[int],
        beam_width_memory: Optional[int],
        gamma: float,
        rrf_k: int,
        lambda_mmr: float,
        lambda_mmr_memory: float,
        branching_threshold: float,
        batched: bool = False,
        encode_chunk_size: Optional[int] = None,
        global_dedup: bool = True,
        normalize_scores: bool = True,
        z_normalize: bool = True,
    ) -> List[RetrievalResult]:
        from latentgraphrag.fusion import AgreementFusion, RRFFusion
        from latentgraphrag.search import (
            run_beamdr,
            run_cross_view_beam,
            run_dual_tree_batched,
            run_full_expansion,
            run_full_expansion_batched,
            run_mmr,
        )

        doc_index = self.chunks_index
        mem_index = self.memories_index
        if doc_index is None or mem_index is None:
            raise ValueError("dual_tree requires both chunks_index and memories_index.")

        if search == "cross_view_beam":
            paths = run_cross_view_beam(
                queries,
                encoder=encoder,
                doc_index=doc_index,
                memory_index=mem_index,
                k=k,
                max_hops=max_hops,
                beam_width=beam_width or 10,
                branch_per_state=int(branching) if isinstance(branching, int) else 3,
            )
            return self._paths_to_results(
                queries, paths, k=k, projection_view=CorpusView.from_mode("dual_tree")
            )

        # For full_expansion / beamdr / mmr we run TWO trees (docs + memories) and fuse.
        # Each tree can use its own search strategy via `search_memory`, plus per-tree
        # branching / beam_width / lambda_mmr overrides. This lets you mix, e.g.,
        # `full_expansion` over documents with `mmr` over the (clustered) memory tree.
        b_doc = branching_doc if branching_doc is not None else (int(branching) if isinstance(branching, int) else 3)
        b_mem = branching_memory if branching_memory is not None else (int(branching) if isinstance(branching, int) else 3)
        bw_doc = beam_width or 10
        bw_mem = beam_width_memory if beam_width_memory is not None else bw_doc

        # Fast path: when both trees use full_expansion and batched=True, share the
        # encoder call across substrates AND across queries at every hop.
        if batched and search == "full_expansion" and search_memory == "full_expansion":
            doc_paths, mem_paths = run_dual_tree_batched(
                queries,
                encoder=encoder,
                doc_index=doc_index,
                memory_index=mem_index,
                k=k,
                max_hops=max_hops,
                branching_doc=b_doc,
                branching_memory=b_mem,
                branching=branching,
                branching_threshold=branching_threshold,
                encode_chunk_size=encode_chunk_size,
                global_dedup=global_dedup,
                normalize_scores=normalize_scores,
            )
        else:
            def _one_tree(
                strategy: SearchStrategy,
                *,
                index,
                b: int,
                bw: int,
                lam: float,
            ):
                if strategy == "full_expansion":
                    if batched:
                        return run_full_expansion_batched(
                            queries, encoder=encoder, index=index, k=k, max_hops=max_hops,
                            branching=b if not isinstance(branching, str) else branching,
                            branching_threshold=branching_threshold,
                            encode_chunk_size=encode_chunk_size,
                            global_dedup=global_dedup,
                            normalize_scores=normalize_scores,
                        )
                    return run_full_expansion(
                        queries, encoder=encoder, index=index, k=k, max_hops=max_hops,
                        branching=b if not isinstance(branching, str) else branching,
                        branching_threshold=branching_threshold,
                        global_dedup=global_dedup,
                        normalize_scores=normalize_scores,
                    )
                if strategy == "beamdr":
                    return run_beamdr(
                        queries, encoder=encoder, index=index, k=k, max_hops=max_hops,
                        beam_width=bw, branch_per_state=b,
                    )
                if strategy == "mmr":
                    return run_mmr(
                        queries, encoder=encoder, index=index, k=k, max_hops=max_hops,
                        branching=b, lambda_mmr=lam,
                        global_dedup=global_dedup,
                        normalize_scores=normalize_scores,
                    )
                raise ValueError(f"strategy={strategy!r} not supported per-tree in dual_tree.")

            doc_paths = _one_tree(search, index=doc_index, b=b_doc, bw=bw_doc, lam=lambda_mmr)
            mem_paths = _one_tree(search_memory, index=mem_index, b=b_mem, bw=bw_mem, lam=lambda_mmr_memory)

        if fusion == "rrf" or fusion is None:
            fuser = RRFFusion(rrf_k=rrf_k)
        elif fusion == "agreement":
            fuser = AgreementFusion(gamma=gamma, z_normalize=z_normalize)
        else:
            raise ValueError(f"Unknown fusion={fusion!r}")

        return self._fuse_dual(queries, doc_paths, mem_paths, fuser=fuser, k=k)

    # ------------------------------------------------------------------ projection / fusion glue

    def _paths_to_results(
        self,
        queries: List[str],
        paths_per_query: List[List["SearchPath"]],  # noqa: F821
        *,
        k: int,
        projection_view: CorpusView,
    ) -> List[RetrievalResult]:
        results: List[RetrievalResult] = []
        for q, paths in zip(queries, paths_per_query):
            doc_seen: Dict[str, float] = {}
            mem_seen: Dict[str, float] = {}
            for p in paths:
                if not p.items:
                    continue
                terminal = p.items[-1]
                # Map memory hash_ids to source documents via the graph.
                doc_id = self._project_to_doc(terminal.hash_id)
                if terminal.hash_id.startswith("memory-"):
                    mem_seen[terminal.hash_id] = max(mem_seen.get(terminal.hash_id, 0.0), p.cumulative_score)
                if doc_id is not None:
                    doc_seen[doc_id] = max(doc_seen.get(doc_id, 0.0), p.cumulative_score)
            ranked = sorted(doc_seen.items(), key=lambda kv: kv[1], reverse=True)[:k]
            results.append(
                RetrievalResult(
                    query=q,
                    documents=[d for d, _ in ranked],
                    scores=[s for _, s in ranked],
                    memories=list(mem_seen.keys()),
                )
            )
        return results

    def _fuse_dual(
        self,
        queries: List[str],
        doc_paths_per_query: List[List["SearchPath"]],  # noqa: F821
        mem_paths_per_query: List[List["SearchPath"]],  # noqa: F821
        *,
        fuser,
        k: int,
    ) -> List[RetrievalResult]:
        memory_to_doc = self._memory_to_doc_map()
        results: List[RetrievalResult] = []
        for q, doc_paths, mem_paths in zip(queries, doc_paths_per_query, mem_paths_per_query):
            doc_ranked = self._aggregate_paths_to_docs(doc_paths)
            mem_ranked = self._aggregate_paths_to_memories(mem_paths)
            fused = fuser.fuse(doc_ranked, mem_ranked, memory_to_doc=memory_to_doc)[:k]
            results.append(
                RetrievalResult(
                    query=q,
                    documents=[d for d, _ in fused],
                    scores=[s for _, s in fused],
                    memories=[m for m, _ in mem_ranked[:k]],
                )
            )
        return results

    def _aggregate_paths_to_docs(self, paths) -> List[Tuple[str, float]]:
        best: Dict[str, float] = {}
        for p in paths:
            if not p.items:
                continue
            doc_id = self._project_to_doc(p.items[-1].hash_id)
            if doc_id is None:
                continue
            if p.cumulative_score > best.get(doc_id, float("-inf")):
                best[doc_id] = p.cumulative_score
        return sorted(best.items(), key=lambda kv: kv[1], reverse=True)

    def _aggregate_paths_to_memories(self, paths) -> List[Tuple[str, float]]:
        best: Dict[str, float] = {}
        for p in paths:
            if not p.items:
                continue
            hid = p.items[-1].hash_id
            if not hid.startswith("memory-"):
                continue
            if p.cumulative_score > best.get(hid, float("-inf")):
                best[hid] = p.cumulative_score
        return sorted(best.items(), key=lambda kv: kv[1], reverse=True)

    def _project_to_doc(self, hash_id: str) -> Optional[str]:
        if self.store is None:
            return hash_id if not hash_id.startswith("memory-") else None
        if hash_id not in self.store._name_to_index:  # noqa: SLF001
            return hash_id
        v = self.store.graph.vs[self.store._name_to_index[hash_id]]  # noqa: SLF001
        return v.attributes().get("doc_id") or hash_id

    def _memory_to_doc_map(self) -> Dict[str, str]:
        if not self.memories:
            return {}
        return {m.hash_id: m.doc_id for m in self.memories}

    def _build_or_get_view_index(self, view: CorpusView):
        """Return the MemoryIndex for the requested view (building joint on demand)."""
        if view.primary_index_name == "chunks":
            return self.chunks_index
        if view.primary_index_name == "memories":
            return self.memories_index
        if view.primary_index_name == "joint":
            return self._joint_index()
        return None

    def _joint_index(self):
        """Build / return a virtual joint index (chunks ∪ memories), cached."""
        if getattr(self, "_joint_cache", None) is not None:
            return self._joint_cache
        if self.chunks_index is None:
            return None
        if self.memories_index is None or len(self.memories_index) == 0:
            self._joint_cache = self.chunks_index
            return self._joint_cache
        # Materialize a transient MemoryIndex in memory by concatenating.
        joint_path = (self.save_dir or Path(".")) / "embeddings" / "joint.parquet"
        joint = MemoryIndex(
            joint_path,
            device=self.config.faiss_device,
            index_type=self.config.faiss_index_type,
        )
        if len(joint) == 0:
            all_ids = self.chunks_index.hash_ids + self.memories_index.hash_ids
            all_texts = self.chunks_index.texts + self.memories_index.texts
            chunk_mat = self.chunks_index.matrix()
            mem_mat = self.memories_index.matrix()
            joint_mat = np.concatenate([chunk_mat, mem_mat], axis=0).astype(np.float32)
            joint.upsert(all_ids, all_texts, joint_mat)
        self._joint_cache = joint
        return joint

    def _validate(
        self,
        *,
        corpus: CorpusMode,
        search: SearchStrategy,
        fusion: Optional[FusionMethod],
        branching: Union[int, str],
        beam_width: Optional[int],
    ) -> None:
        if corpus not in _VALID_CORPUS:
            raise ValueError(f"Invalid corpus={corpus!r}. Expected one of {sorted(_VALID_CORPUS)}.")
        if search not in _VALID_SEARCH:
            raise ValueError(f"Invalid search={search!r}. Expected one of {sorted(_VALID_SEARCH)}.")
        if fusion not in _VALID_FUSION:
            raise ValueError(f"Invalid fusion={fusion!r}. Expected rrf/agreement/none/None.")
        if fusion in {"rrf", "agreement"} and corpus != "dual_tree":
            raise ValueError(
                "Fusion is only meaningful when corpus='dual_tree' -- single-view retrieval has nothing to fuse."
            )
        if search == "cross_view_beam" and corpus != "dual_tree":
            raise ValueError("search='cross_view_beam' requires corpus='dual_tree'.")
        if corpus in {"memory_only", "joint_index", "dual_tree"} and self.memories_index is None:
            raise ValueError(
                "Memory-only / joint / dual modes require a relational memory index. "
                "Call build_graph() first (with openie_llm set)."
            )

