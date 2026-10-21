"""Answer and retrieval metrics, as computed for the paper.

* FanOutQA answers are scored by loose list recall on the final answer text (``loose_final``): the
  text after the agent's last ``Exact Answer:`` up to the end of its output, so answers continued over
  several lines count; outputs without an answer line are scored on the whole output.
* Retrieval is scored by recall@k per question, averaged over questions with gold labels. Gold labels
  are either a set of document ids (fraction retrieved) or groups of interchangeable documents
  (fraction of groups with at least one retrieved member, e.g. FanOutQA source groups).
"""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, Mapping, Sequence, Set, Union

import numpy as np

from ..agent.react import final_answer_text

Gold = Union[Set[Any], Mapping[Any, Set[Any]]]


def normalize_text(text: str) -> str:
    """Lower-case and replace every run of non-alphanumeric characters by a single space."""
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def answer_string(answer: Union[str, Sequence[str]]) -> str:
    """Gold answers given as a list are joined with ``"; "`` (the paper's convention)."""
    return "; ".join(answer) if isinstance(answer, list) else str(answer)


def loose_list_recall(response: str, gold: Union[str, Sequence[str]]) -> float:
    """Loose list recall: the share of gold list items found in the response.

    The gold answer is split on ``;``. An item ``key: value`` counts when every token of the normalized
    key and value occurs in the normalized response; an item without ``:`` when every token of its value
    does. Token occurrence is a substring test on the normalized response, exactly as in the paper.
    An empty gold answer scores 0.
    """
    r = normalize_text(response)
    items = []
    for seg in answer_string(gold).split(";"):
        seg = seg.strip()
        if not seg:
            continue
        if ":" in seg:
            k, v = seg.split(":", 1)
            items.append((normalize_text(k), normalize_text(v)))
        else:
            items.append((None, normalize_text(seg)))
    if not items:
        return 0.0
    hits = 0
    for k, v in items:
        if bool(v) and all(t in r for t in v.split()) and (k is None or all(t in r for t in k.split())):
            hits += 1
    return hits / len(items)


def loose_final(output: str, gold: Union[str, Sequence[str]]) -> float:
    """The paper's FanOutQA score: loose list recall on :func:`final_answer_text` of the output."""
    return loose_list_recall(final_answer_text(output), gold)


def final_answer_line(output: str) -> str:
    """Only the line after the last ``Exact Answer:`` (the paper's first-line sensitivity variant)."""
    k = output.rfind("Exact Answer:")
    return output[k + len("Exact Answer:"):].split("\n", 1)[0].strip() if k >= 0 else output


def recall_at_k(ranking: Sequence[Any], gold: Gold, k: int) -> float:
    """Recall@k of one ranking against a gold id set or gold groups (``{group: set of ids}``)."""
    retrieved = set(list(ranking)[:k])
    if isinstance(gold, Mapping):
        return sum(bool(retrieved & set(docs)) for docs in gold.values()) / len(gold)
    gold = set(gold)
    return len(retrieved & gold) / len(gold)


def retrieval_metrics(rankings: Sequence[Sequence[Any]], gold: Sequence[Gold],
                      ks: Iterable[int] = (1, 5, 10, 20, 50, 100)) -> Dict[str, float]:
    """Mean recall@k over the questions that have gold labels, plus ``queries_with_gold``."""
    valid = [i for i, g in enumerate(gold) if g]
    out: Dict[str, float] = {}
    for k in ks:
        vals = [recall_at_k(rankings[i], gold[i], k) for i in valid]
        out[f"recall@{k}"] = float(np.mean(vals)) if vals else 0.0
    out["queries_with_gold"] = len(valid)
    return out
