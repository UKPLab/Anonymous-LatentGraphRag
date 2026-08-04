"""The corpus-mode axis. Phase 3 wires the actual ``MemoryIndex`` selection."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

CorpusMode = Literal["document_only", "memory_only", "joint_index", "dual_tree"]


@dataclass(frozen=True)
class CorpusView:
    """A logical view used by a search strategy at retrieval time.

    For ``document_only`` / ``memory_only`` / ``joint_index``: a single index is searched
    (``primary_index_name`` set, ``secondary_index_name`` is None).
    For ``dual_tree``: both ``primary`` (documents) and ``secondary`` (memories) are searched.
    """

    mode: CorpusMode
    primary_index_name: str
    secondary_index_name: Optional[str] = None

    @classmethod
    def from_mode(cls, mode: CorpusMode) -> "CorpusView":
        if mode == "document_only":
            return cls(mode=mode, primary_index_name="chunks")
        if mode == "memory_only":
            return cls(mode=mode, primary_index_name="memories")
        if mode == "joint_index":
            return cls(mode=mode, primary_index_name="joint")
        if mode == "dual_tree":
            return cls(mode=mode, primary_index_name="chunks", secondary_index_name="memories")
        raise ValueError(f"Unknown corpus mode: {mode!r}")
