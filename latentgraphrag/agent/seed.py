"""Initial evidence ("seed") handed to the agent before its first turn.

A seed is the top of any ranking: the paper uses the top ten documents of a retrieval condition, each
truncated to 2,200 characters, and supplies them as numbered documents in the first user turn. The
seed is not a search call and is not counted as one.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterator, Mapping, Optional, Sequence, Tuple

SEED_SIZE = 10
SEED_TEXT_CAP = 2200


@dataclass(frozen=True)
class SeedDoc:
    """One seed document: its (truncated) text and, when known, its document id."""

    text: str
    doc_id: Optional[Any] = None


@dataclass(frozen=True)
class Seed:
    """An ordered list of seed documents (possibly empty: the unseeded condition)."""

    docs: Tuple[SeedDoc, ...] = ()

    @classmethod
    def empty(cls) -> "Seed":
        """No initial evidence (the paper's "No seed" / closed-book condition)."""
        return cls(())

    @classmethod
    def from_ranking(cls, ranking: Sequence[Any], texts: Mapping[Any, str], k: int = SEED_SIZE,
                     text_cap: Optional[int] = SEED_TEXT_CAP) -> "Seed":
        """The top-``k`` documents of a ranking of document ids, texts cut to ``text_cap`` characters.

        Args:
            ranking: Document ids, best first (e.g. a LatentGraphRAG ranking).
            texts: ``doc_id -> text``.
            k: Seed size (paper: 10). Rankings shorter than ``k`` give shorter seeds.
            text_cap: Character cap per document (paper: 2,200); ``None`` keeps full texts.
        """
        docs = []
        for d in list(ranking)[:k]:
            t = texts[d]
            docs.append(SeedDoc(text=t[:text_cap] if text_cap is not None else t, doc_id=d))
        return cls(tuple(docs))

    @classmethod
    def from_texts(cls, texts: Sequence[str], ids: Optional[Sequence[Any]] = None, k: int = SEED_SIZE,
                   text_cap: Optional[int] = SEED_TEXT_CAP) -> "Seed":
        """Seed from texts in rank order (optionally with their ids)."""
        texts = list(texts)[:k]
        ids = list(ids)[:k] if ids is not None else [None] * len(texts)
        return cls(tuple(SeedDoc(text=t[:text_cap] if text_cap is not None else t, doc_id=i)
                         for t, i in zip(texts, ids)))

    @property
    def texts(self) -> list:
        return [d.text for d in self.docs]

    @property
    def ids(self) -> list:
        return [d.doc_id for d in self.docs]

    def __len__(self) -> int:
        return len(self.docs)

    def __iter__(self) -> Iterator[SeedDoc]:
        return iter(self.docs)

    def __bool__(self) -> bool:
        return bool(self.docs)
