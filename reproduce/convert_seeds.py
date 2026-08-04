#!/usr/bin/env python3
"""Turn the released seeds back into the bundle format the harness reads.

The released seeds reference documents by corpus id (so a document is stored
once); the harness wants the document text inline. This script rehydrates them:

    seeds/<ds>/<method>.json  +  corpus/<ds>/b*.json
        ->  $LGR_ROOT/bundles/<ds>/seed_<method>.jsonl

Usage:
    export LGR_ROOT=/path/to/workspace
    python reproduce/convert_seeds.py                  # all datasets, all methods
    python reproduce/convert_seeds.py browsecomp       # one dataset
"""
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "website" / "public" / "data"
DATASETS = ["musique", "browsecomp", "fanoutqa"]


def bucket_of(docid: str) -> str:
    """Must match bucket_of() in the exporter and bucketOf() in the website."""
    m = re.search(r"(\d+)\s*$", docid)
    if m:
        return f"{int(m.group(1)) % 256:03d}"
    acc = 2166136261
    for ch in docid:
        acc = ((acc ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return f"{acc % 256:03d}"


class Corpus:
    """Lazily loads corpus buckets, so we never hold a whole corpus in memory."""

    def __init__(self, dataset: str):
        self.dir = DATA / "corpus" / dataset
        self._buckets: dict[str, dict] = {}

    def text(self, docid: str) -> str | None:
        b = bucket_of(docid)
        if b not in self._buckets:
            p = self.dir / f"b{b}.json"
            self._buckets[b] = json.loads(p.read_text()) if p.exists() else {}
        doc = self._buckets[b].get(docid)
        return doc["x"] if doc else None


def convert(dataset: str, out_root: Path) -> None:
    seed_dir = DATA / "seeds" / dataset
    if not seed_dir.is_dir():
        print(f"  no seeds for {dataset}, skipping")
        return
    corpus = Corpus(dataset)
    out_dir = out_root / "bundles" / dataset
    out_dir.mkdir(parents=True, exist_ok=True)

    for src in sorted(seed_dir.glob("*.json")):
        method = src.stem
        records = json.loads(src.read_text())
        written = missing = 0
        dst = out_dir / f"seed_{method}.jsonl"
        with dst.open("w") as f:
            for r in records:
                seed = []
                for did in r["seed"]:
                    if did is None:
                        missing += 1
                        continue
                    t = corpus.text(did)
                    if t is None:
                        missing += 1
                        continue
                    seed.append({"docid": did, "text": t})
                f.write(
                    json.dumps(
                        {
                            "query_id": r["qid"],
                            "question": r["q"],
                            "answer": r["gold_answer"],
                            "method": method,
                            "seed": seed,
                        }
                    )
                    + "\n"
                )
                written += 1
        note = f", {missing} document refs unavailable" if missing else ""
        print(f"  {dataset}/{method:22s} {written:5d} records -> {dst.name}{note}")


def main() -> int:
    root = os.environ.get("LGR_ROOT")
    if not root:
        print("LGR_ROOT is not set. Point it at the workspace the harness should use.")
        return 1
    if not DATA.is_dir():
        print(f"Released data not found at {DATA}")
        return 1
    targets = sys.argv[1:] or DATASETS
    out_root = Path(root)
    print(f"writing bundles under {out_root}")
    for ds in targets:
        convert(ds, out_root)
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
