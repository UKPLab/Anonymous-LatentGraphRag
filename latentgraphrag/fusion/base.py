"""Fusion ABC for combining two ranked lists into one."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Dict, List, Literal, Tuple

FusionMethod = Literal["rrf", "agreement"]


class BaseFusion(ABC):
    """Combine document-view and memory-view rankings into a single document ranking."""

    name: FusionMethod

    @abstractmethod
    def fuse(
        self,
        doc_ranked: List[Tuple[str, float]],
        mem_ranked: List[Tuple[str, float]],
        *,
        memory_to_doc: Dict[str, str],
    ) -> List[Tuple[str, float]]:
        """Return a list of ``(doc_id, fused_score)`` sorted descending."""
