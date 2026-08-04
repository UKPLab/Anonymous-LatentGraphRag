"""Iterative retrieval-context builder.

At hop ``t``, the contextual encoder sees ``c_t = [q; x_1; ...; x_{t-1}]`` (paper Sec 3.3.1).
This module owns the concatenation policy so search strategies don't duplicate it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Tuple

DEFAULT_SEPARATOR = " "
MAX_CONTEXT_CHARS = 4000  # truncate very long histories; encoders cap at ~2k-8k tokens


@dataclass(frozen=True)
class RetrievedItem:
    """One item retrieved at some hop."""

    hash_id: str
    text: str
    score: float
    hop: int


@dataclass
class SearchPath:
    """A path through the latent graph — one element per hop."""

    items: List[RetrievedItem] = field(default_factory=list)
    cumulative_score: float = 1.0  # multiplicative along hops

    def with_extension(self, item: RetrievedItem) -> "SearchPath":
        return SearchPath(
            items=self.items + [item],
            cumulative_score=self.cumulative_score * max(item.score, 1e-12),
        )

    @property
    def depth(self) -> int:
        return len(self.items)

    @property
    def hash_ids(self) -> List[str]:
        return [it.hash_id for it in self.items]


def build_context(query: str, path: SearchPath, *, separator: str = DEFAULT_SEPARATOR) -> str:
    parts: List[str] = [query]
    for it in path.items:
        parts.append(it.text)
    ctx = separator.join(parts)
    if len(ctx) > MAX_CONTEXT_CHARS:
        ctx = ctx[: MAX_CONTEXT_CHARS]
    return ctx


def deduplicate_paths_by_terminal(paths: List[SearchPath]) -> List[Tuple[str, float, SearchPath]]:
    """Aggregate paths by their terminal item, keeping the best cumulative score per terminal.

    Returns a list of ``(hash_id, score, path)`` sorted by score descending.
    """
    best: dict[str, Tuple[float, SearchPath]] = {}
    for p in paths:
        if not p.items:
            continue
        terminal = p.items[-1].hash_id
        prev = best.get(terminal)
        if prev is None or p.cumulative_score > prev[0]:
            best[terminal] = (p.cumulative_score, p)
    out = [(h, s, p) for h, (s, p) in best.items()]
    out.sort(key=lambda t: t[1], reverse=True)
    return out
