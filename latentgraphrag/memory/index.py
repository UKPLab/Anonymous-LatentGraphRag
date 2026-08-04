"""Parquet-backed embedding store with optional FAISS-accelerated ANN search.

The parquet table is the canonical source of truth. The FAISS index is a derived,
on-disk side file built lazily on first search and rebuilt when parquet mtime exceeds
the FAISS file mtime.

Backend dispatch (``device`` arg):
    - ``"auto"``: GPU if ``faiss.get_num_gpus() > 0`` else CPU; numpy brute-force if neither.
    - ``"cpu"``: requires ``faiss-cpu``.
    - ``"cuda"`` / ``"cuda:N"``: requires ``faiss-gpu``.
    - ``"numpy"``: never use FAISS; brute-force inner product (used in tests).

Index type (``index_type`` arg):
    - ``"flat"``: exact IndexFlatIP, no recall loss.
    - ``"hnsw"``: IndexHNSWFlat (M=32, efSearch=64) for large indices.
    - ``"auto"``: flat for ``<= 1M`` vectors, hnsw above.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Literal, Optional, Tuple

import numpy as np

from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


IndexType = Literal["flat", "hnsw", "auto"]
Device = str  # "auto" | "cpu" | "cuda" | "cuda:N" | "numpy"


_HNSW_THRESHOLD = 1_000_000
_HNSW_M = 32
_HNSW_EF_SEARCH = 64


def _faiss_available() -> bool:
    """True iff faiss imports cleanly.

    Note: on some macOS setups FAISS imports but segfaults during ``search()`` because
    of an OpenMP runtime conflict (libomp loaded twice by FAISS and PyTorch). In that
    case the search will raise and ``MemoryIndex`` falls back to numpy brute-force at
    use time. We can't probe ``search`` here because the failure mode is a hard segfault.

    Workaround: ``conda install -c conda-forge faiss-cpu`` instead of ``pip install``,
    which uses a single OMP runtime shared with PyTorch.
    """
    try:
        import faiss  # noqa: F401

        return True
    except ImportError:
        return False


def _faiss_gpu_available() -> bool:
    if not _faiss_available():
        return False
    try:
        import faiss

        return faiss.get_num_gpus() > 0
    except Exception:
        return False


def _resolve_device(device: Device) -> Literal["cpu", "cuda", "numpy"]:
    if device == "numpy":
        return "numpy"
    if not _faiss_available():
        logger.info("FAISS not installed; falling back to numpy brute-force search.")
        return "numpy"
    if device == "auto":
        return "cuda" if _faiss_gpu_available() else "cpu"
    if device == "cpu":
        return "cpu"
    if device.startswith("cuda"):
        if not _faiss_gpu_available():
            logger.warning("Requested %r but FAISS-GPU not available; using CPU.", device)
            return "cpu"
        return "cuda"
    raise ValueError(f"Unknown FAISS device: {device!r}")


def _pick_index_type(n_vectors: int, requested: IndexType) -> Literal["flat", "hnsw"]:
    if requested == "auto":
        return "hnsw" if n_vectors > _HNSW_THRESHOLD else "flat"
    return requested  # type: ignore[return-value]


class MemoryIndex:
    """An on-disk parquet store with lazy FAISS index.

    Two indices typically coexist in a corpus: one for chunks, one for memories. A third
    "joint" index can be built by combining them at retrieval time.
    """

    def __init__(
        self,
        parquet_path: str | Path,
        *,
        dim: Optional[int] = None,
        device: Device = "auto",
        index_type: IndexType = "auto",
    ) -> None:
        self.parquet_path = Path(parquet_path)
        self.dim = dim
        self.requested_device = device
        self.requested_index_type = index_type

        self._hash_ids: List[str] = []
        self._texts: List[str] = []
        self._embeddings: List[np.ndarray] = []
        self._matrix: Optional[np.ndarray] = None
        self._faiss_index = None
        self._faiss_resource = None
        self._resolved_device: Optional[Literal["cpu", "cuda", "numpy"]] = None

        self._load()

    # ------------------------------------------------------------------ io

    def _load(self) -> None:
        if not self.parquet_path.exists():
            return
        import pandas as pd

        df = pd.read_parquet(self.parquet_path)
        self._hash_ids = df["hash_id"].astype(str).tolist()
        self._texts = df["content"].astype(str).tolist()
        self._embeddings = [np.asarray(e, dtype=np.float32) for e in df["embedding"].tolist()]
        if self._embeddings and self.dim is None:
            self.dim = int(self._embeddings[0].shape[-1])
        logger.info("Loaded %s records from %s", len(self._hash_ids), self.parquet_path)

    def _save(self) -> None:
        import pandas as pd

        self.parquet_path.parent.mkdir(parents=True, exist_ok=True)
        df = pd.DataFrame(
            {
                "hash_id": self._hash_ids,
                "content": self._texts,
                "embedding": [e.tolist() for e in self._embeddings],
            }
        )
        df.to_parquet(self.parquet_path, index=False)
        logger.info("Saved %s records to %s", len(self._hash_ids), self.parquet_path)

    # ------------------------------------------------------------------ write

    def upsert(self, hash_ids: List[str], texts: List[str], embeddings: np.ndarray) -> None:
        if not (len(hash_ids) == len(texts) == embeddings.shape[0]):
            raise ValueError("hash_ids, texts, embeddings must have matching lengths")
        if self.dim is None:
            self.dim = embeddings.shape[1]
        elif embeddings.shape[1] != self.dim:
            raise ValueError(f"dim mismatch: store={self.dim}, batch={embeddings.shape[1]}")

        existing = set(self._hash_ids)
        added = 0
        for h, t, e in zip(hash_ids, texts, embeddings):
            if h in existing:
                continue
            self._hash_ids.append(h)
            self._texts.append(t)
            self._embeddings.append(np.asarray(e, dtype=np.float32))
            existing.add(h)
            added += 1
        if added == 0:
            return
        # Invalidate derived structures.
        self._matrix = None
        self._faiss_index = None
        self._delete_faiss_sidecar()
        self._save()

    def _delete_faiss_sidecar(self) -> None:
        side = self._faiss_sidecar_path()
        if side.exists():
            try:
                side.unlink()
            except OSError:
                pass

    def _faiss_sidecar_path(self) -> Path:
        return self.parquet_path.with_suffix(".faiss")

    # ------------------------------------------------------------------ read

    def __len__(self) -> int:
        return len(self._hash_ids)

    @property
    def hash_ids(self) -> List[str]:
        return list(self._hash_ids)

    @property
    def texts(self) -> List[str]:
        return list(self._texts)

    def matrix(self) -> np.ndarray:
        if self._matrix is None and self._embeddings:
            self._matrix = np.stack(self._embeddings, axis=0).astype(np.float32)
        return self._matrix if self._matrix is not None else np.zeros((0, self.dim or 0), dtype=np.float32)

    # ------------------------------------------------------------------ faiss

    def _build_or_load_faiss(self) -> None:
        import faiss

        n = len(self._embeddings)
        index_kind = _pick_index_type(n, self.requested_index_type)

        side = self._faiss_sidecar_path()
        if side.exists() and side.stat().st_mtime >= self.parquet_path.stat().st_mtime:
            self._faiss_index = faiss.read_index(str(side))
            logger.info("Loaded FAISS index from %s (%s vectors, kind=%s)", side, n, index_kind)
        else:
            matrix = self.matrix()
            if index_kind == "flat":
                index = faiss.IndexFlatIP(self.dim)
            else:
                index = faiss.IndexHNSWFlat(self.dim, _HNSW_M, faiss.METRIC_INNER_PRODUCT)
                index.hnsw.efSearch = _HNSW_EF_SEARCH
            index.add(matrix)
            faiss.write_index(index, str(side))
            self._faiss_index = index
            logger.info("Built FAISS index at %s (%s vectors, kind=%s)", side, n, index_kind)

        if self._resolved_device == "cuda":
            try:
                self._faiss_resource = faiss.StandardGpuResources()
                self._faiss_index = faiss.index_cpu_to_gpu(self._faiss_resource, 0, self._faiss_index)
                logger.info("Moved FAISS index to GPU.")
            except Exception as exc:
                logger.warning("Could not move FAISS index to GPU (%s); using CPU.", exc)
                self._resolved_device = "cpu"

    def _ensure_index(self) -> None:
        if self._resolved_device is None:
            self._resolved_device = _resolve_device(self.requested_device)
        if self._resolved_device == "numpy":
            return
        if self._faiss_index is None:
            self._build_or_load_faiss()

    # ------------------------------------------------------------------ search

    def search(self, queries: np.ndarray, k: int) -> Tuple[np.ndarray, np.ndarray]:
        """Top-k inner-product search. Returns ``(scores, indices)`` shaped ``(B, k)``."""
        if queries.ndim == 1:
            queries = queries[None, :]
        n = len(self._embeddings)
        if n == 0:
            return (
                np.zeros((queries.shape[0], 0), dtype=np.float32),
                np.zeros((queries.shape[0], 0), dtype=np.int64),
            )
        k_eff = min(k, n)
        self._ensure_index()
        if self._resolved_device == "numpy" or self._faiss_index is None:
            return self._search_numpy(queries, k_eff)

        scores, idx = self._faiss_index.search(queries.astype(np.float32), k_eff)
        return scores.astype(np.float32), idx.astype(np.int64)

    def _search_numpy(self, queries: np.ndarray, k_eff: int) -> Tuple[np.ndarray, np.ndarray]:
        matrix = self.matrix()
        scores = queries.astype(np.float32) @ matrix.T  # (B, N)
        idx = np.argpartition(-scores, kth=k_eff - 1, axis=1)[:, :k_eff]
        row_idx = np.arange(queries.shape[0])[:, None]
        sorted_order = np.argsort(-scores[row_idx, idx], axis=1)
        idx_sorted = idx[row_idx, sorted_order]
        scores_sorted = scores[row_idx, idx_sorted]
        return scores_sorted.astype(np.float32), idx_sorted.astype(np.int64)
