"""Token-based chunking. Defaults match the paper's HippoRAG-2 setup."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from latentgraphrag.utils.io import compute_mdhash_id
from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class Chunk:
    """A single chunk of a document.

    Attributes:
        hash_id: stable ``"chunk-<md5>"`` id; deterministic from ``text``.
        text: the chunk text.
        doc_id: id of the source document.
        position: 0-indexed position within the document.
    """

    hash_id: str
    text: str
    doc_id: str
    position: int


class TokenChunker:
    """Whitespace-cheap chunker that prefers ``tiktoken`` when available.

    Behaviour matches HippoRAG's preprocess pipeline:
    - target ``chunk_size`` tokens per chunk
    - ``chunk_overlap`` overlapping tokens between adjacent chunks
    - chunks never cross a document boundary
    """

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        encoding_name: str = "cl100k_base",
    ) -> None:
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be < chunk_size")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._encoding_name = encoding_name
        self._encoding = self._load_encoding(encoding_name)

    @staticmethod
    def _load_encoding(name: str):
        try:
            import tiktoken

            return tiktoken.get_encoding(name)
        except Exception:  # pragma: no cover - falls back to whitespace tokenizer
            logger.warning(
                "tiktoken not available; falling back to whitespace tokenization."
            )
            return None

    def _tokenize(self, text: str) -> List[str | int]:
        if self._encoding is not None:
            return self._encoding.encode(text)
        return text.split()

    def _detokenize(self, tokens: List[str | int]) -> str:
        if self._encoding is not None:
            return self._encoding.decode(tokens)  # type: ignore[arg-type]
        return " ".join(tokens)  # type: ignore[arg-type]

    def split(self, text: str, doc_id: Optional[str] = None) -> List[Chunk]:
        """Split a single document into a list of ``Chunk``."""
        tokens = self._tokenize(text)
        if not tokens:
            return []
        if doc_id is None:
            doc_id = compute_mdhash_id(text, prefix="doc-")

        chunks: List[Chunk] = []
        step = self.chunk_size - self.chunk_overlap
        position = 0
        for start in range(0, len(tokens), step):
            piece = tokens[start : start + self.chunk_size]
            if not piece:
                break
            chunk_text = self._detokenize(piece)
            hash_id = compute_mdhash_id(chunk_text, prefix="chunk-")
            chunks.append(
                Chunk(hash_id=hash_id, text=chunk_text, doc_id=doc_id, position=position)
            )
            position += 1
            if start + self.chunk_size >= len(tokens):
                break
        return chunks

    def split_many(self, documents: List[str], doc_ids: Optional[List[str]] = None) -> List[Chunk]:
        if doc_ids is not None and len(doc_ids) != len(documents):
            raise ValueError("len(doc_ids) must equal len(documents)")
        out: List[Chunk] = []
        for i, doc in enumerate(documents):
            doc_id = doc_ids[i] if doc_ids is not None else compute_mdhash_id(doc, prefix="doc-")
            out.extend(self.split(doc, doc_id=doc_id))
        return out
