"""Encoder ABC + a deterministic stub encoder for tests."""

from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from typing import List, Optional

import numpy as np


class BaseEncoder(ABC):
    """A dense encoder.

    Subclasses promise that ``encode(texts, instruction=...)`` returns an
    ``(N, dim)`` float32 array. If ``self.normalize`` is True, vectors are
    L2-normalized so inner-product equals cosine similarity.
    """

    dim: int
    normalize: bool = True

    @abstractmethod
    def encode(
        self,
        texts: List[str],
        *,
        instruction: Optional[str] = None,
        is_query: bool = False,
    ) -> np.ndarray:
        ...

    def encode_one(self, text: str, *, instruction: Optional[str] = None, is_query: bool = False) -> np.ndarray:
        return self.encode([text], instruction=instruction, is_query=is_query)[0]

    @staticmethod
    def _l2_normalize(x: np.ndarray) -> np.ndarray:
        n = np.linalg.norm(x, axis=-1, keepdims=True)
        n = np.where(n == 0, 1.0, n)
        return x / n


class HashEncoder(BaseEncoder):
    """Deterministic stub encoder: maps text to a fixed-dim vector via MD5 -> float.

    Useful for CI / golden tests where we don't want to load a real model.
    """

    def __init__(self, dim: int = 64, normalize: bool = True) -> None:
        self.dim = dim
        self.normalize = normalize

    def encode(
        self,
        texts: List[str],
        *,
        instruction: Optional[str] = None,
        is_query: bool = False,
    ) -> np.ndarray:
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for i, t in enumerate(texts):
            seed_input = (instruction or "") + ("Q::" if is_query else "D::") + t
            seed = int.from_bytes(hashlib.md5(seed_input.encode("utf-8")).digest()[:8], "little")
            rng = np.random.default_rng(seed)
            out[i] = rng.standard_normal(self.dim).astype(np.float32)
        if self.normalize:
            out = self._l2_normalize(out)
        return out
