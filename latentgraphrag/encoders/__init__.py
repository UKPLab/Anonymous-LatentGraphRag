"""Dense encoders.

Public API:
    - ``BaseEncoder``: the ABC every encoder implements.
    - ``HashEncoder``: deterministic stub for CI / golden tests.
    - ``GritHopperEncoder``: paper-canonical encoder.
    - ``SentenceTransformerEncoder``: any HuggingFace sentence-transformers model.
    - ``CompatibleEncoder``: OpenAI-compatible API encoder (works with vLLM and local servers).
    - ``NVEmbedV2Encoder``: NV-Embed-v2 baseline.
    - ``load_encoder(spec)``: dispatch a string id to the right encoder class.

Heavy backends import their dependencies lazily on instantiation so the package is light
to import.
"""

from latentgraphrag.encoders.base import BaseEncoder, HashEncoder
from latentgraphrag.encoders.factory import load_encoder

__all__ = [
    "BaseEncoder",
    "HashEncoder",
    "load_encoder",
    # GritHopperEncoder, SentenceTransformerEncoder, CompatibleEncoder, NVEmbedV2Encoder
    # are lazily importable from their submodules to avoid pulling in heavy deps.
]
