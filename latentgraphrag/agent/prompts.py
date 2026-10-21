"""Prompts and message layout of the ReAct agent, verbatim from the paper's runners (Figure 3).

Every string here is part of the measured protocol: changing a character changes the experiment.
The system prompt of the main protocol is the one released with the BrowseComp-Plus agent; the
seed-aware and read-only prompts are the paper's ablations.
"""

from __future__ import annotations

from typing import Dict, Optional, Sequence, Tuple

# ----------------------------------------------------------------------------- system prompts

#: Main protocol ("standard"): the BrowseComp-Plus agent prompt.
STANDARD_SYSTEM = (
    "You are a deep research agent. Answer the question by interacting with a local knowledge base. "
    "Actions (one per turn):\n"
    "  SEARCH: <query>   -> returns top-5 documents\n"
    "Search to find candidates, read the most relevant documents, then finish with a line:\n"
    "  Exact Answer: <your single best answer>\n"
    "Be efficient; answer as soon as you have enough evidence."
)

#: Seed-aware policy: search only when a specific fact is missing.
SEED_AWARE_SYSTEM = (
    "Use the documents to answer. If a specific fact is missing, output ONLY: SEARCH: <focused query>. "
    "Otherwise end with: Exact Answer: <answer>. Prefer to answer; search only when needed."
)

#: Read-only condition (retrieve-then-read): answer from the seed alone.
READ_ONLY_SYSTEM = "Use the documents to answer. End with: Exact Answer: <answer>."

# Further prompt variants of the policy ablation runner; not part of the main tables.
SEED_AWARE_NO_PREFER_SYSTEM = (
    "Use the documents to answer. If a specific fact is missing, output ONLY: SEARCH: <focused query>. "
    "Otherwise end with: Exact Answer: <answer>."
)
SEED_AWARE_BROAD_SYSTEM = (
    "Use the documents to answer. If information is missing, output: SEARCH: <query>. "
    "Otherwise end with: Exact Answer: <answer>. Prefer to answer; search only when needed."
)
STANDARD_SEED_SYSTEM = STANDARD_SYSTEM + (
    " Documents given with the question are initial evidence: check whether they already answer the "
    "question completely before you search."
)

# ----------------------------------------------------------------------------- observation lines

#: Ends every observation of the standard policy while searches remain.
STANDARD_CONTINUE = "Continue (SEARCH / Exact Answer)."
#: Ends every observation of the seed-aware policy (and of the read-only runner) while searches remain.
SEED_AWARE_CONTINUE = "Now answer or SEARCH."
#: Ends the observation after the last allowed search.
NO_SEARCHES_LEFT = "No searches left. Answer now from the documents. End with: Exact Answer: <answer>."

#: ``name -> (system prompt, continuation line)``. ``standard``/``seed_aware``/``read_only`` are the
#: paper's conditions; the short names are the ablation runner's own keys.
POLICIES: Dict[str, Tuple[str, str]] = {
    "standard": (STANDARD_SYSTEM, STANDARD_CONTINUE),
    "seed_aware": (SEED_AWARE_SYSTEM, SEED_AWARE_CONTINUE),
    "read_only": (READ_ONLY_SYSTEM, SEED_AWARE_CONTINUE),
    "std": (STANDARD_SYSTEM, STANDARD_CONTINUE),
    "tgt": (SEED_AWARE_SYSTEM, SEED_AWARE_CONTINUE),
    "tgt_noprefer": (SEED_AWARE_NO_PREFER_SYSTEM, SEED_AWARE_CONTINUE),
    "tgt_broad": (SEED_AWARE_BROAD_SYSTEM, SEED_AWARE_CONTINUE),
    "std_seed": (STANDARD_SEED_SYSTEM, STANDARD_CONTINUE),
}

# ----------------------------------------------------------------------------- follow-up request

#: Opening of the single follow-up request after a turn without a valid action.
FOLLOWUP_OPENINGS: Dict[str, str] = {
    "cut": "Your previous message was cut off at the length limit. ",
    "nosearch": "No searches are left. ",
    "noaction": "Your previous message did not contain a valid action. ",
}
FOLLOWUP_INSTRUCTION = "Stop reasoning and reply with exactly one line: "
FOLLOWUP_EITHER = "either SEARCH: <query> or Exact Answer: <answer>."
FOLLOWUP_ANSWER_ONLY = "Exact Answer: <answer>."
#: Marker inserted between the original turn and the forced action.
FORCED_MARKERS: Dict[str, str] = {
    "cut": "cut off at the token limit",
    "nosearch": "no searches left",
    "noaction": "no valid action",
}

#: Search-result shrinking (context fitting) recognises an observation by these continuation lines.
_OBSERVATION_TAILS = ("\n" + SEED_AWARE_CONTINUE, "\n" + STANDARD_CONTINUE, "\nNo searches left.")


def followup_request(reason: str, can_search: bool) -> str:
    """The follow-up user turn for a turn without a valid action (``reason``: cut / nosearch / noaction)."""
    return (FOLLOWUP_OPENINGS[reason] + FOLLOWUP_INSTRUCTION
            + (FOLLOWUP_EITHER if can_search else FOLLOWUP_ANSWER_ONLY))


def documents_turn(seed_texts: Sequence[str], question: str) -> str:
    """First user turn: the seed as numbered documents, then the question (empty list without a seed)."""
    return ("Documents:\n" + "\n\n".join(f"[{i + 1}] " + s for i, s in enumerate(seed_texts))
            + f"\n\nQuestion: {question}")


def search_results_turn(texts: Sequence[str], question: str, continue_line: Optional[str]) -> str:
    """User turn after a search. ``continue_line=None`` marks the observation after the last allowed search."""
    body = "Search results:\n" + "\n\n".join(f"[+{i + 1}] " + g for i, g in enumerate(texts))
    if continue_line is None:
        return body + f"\n{NO_SEARCHES_LEFT}\nQuestion: {question}"
    return body + f"\n{continue_line}\nQuestion: {question}"
