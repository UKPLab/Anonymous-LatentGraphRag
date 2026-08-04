"""Configuration for the LatentGraphRAG pipeline.

Deliberately small surface compared to the legacy 30-field BaseConfig: most retrieval
decisions live on the `retrieve()` call, not on the model.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional


@dataclass
class LatentGraphRAGConfig:
    """Top-level configuration.

    Attributes:
        encoder: HuggingFace id or local path for the dense encoder. The paper-canonical
            choice is ``"GritHopper-7B"``.
        openie_llm: model used for NER + triple extraction. ``None`` skips graph build.
        verbalizer_llm: model used to turn a triplet into a sentence. ``None`` falls
            back to a template (``"{head} {relation} {tail}."``).
        chunk_size: target token count per chunk.
        chunk_overlap: overlapping tokens between adjacent chunks.
        save_dir: persistence root. All artifacts (graph, parquet, FAISS) live here.
        faiss_index_type: ``"flat"`` (exact IP, default), ``"hnsw"`` (approximate),
            or ``"auto"`` (flat below 1M, hnsw above).
        faiss_device: ``"auto"`` | ``"cpu"`` | ``"cuda"`` | ``"cuda:N"``.
        normalize_embeddings: L2-normalize at write time so inner-product == cosine.
        batch_size: encoding batch size.
    """

    encoder: str = "GritHopper-7B"
    openie_llm: Optional[str] = "gpt-4o-mini"
    verbalizer_llm: Optional[str] = "gpt-4o-mini"
    chunk_size: int = 512
    chunk_overlap: int = 50
    save_dir: str = "./lgrag_index"
    faiss_index_type: Literal["flat", "hnsw", "auto"] = "auto"
    faiss_device: str = "auto"
    normalize_embeddings: bool = True
    batch_size: int = 32

    # OpenIE-specific knobs (rarely touched)
    openie_max_retries: int = 5
    openie_temperature: float = 0.0
    openie_timeout_s: float = 120.0

    # Verbalization-specific knobs
    verbalizer_max_tokens: int = 96
    verbalizer_temperature: float = 0.0

    # Provider endpoints; default to environment variables when None
    openai_base_url: Optional[str] = None
    openai_api_key: Optional[str] = None

    # Free-form provider extras for advanced use (e.g. {"http_headers": {...}})
    provider_kwargs: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError(
                f"chunk_overlap ({self.chunk_overlap}) must be < chunk_size ({self.chunk_size})"
            )
        if self.faiss_index_type not in ("flat", "hnsw", "auto"):
            raise ValueError(f"Invalid faiss_index_type={self.faiss_index_type!r}")
