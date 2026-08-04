"""``RelationalMemory`` -- the verbalized (head, relation, tail) triplet with provenance."""

from __future__ import annotations

from dataclasses import dataclass

from latentgraphrag.utils.io import compute_mdhash_id


@dataclass(frozen=True)
class RelationalMemory:
    """A single relational memory.

    Attributes:
        hash_id: stable ``"memory-<md5>"`` id; deterministic from ``sentence``.
        head: the triplet's subject.
        relation: the triplet's relation.
        tail: the triplet's object.
        sentence: the verbalized form (one natural-language sentence).
        chunk_id: the chunk this memory was extracted from.
        doc_id: the source document.
    """

    hash_id: str
    head: str
    relation: str
    tail: str
    sentence: str
    chunk_id: str
    doc_id: str

    @classmethod
    def from_triple(
        cls,
        triple: tuple[str, str, str],
        sentence: str,
        *,
        chunk_id: str,
        doc_id: str,
    ) -> "RelationalMemory":
        h, r, t = triple
        return cls(
            hash_id=compute_mdhash_id(sentence, prefix="memory-"),
            head=h,
            relation=r,
            tail=t,
            sentence=sentence,
            chunk_id=chunk_id,
            doc_id=doc_id,
        )
