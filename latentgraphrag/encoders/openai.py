"""OpenAI-compatible embeddings API."""

from __future__ import annotations

import os
from typing import List, Optional

import numpy as np

from latentgraphrag.encoders.base import BaseEncoder
from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


_DIM_BY_MODEL = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
}


class CompatibleEncoder(BaseEncoder):
    """OpenAI-compatible embeddings API encoder.

    Works with vLLM's openai-style embeddings server and any OpenAI-compatible
    embeddings endpoint — point ``base_url`` at it.
    """

    def __init__(
        self,
        model: str = "text-embedding-3-large",
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        normalize: bool = True,
        batch_size: int = 64,
        dim: Optional[int] = None,
        timeout_s: float = 60.0,
    ) -> None:
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "CompatibleEncoder requires `openai`. "
                "Install with `pip install latentgraphrag[openai]`."
            ) from exc

        self.model = model
        self.normalize = normalize
        self.batch_size = batch_size
        self.dim = dim or _DIM_BY_MODEL.get(model, 1536)
        self._client = OpenAI(
            api_key=api_key or os.environ.get("OPENAI_API_KEY"),
            base_url=base_url,
            timeout=timeout_s,
        )

    def encode(
        self,
        texts: List[str],
        *,
        instruction: Optional[str] = None,
        is_query: bool = False,  # noqa: ARG002
    ) -> np.ndarray:
        if isinstance(texts, str):
            texts = [texts]
        prepared = [f"{instruction}{t}" if instruction else t for t in texts]
        out: List[np.ndarray] = []
        for i in range(0, len(prepared), self.batch_size):
            batch = prepared[i : i + self.batch_size]
            resp = self._client.embeddings.create(model=self.model, input=batch)
            for item in resp.data:
                out.append(np.asarray(item.embedding, dtype=np.float32))
        vecs = np.stack(out, axis=0) if out else np.zeros((0, self.dim), dtype=np.float32)
        if self.normalize:
            vecs = self._l2_normalize(vecs)
        return vecs
