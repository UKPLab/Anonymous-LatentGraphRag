"""Reciprocal Rank Fusion (RRF).

For two ranked lists L_D (documents) and L_M (memories projected to documents) we
compute the RRF score for each doc:

    rrf(d) = sum_{L in {L_D, L_M}} 1 / (rrf_k + rank_L(d))

Paper §3.4 "Dual RRF".
"""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Tuple

from latentgraphrag.fusion.base import BaseFusion


class RRFFusion(BaseFusion):
    """Default ``rrf_k=60`` is the standard from Cormack et al. 2009."""

    name = "rrf"

    def __init__(self, rrf_k: int = 60) -> None:
        if rrf_k < 1:
            raise ValueError(f"rrf_k must be >= 1; got {rrf_k}")
        self.rrf_k = rrf_k

    def fuse(
        self,
        doc_ranked: List[Tuple[str, float]],
        mem_ranked: List[Tuple[str, float]],
        *,
        memory_to_doc: Dict[str, str],
    ) -> List[Tuple[str, float]]:
        scores: Dict[str, float] = defaultdict(float)
        for rank, (doc_id, _score) in enumerate(doc_ranked, start=1):
            scores[doc_id] += 1.0 / (self.rrf_k + rank)
        for rank, (mem_id, _score) in enumerate(mem_ranked, start=1):
            doc_id = memory_to_doc.get(mem_id, mem_id)
            scores[doc_id] += 1.0 / (self.rrf_k + rank)
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        return ranked
