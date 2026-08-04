"""GritHopper encoder — the paper-canonical encoder for LatentGraphRAG.

Wraps the ``gritlm`` library. Uses paper-canonical query / document instructions by default,
copied from ``utils/config_utils.py::grithopper_instruction`` and ``grithopper_doc_instruction``.
"""

from __future__ import annotations

from copy import deepcopy
from typing import List, Optional

import numpy as np

from latentgraphrag.encoders.base import BaseEncoder
from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


# Verbatim from utils/config_utils.py — keep in sync with the paper.
DEFAULT_QUERY_INSTRUCTION = (
    "You answer multi-hop questions by iteratively retrieving documents. "
    "If a document is relevant, think by yourself which information is important to continue the search. "
    "If a document is irrelevant, stop the search. Once all information is extracted to answer the question, provide the final answer."
)
DEFAULT_DOC_INSTRUCTION = "Represent the document: "


def _format_grit_instruction(instruction: str) -> str:
    """GritLM tag layout: <|user|>\\n{instruction}\\n<|embed|>\\n"""
    if not instruction:
        return "<|embed|>\n"
    return f"<|user|>\n{instruction}\n<|embed|>\n"


class GritHopperEncoder(BaseEncoder):
    """The canonical encoder.

    Example::

        enc = GritHopperEncoder("GritHopper-7B", device="cuda:0")
        chunk_vecs = enc.encode(chunks, is_query=False)
        query_vecs = enc.encode(queries, is_query=True)
    """

    def __init__(
        self,
        model_name_or_path: str = "GritHopper-7B",
        *,
        device: Optional[str] = None,
        torch_dtype: Optional[str] = "bfloat16",
        normalize: bool = True,
        batch_size: int = 8,
        query_instruction: str = DEFAULT_QUERY_INSTRUCTION,
        doc_instruction: str = DEFAULT_DOC_INSTRUCTION,
        max_length: int = 2048,
    ) -> None:
        try:
            import torch
            from gritlm import GritLM
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "GritHopperEncoder requires `gritlm` and `torch`. "
                "Install with `pip install latentgraphrag[gritlm]`."
            ) from exc

        self.model_name_or_path = model_name_or_path
        self.normalize = normalize
        self.batch_size = batch_size
        self.query_instruction = query_instruction
        self.doc_instruction = doc_instruction
        self.max_length = max_length

        if device is None:
            device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.device = device

        self._model = GritLM(model_name_or_path=model_name_or_path, torch_dtype=torch_dtype)
        try:
            self._model.to(device)
        except Exception:
            try:
                self._model.model.to(device)
            except Exception as exc:  # pragma: no cover
                logger.warning("Could not move GritHopper to %s: %s", device, exc)
        self.dim = int(self._model.model.config.hidden_size)

    def encode(
        self,
        texts: List[str],
        *,
        instruction: Optional[str] = None,
        is_query: bool = False,
    ) -> np.ndarray:
        if isinstance(texts, str):
            texts = [texts]
        if instruction is None:
            instruction = self.query_instruction if is_query else self.doc_instruction
        formatted = _format_grit_instruction(instruction)
        try:
            import torch
        except ImportError:  # pragma: no cover
            torch = None  # type: ignore[assignment]

        params = {
            "sentences": list(texts),
            "instruction": formatted,
            "batch_size": self.batch_size,
            "max_length": self.max_length,
        }

        if torch is not None and torch.cuda.is_available() and "cuda" in str(self.device):
            dev_index = 0
            if ":" in str(self.device):
                try:
                    dev_index = int(str(self.device).split(":")[1])
                except ValueError:
                    dev_index = 0
            with torch.cuda.device(dev_index):
                vecs = self._model.encode(**params)
        else:
            vecs = self._model.encode(**params)

        if torch is not None and isinstance(vecs, torch.Tensor):
            vecs = vecs.cpu().numpy()
        vecs = np.asarray(vecs, dtype=np.float32)
        if self.normalize:
            vecs = self._l2_normalize(vecs)
        return vecs
