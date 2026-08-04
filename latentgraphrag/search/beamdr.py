"""BeamDR-style beam search (paper §3.3.2).

After each hop we keep only the top-``beam_width`` paths by cumulative score, instead
of full expansion.
"""

from __future__ import annotations

from typing import List, Optional

import numpy as np

from latentgraphrag.encoders.base import BaseEncoder
from latentgraphrag.memory.index import MemoryIndex
from latentgraphrag.search.context import RetrievedItem, SearchPath, build_context


def run_beamdr(
    queries: List[str],
    *,
    encoder: BaseEncoder,
    index: MemoryIndex,
    k: int = 100,
    max_hops: int = 4,
    beam_width: int = 10,
    branch_per_state: int = 3,
    query_instruction: Optional[str] = None,
) -> List[List[SearchPath]]:
    """BeamDR-style search. Each hop expands each beam state by ``branch_per_state`` and
    keeps the top-``beam_width`` paths overall.
    """
    out: List[List[SearchPath]] = []
    for q in queries:
        beam: List[SearchPath] = [SearchPath()]
        finished: List[SearchPath] = []
        for hop in range(max_hops):
            if not beam:
                break
            contexts = [build_context(q, p) for p in beam]
            ctx_vecs = encoder.encode(contexts, is_query=True, instruction=query_instruction)
            scores, idx = index.search(ctx_vecs, k=branch_per_state * 2)

            candidates: List[SearchPath] = []
            for bi, path in enumerate(beam):
                seen = set(path.hash_ids)
                added = 0
                for rank in range(idx.shape[1]):
                    i = int(idx[bi, rank])
                    if i < 0:
                        continue
                    hid = index.hash_ids[i]
                    if hid in seen:
                        continue
                    item = RetrievedItem(
                        hash_id=hid,
                        text=index.texts[i],
                        score=float(scores[bi, rank]),
                        hop=hop,
                    )
                    candidates.append(path.with_extension(item))
                    added += 1
                    if added >= branch_per_state:
                        break

            candidates.sort(key=lambda p: p.cumulative_score, reverse=True)
            beam = candidates[:beam_width]
            finished.extend(beam)

        finished.sort(key=lambda p: p.cumulative_score, reverse=True)
        out.append(finished[:k])
    return out
