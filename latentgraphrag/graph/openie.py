"""Open information extraction (NER + triple extraction) over chunks.

Provider-agnostic: the actual LLM call is delegated to ``latentgraphrag.llm``. This module
owns the chunk-loop, JSON parsing, caching, and result shape.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from latentgraphrag.graph.chunker import Chunk
from latentgraphrag.llm.base import BaseLLM
from latentgraphrag.prompts.openie import (
    build_ner_messages,
    build_triple_extraction_messages,
)
from latentgraphrag.utils.io import read_json, write_json
from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class OpenIEResult:
    """Per-chunk OpenIE output."""

    chunk_id: str
    entities: List[str] = field(default_factory=list)
    triples: List[Tuple[str, str, str]] = field(default_factory=list)
    raw_ner_response: Optional[str] = None
    raw_triple_response: Optional[str] = None


_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_json_obj(response: str) -> Dict[str, Any]:
    """Robustly parse a JSON object from a model response."""
    text = (response or "").strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = _JSON_BLOCK_RE.search(text)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}


def _coerce_triples(raw: Any) -> List[Tuple[str, str, str]]:
    out: List[Tuple[str, str, str]] = []
    if not isinstance(raw, list):
        return out
    for item in raw:
        if isinstance(item, (list, tuple)) and len(item) == 3 and all(isinstance(p, str) for p in item):
            s, r, o = (p.strip() for p in item)
            if s and r and o:
                out.append((s, r, o))
    return out


def _coerce_entities(raw: Any) -> List[str]:
    if not isinstance(raw, list):
        return []
    seen: set = set()
    out: List[str] = []
    for item in raw:
        if isinstance(item, str):
            s = item.strip()
            if s and s.lower() not in seen:
                seen.add(s.lower())
                out.append(s)
    return out


class OpenIEExtractor:
    """Run NER + triple extraction over a list of chunks, with optional disk cache."""

    def __init__(self, llm: BaseLLM, *, cache_path: Optional[str] = None) -> None:
        self.llm = llm
        self.cache_path = cache_path
        self._cache: Dict[str, dict] = {}
        if cache_path:
            try:
                self._cache = read_json(cache_path)
            except FileNotFoundError:
                self._cache = {}

    def _save_cache(self) -> None:
        if self.cache_path:
            write_json(self._cache, self.cache_path)

    def extract_one(self, chunk: Chunk) -> OpenIEResult:
        if chunk.hash_id in self._cache:
            d = self._cache[chunk.hash_id]
            return OpenIEResult(
                chunk_id=chunk.hash_id,
                entities=d.get("entities", []),
                triples=[tuple(t) for t in d.get("triples", [])],
            )

        # Step 1: NER pass — verbatim paper-canonical 1-shot prompt.
        ner_messages = build_ner_messages(chunk.text)
        ner_resp = self.llm.complete_chat(ner_messages)
        entities = _coerce_entities(_parse_json_obj(ner_resp).get("named_entities"))

        # Step 2: triple extraction — feeds the named entity list back in as JSON,
        # exactly as in the paper's prompts/templates/triple_extraction.py.
        named_entity_json = json.dumps({"named_entities": entities}, ensure_ascii=False)
        trip_messages = build_triple_extraction_messages(chunk.text, named_entity_json)
        trip_resp = self.llm.complete_chat(trip_messages)
        triples = _coerce_triples(_parse_json_obj(trip_resp).get("triples"))

        self._cache[chunk.hash_id] = {
            "entities": entities,
            "triples": [list(t) for t in triples],
        }
        self._save_cache()

        return OpenIEResult(
            chunk_id=chunk.hash_id,
            entities=entities,
            triples=triples,
            raw_ner_response=ner_resp,
            raw_triple_response=trip_resp,
        )

    def extract_many(self, chunks: List[Chunk]) -> List[OpenIEResult]:
        """Run NER + triple extraction across many chunks, batching where possible.

        The pipeline runs in two batched stages so backends with batched inference
        (notably vLLM with prefix caching) can amortize the few-shot prompt prefix
        across the whole batch. Cached chunks short-circuit to disk without an LLM
        call.
        """
        results: List[Optional[OpenIEResult]] = [None] * len(chunks)
        pending_idx: List[int] = []
        pending_chunks: List[Chunk] = []

        # Stage 0: serve cached results, collect indices that still need NER.
        for i, ch in enumerate(chunks):
            if ch.hash_id in self._cache:
                d = self._cache[ch.hash_id]
                results[i] = OpenIEResult(
                    chunk_id=ch.hash_id,
                    entities=d.get("entities", []),
                    triples=[tuple(t) for t in d.get("triples", [])],
                )
            else:
                pending_idx.append(i)
                pending_chunks.append(ch)

        if not pending_chunks:
            return [r for r in results if r is not None]

        # Stage 1: NER, one batched call across all pending chunks.
        ner_message_lists = [build_ner_messages(ch.text) for ch in pending_chunks]
        ner_responses = self.llm.batch_complete_chat(ner_message_lists)
        entities_per_chunk: List[List[str]] = [
            _coerce_entities(_parse_json_obj(r).get("named_entities"))
            for r in ner_responses
        ]

        # Stage 2: triple extraction, one batched call. Feeds NER output back as JSON
        # exactly as the upstream experiment scripts do.
        trip_message_lists = [
            build_triple_extraction_messages(
                ch.text,
                json.dumps({"named_entities": ents}, ensure_ascii=False),
            )
            for ch, ents in zip(pending_chunks, entities_per_chunk)
        ]
        trip_responses = self.llm.batch_complete_chat(trip_message_lists)

        for offset, ch in enumerate(pending_chunks):
            entities = entities_per_chunk[offset]
            triples = _coerce_triples(_parse_json_obj(trip_responses[offset]).get("triples"))
            self._cache[ch.hash_id] = {
                "entities": entities,
                "triples": [list(t) for t in triples],
            }
            results[pending_idx[offset]] = OpenIEResult(
                chunk_id=ch.hash_id,
                entities=entities,
                triples=triples,
                raw_ner_response=ner_responses[offset],
                raw_triple_response=trip_responses[offset],
            )
        self._save_cache()

        return [r for r in results if r is not None]
