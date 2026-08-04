"""Search-strategy ABCs and result types."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Literal, Tuple

SearchStrategy = Literal[
    "full_expansion",
    "beamdr",
    "cross_view_beam",
    "mmr",
    "single_hop",
]


@dataclass
class RetrievalPath:
    """A single retrieval path through the latent graph.

    ``items`` is a list of ``(hash_id, score)`` tuples — one per hop.
    """

    items: List[Tuple[str, float]] = field(default_factory=list)
    cumulative_score: float = 0.0


class BaseSearch(ABC):
    """A search strategy.

    Subclasses operate over one or two ``MemoryIndex`` instances plus an encoder. They
    return the per-query top-k items as a list of ``RetrievalPath``.
    """

    name: SearchStrategy

    @abstractmethod
    def run(self, queries: List[str], **kwargs) -> List[List[RetrievalPath]]:
        ...
