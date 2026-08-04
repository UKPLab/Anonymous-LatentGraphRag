"""Single-hop dense retrieval — the Qwen3-Embedding baseline in the paper."""

from __future__ import annotations

from typing import List, Optional

from latentgraphrag.encoders.base import BaseEncoder
from latentgraphrag.memory.index import MemoryIndex
from latentgraphrag.search.context import RetrievedItem, SearchPath


def run_single_hop(
    queries: List[str],
    *,
    encoder: BaseEncoder,
    index: MemoryIndex,
    k: int = 10,
    query_instruction: Optional[str] = None,
) -> List[List[SearchPath]]:
    """One forward pass; return the top-k as one-hop paths.

    Output: ``results[i]`` is a list of single-hop ``SearchPath`` for query ``i``.
    """
    query_vecs = encoder.encode(list(queries), is_query=True, instruction=query_instruction)
    scores, idx = index.search(query_vecs, k=k)
    out: List[List[SearchPath]] = []
    for qi in range(len(queries)):
        paths: List[SearchPath] = []
        for rank in range(idx.shape[1]):
            i = int(idx[qi, rank])
            if i < 0:
                continue
            item = RetrievedItem(
                hash_id=index.hash_ids[i],
                text=index.texts[i],
                score=float(scores[qi, rank]),
                hop=0,
            )
            paths.append(SearchPath(items=[item], cumulative_score=item.score))
        out.append(paths)
    return out
