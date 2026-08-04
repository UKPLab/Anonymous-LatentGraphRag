"""MMR-decoded expansion.

At each hop, instead of picking the top-``b`` by cosine similarity alone, we pick the
top-``b`` that maximize:

    score(x) = lambda_mmr * sim(c_t, x)  -  (1 - lambda_mmr) * max_{y in retrieved} sim(x, y)

This trades raw relevance for diversity — useful in width-oriented tasks like FanOutQA.
"""

from __future__ import annotations

from typing import List, Optional

import numpy as np

from latentgraphrag.encoders.base import BaseEncoder
from latentgraphrag.memory.index import MemoryIndex
from latentgraphrag.search.context import RetrievedItem, SearchPath, build_context


def _mmr_select(
    candidates_idx: np.ndarray,
    candidates_scores: np.ndarray,
    *,
    candidate_vecs: np.ndarray,
    seen_vecs: np.ndarray,
    branching: int,
    lambda_mmr: float,
) -> List[int]:
    """Return the local positions to keep after MMR re-ranking."""
    selected: List[int] = []
    avail = list(range(len(candidates_idx)))
    while avail and len(selected) < branching:
        best_pos = None
        best_score = -np.inf
        for pos in avail:
            if seen_vecs.shape[0] == 0 and not selected:
                redundancy = 0.0
            else:
                reference = []
                if seen_vecs.shape[0] > 0:
                    reference.append(seen_vecs)
                if selected:
                    reference.append(candidate_vecs[selected])
                ref_matrix = np.concatenate(reference, axis=0)
                redundancy = float(np.max(candidate_vecs[pos] @ ref_matrix.T))
            s = lambda_mmr * float(candidates_scores[pos]) - (1.0 - lambda_mmr) * redundancy
            if s > best_score:
                best_score = s
                best_pos = pos
        if best_pos is None:
            break
        selected.append(best_pos)
        avail.remove(best_pos)
    return selected


def run_mmr(
    queries: List[str],
    *,
    encoder: BaseEncoder,
    index: MemoryIndex,
    k: int = 100,
    max_hops: int = 4,
    branching: int = 3,
    lambda_mmr: float = 0.7,
    query_instruction: Optional[str] = None,
    global_dedup: bool = True,
    normalize_scores: bool = True,
) -> List[List[SearchPath]]:
    """MMR-decoded full expansion over ``index``.

    Args:
        global_dedup: When True (default), items selected by any frontier path are
            globally excluded from later selections within the same query.
        normalize_scores: When True (default), FAISS cosine similarities are min-max
            normalised to [0, 1] per state per hop before the cumulative product.
    """
    if not (0.0 <= lambda_mmr <= 1.0):
        raise ValueError(f"lambda_mmr must be in [0, 1]; got {lambda_mmr}")
    out: List[List[SearchPath]] = []
    matrix = index.matrix()
    for q in queries:
        frontier: List[SearchPath] = [SearchPath()]
        all_paths: List[SearchPath] = []
        global_seen: set = set()
        for hop in range(max_hops):
            if not frontier:
                break
            contexts = [build_context(q, p) for p in frontier]
            ctx_vecs = encoder.encode(contexts, is_query=True, instruction=query_instruction)
            top = max(branching * 4, 8)
            scores, idx = index.search(ctx_vecs, k=top)

            next_frontier: List[SearchPath] = []
            for fi, path in enumerate(frontier):
                seen = set(path.hash_ids)
                if global_dedup:
                    seen = seen | global_seen
                local_scores = scores[fi]
                local_idx = idx[fi]
                filtered_pos = [
                    j for j in range(len(local_idx))
                    if int(local_idx[j]) >= 0 and index.hash_ids[int(local_idx[j])] not in seen
                ]
                if not filtered_pos:
                    continue
                f_idx = local_idx[filtered_pos]
                f_scores = local_scores[filtered_pos]
                if normalize_scores and f_scores.size > 0:
                    s_min = float(f_scores.min())
                    s_max = float(f_scores.max())
                    if s_max - s_min > 1e-12:
                        f_scores = (f_scores - s_min) / (s_max - s_min)
                    else:
                        f_scores = np.zeros_like(f_scores)
                cand_vecs = matrix[f_idx]
                seen_vecs = matrix[[index.hash_ids.index(h) for h in path.hash_ids]] if path.items else np.zeros((0, matrix.shape[1]), dtype=np.float32)
                pick = _mmr_select(
                    f_idx,
                    f_scores,
                    candidate_vecs=cand_vecs,
                    seen_vecs=seen_vecs,
                    branching=branching,
                    lambda_mmr=lambda_mmr,
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
