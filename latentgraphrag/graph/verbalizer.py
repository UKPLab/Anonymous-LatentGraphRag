"""Triplet → relational memory verbalization.

Default: LM-based via the configured ``llm.base.BaseLLM``. If no LLM is provided,
falls back to a template ("{head} {relation} {tail}.") — matching the
``sanitize_sentence`` fallback in the original cluster script.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from latentgraphrag.llm.base import BaseLLM
from latentgraphrag.prompts.verbalization import (
    VERBALIZATION_SYSTEM_PROMPT,
    VERBALIZATION_USER_TEMPLATE,
)
from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


def _template_fallback(triple: Tuple[str, str, str]) -> str:
    s, r, o = triple
    return f"{s} {r} {o}."


def _sanitize(sentence: str, triple: Tuple[str, str, str]) -> str:
    cleaned = " ".join((sentence or "").strip().split())
    return cleaned or _template_fallback(triple)


class Verbalizer:
    """Convert a (head, relation, tail) triple into one natural-language sentence."""

    def __init__(self, llm: Optional[BaseLLM] = None) -> None:
        self.llm = llm

    def verbalize_one(self, triple: Tuple[str, str, str]) -> str:
        if self.llm is None:
            return _template_fallback(triple)
        s, r, o = triple
        try:
            resp = self.llm.complete(
                system=VERBALIZATION_SYSTEM_PROMPT,
                user=VERBALIZATION_USER_TEMPLATE.format(subject=s, relation=r, object=o),
            )
            return _sanitize(resp, triple)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Verbalization failed for triple=%s, falling back to template: %s", triple, exc)
            return _template_fallback(triple)

    def verbalize_many(self, triples: List[Tuple[str, str, str]]) -> List[str]:
        return [self.verbalize_one(t) for t in triples]
