"""LatentGraphRAG retrieval: two recursive searches, one source-document ranking.

Both views use Recursive Dense Retrieval (RDR) unchanged: the same encoder, the same recursive update
and RDR's global readout. The document tree searches the source documents; the memory tree searches the
constructed units. The memory readout is projected onto the documents that supplied the memories, and
the two views are fused into a single document ranking.

Views (``view`` in :meth:`LatentGraphRAG.search`):

- ``"D+M"`` (default): document tree and memory tree, fused.
- ``"D"``: the document tree alone ("documents only").
- ``"M"``: the memory tree alone, projected to documents.
- ``"J"``: one tree over a joint index holding documents and memories.
- ``"D+J"``: the document tree fused with the joint tree.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, replace
from typing import Any, Dict, Hashable, List, Optional, Sequence, Tuple, Union

import torch
from rdr import GlobalReadout, RecursiveRetriever, TreeSearch
from rdr.index import DenseIndex
from rdr.prompts import ContextLayout, PromptConfig

from ..config import PAPER, LGRConfig
from ..inventory import MemoryInventory
from .fusion import fuse, project, rank
from .search import MMRTreeSearch

VIEWS = ("D+M", "D", "M", "J", "D+J")


@dataclass
class LGRIndex:
    """The indices LatentGraphRAG searches.

    Args:
        documents: Index over the source documents (or their chunks).
        memories: Index over the constructed units, or ``None`` for documents-only retrieval.
        inventory: The constructed units with their source documents.
        doc_of: Document id per position of ``documents`` (the corpus id unless the corpus is chunked).
    """

    documents: DenseIndex
    memories: Optional[DenseIndex]
    inventory: Optional[MemoryInventory]
    doc_of: List[Hashable]
    _joint: Optional[DenseIndex] = field(default=None, repr=False)

    def save(self, path: str) -> None:
        """Save the index to a directory: ``documents/`` and ``memories/`` (RDR indices with their
        embeddings and texts), ``inventory.jsonl`` (memories, sources, kinds) and ``lgr_index.json``.

        Args:
            path: Target directory (created if needed).
        """
        os.makedirs(path, exist_ok=True)
        self.documents.save(os.path.join(path, "documents"))
        if self.memories is not None:
            self.memories.save(os.path.join(path, "memories"))
        if self.inventory is not None:
            self.inventory.save_jsonl(os.path.join(path, "inventory.jsonl"))
        meta = {"format": 1, "documents": list(self.documents.ids), "doc_of": list(self.doc_of),
                "memories": self.memories is not None}
        with open(os.path.join(path, "lgr_index.json"), "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False)

    @classmethod
    def load(cls, path: str, device: Any = None, dtype: Optional[torch.dtype] = None) -> "LGRIndex":
        """Load an index written by :meth:`save`.

        Args:
            path: Directory of the saved index.
            device: Where the vectors live and the search runs (e.g. ``LatentGraphRAG(...).rdr.index_device``).
            dtype: Storage/compute dtype (default: float16 on GPU, float32 on CPU).
        """
        with open(os.path.join(path, "lgr_index.json"), encoding="utf-8") as f:
            meta = json.load(f)
        docs = DenseIndex.load(os.path.join(path, "documents"), device=device, dtype=dtype)
        docs.ids = list(meta["documents"])  # keep the original id types (DenseIndex.save writes strings)
        mems = DenseIndex.load(os.path.join(path, "memories"), device=device, dtype=dtype) if meta["memories"] else None
        inv_path = os.path.join(path, "inventory.jsonl")
        inventory = MemoryInventory.load_jsonl(inv_path) if os.path.exists(inv_path) else None
        return cls(documents=docs, memories=mems, inventory=inventory, doc_of=list(meta["doc_of"]))

    def joint(self) -> DenseIndex:
        """Documents and memories in one index (built from the existing embeddings, no re-encoding)."""
        if self._joint is None:
            if self.memories is None:
                raise ValueError("the joint index needs memories")
            emb = torch.cat([self.documents.embeddings, self.memories.embeddings.to(self.documents.embeddings)], dim=0)
            texts = list(self.documents.texts) + list(self.memories.texts)
            self._joint = DenseIndex(emb, texts=texts, device=self.documents.device, dtype=emb.dtype, normalized=True)
        return self._joint


@dataclass
class LGRResult:
    """One query's ranking and the views it was fused from (document id -> score)."""

    ranking: List[Tuple[Hashable, float]]
    views: Dict[str, Dict[Hashable, float]]

    @property
    def ids(self) -> List[Hashable]:
        """Document ids of :attr:`ranking`, best first."""
        return [d for d, _ in self.ranking]

    @property
    def document_view(self) -> Dict[Hashable, float]:
        return self.views.get("D", {})

    @property
    def memory_view(self) -> Dict[Hashable, float]:
        return self.views.get("M", {})


