"""NER + open information extraction prompts.

Ported verbatim from the experiment scripts at
``source_files/HippoRAG_GritHopper/src/hipporag/prompts/templates/{ner,triple_extraction}.py``
so that the package's OpenIE behavior matches the paper's experiments bit-for-bit.

The originals use a **few-shot chat-message pattern**: a system message, one
demonstration (user paragraph → assistant JSON), and then the real user message. The
helpers below build these message lists for a given (passage, entities) tuple.
"""

from __future__ import annotations

from typing import List, TypedDict


# ---------------------------------------------------------------------- types

class ChatMessage(TypedDict):
    role: str  # "system" | "user" | "assistant"
    content: str


# ============================================================================
# NER prompts — verbatim from prompts/templates/ner.py
# ============================================================================

NER_SYSTEM_PROMPT = """Your task is to extract named entities from the given paragraph.
Respond with a JSON list of entities.
"""

ONE_SHOT_NER_PARAGRAPH = """Radio City
Radio City is India's first private FM radio station and was started on 3 July 2001.
It plays Hindi, English and regional songs.
Radio City recently forayed into New Media in May 2008 with the launch of a music portal - PlanetRadiocity.com that offers music related news, videos, songs, and other music-related features."""

ONE_SHOT_NER_OUTPUT = """{"named_entities":
    ["Radio City", "India", "3 July 2001", "Hindi", "English", "May 2008", "PlanetRadiocity.com"]
}
"""


def build_ner_messages(passage: str) -> List[ChatMessage]:
    """Return the four-message chat sequence used for NER (system + 1-shot demo + real)."""
    return [
        {"role": "system", "content": NER_SYSTEM_PROMPT},
        {"role": "user", "content": ONE_SHOT_NER_PARAGRAPH},
        {"role": "assistant", "content": ONE_SHOT_NER_OUTPUT},
        {"role": "user", "content": passage},
    ]


# ============================================================================
# Triple extraction prompts — verbatim from prompts/templates/triple_extraction.py
# ============================================================================

TRIPLE_EXTRACTION_SYSTEM_PROMPT = """Your task is to construct an RDF (Resource Description Framework) graph from the given passages and named entity lists.
Respond with a JSON list of triples, with each triple representing a relationship in the RDF graph.

Pay attention to the following requirements:
- Each triple should contain at least one, but preferably two, of the named entities in the list for each passage.
- Clearly resolve pronouns to their specific names to maintain clarity.

"""

# Frame for the user message — same template used for both the demonstration and the real query.
NER_CONDITIONED_RE_FRAME = """Convert the paragraph into a JSON dict, it has a named entity list and a triple list.
Paragraph:
```
{passage}
```

{named_entity_json}
"""

# Rendered demonstration: the same Radio City paragraph + its NER output.
ONE_SHOT_RE_INPUT = NER_CONDITIONED_RE_FRAME.format(
    passage=ONE_SHOT_NER_PARAGRAPH,
    named_entity_json=ONE_SHOT_NER_OUTPUT,
)

# Demonstration assistant response — the gold triples for the Radio City paragraph.
ONE_SHOT_RE_OUTPUT = """{"triples": [
            ["Radio City", "located in", "India"],
            ["Radio City", "is", "private FM radio station"],
            ["Radio City", "started on", "3 July 2001"],
            ["Radio City", "plays songs in", "Hindi"],
            ["Radio City", "plays songs in", "English"],
            ["Radio City", "forayed into", "New Media"],
            ["Radio City", "launched", "PlanetRadiocity.com"],
            ["PlanetRadiocity.com", "launched in", "May 2008"],
            ["PlanetRadiocity.com", "is", "music portal"],
            ["PlanetRadiocity.com", "offers", "news"],
            ["PlanetRadiocity.com", "offers", "videos"],
            ["PlanetRadiocity.com", "offers", "songs"]
    ]
}
"""


def build_triple_extraction_messages(passage: str, named_entity_json: str) -> List[ChatMessage]:
    """Return the four-message chat sequence used for triple extraction.

    Args:
        passage: the chunk text to extract triples from.
        named_entity_json: the JSON string the NER pass produced for this chunk —
            usually ``json.dumps({"named_entities": [...]})``. This is concatenated
            into the user message exactly as in the experiment scripts.
    """
    real_user_message = NER_CONDITIONED_RE_FRAME.format(
        passage=passage,
        named_entity_json=named_entity_json,
    )
    return [
        {"role": "system", "content": TRIPLE_EXTRACTION_SYSTEM_PROMPT},
        {"role": "user", "content": ONE_SHOT_RE_INPUT},
        {"role": "assistant", "content": ONE_SHOT_RE_OUTPUT},
        {"role": "user", "content": real_user_message},
    ]


__all__ = [
    "ChatMessage",
    "NER_SYSTEM_PROMPT",
    "ONE_SHOT_NER_PARAGRAPH",
    "ONE_SHOT_NER_OUTPUT",
    "TRIPLE_EXTRACTION_SYSTEM_PROMPT",
    "NER_CONDITIONED_RE_FRAME",
    "ONE_SHOT_RE_INPUT",
    "ONE_SHOT_RE_OUTPUT",
    "build_ner_messages",
    "build_triple_extraction_messages",
]
