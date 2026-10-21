"""Propositions as memories.

A proposition is a self-contained statement extracted from one passage. The paper uses PropRAG's
propositions: its released extraction on MuSiQue, and on FanOutQA and BrowseComp+ an extraction with
PropRAG's own prompts and output repair against a local model. This module does not copy PropRAG's
prompts; :func:`extract_with_proprag` calls PropRAG itself, so extraction stays identical to it and is
governed by its terms.
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Mapping, Union

from ..inventory import MemoryInventory

KIND = "proposition"


def render(text: Any) -> str | None:
    """The proposition's text, stripped; ``None`` if empty."""
    s = str(text).strip() if text is not None else ""
    return s or None


def load_records(path: Union[str, Path]) -> List[Dict[str, Any]]:
    """Records ``{"idx", "propositions", ...}`` from PropRAG's OpenIE output (``{"docs": [...]}``, JSON
    lines, optionally gzipped)."""
    p = str(path)
    opener = gzip.open if p.endswith(".gz") else open
    with opener(p, "rt", encoding="utf-8") as f:
        head = f.read(1)
        f.seek(0)
        if head == "{" and not (p.endswith(".jsonl") or p.endswith(".jsonl.gz")):
            data = json.load(f)
            return list(data["docs"] if isinstance(data, dict) and "docs" in data else data)
        return [json.loads(line) for line in f if line.strip()]


def from_records(records: Iterable[Mapping[str, Any]],
                 source_of: Union[Mapping[str, Any], Callable[[str], Any], None] = None) -> MemoryInventory:
    """Memory inventory from PropRAG records (``idx`` plus a list of ``propositions``).

    Args:
        records: PropRAG OpenIE records.
        source_of: Maps a record's ``idx`` to the document id used by the document index (mapping or
            callable; default: the ``idx`` itself). Records it does not know are skipped.
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
        for prop in rec.get("propositions") or []:
            text = render(prop.get("text") if isinstance(prop, Mapping) else prop)
            if text is not None:
                inv.add(text, src, KIND)
    return inv


def extract_with_proprag(passages: Mapping[str, str], llm_name: str, llm_base_url: str, save_dir: Union[str, Path],
                         proprag_root: Union[str, Path]) -> List[Dict[str, Any]]:
    """Run PropRAG's ``EnhancedOpenIE`` (entities, then propositions) over ``{chunk id: passage}``.

    PropRAG is not bundled: pass the root of a PropRAG checkout as ``proprag_root``. It is run exactly as
    in the paper, with its own prompts and output repair, against an OpenAI-compatible endpoint.

    Returns:
        Records ``{"idx", "passage", "extracted_entities", "propositions"}`` for :func:`from_records`.
    """
    import os
    import sys

    root = str(Path(proprag_root).resolve())
    sys.path.insert(0, root)
    cwd = os.getcwd()
    os.chdir(root)  # PropRAG resolves its prompt templates relative to the checkout
    try:
        from src.proprag.information_extraction.enhanced_openie import EnhancedOpenIE
        from src.proprag.llm.openai_gpt import CacheOpenAI
        from src.proprag.utils.config_utils import BaseConfig

        cfg = BaseConfig(llm_name=llm_name, llm_base_url=llm_base_url, save_dir=str(save_dir), use_propositions=True)
        oie = EnhancedOpenIE(llm_model=CacheOpenAI.from_experiment_config(cfg))
        chunks = {k: {"content": v} for k, v in passages.items()}
        ner, _, props = oie.batch_openie(chunks)
    finally:
        os.chdir(cwd)
    return [{"idx": k, "passage": v,
             "extracted_entities": ner[k].unique_entities if k in ner else [],
             "propositions": props[k].propositions if k in props else []} for k, v in passages.items()]
