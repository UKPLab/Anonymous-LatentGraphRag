"""Lightweight igraph wrapper with stable IDs and parquet/binary persistence."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable, Optional

from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


class GraphStore:
    """A thin wrapper around python-igraph.

    Nodes carry a ``kind`` attribute: ``"chunk"`` | ``"entity"`` | ``"memory"``.
    Edges carry a ``kind`` attribute: ``"chunk_entity"`` | ``"chunk_memory"`` |
    ``"entity_relation"`` | ``"entity_synonymy"`` (added later by an encoder pass).
    """

    def __init__(self) -> None:
        try:
            import igraph  # noqa: F401
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "python-igraph is required. Install with `pip install python-igraph`."
            ) from exc
        from igraph import Graph

        self._graph: Graph = Graph(directed=False)
        self._name_to_index: dict[str, int] = {}

    @property
    def graph(self):  # noqa: ANN201
        return self._graph

    def add_node(self, node_id: str, kind: str, **attrs) -> int:
        if node_id in self._name_to_index:
            return self._name_to_index[node_id]
        idx = self._graph.vcount()
        self._graph.add_vertex(name=node_id, kind=kind, **attrs)
        self._name_to_index[node_id] = idx
        return idx

    def add_edge(self, src: str, dst: str, kind: str, weight: float = 1.0) -> None:
        if src not in self._name_to_index or dst not in self._name_to_index:
            raise KeyError(f"Cannot add edge between unknown nodes: {src!r}, {dst!r}")
        self._graph.add_edge(self._name_to_index[src], self._name_to_index[dst], kind=kind, weight=weight)

    def vcount(self) -> int:
        return self._graph.vcount()

    def ecount(self) -> int:
        return self._graph.ecount()

    def nodes_of_kind(self, kind: str) -> Iterable[str]:
        for v in self._graph.vs:
            if v.attributes().get("kind") == kind:
                yield v["name"]

    def save(self, path: str | os.PathLike) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        # igraph picks the format from the extension; .picklez = compressed pickle.
        self._graph.write_picklez(str(path))
        logger.info("Saved graph: %s nodes, %s edges -> %s", self.vcount(), self.ecount(), path)

    @classmethod
    def load(cls, path: str | os.PathLike) -> "GraphStore":
        from igraph import Graph

        store = cls()
        store._graph = Graph.Read_Picklez(str(path))
        store._name_to_index = {v["name"]: v.index for v in store._graph.vs}
        return store

    def neighbors(self, node_id: str, edge_kind: Optional[str] = None) -> list[str]:
        if node_id not in self._name_to_index:
            return []
        idx = self._name_to_index[node_id]
        out: list[str] = []
        for nb in self._graph.neighbors(idx):
            if edge_kind is None:
                out.append(self._graph.vs[nb]["name"])
                continue
            eid = self._graph.get_eid(idx, nb)
            if self._graph.es[eid].attributes().get("kind") == edge_kind:
                out.append(self._graph.vs[nb]["name"])
        return out
