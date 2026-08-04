"""NV-Embed-v2 encoder — used as a baseline in the paper's experiments."""

from __future__ import annotations

from typing import List, Optional

import numpy as np

from latentgraphrag.encoders.base import BaseEncoder
from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


class NVEmbedV2Encoder(BaseEncoder):
    """Wraps ``nvidia/NV-Embed-v2`` via HuggingFace transformers.

    Note: NV-Embed has its own ``encode`` method exposed through ``AutoModel``. This is
    a thin adapter that runs the model with the standard HF interface.
    """

    def __init__(
        self,
        model_name_or_path: str = "nvidia/NV-Embed-v2",
        *,
        device: Optional[str] = None,
        normalize: bool = True,
        batch_size: int = 8,
        max_length: int = 4096,
        torch_dtype: Optional[str] = "bfloat16",
    ) -> None:
        try:
            import torch
            from transformers import AutoModel, AutoTokenizer
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "NVEmbedV2Encoder requires `torch` and `transformers`. "
                "Install with `pip install latentgraphrag[nvembed]`."
            ) from exc

        self.model_name_or_path = model_name_or_path
        self.normalize = normalize
        self.batch_size = batch_size
        self.max_length = max_length
        if device is None:
            device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.device = device

        dtype_map = {"float16": torch.float16, "bfloat16": torch.bfloat16, "float32": torch.float32}
        dtype = dtype_map.get(torch_dtype or "bfloat16", torch.bfloat16)

        self._tokenizer = AutoTokenizer.from_pretrained(model_name_or_path, trust_remote_code=True)
        self._model = AutoModel.from_pretrained(
            model_name_or_path, trust_remote_code=True, torch_dtype=dtype
        ).to(device)
        self._model.eval()
        self.dim = int(getattr(self._model.config, "hidden_size", 4096))

    def encode(
        self,
        texts: List[str],
        *,
        instruction: Optional[str] = None,
        is_query: bool = False,  # noqa: ARG002
    ) -> np.ndarray:
        import torch

        if isinstance(texts, str):
            texts = [texts]
        prepared = [f"{instruction}{t}" if instruction else t for t in texts]
        out: List[np.ndarray] = []
        with torch.no_grad():
            for i in range(0, len(prepared), self.batch_size):
                batch = prepared[i : i + self.batch_size]
                enc = self._tokenizer(
                    batch,
                    max_length=self.max_length,
                    padding=True,
                    truncation=True,
                    return_tensors="pt",
                ).to(self.device)
                outputs = self._model(**enc)
                # NV-Embed-v2 surfaces sentence embeddings via .sentence_embeddings or last_hidden_state mean
                if hasattr(outputs, "sentence_embeddings"):
                    vecs = outputs.sentence_embeddings
                else:
                    mask = enc["attention_mask"].unsqueeze(-1).float()
                    summed = (outputs.last_hidden_state * mask).sum(dim=1)
                    counts = mask.sum(dim=1).clamp(min=1)
                    vecs = summed / counts
                out.append(vecs.float().cpu().numpy())
        vecs_np = np.concatenate(out, axis=0) if out else np.zeros((0, self.dim), dtype=np.float32)
        vecs_np = vecs_np.astype(np.float32)
        if self.normalize:
            vecs_np = self._l2_normalize(vecs_np)
        return vecs_np
