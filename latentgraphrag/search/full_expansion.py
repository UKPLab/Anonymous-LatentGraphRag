"""Full expansion (paper §3.3.2): branch out to top-b at every hop.

After ``H`` hops with branching ``b`` you have up to ``b^H`` candidate paths. Paths are
deduplicated by terminal item; scores accumulate multiplicatively along hops.

When ``branching="adaptive"`` we only expand to neighbors whose score margin to the best
so far stays within ``branching_threshold``. This recovers the AdaptiveAlpha behavior
from the legacy code in a clean way.

``global_dedup=True`` (default) matches the paper's experiment implementation: once an
item is selected by *any* frontier path at any hop, it is excluded from all subsequent
selections for that query. This is stricter than per-path deduplication and prevents the
same item from appearing in multiple branches.

``normalize_scores=True`` (default) applies min-max normalization to the FAISS cosine
similarities before they enter the cumulative score product, matching the paper's
experiment script which normalised raw dot-product scores to [0, 1] per hop.
"""

from __future__ import annotations

from typing import List, Optional, Union

import numpy as np

from latentgraphrag.encoders.base import BaseEncoder
from latentgraphrag.memory.index import MemoryIndex
from latentgraphrag.search.context import RetrievedItem, SearchPath, build_context


def _pick_branches(
    scores: np.ndarray,
    indices: np.ndarray,
    *,
    branching: Union[int, str],
    branching_threshold: float,
) -> List[int]:
    """Return the local indices into ``scores``/``indices`` to expand for this state."""
    if isinstance(branching, str):
        if branching != "adaptive":
            raise ValueError(f"Unknown branching mode: {branching!r}")
        if scores.size == 0:
            return []
        best = float(scores[0])
        keep = [0]
        for j in range(1, scores.size):
            if best - float(scores[j]) <= branching_threshold:
                keep.append(j)
            else:
                break
        return keep
    return list(range(min(int(branching), scores.size)))


def _minmax_norm(scores: np.ndarray) -> np.ndarray:
    """Min-max normalize an array to [0, 1]. Returns a copy; safe for size-0 input."""
    if scores.size == 0:
        return scores.copy()
    s_min = float(scores.min())
    s_max = float(scores.max())
    if s_max - s_min < 1e-12:
        return np.zeros_like(scores)
    return (scores - s_min) / (s_max - s_min)


def run_full_expansion(
    queries: List[str],
    *,
    encoder: BaseEncoder,
    index: MemoryIndex,
    k: int = 100,
    max_hops: int = 4,
    branching: Union[int, str] = 3,
    branching_threshold: float = 0.05,
    query_instruction: Optional[str] = None,
    global_dedup: bool = True,
    normalize_scores: bool = True,
) -> List[List[SearchPath]]:
    """Run iterative full-expansion search for each query.

    Returns ``results[i]`` = list of ``SearchPath`` for query ``i``, sorted by cumulative
    score descending and truncated to ``k`` paths.

    Args:
        global_dedup: When True (default), an item selected by any frontier path is
            excluded from all subsequent selections for this query. Matches the paper's
            experiment implementation. When False, only within-path deduplication is
            applied (each path avoids revisiting its own items).
        normalize_scores: When True (default), FAISS cosine similarities are min-max
            normalised to [0, 1] per frontier state per hop before entering the
            cumulative score product. Matches the paper's experiment script.
    """
    out: List[List[SearchPath]] = []

    # We expand BFS-style: maintain a frontier (one per query). Vectorize encoding inside
    # each hop across all frontier states for that query.
    for q in queries:
        frontier: List[SearchPath] = [SearchPath()]
        all_paths: List[SearchPath] = []
        global_seen: set = set()  # shared across all paths when global_dedup=True

        for hop in range(max_hops):
            if not frontier:
                break
            contexts = [build_context(q, p) for p in frontier]
            ctx_vecs = encoder.encode(contexts, is_query=True, instruction=query_instruction)
            # Search for top-branching candidates per frontier state.
            # We over-fetch a little so adaptive branching has room.
            top = max(int(branching) if isinstance(branching, int) else 16, 8)
            scores, idx = index.search(ctx_vecs, k=top)

            next_frontier: List[SearchPath] = []
            for fi, path in enumerate(frontier):
                seen = set(path.hash_ids)
                if global_dedup:
                    seen = seen | global_seen
                local_scores = scores[fi]
                local_idx = idx[fi]
                # Drop already-seen items before adaptive thresholding.
                filtered = [
                    (int(local_idx[j]), float(local_scores[j]))
                    for j in range(len(local_idx))
                    if int(local_idx[j]) >= 0 and index.hash_ids[int(local_idx[j])] not in seen
                ]
                if not filtered:
                    continue
                f_scores = np.asarray([s for _, s in filtered], dtype=np.float32)
                f_idx = np.asarray([i for i, _ in filtered], dtype=np.int64)
                if normalize_scores:
                    f_scores = _minmax_norm(f_scores)
                pick = _pick_branches(
                    f_scores,
                    f_idx,
                    branching=branching,
                    branching_threshold=branching_threshold,
                )
                for j in pick:
                    i_global = int(f_idx[j])
                    hid = index.hash_ids[i_global]
                    item = RetrievedItem(
                        hash_id=hid,
                        text=index.texts[i_global],
                        score=float(f_scores[j]),
                        hop=hop,
                    )
                    if global_dedup:
                        global_seen.add(hid)
                    next_frontier.append(path.with_extension(item))

            all_paths.extend(next_frontier)
            frontier = next_frontier

        all_paths.sort(key=lambda p: p.cumulative_score, reverse=True)
        out.append(all_paths[:k])
    return out
