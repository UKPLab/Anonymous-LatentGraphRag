"""Document-memory z-agreement fusion.

Given doc-view scores ``s_D(d)`` and memory-view scores projected to documents
``s_M(d) = max_{m: pi(m)=d} s_M(m)``, the fused score is::

    s_final(d) = ẑ_D(d) + ẑ_M(d) + gamma * 1[d in L_D AND d in L_M]

where ``ẑ_D`` and ``ẑ_M`` are z-score normalised (zero mean, unit variance) within
their respective retrieved sets.  Z-normalisation puts both views on the same
scale before summing — without it the memory-tree scores (small cosine products)
would be dwarfed by the document-tree scores.

Positive ``gamma`` boosts documents found by both views; negative ``gamma`` penalises
disagreement.  ``gamma=0`` is plain z-score additive fusion.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Dict, List, Tuple

from latentgraphrag.fusion.base import BaseFusion


def _z_normalize(scores: Dict[str, float]) -> Dict[str, float]:
    """Return a copy of *scores* with values standardised to (mean=0, std=1).

    Docs with score 0 (= not retrieved by this view) are excluded from the
    statistics and remain 0 in the output.
    """
    active = {k: v for k, v in scores.items() if v != 0.0}
    if len(active) < 2:
        # Nothing useful to normalise; return as-is (single value → z=0)
        return {k: (0.0 if v == 0.0 else 0.0) for k, v in scores.items()}

    vals = list(active.values())
    mu = sum(vals) / len(vals)
    sigma = math.sqrt(sum((v - mu) ** 2 for v in vals) / len(vals))
    if sigma < 1e-9:
        return {k: 0.0 for k in scores}

    return {k: ((v - mu) / sigma if v != 0.0 else 0.0) for k, v in scores.items()}


class AgreementFusion(BaseFusion):
    """Document-memory fusion with optional z-score normalisation.

    Args:
        gamma: Agreement bonus added when a document appears in both views
            (after normalisation). ``gamma=0`` is pure additive fusion.
        z_normalize: When True (default), each view's scores are z-score normalised
            (zero mean, unit variance) before summing — this is Z-Agreement from the
            paper. When False, raw cumulative scores are summed directly — this
            reproduces the plain "Agreement" ablation rows in Table 1.
    """

    name = "agreement"

    def __init__(self, gamma: float = 0.0, z_normalize: bool = True) -> None:
        self.gamma = float(gamma)
        self.z_normalize = z_normalize

    def fuse(
        self,
        doc_ranked: List[Tuple[str, float]],
        mem_ranked: List[Tuple[str, float]],
        *,
        memory_to_doc: Dict[str, str],
    ) -> List[Tuple[str, float]]:
        # --- doc-view scores ---
        doc_score: Dict[str, float] = {d: s for d, s in doc_ranked}

        # --- project memory scores to document level (max over memories) ---
        mem_score_per_doc: Dict[str, float] = defaultdict(lambda: float("-inf"))
        for mem_id, score in mem_ranked:
            doc_id = memory_to_doc.get(mem_id, mem_id)
            if score > mem_score_per_doc[doc_id]:
                mem_score_per_doc[doc_id] = score

        # Replace −∞ sentinel with 0
        mem_score_clean: Dict[str, float] = {
            k: (v if v > float("-inf") else 0.0)
            for k, v in mem_score_per_doc.items()
        }

        if self.z_normalize:
            # Z-Agreement: normalise each view to (mean=0, std=1) before summing.
            effective_doc = _z_normalize(doc_score)
            effective_mem = _z_normalize(mem_score_clean)
        else:
            # Plain additive Agreement: use raw scores directly.
            effective_doc = doc_score
            effective_mem = mem_score_clean

        # --- fuse: score_D + score_M + gamma * 1[d in both] ---
        all_docs = set(doc_score) | set(mem_score_clean)
        fused: Dict[str, float] = {}
        for d in all_docs:
            sd = effective_doc.get(d, 0.0)
            sm = effective_mem.get(d, 0.0)
            agree_bonus = self.gamma if (d in doc_score and d in mem_score_clean) else 0.0
            fused[d] = sd + sm + agree_bonus

        return sorted(fused.items(), key=lambda kv: kv[1], reverse=True)
