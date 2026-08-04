"""Prompt for triplet → relational memory verbalization.

Lifted verbatim from cluster_scripts/generate_triples_to_sentences_browsecomp_plus.py
so paper-canonical memories are reproducible.
"""

VERBALIZATION_SYSTEM_PROMPT = (
    "You will receive RDF-style triples in the form (subject, relation, object). "
    "Write exactly one concise natural-language sentence that preserves the fact. "
    "Do not add extra facts, explanations, bullets, or formatting."
)

VERBALIZATION_USER_TEMPLATE = "Triple: ({subject}, {relation}, {object})\nSentence:"
