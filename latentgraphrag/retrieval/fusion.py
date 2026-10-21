"""Source projection and view fusion.

A memory view ranks constructed units (triples, propositions); the document view ranks source
documents. :func:`project` maps memory scores onto the documents that supplied the memories, so both
views refer to the same identifiers, and :func:`fuse` combines the views into one document ranking.

Scores are the views' readout scores as they are: the paper's views come from the same readout
contract (sparse softmax distributions), so no normalisation is applied before fusion.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Hashable, Iterable, List, Mapping, Sequence, Tuple

Scores = Dict[Hashable, float]

PROJECTIONS = ("max", "sum", "mean", "pmax2", "pmax4", "noisy_or")
FUSIONS = ("combmnz", "combsum", "z", "rrf", "max")


def _sources(value: Any) -> List[Hashable]:
    if value is None:
        return []
    if isinstance(value, (str, int)):
        return [value]
    return list(value)


def project(scores: Mapping[Hashable, float], source_of: Mapping[Hashable, Any], reduce: str = "max") -> Scores:
    """Map unit scores to source scores.

    Args:
        scores: Score per unit, in the view's rank order.
        source_of: Source id(s) per unit (one id or a list; a unit can come from several sources).
            Units without a source contribute nothing.
        reduce: ``"max"`` (paper), ``"sum"``, ``"mean"``, ``"pmax2"`` / ``"pmax4"`` (soft maximum
            ``(sum r^Q)^(1/Q)``) or ``"noisy_or"`` (``1 - prod(1 - r)``).

    Returns:
        Score per source id, in order of first appearance.
    """
    if reduce not in PROJECTIONS:
        raise ValueError(f"reduce must be one of {PROJECTIONS}")
    if reduce == "max":
        out: Scores = {}
        for unit, s in scores.items():
            for d in _sources(source_of.get(unit)):
                out[d] = max(s, out.get(d, 0.0))
        return out
    if reduce == "sum":
        out = {}
        for unit, s in scores.items():
            for d in _sources(source_of.get(unit)):
                out[d] = out.get(d, 0.0) + s
        return out
    groups: Dict[Hashable, List[float]] = {}
    for unit, s in scores.items():
        for d in _sources(source_of.get(unit)):
            groups.setdefault(d, []).append(s)
    if reduce == "mean":
        return {d: sum(v) / len(v) for d, v in groups.items()}
    if reduce in ("pmax2", "pmax4"):
        q = 2.0 if reduce == "pmax2" else 4.0
        return {d: sum(max(x, 0.0) ** q for x in v) ** (1.0 / q) for d, v in groups.items()}
    return {d: 1.0 - math.prod(1.0 - min(max(x, 0.0), 1.0) for x in v) for d, v in groups.items()}


def _ordered(view: Mapping[Hashable, float]) -> List[Tuple[Hashable, float]]:
    return sorted(view.items(), key=lambda kv: -kv[1])


def fuse(views: Sequence[Mapping[Hashable, float]], weights: Sequence[float] | None = None,
         method: str = "combmnz", rrf_k: int = 60) -> Scores:
    """Fuse score views over the same identifiers.

    Args:
        views: One score mapping per view (e.g. documents, projected memories).
        weights: Weight per view (default 1 each); ``"max"`` ignores them.
        method: ``"combmnz"`` (paper): ``sum_v w_v * s_v(d)`` times the number of views containing
            ``d``; ``"combsum"``: the weighted sum alone; ``"z"``: weighted sum of per-view z-scores
            (sample standard deviation; a document missing from a view takes that view's minimum z);
            ``"rrf"``: ``sum_v w_v / (rrf_k + rank_v(d))`` with ranks starting at 1; ``"max"``: the
            largest score of any view.
        rrf_k: Rank offset of ``"rrf"``.

    Returns:
        Fused score per identifier.
    """
    if method not in FUSIONS:
        raise ValueError(f"method must be one of {FUSIONS}")
    weights = [1.0] * len(views) if weights is None else list(weights)
    if len(weights) != len(views):
        raise ValueError("one weight per view")
    if method in ("combmnz", "combsum"):
        total: Scores = {}
        count: Dict[Hashable, int] = {}
        for view, w in zip(views, weights):
            for d, s in view.items():
                total[d] = total.get(d, 0.0) + w * s
                count[d] = count.get(d, 0) + 1
        return {d: v * count[d] for d, v in total.items()} if method == "combmnz" else total
    if method == "rrf":
        out: Scores = {}
        for view, w in zip(views, weights):
            for r, (d, _) in enumerate(_ordered(view)):
                out[d] = out.get(d, 0.0) + w / (rrf_k + r + 1)
        return out
    if method == "max":
        out = {}
        for view in views:
            for d, s in view.items():
                out[d] = max(s, out.get(d, -math.inf))
        return out
    standardized: List[Tuple[Scores, float]] = []
    for view in views:
        if not view:
            standardized.append(({}, 0.0))
            continue
        vals = list(view.values())
        mu = sum(vals) / len(vals)
        var = sum((x - mu) ** 2 for x in vals) / max(1, len(vals) - 1)
        sd = var ** 0.5 or 1.0
        z = {d: (x - mu) / sd for d, x in view.items()}
        standardized.append((z, min(z.values())))
    keys: Iterable[Hashable] = {d for z, _ in standardized for d in z}
    return {d: sum(w * z.get(d, zmin) for (z, zmin), w in zip(standardized, weights)) for d in keys}


def rank(scores: Mapping[Hashable, float], k: int | None = None) -> List[Hashable]:
    """Identifiers by descending score (ties keep their insertion order)."""
    order = [d for d, _ in _ordered(scores)]
    return order if k is None else order[:k]
