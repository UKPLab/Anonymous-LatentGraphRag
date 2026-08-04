"""Hop-synchronous batched search.

The sequential variants in ``full_expansion.py`` / ``beamdr.py`` / ``mmr.py`` process
queries one at a time, batching only within a single query's frontier per hop. This
is fine for small corpora but leaves a lot of GPU efficiency on the table when
running an entire dataset: 310 queries × 4 hops becomes 1,240 encoder calls and
1,240 FAISS searches instead of 4 mega-batched calls.

The functions in this module are **mathematically equivalent** to their sequential
counterparts — same context construction, same scoring, same branch selection,
same deduplication. They differ only in the order of operations: each hop pools the
frontiers of ALL queries into a single encoder call and a single FAISS search, then
distributes results back per-query.

For dual-tree search, ``run_dual_tree_batched`` further combines the document and
memory frontier encoder calls at each hop into one (encoder is shared; only the
FAISS searches per substrate must remain separate, since they hit different indices).

Opt in via ``rag.retrieve(..., batched=True)``. Default behaviour (``batched=False``)
preserves the sequential variants for reproducibility / bit-equivalent comparison.
"""

from __future__ import annotations

from typing import List, Optional, Tuple, Union

import numpy as np

from latentgraphrag.encoders.base import BaseEncoder
from latentgraphrag.memory.index import MemoryIndex
from latentgraphrag.search.context import RetrievedItem, SearchPath, build_context
from latentgraphrag.search.full_expansion import _pick_branches


def _encode_chunked(
    encoder: BaseEncoder,
    texts: List[str],
    *,
    is_query: bool,
    instruction: Optional[str],
    chunk_size: Optional[int],
) -> np.ndarray:
    """Encode ``texts`` in chunks of ``chunk_size`` if set, else in one call.

    Useful when the union of all queries' frontiers is too large to fit in a single
    GPU forward pass.
    """
    if chunk_size is None or len(texts) <= chunk_size:
        return encoder.encode(texts, is_query=is_query, instruction=instruction)
    out: List[np.ndarray] = []
    for i in range(0, len(texts), chunk_size):
        out.append(
            encoder.encode(
                texts[i : i + chunk_size],
                is_query=is_query,
                instruction=instruction,
            )
        )
    return np.concatenate(out, axis=0)


def run_full_expansion_batched(
    queries: List[str],
    *,
    encoder: BaseEncoder,
    index: MemoryIndex,
    k: int = 100,
    max_hops: int = 4,
    branching: Union[int, str] = 3,
    branching_threshold: float = 0.05,
    query_instruction: Optional[str] = None,
    encode_chunk_size: Optional[int] = None,
    global_dedup: bool = True,
    normalize_scores: bool = True,
) -> List[List[SearchPath]]:
    """Hop-synchronous batched full expansion.

    Equivalent to :func:`run_full_expansion`, but at each hop pools the entire
    cross-query × frontier set into one encoder call and one FAISS search.
    ``global_dedup`` and ``normalize_scores`` match the sequential variant.
    """
    Q = len(queries)
    frontiers: List[List[SearchPath]] = [[SearchPath()] for _ in range(Q)]
    all_paths: List[List[SearchPath]] = [[] for _ in range(Q)]
    global_seens: List[set] = [set() for _ in range(Q)]

    # We over-fetch slightly so adaptive branching has room to consider neighbors.
    top = max(int(branching) if isinstance(branching, int) else 16, 8)

    for hop in range(max_hops):
        # Phase 1: gather all contexts across queries and frontier states.
        all_contexts: List[str] = []
        index_map: List[Tuple[int, SearchPath]] = []  # (query_index, path)
        for qi, frontier in enumerate(frontiers):
            for path in frontier:
                all_contexts.append(build_context(queries[qi], path))
                index_map.append((qi, path))

        if not all_contexts:
            break

        # Phase 2: one big encoder call + one big FAISS search.
        ctx_vecs = _encode_chunked(
            encoder,
            all_contexts,
            is_query=True,
            instruction=query_instruction,
            chunk_size=encode_chunk_size,
        )
        scores, idx = index.search(ctx_vecs, k=top)

        # Phase 3: per-row branch selection + distribute back to per-query frontiers.
        new_frontiers: List[List[SearchPath]] = [[] for _ in range(Q)]
        for row, (qi, path) in enumerate(index_map):
            seen = set(path.hash_ids)
            if global_dedup:
                seen = seen | global_seens[qi]
            local_scores = scores[row]
            local_idx = idx[row]
            filtered = [
                (int(local_idx[j]), float(local_scores[j]))
                for j in range(len(local_idx))
                if int(local_idx[j]) >= 0 and index.hash_ids[int(local_idx[j])] not in seen
            ]
            if not filtered:
                continue
            f_scores = np.asarray([s for _, s in filtered], dtype=np.float32)
            f_idx = np.asarray([i for i, _ in filtered], dtype=np.int64)
            if normalize_scores and f_scores.size > 0:
                s_min = float(f_scores.min())
                s_max = float(f_scores.max())
                if s_max - s_min > 1e-12:
                    f_scores = (f_scores - s_min) / (s_max - s_min)
                else:
                    f_scores = np.zeros_like(f_scores)
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
                    global_seens[qi].add(hid)
                new_frontiers[qi].append(path.with_extension(item))

        for qi in range(Q):
            all_paths[qi].extend(new_frontiers[qi])
        frontiers = new_frontiers

    out: List[List[SearchPath]] = []
    for qi in range(Q):
        all_paths[qi].sort(key=lambda p: p.cumulative_score, reverse=True)
        out.append(all_paths[qi][:k])
    return out


