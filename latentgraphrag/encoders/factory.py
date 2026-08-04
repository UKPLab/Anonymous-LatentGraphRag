"""Encoder factory — dispatch from a string spec to a concrete encoder instance.

LatentGraphRAG retrieval relies on **iterative contextual dense retrieval**: at every
hop the encoder sees the question concatenated with previously retrieved evidence and
produces a fresh embedding. That means the encoder must distinguish between query and
document roles AND handle long, growing query contexts (multi-hop).

For that reason the package only ships encoders that are designed for this regime:
``GritHopperEncoder``, ``NVEmbedV2Encoder``, and ``CompatibleEncoder``. Generic
sentence-transformers models that have no notion of role or instruction are not a good
match for multi-hop dense retrieval; if you want to use a custom encoder, implement
``BaseEncoder`` directly so you can wire the right query/document conditioning.

Dispatch rules:
    - ``"hash"`` → ``HashEncoder`` (deterministic, for tests)
    - Known GritHopper checkpoints → ``GritHopperEncoder``
    - ``"text-embedding-*"`` or ``"openai/*"`` → ``CompatibleEncoder``
    - ``"nvidia/NV-Embed-*"`` (or contains ``"nv-embed"``) → ``NVEmbedV2Encoder``
"""

from __future__ import annotations

from typing import Union

from latentgraphrag.encoders.base import BaseEncoder, HashEncoder
from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


_GRITHOPPER_ALIASES = {
    "grithopper",
    "grithopper-7b",
}


def load_encoder(spec: Union[str, BaseEncoder]) -> BaseEncoder:
    """Return a concrete ``BaseEncoder`` for ``spec``.

    ``spec`` may be:
        - an already-constructed ``BaseEncoder`` (returned unchanged)
        - the literal string ``"hash"`` → the deterministic ``HashEncoder`` for tests
        - a HuggingFace id for a multi-hop-capable encoder (GritHopper, NV-Embed)
        - an OpenAI embeddings model (e.g. ``"text-embedding-3-large"``)

    Unknown strings raise. Implement ``BaseEncoder`` directly if you need a custom
    multi-hop encoder.
    """
    if isinstance(spec, BaseEncoder):
        return spec
    if not isinstance(spec, str):
        raise TypeError(f"encoder spec must be a string or BaseEncoder, got {type(spec).__name__}")

    s = spec.strip()
    s_lower = s.lower()

    if s_lower == "hash":
        return HashEncoder()

    if s_lower in _GRITHOPPER_ALIASES or "grithopper" in s_lower:
        from latentgraphrag.encoders.grithopper import GritHopperEncoder

        return GritHopperEncoder(s)

    if s_lower.startswith("text-embedding-") or s_lower.startswith("openai/"):
        from latentgraphrag.encoders.openai import CompatibleEncoder

        model_name = s.split("openai/", 1)[-1]
        return CompatibleEncoder(model_name)

    if s_lower.startswith("nvidia/nv-embed") or "nv-embed" in s_lower:
        from latentgraphrag.encoders.nvembed import NVEmbedV2Encoder

        return NVEmbedV2Encoder(s)

    raise ValueError(
        f"Unknown encoder spec {spec!r}. Multi-hop dense retrieval requires an encoder "
        "designed for it. Pass a GritHopper / NV-Embed / OpenAI-compatible id, or implement "
        "BaseEncoder directly for a custom multi-hop encoder."
    )
