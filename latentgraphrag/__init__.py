"""LatentGraphRAG: composing constructed knowledge at test time with Recursive Dense Retrieval.

LatentGraphRAG searches the source documents and the knowledge constructed from them (triples and
propositions) with two recursive trees, maps the memory evidence back to its source documents and fuses
both into one document ranking. Recursive Dense Retrieval (RDR) supplies the encoder, the recursive
update and the readout; this package adds knowledge construction, the source-level fusion, and the
retrieval-first ReAct agent and evaluation used in the paper.
"""

from .config import PAPER, LGRConfig
from .construction import chunk_id, propositions, triples
from .inventory import MemoryInventory
from .retrieval import VIEWS, LatentGraphRAG, LGRIndex, LGRResult, MMRTreeSearch, fuse, project, rank
from .agent import DenseSearchTool, OpenAIChatModel, RankFileFusedSearchTool, ReActAgent, Seed, Trajectory
from .evaluation import BrowseCompGrader, Reader, loose_final, retrieval_metrics

__version__ = "0.2.0"

__all__ = ["LatentGraphRAG", "LGRIndex", "LGRResult", "LGRConfig", "PAPER", "MemoryInventory", "MMRTreeSearch",
           "triples", "propositions", "chunk_id", "project", "fuse", "rank", "VIEWS",
           "ReActAgent", "Seed", "Trajectory", "DenseSearchTool", "RankFileFusedSearchTool", "OpenAIChatModel",
           "Reader", "BrowseCompGrader", "loose_final", "retrieval_metrics", "__version__"]