def run_dual_tree_batched(
    queries: List[str],
    *,
    encoder: BaseEncoder,
    doc_index: MemoryIndex,
    memory_index: MemoryIndex,
    k: int = 100,
    max_hops: int = 4,
    branching_doc: int = 3,
    branching_memory: int = 5,
    branching: Union[int, str] = 3,  # forwarded to adaptive when both are str
    branching_threshold: float = 0.05,
    query_instruction: Optional[str] = None,
    encode_chunk_size: Optional[int] = None,
    global_dedup: bool = True,
    normalize_scores: bool = True,
) -> Tuple[List[List[SearchPath]], List[List[SearchPath]]]:
    """Hop-synchronous dual-tree expansion with a single encoder call per hop.

    Combines the document-tree and memory-tree encoder calls at every hop. The two
    FAISS searches remain separate (different indices), but both run on already-encoded
    context vectors so there's no encoder overhead duplication.

    Returns ``(doc_paths_per_query, mem_paths_per_query)``. The caller fuses them
    through ``RRFFusion``, ``AgreementFusion``, or ``ZAgreementFusion`` as usual.
    ``global_dedup`` and ``normalize_scores`` are applied independently per substrate.
    """
    Q = len(queries)
    doc_frontiers: List[List[SearchPath]] = [[SearchPath()] for _ in range(Q)]
    mem_frontiers: List[List[SearchPath]] = [[SearchPath()] for _ in range(Q)]
    doc_paths: List[List[SearchPath]] = [[] for _ in range(Q)]
    mem_paths: List[List[SearchPath]] = [[] for _ in range(Q)]
    doc_global_seens: List[set] = [set() for _ in range(Q)]
    mem_global_seens: List[set] = [set() for _ in range(Q)]

    top_doc = max(branching_doc if isinstance(branching_doc, int) else 16, 8)
    top_mem = max(branching_memory if isinstance(branching_memory, int) else 16, 8)

    for hop in range(max_hops):
        # Gather doc-tree contexts and memory-tree contexts across all queries.
        doc_contexts: List[str] = []
        doc_map: List[Tuple[int, SearchPath]] = []
        for qi, frontier in enumerate(doc_frontiers):
            for path in frontier:
                doc_contexts.append(build_context(queries[qi], path))
                doc_map.append((qi, path))

        mem_contexts: List[str] = []
        mem_map: List[Tuple[int, SearchPath]] = []
        for qi, frontier in enumerate(mem_frontiers):
            for path in frontier:
                mem_contexts.append(build_context(queries[qi], path))
                mem_map.append((qi, path))

        if not doc_contexts and not mem_contexts:
            break

        # One encoder call across BOTH substrates' frontiers.
        n_doc = len(doc_contexts)
        all_ctx = doc_contexts + mem_contexts
        ctx_vecs = _encode_chunked(
            encoder,
            all_ctx,
            is_query=True,
            instruction=query_instruction,
            chunk_size=encode_chunk_size,
        )
        doc_vecs = ctx_vecs[:n_doc] if n_doc else ctx_vecs[:0]
        mem_vecs = ctx_vecs[n_doc:]

        # Two FAISS searches (one per index — unavoidable, different corpora).
        doc_scores, doc_idx = doc_index.search(doc_vecs, k=top_doc) if n_doc else (None, None)
        mem_scores, mem_idx = (
            memory_index.search(mem_vecs, k=top_mem) if len(mem_vecs) else (None, None)
        )

        # Distribute back per substrate.
        new_doc_frontiers: List[List[SearchPath]] = [[] for _ in range(Q)]
        if doc_scores is not None:
            for row, (qi, path) in enumerate(doc_map):
                seen = set(path.hash_ids)
                if global_dedup:
                    seen = seen | doc_global_seens[qi]
                filtered = [
                    (int(doc_idx[row, j]), float(doc_scores[row, j]))
                    for j in range(doc_idx.shape[1])
                    if int(doc_idx[row, j]) >= 0
                    and doc_index.hash_ids[int(doc_idx[row, j])] not in seen
                ]
                if not filtered:
                    continue
                f_scores = np.asarray([s for _, s in filtered], dtype=np.float32)
                f_idx = np.asarray([i for i, _ in filtered], dtype=np.int64)
                if normalize_scores and f_scores.size > 0:
                    s_min = float(f_scores.min())
                    s_max = float(f_scores.max())
                    if s_max - s_min > 1e-12:
                        f_scores = (f_scores - s_min) / (s_max - s_min)
                    else:
                        f_scores = np.zeros_like(f_scores)
                pick = _pick_branches(
                    f_scores,
                    f_idx,
                    branching=branching_doc if not isinstance(branching, str) else branching,
                    branching_threshold=branching_threshold,
                )
                for j in pick:
                    i_global = int(f_idx[j])
                    hid = doc_index.hash_ids[i_global]
                    item = RetrievedItem(
                        hash_id=hid,
                        text=doc_index.texts[i_global],
                        score=float(f_scores[j]),
                        hop=hop,
                    )
                    if global_dedup:
                        doc_global_seens[qi].add(hid)
                    new_doc_frontiers[qi].append(path.with_extension(item))

        new_mem_frontiers: List[List[SearchPath]] = [[] for _ in range(Q)]
        if mem_scores is not None:
            for row, (qi, path) in enumerate(mem_map):
                seen = set(path.hash_ids)
                if global_dedup:
                    seen = seen | mem_global_seens[qi]
                filtered = [
                    (int(mem_idx[row, j]), float(mem_scores[row, j]))
                    for j in range(mem_idx.shape[1])
                    if int(mem_idx[row, j]) >= 0
                    and memory_index.hash_ids[int(mem_idx[row, j])] not in seen
                ]
                if not filtered:
                    continue
                f_scores = np.asarray([s for _, s in filtered], dtype=np.float32)
                f_idx = np.asarray([i for i, _ in filtered], dtype=np.int64)
                if normalize_scores and f_scores.size > 0:
                    s_min = float(f_scores.min())
                    s_max = float(f_scores.max())
                    if s_max - s_min > 1e-12:
                        f_scores = (f_scores - s_min) / (s_max - s_min)
                    else:
                        f_scores = np.zeros_like(f_scores)
                pick = _pick_branches(
                    f_scores,
                    f_idx,
                    branching=branching_memory if not isinstance(branching, str) else branching,
                    branching_threshold=branching_threshold,
                )
                for j in pick:
                    i_global = int(f_idx[j])
                    hid = memory_index.hash_ids[i_global]
                    item = RetrievedItem(
                        hash_id=hid,
                        text=memory_index.texts[i_global],
                        score=float(f_scores[j]),
                        hop=hop,
                    )
                    if global_dedup:
                        mem_global_seens[qi].add(hid)
                    new_mem_frontiers[qi].append(path.with_extension(item))

        for qi in range(Q):
            doc_paths[qi].extend(new_doc_frontiers[qi])
            mem_paths[qi].extend(new_mem_frontiers[qi])
        doc_frontiers = new_doc_frontiers
        mem_frontiers = new_mem_frontiers

    for qi in range(Q):
        doc_paths[qi].sort(key=lambda p: p.cumulative_score, reverse=True)
        mem_paths[qi].sort(key=lambda p: p.cumulative_score, reverse=True)
        doc_paths[qi] = doc_paths[qi][:k]
        mem_paths[qi] = mem_paths[qi][:k]
    return doc_paths, mem_paths
