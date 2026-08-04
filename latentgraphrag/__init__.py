"""LatentGraphRAG: contextual dense retrieval over documents and relational memories.

Public API:
    LatentGraphRAG          -- main pipeline class
    LatentGraphRAGConfig    -- configuration dataclass
    RelationalMemory        -- a verbalized (head, relation, tail) triplet
    RetrievalResult         -- output of LatentGraphRAG.retrieve()

For the three orthogonal axes (corpus, search, fusion) see `LatentGraphRAG.retrieve`.
"""

from latentgraphrag.config import LatentGraphRAGConfig
from latentgraphrag.memory.memory import RelationalMemory
from latentgraphrag.pipeline import LatentGraphRAG, RetrievalResult

__version__ = "0.1.0a0"

__all__ = [
    "LatentGraphRAG",
    "LatentGraphRAGConfig",
    "RelationalMemory",
    "RetrievalResult",
    "__version__",
]
