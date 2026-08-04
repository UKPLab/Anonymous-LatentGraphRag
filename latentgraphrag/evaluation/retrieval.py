"""Recall@K — the metric used in the paper's main table."""

from __future__ import annotations

from typing import Iterable, List, Sequence


def recall_at_k(retrieved: Sequence[Sequence[str]], gold: Sequence[Iterable[str]], k: int) -> float:
    """Macro-averaged Recall@K.

    For each query, fraction of gold docs that appear in the top-k retrieved.
    """
    if not retrieved:
        return 0.0
    if len(retrieved) != len(gold):
        raise ValueError(f"len(retrieved)={len(retrieved)} != len(gold)={len(gold)}")
    total = 0.0
    n = 0
    for r, g in zip(retrieved, gold):
        g_set = set(g)
        if not g_set:
            continue
        top_k = set(list(r)[:k])
        total += len(top_k & g_set) / len(g_set)
        n += 1
    return total / n if n else 0.0
