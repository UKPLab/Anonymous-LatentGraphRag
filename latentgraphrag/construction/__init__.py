"""Knowledge construction: triples and propositions as memories linked to their source documents."""

import hashlib

from . import propositions, triples


def chunk_id(title: str, text: str) -> str:
    """The chunk id the OpenIE caches use: ``"chunk-" + md5(title + "\\n" + text)``."""
    return "chunk-" + hashlib.md5(f"{title}\n{text}".encode()).hexdigest()


__all__ = ["triples", "propositions", "chunk_id"]
