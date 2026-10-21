"""The memory tree's search strategy: RDR's tree with maximal-marginal-relevance selection.

Constructed units are short and often near-duplicates (the same fact as a triple and as a proposition,
or the same relation extracted from several passages). The document tree selects each state's top-scoring
unselected units; the memory tree instead selects them greedily by maximal marginal relevance, so one
state's children cover different facts. Everything else is RDR's tree unchanged: one level at a time,
units chosen at earlier levels are excluded, and a unit chosen by several parents becomes one child on
its best path.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Set, Tuple

import torch
from rdr.search import TreeSearch
from rdr.search.base import Proposal, StateSpec, state_probabilities, top_candidates


class MMRTreeSearch(TreeSearch):
    """``TreeSearch(depth, branching)`` whose states pick children by maximal marginal relevance.

    A state takes the ``pool * branching`` best units not selected at earlier levels and greedily adds the
    one maximising ``lam * score - (1 - lam) * redundancy``, where the redundancy is the largest dot product
    with a unit it has already picked; the first pick is the top-scoring unit.

    Args:
        depth: Encoded levels including the root.
        branching: Children per state.
        lam: Relevance weight ``lambda``.
        pool: Size of the candidate pool as a multiple of ``branching``.
        embeddings: Unit embeddings of the searched index (rows = index positions); set them with
            :meth:`bind` if they are not known at construction.
    """

    name = "mmr_tree"

    def __init__(self, depth: int = 4, branching: int = 3, lam: float = 0.5, pool: int = 5,
                 embeddings: Optional[torch.Tensor] = None) -> None:
        super().__init__(depth=depth, branching=branching, dedup="level", path_score="raw")
        self.lam = lam
        self.pool = pool
        self.embeddings = embeddings

    def bind(self, index) -> "MMRTreeSearch":
        """Use the embeddings of ``index`` (an ``rdr.DenseIndex``) for the redundancy term."""
        self.embeddings = index.embeddings
        return self

    def _pick(self, state, k: int, used: Set[int]) -> List[Tuple[int, float]]:
        cand = top_candidates(state, self.pool * k, used)
        if not cand:
            return []
        if self.embeddings is None:
            raise RuntimeError("MMRTreeSearch needs the index embeddings; call bind(index) first")
        rows = torch.tensor([d for d, _ in cand], device=self.embeddings.device)
        emb = self.embeddings[rows]
        score = torch.tensor([v for _, v in cand], dtype=emb.dtype, device=emb.device)
        chosen = [0]
        while len(chosen) < min(k, len(cand)):
            redundancy = (emb @ emb[chosen].T).max(dim=1).values
            objective = self.lam * score - (1.0 - self.lam) * redundancy
            objective[chosen] = -torch.inf
            chosen.append(int(objective.argmax()))
        return [cand[i] for i in chosen]

    def select(self, traversal, level: int, states: List[int]) -> List[StateSpec]:
        b = self._b(level)
        used = traversal.meta.setdefault("used", set())
        best: Dict[int, Proposal] = {}
        for si in states:
            s = traversal.states[si]
            probs = state_probabilities(s)
            for d, v in self._pick(s, b, used):
                p = self._proposal(traversal, si, d, v, probs)
                if d not in best or p.cum > best[d].cum:
                    best[d] = p
        used.update(best)
        props = list(best.values())
        base = len(traversal.proposals)
        traversal.proposals.extend(props)
        return [self._spec(p, base + k) for k, p in enumerate(props)]
