"""QA exact-match and F1 — slimmed from evaluation/qa_eval.py."""

from __future__ import annotations

import re
import string
from collections import Counter
from typing import Iterable


def _normalize(text: str) -> str:
    text = text.lower()
    text = "".join(ch for ch in text if ch not in string.punctuation)
    text = re.sub(r"\b(a|an|the)\b", " ", text)
    text = " ".join(text.split())
    return text


def qa_exact_match(prediction: str, gold_answers: Iterable[str]) -> float:
    p = _normalize(prediction)
    return float(any(_normalize(g) == p for g in gold_answers))


def qa_f1(prediction: str, gold_answers: Iterable[str]) -> float:
    p_toks = _normalize(prediction).split()
    best = 0.0
    for g in gold_answers:
        g_toks = _normalize(g).split()
        if not p_toks or not g_toks:
            score = float(p_toks == g_toks)
        else:
            common = Counter(p_toks) & Counter(g_toks)
            n_same = sum(common.values())
            if n_same == 0:
                score = 0.0
            else:
                precision = n_same / len(p_toks)
                recall = n_same / len(g_toks)
                score = 2 * precision * recall / (precision + recall)
        best = max(best, score)
    return best
