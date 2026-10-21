"""The paper's frozen retrieval configuration.

LatentGraphRAG runs Recursive Dense Retrieval (RDR) twice, once over the source documents and once over
the constructed memories, and fuses the two readouts in document space. Every value below is the one
used for the paper's tables; RDR's own defaults are noted where they differ.
"""

from __future__ import annotations

from dataclasses import dataclass, replace


@dataclass(frozen=True)
class LGRConfig:
    """Settings of the two recursive searches, their readouts and the source-level fusion.

    Args:
        depth: Encoded levels per tree, including the root (RDR(4, 3)).
        branching: Children per state in the document tree.
        memory_branching: Children per state in the memory tree.
        memory_mmr: Select memory children by maximal marginal relevance instead of top score.
        mmr_lambda: Relevance weight of the MMR objective ``lambda * score - (1 - lambda) * redundancy``.
        mmr_pool: MMR chooses among the ``mmr_pool * branching`` best unselected units.
        joint_branching: Children per state in the joint-index ablation (documents and memories in one
            index, one tree, top-score selection).
        temperature: Softmax temperature of RDR's global readout (RDR's default is 0.05).
        top_k: Units each state contributes to the readout, and units each view passes to fusion.
        projection: How memory scores become document scores: ``"max"`` over the memories a document
            supplied (paper), or ``"sum"``, ``"mean"``, ``"pmax2"``, ``"pmax4"``, ``"noisy_or"``.
        fusion: View fusion: ``"combmnz"`` (paper), ``"combsum"``, ``"z"``, ``"rrf"`` or ``"max"``.
        document_weight: Weight of the document view in the fusion.
        memory_weight: Weight of the projected memory view (and of the joint view) in the fusion.
        rrf_k: Rank offset of reciprocal rank fusion.
        observation_max_tokens: Token cap per observed unit in a query state.
        observation_header: Line placed before the observed units in a query state.
    """

    depth: int = 4
    branching: int = 3
    memory_branching: int = 3
    memory_mmr: bool = True
    mmr_lambda: float = 0.5
    mmr_pool: int = 5
    joint_branching: int = 3
    temperature: float = 0.02
    top_k: int = 200
    projection: str = "max"
    fusion: str = "combmnz"
    document_weight: float = 1.0
    memory_weight: float = 0.5
    rrf_k: int = 60
    observation_max_tokens: int = 512
    observation_header: str = "Retrieved Context:"

    def with_(self, **changes) -> "LGRConfig":
        """A copy with some settings changed, e.g. ``PAPER.with_(memory_weight=1.0)``."""
        return replace(self, **changes)


#: The configuration behind every LatentGraphRAG row of the paper.
PAPER = LGRConfig()
