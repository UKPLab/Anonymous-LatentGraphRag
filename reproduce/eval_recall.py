#!/usr/bin/env python3
"""Recompute the BrowseComp+ retrieval numbers from the released rankings.

No GPU, no model, no index: the rankings in reproduce/rankings/ are the actual
retrieval outputs in TREC format, and the gold labels ship with the trace payload,
so Recall@k can be verified directly.

    python reproduce/eval_recall.py
"""
import collections
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
GOLD = HERE.parent / "website" / "public" / "data" / "gold" / "browsecomp.json"

# ranking file -> the paper row it corresponds to, with the reported R@5 / R@10
# on evidence documents (Table 1 / tab:browsecomp-plus-retrieval)
RUNS = {
    "qwen.txt": ("Qwen3-Embedding-8B", 14.60, 20.30),
    "bc_doc_only.txt": ("Document-only, full tree", 21.18, 28.87),
    "bc_memory_only.txt": ("Memory-only, full expansion", 9.28, 13.19),
    "bc_dual_z.txt": ("MMR-Tree + Z-Agreement", 18.62, 25.94),
    "bc_reasonmcb.txt": ("Reason-ModernColBERT", None, None),
    "latentgraph.txt": ("LatentGraphRAG (document tree)", None, None),
}


def read_run(path):
    """TREC run: qid Q0 docid rank score tag."""
    ranked = collections.defaultdict(list)
    for line in open(path):
        p = line.split()
        if len(p) >= 4:
            ranked[p[0]].append((int(p[3]), p[2]))
    return {q: [d for _, d in sorted(v)] for q, v in ranked.items()}


def recall(ranked, labels, key, k):
    """Mean over queries of |retrieved@k ∩ relevant| / |relevant|."""
    vals = []
    for qid, docs in ranked.items():
        rel = set(labels.get(qid, {}).get(key, []))
        if not rel:
            continue
        vals.append(len(rel & set(docs[:k])) / len(rel))
    return 100 * sum(vals) / len(vals) if vals else float("nan")


def main():
    if not GOLD.exists():
        print(f"gold labels not found at {GOLD}")
        return 1
    labels = json.loads(GOLD.read_text())
    print(f"{'run':34s} {'R@5 ev':>7s} {'R@10 ev':>8s} "
          f"{'R@5 gold':>9s} {'R@10 gold':>10s}   paper R@5/R@10 (ev)")
    print("-" * 104)
    for fn, (name, p5, p10) in RUNS.items():
        path = HERE / "rankings" / fn
        if not path.exists():
            print(f"{name:34s} (missing {fn})")
            continue
        ranked = read_run(path)
        e5, e10 = recall(ranked, labels, "e", 5), recall(ranked, labels, "e", 10)
        g5, g10 = recall(ranked, labels, "g", 5), recall(ranked, labels, "g", 10)
        exp = f"{p5} / {p10}" if p5 is not None else "not in the paper"
        flag = ""
        if p5 is not None and abs(e5 - p5) > 0.5:
            flag = "  <-- differs from the paper"
        print(f"{name:34s} {e5:7.2f} {e10:8.2f} {g5:9.2f} {g10:10.2f}   {exp}{flag}")
    print("\nev = evidence documents, gold = gold documents (official qrels).")
    print("Rankings are truncated to the top 20, which is all Recall@5/@10 needs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