def paper_prompts(config: LGRConfig = PAPER) -> PromptConfig:
    """RDR's multi-hop prompt contract with the configuration's observation layout."""
    base = PromptConfig.preset("multi-hop")
    layout = ContextLayout(header=config.observation_header, item="Document {i}: {text}")
    return replace(base, layouts={}, default_layout=layout, observation_max_tokens=config.observation_max_tokens)


class LatentGraphRAG:
    """Recursive retrieval over documents and constructed knowledge, fused at the source.

    Args:
        model: An RDR checkpoint (path or model id) or any encoder object ``rdr.RecursiveRetriever``
            accepts.
        config: Search, readout and fusion settings (default: the paper's).
        **rdr_kwargs: Passed to :class:`rdr.RecursiveRetriever` (devices, batch sizes, dtype, …).

    Example::

        lgr = LatentGraphRAG("path/to/rdr-checkpoint")
        index = lgr.build(documents, inventory)
        results = lgr.search(["Who founded the company that ..."], index, k=10)
        results[0].ranking  # [(document id, score), ...]
    """

    def __init__(self, model: Any, config: LGRConfig = PAPER, **rdr_kwargs: Any) -> None:
        self.config = config
        readout = GlobalReadout(temperature=config.temperature, top_k=config.top_k, output_top_k=config.top_k)
        self.rdr = RecursiveRetriever(
            model, prompts=paper_prompts(config), search=TreeSearch(config.depth, config.branching, dedup="level"),
            readout=readout, candidate_k=config.top_k, **rdr_kwargs)

    # ------------------------------------------------------------------ indexing
    def build(self, documents: Union[Sequence[str], Dict[Any, str]], inventory: Optional[MemoryInventory] = None,
              groups: Optional[Sequence[Hashable]] = None, cache_dir: Optional[str] = None,
              show_progress_bar: bool = True) -> LGRIndex:
        """Encode the documents and the constructed units.

        Args:
            documents: Document texts, or ``{document id: text}``.
            inventory: Constructed units; their sources must be document ids (for a chunked corpus, the
                ids given in ``groups``). ``None`` builds a documents-only index.
            groups: For a chunked corpus, the document id of every chunk; a document's score is then the
                maximum over its chunks among the readout's top units.
            cache_dir: Directory for embedding caches (``documents/`` and ``memories/`` below it).
            show_progress_bar: Show encoding progress.
        """
        sub = (lambda name: f"{cache_dir}/{name}") if cache_dir else (lambda name: None)
        docs = self.rdr.build_index(documents, cache_dir=sub("documents"), show_progress_bar=show_progress_bar)
        doc_of = list(groups) if groups is not None else list(docs.ids)
        if len(doc_of) != len(docs):
            raise ValueError("groups needs one document id per document entry")
        mems = None
        if inventory is not None and len(inventory):
            mems = self.rdr.build_index(inventory.texts, cache_dir=sub("memories"), show_progress_bar=show_progress_bar)
        return LGRIndex(documents=docs, memories=mems, inventory=inventory, doc_of=doc_of)

    def load_index(self, path: str) -> LGRIndex:
        """Load an index saved with :meth:`LGRIndex.save` onto this retriever's index device."""
        return LGRIndex.load(path, device=self.rdr.index_device)

    # ------------------------------------------------------------------ views
    def _ranking_dict(self, ranking) -> Dict[int, float]:
        return {int(p): float(s) for p, s in zip(ranking.ids.tolist(), ranking.scores.tolist())}

    def _documents(self, positions: Dict[int, float], index: LGRIndex) -> Dict[Hashable, float]:
        out: Dict[Hashable, float] = {}
        for pos, s in positions.items():
            d = index.doc_of[pos]
            if s > out.get(d, float("-inf")):
                out[d] = s
        return out

    def _project(self, positions: Dict[int, float], index: LGRIndex) -> Dict[Hashable, float]:
        return project(positions, index.inventory.source_map(), reduce=self.config.projection)

    def _memory_search(self, index: LGRIndex):
        c = self.config
        if c.memory_mmr:
            return MMRTreeSearch(c.depth, c.memory_branching, lam=c.mmr_lambda, pool=c.mmr_pool).bind(index.memories)
        return TreeSearch(c.depth, c.memory_branching, dedup="level")

    def _run(self, queries, index: DenseIndex, search, instruction) -> List[Dict[int, float]]:
        trav = self.rdr.traverse(queries, index, search=search, instruction=instruction)
        return [self._ranking_dict(r) for r in self.rdr.read(trav, index)]

    def _joint_views(self, queries, index: LGRIndex, instruction) -> List[Dict[Hashable, float]]:
        joint = index.joint()
        n_docs = len(index.documents)
        out = []
        for pos in self._run(queries, joint, TreeSearch(self.config.depth, self.config.joint_branching, dedup="level"),
                             instruction):
            docs = {p: s for p, s in pos.items() if p < n_docs}
            mems = {p - n_docs: s for p, s in pos.items() if p >= n_docs}
            view = self._documents(docs, index)
            for d, s in self._project(mems, index).items():
                view[d] = max(s, view.get(d, 0.0))
            out.append(view)
        return out

    # ------------------------------------------------------------------ search
    def search(self, queries: Sequence[str], index: LGRIndex, k: Optional[int] = 10, view: str = "D+M",
               instruction: Optional[str] = None) -> List[LGRResult]:
        """Rank documents for each query.

        Args:
            queries: Questions.
            index: Output of :meth:`build`.
            k: Length of each returned ranking (``None`` returns every ranked document).
            view: ``"D+M"`` (paper), ``"D"`` (documents only), ``"M"``, ``"J"`` or ``"D+J"``.
            instruction: Root instruction (default: RDR's multi-hop instruction).

        Returns:
            One :class:`LGRResult` per query.
        """
        if view not in VIEWS:
            raise ValueError(f"view must be one of {VIEWS}")
        parts = view.split("+")
        if any(p in ("M", "J") for p in parts) and index.memories is None:
            raise ValueError(f"view {view!r} needs an index built with an inventory")
        c = self.config
        per_view: Dict[str, List[Dict[Hashable, float]]] = {}
        if "D" in parts:
            per_view["D"] = [self._documents(p, index) for p in self._run(queries, index.documents, None, instruction)]
        if "M" in parts:
            per_view["M"] = [self._project(p, index)
                             for p in self._run(queries, index.memories, self._memory_search(index), instruction)]
        if "J" in parts:
            per_view["J"] = self._joint_views(queries, index, instruction)
        out = []
        for i in range(len(queries)):
            views = {name: per_view[name][i] for name in parts}
            if len(parts) == 1:
                fused = views[parts[0]]
            else:
                weights = [c.document_weight if name == "D" else c.memory_weight for name in parts]
                fused = fuse([views[name] for name in parts], weights, method=c.fusion, rrf_k=c.rrf_k)
            out.append(LGRResult(ranking=[(d, fused[d]) for d in rank(fused, k)], views=views))
        return out
