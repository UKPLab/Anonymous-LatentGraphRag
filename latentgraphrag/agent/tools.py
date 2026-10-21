"""The agent's search tool.

The paper's tool is plain embedding search: the agent's query is encoded with Qwen3-Embedding-8B
(last-token pooling, query cut to 512 characters and 512 tokens), scored against a fixed document
index by dot product, and the top five documents are returned, each cut to 2,000 characters.

:class:`RankFileFusedSearchTool` is the fused-tool ablation: reciprocal rank fusion of the live query
ranking with a fixed per-question ranking (e.g. LatentGraphRAG's), returning only documents the agent
has not seen yet.
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Mapping, Optional, Protocol, Sequence, Set, runtime_checkable

import numpy as np

from .seed import Seed

SEARCH_K = 5
SEARCH_TEXT_CAP = 2000
LOG_TOP = 1000


@dataclass
class SearchHit:
    """One returned document: its id (``None`` when unknown) and the text shown to the agent."""

    doc_id: Any
    text: str


@dataclass
class SearchResult:
    """What one search call returned, plus the logged top of the underlying ranking.

    Args:
        hits: The documents shown to the agent, in order.
        top_positions: Index positions of the logged top of the live query ranking (paper: top 1,000).
        top_scores: Their scores, rounded to four decimals as in the paper's logs.
    """

    hits: List[SearchHit]
    top_positions: List[int] = field(default_factory=list)
    top_scores: List[float] = field(default_factory=list)

    @property
    def texts(self) -> List[str]:
        return [h.text for h in self.hits]

    @property
    def ids(self) -> List[Any]:
        return [h.doc_id for h in self.hits]


@dataclass
class SearchContext:
    """Per-episode search state: the question and the index positions the agent has already been shown."""

    question: str
    shown: Set[int] = field(default_factory=set)


@runtime_checkable
class SearchTool(Protocol):
    """A search tool: ``start`` once per question, then ``search`` per agent query."""

    def start(self, question: str, seed: Seed) -> SearchContext:  # pragma: no cover - protocol
        ...

    def search(self, query: str, context: SearchContext) -> SearchResult:  # pragma: no cover - protocol
        ...


class Qwen3QueryEncoder:
    """Query encoder of the paper's search tool: Qwen3-Embedding, last-token pooling, L2-normalized.

    The query string is passed without an instruction prefix, cut to ``max_chars`` characters and then
    to ``max_length`` tokens, exactly as in the paper's runner. Thread-safe (one forward pass at a time).

    Args:
        model_name: Hugging Face model id (paper: ``Qwen/Qwen3-Embedding-8B``).
        device: Torch device.
        dtype: Torch dtype name (paper: ``float16``).
        max_chars: Character cut applied before tokenization (paper: 512).
        max_length: Token cut (paper: 512).
    """

    def __init__(self, model_name: str = "Qwen/Qwen3-Embedding-8B", device: str = "cuda", dtype: str = "float16",
                 max_chars: int = 512, max_length: int = 512) -> None:
        import torch
        from transformers import AutoModel, AutoTokenizer

        self._torch = torch
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name, torch_dtype=getattr(torch, dtype)).to(device).eval()
        self.device = device
        self.max_chars = max_chars
        self.max_length = max_length
        self._lock = threading.Lock()

    def __call__(self, query: str) -> np.ndarray:
        torch = self._torch
        with self._lock:
            b = self.tokenizer([query[: self.max_chars]], padding=True, truncation=True, max_length=self.max_length,
                               return_tensors="pt").to(self.device)
            with torch.no_grad():
                h = self.model(**b).last_hidden_state[:, -1]
                h = torch.nn.functional.normalize(h, dim=-1)
            return h.cpu().float().numpy()[0]


class DenseSearchTool:
    """Embedding search over a fixed index (the paper's search tool).

    Args:
        embeddings: ``(N, d)`` document embeddings (paper: Qwen3-Embedding-8B, L2-normalized).
        texts: The ``N`` document texts.
        ids: Document ids returned with the hits (default: positions ``0 … N-1``).
        query_encoder: ``str -> (d,)`` vector; default :class:`Qwen3QueryEncoder` (loaded lazily).
        k: Documents returned per call (paper: 5).
        text_cap: Character cap per returned document (paper: 2,000).
        log_top: Length of the logged live ranking (paper: 1,000).
    """

    def __init__(self, embeddings: np.ndarray, texts: Sequence[str], ids: Optional[Sequence[Any]] = None,
                 query_encoder: Optional[Callable[[str], np.ndarray]] = None, k: int = SEARCH_K,
                 text_cap: Optional[int] = SEARCH_TEXT_CAP, log_top: int = LOG_TOP) -> None:
        self.embeddings = np.asarray(embeddings)
        self.texts = list(texts)
        if len(self.texts) != self.embeddings.shape[0]:
            raise ValueError("embeddings and texts differ in length")
        self.ids = list(ids) if ids is not None else list(range(len(self.texts)))
        self._query_encoder = query_encoder
        self.k = k
        self.text_cap = text_cap
        self.log_top = log_top

    @property
    def query_encoder(self) -> Callable[[str], np.ndarray]:
        if self._query_encoder is None:
            self._query_encoder = Qwen3QueryEncoder()
        return self._query_encoder

    def _cut(self, text: str) -> str:
        return text[: self.text_cap] if self.text_cap is not None else text

    def rank(self, query: str) -> tuple:
        """Positions and scores of the live query ranking, best first (the logged top ``log_top``)."""
        v = self.query_encoder(query)
        s = self.embeddings @ v
        order = np.argsort(-s)[: self.log_top]
        return order, s

    def start(self, question: str, seed: Seed) -> SearchContext:
        return SearchContext(question=question)

    def search(self, query: str, context: Optional[SearchContext] = None) -> SearchResult:
        order, s = self.rank(query)
        hits = [SearchHit(self.ids[int(i)], self._cut(self.texts[int(i)])) for i in order[: self.k]]
        return SearchResult(hits=hits, top_positions=[int(i) for i in order],
                            top_scores=[round(float(s[i]), 4) for i in order])


def _normalize_question(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


class RankFileFusedSearchTool:
    """Fused-tool ablation: RRF of the live query ranking and a fixed per-question ranking, novelty-filtered.

    For every agent query, each of the live top-``log_top`` positions and each position of the fixed
    ranking of this question receives ``1 / (rrf_offset + rank)`` (rank from 0, i.e. RRF with k = 60);
    documents are ordered by the summed score (ties keep first-seen order), documents already shown in
    this episode (seed and earlier results) are skipped, and the top ``k`` are returned.

    Args:
        base: The embedding search tool providing the index, the texts and the live ranking.
        rank_lists: ``normalized question -> list of index positions`` (the fixed ranking, best first).
            Keys are normalized with whitespace collapsed and lower-cased.
        k: Documents returned per call (paper: 5).
        rrf_offset: Offset added to the 0-based rank (paper: 61, i.e. RRF k = 60 with 1-based ranks).
        position_of: ``seed doc id -> index position``, to count seed documents as shown.
        match_seed_text: Also mark seed documents without a known id as shown by matching the first 300
            characters of their normalized text against the index texts.
    """

    def __init__(self, base: DenseSearchTool, rank_lists: Mapping[str, Sequence[int]], k: int = SEARCH_K,
                 rrf_offset: int = 61, position_of: Optional[Mapping[Any, int]] = None,
                 match_seed_text: bool = True) -> None:
        self.base = base
        self.rank_lists = {_normalize_question(q): [int(i) for i in r] for q, r in rank_lists.items()}
        self.k = k
        self.rrf_offset = rrf_offset
        self.position_of = dict(position_of) if position_of is not None else {}
        self.match_seed_text = match_seed_text
        self._text_index: Optional[Dict[str, int]] = None

    def _text_key(self, text: str) -> str:
        return _normalize_question(text)[:300]

    def _texts(self) -> Dict[str, int]:
        if self._text_index is None:
            idx: Dict[str, int] = {}
            for i, t in enumerate(self.base.texts):
                idx.setdefault(self._text_key(t), i)
            self._text_index = idx
        return self._text_index

    def start(self, question: str, seed: Seed) -> SearchContext:
        shown = {self.position_of[d.doc_id] for d in seed.docs[:10] if d.doc_id in self.position_of}
        if self.match_seed_text:
            ti = self._texts()
            shown |= {ti[self._text_key(d.text)] for d in seed.docs[:10]
                      if not d.doc_id and self._text_key(d.text or "") in ti}
        return SearchContext(question=question, shown=shown)

    def search(self, query: str, context: SearchContext) -> SearchResult:
        order, s = self.base.rank(query)
        sc: Dict[int, float] = {}
        for r, i in enumerate(order):
            sc[int(i)] = sc.get(int(i), 0.0) + 1.0 / (self.rrf_offset + r)
        for r, i in enumerate(self.rank_lists.get(_normalize_question(context.question), [])):
            sc[int(i)] = sc.get(int(i), 0.0) + 1.0 / (self.rrf_offset + r)
        fused = sorted(sc, key=lambda i: -sc[i])
        pick = [i for i in fused if i not in context.shown][: self.k]
        context.shown.update(pick)
        hits = [SearchHit(self.base.ids[i], self.base._cut(self.base.texts[i])) for i in pick]
        return SearchResult(hits=hits, top_positions=[int(i) for i in order],
                            top_scores=[round(float(s[i]), 4) for i in order])
