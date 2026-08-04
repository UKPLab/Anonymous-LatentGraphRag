"""Fusion methods -- the third orthogonal axis (dual-tree only).

Values: ``rrf`` | ``agreement``.

Phase 3 implements each; Phase 1 ships the ABC.
"""

from latentgraphrag.fusion.agreement import AgreementFusion
from latentgraphrag.fusion.base import BaseFusion, FusionMethod
from latentgraphrag.fusion.rrf import RRFFusion

__all__ = ["BaseFusion", "FusionMethod", "RRFFusion", "AgreementFusion"]
