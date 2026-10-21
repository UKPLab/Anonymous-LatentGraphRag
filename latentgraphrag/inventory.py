"""Knowledge inventories: constructed units with their source links.

A memory is one constructed unit of text (a triple rendered as "head relation tail.", or a
proposition) together with the source documents it was extracted from (its provenance, ``pi``).
Triples, propositions or both form one inventory; the memory tree searches it and the provenance maps
memory scores back to documents.

On disk an inventory is the mapping ``{memory text: [source ids]}`` used throughout the paper's
experiments (JSON, optionally gzipped); :meth:`MemoryInventory.save_jsonl` additionally keeps each
unit's kind.
"""

from __future__ import annotations

import gzip
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Mapping, Optional, Sequence, Tuple, Union

PathLike = Union[str, Path]


def _open(path: PathLike, mode: str = "rt"):
    path = str(path)
    return gzip.open(path, mode, encoding="utf-8") if path.endswith(".gz") else open(path, mode, encoding="utf-8")


@dataclass
class MemoryInventory:
    """Constructed units and their source documents.

    Args:
        texts: The memory texts (unique).
        sources: Source document ids per memory (a memory can come from several documents).
        kinds: ``"triple"`` or ``"proposition"`` per memory (the kind of its first occurrence).
    """

    texts: List[str] = field(default_factory=list)
    sources: List[List[Any]] = field(default_factory=list)
    kinds: List[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not (len(self.texts) == len(self.sources) == len(self.kinds)):
            raise ValueError("texts, sources and kinds must have the same length")
        self._pos: Dict[str, int] = {}
        for i, t in enumerate(self.texts):
            if t in self._pos:
                raise ValueError(f"duplicate memory text: {t!r}")
            self._pos[t] = i

    # ------------------------------------------------------------------ building
    def add(self, text: str, source: Any, kind: str) -> None:
        """Add one (memory, source) link; a known memory gains the source if it is new."""
        i = self._pos.get(text)
        if i is None:
            self._pos[text] = len(self.texts)
            self.texts.append(text)
            self.sources.append([source])
            self.kinds.append(kind)
        elif source not in self.sources[i]:
            self.sources[i].append(source)

    @classmethod
    def from_links(cls, links: Iterable[Tuple[str, Any]], kind: str) -> "MemoryInventory":
        """Build from ``(memory text, source id)`` pairs, keeping first-appearance order."""
        inv = cls()
        for text, source in links:
            inv.add(text, source, kind)
        return inv

    @classmethod
    def from_map(cls, mapping: Mapping[str, Any], kind: str) -> "MemoryInventory":
        """Build from ``{memory text: source id or [source ids]}``."""
        inv = cls()
        for text, srcs in mapping.items():
            for s in (srcs if isinstance(srcs, (list, tuple)) else [srcs]):
                inv.add(text, s, kind)
        return inv

    @classmethod
    def union(cls, *inventories: "MemoryInventory") -> "MemoryInventory":
        """One inventory over several: memories in order of first appearance, provenance lists merged."""
        out = cls()
        for inv in inventories:
            for text, srcs, kind in zip(inv.texts, inv.sources, inv.kinds):
                for s in srcs:
                    out.add(text, s, kind)
        return out

    # ------------------------------------------------------------------ access
    def __len__(self) -> int:
        return len(self.texts)

    def __iter__(self) -> Iterator[Tuple[str, List[Any], str]]:
        return iter(zip(self.texts, self.sources, self.kinds))

    def source_map(self) -> Dict[int, List[Any]]:
        """Source ids per memory position, the form the retriever uses."""
        return {i: list(s) for i, s in enumerate(self.sources)}

    def select(self, kind: str) -> "MemoryInventory":
        """The memories of one kind."""
        return MemoryInventory.from_links(((t, s) for t, ss, k in self for s in ss if k == kind), kind)

    def stats(self) -> Dict[str, int]:
        """Counts of memories per kind and of covered source documents."""
        out: Dict[str, int] = {"memories": len(self)}
        for k in self.kinds:
            out[k] = out.get(k, 0) + 1
        out["sources"] = len({s for ss in self.sources for s in ss})
        return out

    # ------------------------------------------------------------------ I/O
    def to_map(self) -> Dict[str, List[Any]]:
        return {t: list(s) for t, s in zip(self.texts, self.sources)}

    def save_map(self, path: PathLike) -> None:
        """Write ``{memory text: [source ids]}`` (gzipped if ``path`` ends in ``.gz``)."""
        with _open(path, "wt") as f:
            json.dump(self.to_map(), f, ensure_ascii=False)

    @classmethod
    def load_map(cls, path: PathLike, kind: str) -> "MemoryInventory":
        """Read ``{memory text: [source ids]}``; ``kind`` labels every unit."""
        with _open(path) as f:
            return cls.from_map(json.load(f), kind)

    def save_jsonl(self, path: PathLike) -> None:
        """One ``{"text", "sources", "kind"}`` record per line (gzipped if ``path`` ends in ``.gz``)."""
        with _open(path, "wt") as f:
            for t, s, k in self:
                f.write(json.dumps({"text": t, "sources": s, "kind": k}, ensure_ascii=False) + "\n")

    @classmethod
    def load_jsonl(cls, path: PathLike) -> "MemoryInventory":
        inv = cls()
        with _open(path) as f:
            for line in f:
                if line.strip():
                    r = json.loads(line)
                    for s in r["sources"]:
                        inv.add(r["text"], s, r["kind"])
        return inv
