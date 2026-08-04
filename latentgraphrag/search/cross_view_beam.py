"""Cross-view beam search (paper §3.3.2).

A single beam queries BOTH the document index and the memory index at each hop. The
beam can therefore mix document and memory states. Items from each side are tagged so
the downstream pipeline can map memory states to their source documents.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from latentgraphrag.encoders.base import BaseEncoder
from latentgraphrag.memory.index import MemoryIndex
from latentgraphrag.search.context import RetrievedItem, SearchPath, build_context


@dataclass(frozen=True)
class CrossViewItem(RetrievedItem):
    """A retrieved item with a tag indicating which index it came from."""

    source: str = "document"  # "document" | "memory"


def run_cross_view_beam(
    queries: List[str],
    *,
    encoder: BaseEncoder,
    doc_index: MemoryIndex,
    memory_index: MemoryIndex,
    k: int = 100,
    max_hops: int = 4,
    beam_width: int = 10,
    branch_per_state: int = 3,
    query_instruction: Optional[str] = None,
) -> List[List[SearchPath]]:
    out: List[List[SearchPath]] = []
    for q in queries:
        beam: List[SearchPath] = [SearchPath()]
        finished: List[SearchPath] = []
        for hop in range(max_hops):
            if not beam:
                break
            contexts = [build_context(q, p) for p in beam]
            ctx_vecs = encoder.encode(contexts, is_query=True, instruction=query_instruction)
            doc_scores, doc_idx = doc_index.search(ctx_vecs, k=branch_per_state * 2)
            mem_scores, mem_idx = memory_index.search(ctx_vecs, k=branch_per_state * 2)

            candidates: List[SearchPath] = []
            for bi, path in enumerate(beam):
                seen = set(path.hash_ids)
                merged: List[CrossViewItem] = []
                for rank in range(doc_idx.shape[1]):
                    i = int(doc_idx[bi, rank])
                    if i < 0:
                        continue
                    hid = doc_index.hash_ids[i]
                    if hid in seen:
                        continue
                    merged.append(
                        CrossViewItem(
                            hash_id=hid,
                            text=doc_index.texts[i],
                            score=float(doc_scores[bi, rank]),
                            hop=hop,
                            source="document",
                        )
                    )
                for rank in range(mem_idx.shape[1]):
                    i = int(mem_idx[bi, rank])
                    if i < 0:
                        continue
                    hid = memory_index.hash_ids[i]
                    if hid in seen:
                        continue
                    merged.append(
                        CrossViewItem(
                            hash_id=hid,
                            text=memory_index.texts[i],
                            score=float(mem_scores[bi, rank]),
                            hop=hop,
                            source="memory",
                        )
                    )
                merged.sort(key=lambda it: it.score, reverse=True)
                for item in merged[:branch_per_state]:
                    candidates.append(path.with_extension(item))

            candidates.sort(key=lambda p: p.cumulative_score, reverse=True)
            beam = candidates[:beam_width]
            finished.extend(beam)

        finished.sort(key=lambda p: p.cumulative_score, reverse=True)
        out.append(finished[:k])
    return out
