"""Prompt templates for OpenIE and triplet verbalization."""

from latentgraphrag.prompts.openie import (
    NER_SYSTEM_PROMPT,
    TRIPLE_EXTRACTION_SYSTEM_PROMPT,
    build_ner_messages,
    build_triple_extraction_messages,
)
from latentgraphrag.prompts.verbalization import VERBALIZATION_SYSTEM_PROMPT, VERBALIZATION_USER_TEMPLATE

__all__ = [
    "NER_SYSTEM_PROMPT",
    "TRIPLE_EXTRACTION_SYSTEM_PROMPT",
    "build_ner_messages",
    "build_triple_extraction_messages",
    "VERBALIZATION_SYSTEM_PROMPT",
    "VERBALIZATION_USER_TEMPLATE",
]
