"""Triples as memories.

A triple ``(head, relation, tail)`` becomes the literal string ``"head relation tail."``: the three
parts joined by spaces, whitespace collapsed, a period appended. No language model rewrites it, so the
memory index holds exactly the units a graph pipeline built from the same extraction would traverse.

The paper reuses the triple sets of the graph baselines: on MuSiQue the HippoRAG 2 release extraction,
on FanOutQA and BrowseComp+ an extraction in HippoRAG's OpenIE format. :func:`load_openie` reads such
a cache; :func:`extract_with_hipporag` produces one with HippoRAG's own OpenIE code against any
OpenAI-compatible endpoint (e.g. vLLM).
"""

from __future__ import annotations

import ast
import gzip
import json
import re
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Mapping, Optional, Sequence, Union

from ..inventory import MemoryInventory

KIND = "triple"
_WS = re.compile(r"\s+")


def render(head: Any, relation: Any, tail: Any) -> Optional[str]:
    """``"head relation tail."``, or ``None`` if nothing is left after whitespace normalisation."""
    s = _WS.sub(" ", f"{head} {relation} {tail}".strip()).strip()
    if not s:
        return None
    return s if s.endswith(".") else s + "."


def load_openie(path: Union[str, Path]) -> List[Dict[str, Any]]:
    """Records ``{"idx", "extracted_triples", ...}`` from a HippoRAG-format OpenIE cache.

    Accepts the JSON form ``{"docs": [...]}`` and JSON lines, each optionally gzipped.
    """
    p = str(path)
    opener = gzip.open if p.endswith(".gz") else open
    with opener(p, "rt", encoding="utf-8") as f:
        head = f.read(1)
        f.seek(0)
        if head == "{" and not (p.endswith(".jsonl") or p.endswith(".jsonl.gz")):
            data = json.load(f)
            return list(data["docs"] if isinstance(data, dict) and "docs" in data else data)
        return [json.loads(line) for line in f if line.strip()]


def _triples(record: Mapping[str, Any]) -> Iterator[Sequence[Any]]:
    tr = record.get("extracted_triples") or []
    if isinstance(tr, str):
        tr = ast.literal_eval(tr)
    for t in tr:
        if isinstance(t, (list, tuple)) and len(t) == 3:
            yield t


def from_openie(records: Iterable[Mapping[str, Any]],
                source_of: Union[Mapping[str, Any], Callable[[str], Any], None] = None) -> MemoryInventory:
    """Memory inventory from OpenIE records.

    Args:
        records: OpenIE records with the chunk id ``idx`` and ``extracted_triples``.
        source_of: Maps a record's ``idx`` to the document id used by the document index (a mapping
            or a callable). Default: the ``idx`` itself. Records it does not know are skipped.
    """
    if source_of is None:
        resolve: Callable[[str], Any] = lambda i: i
    elif callable(source_of):
        resolve = source_of
    else:
        resolve = source_of.get
    inv = MemoryInventory()
    for rec in records:
        src = resolve(rec["idx"])
        if src is None:
            continue
        for h, r, t in _triples(rec):
            text = render(h, r, t)
            if text is not None:
                inv.add(text, src, KIND)
    return inv


def extract_with_hipporag(passages: Mapping[str, str], llm_name: str, llm_base_url: str, save_dir: Union[str, Path],
                          hipporag_src: Union[str, Path, None] = None) -> List[Dict[str, Any]]:
    """Run HippoRAG's OpenIE (NER, then triple extraction) over ``{chunk id: passage}``.

    Requires HippoRAG (MIT licensed) to be importable, either installed or from a checkout passed as
    ``hipporag_src`` (its ``src`` directory). Calls are cached by HippoRAG in ``save_dir``.

    Returns:
        HippoRAG-format records ``{"idx", "passage", "extracted_entities", "extracted_triples"}``, ready
        for :func:`from_openie`.
    """
    import sys

    if hipporag_src is not None:
        sys.path.insert(0, str(hipporag_src))
    from hipporag.information_extraction import OpenIE
    from hipporag.llm.openai_gpt import CacheOpenAI
    from hipporag.utils.config_utils import BaseConfig

    cfg = BaseConfig(llm_name=llm_name, llm_base_url=llm_base_url, save_dir=str(save_dir))
    oie = OpenIE(llm_model=CacheOpenAI.from_experiment_config(cfg))
    chunks = {k: {"content": v} for k, v in passages.items()}
    ner, triples = oie.batch_openie(chunks)
    return [{"idx": k, "passage": v,
             "extracted_entities": ner[k].unique_entities if k in ner else [],
             "extracted_triples": triples[k].triples if k in triples else []} for k, v in passages.items()]
