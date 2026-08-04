"""Search strategies -- the second orthogonal axis.

Values: ``full_expansion`` | ``beamdr`` | ``cross_view_beam`` | ``mmr``
       | ``single_hop``.

Phase 3 implements each strategy; Phase 1 ships the ABC and search-result type.
"""

from latentgraphrag.search.base import BaseSearch, RetrievalPath, SearchStrategy
from latentgraphrag.search.batched import (
    run_dual_tree_batched,
    run_full_expansion_batched,
)
from latentgraphrag.search.beamdr import run_beamdr
from latentgraphrag.search.context import RetrievedItem, SearchPath, build_context
from latentgraphrag.search.cross_view_beam import CrossViewItem, run_cross_view_beam
from latentgraphrag.search.full_expansion import run_full_expansion
from latentgraphrag.search.mmr import run_mmr
from latentgraphrag.search.single_hop import run_single_hop

__all__ = [
    "BaseSearch",
    "RetrievalPath",
    "RetrievedItem",
    "SearchPath",
    "SearchStrategy",
    "CrossViewItem",
    "build_context",
    "run_beamdr",
    "run_cross_view_beam",
    "run_dual_tree_batched",
    "run_full_expansion",
    "run_full_expansion_batched",
    "run_mmr",
    "run_single_hop",
]
