# Reproducing the LatentGraphRAG evaluation

This folder contains everything needed to inspect or re-run the downstream
experiments: the released **trajectories**, the released **retrieval seeds**, and
the **harness scripts** exactly as they were run.

Nothing here needs a GPU unless you want to re-run generation. Reading the
trajectories and recomputing the reported metrics from them needs only Python.


> **BrowseComp+ traces are withheld.** Its authors ask that the benchmark never
> appear as plain text online, so we do not publish its corpus, questions or
> trajectories. MuSiQue and FanOutQA carry no such request and are released in
> full. The harness that produced the BrowseComp+ runs is included, so they can be
> reproduced by anyone who obtains the dataset from its own distribution, and a
> gated release is in preparation.

---

## 1. Where the data is

Everything lives under [`../website/public/data/`](../website/public/data), which
is also what the [trajectory viewer](../website/src/components/Traces) serves. It
is plain static JSON, deliberately split into many small files so that a single
trajectory can be read without loading the dataset.

```
website/public/data/
  runs.json                        manifest: one entry per run, with its aggregate score
  seeds.json                       manifest: one entry per released seed set
  traces/<dataset>/<run_id>/
      index.json                   one row per sample: id, verdict, tool calls, question
      s0.json … sN.json            the full trajectories, 100 samples per shard
  seeds/<dataset>/<method>.json    the released retrieval seeds (ranked doc ids)
  corpus/<dataset>/b000.json …     documents and memory items, stored once, referenced by id
  gold/<dataset>.json              official gold / evidence labels per question
```

`<dataset>` is one of `musique` or `fanoutqa`; BrowseComp+ is withheld, see above.
`<run_id>` is `<reader>__<condition>`, e.g. `qwen3_5_122b__latentgraph_dualtree_seed`.

### Why documents are stored separately

A document that appears in a hundred trajectories is stored once. Trajectories
reference documents by their corpus id; the text lives in
`corpus/<dataset>/b<NNN>.json`. The bucket `NNN` is computed from the id with no
hashing, so any client can find a document in one lookup:

```python
import re
def bucket_of(docid: str) -> str:
    m = re.search(r'(\d+)\s*$', docid)
    if m:
        return f'{int(m.group(1)) % 256:03d}'
    acc = 2166136261                      # FNV-1a fallback, not used by our ids
    for ch in docid:
        acc = ((acc ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return f'{acc % 256:03d}'
```

The stored text is the item **as the model saw it**, truncated at 2,000
characters. It is not the full source document.

Entries carrying `"kind": "memory"` are not corpus documents but **verbalized
relational memories** — a triplet rendered as a short passage — which is what the
memory-only, HippoRAG and dual-tree seeds retrieve. Gold labels do not apply to
them.

### A trajectory record

```jsonc
{
  "qid": "793",
  "q": "…the question…",
  "gold_answer": "…",
  "answer": "…the model's final answer…",
  "correct": true,            // null when the run was never judged
  "loose": null,              // FanOutQA only: loose list-recall in [0,1]
  "tools": 4,                 // searches the agent issued itself
  "seed": ["24013", "58622"], // injected seed, ranked, by corpus id
  "traj": [
    { "i": 0, "act": "search", "txt": "…the assistant turn…",
      "q": "…the search query…", "ret": ["93648", "69495"] }
  ],
  "tok_in": 226, "tok_out": 400
}
```

Two conventions matter when you compute anything from this:

* `correct: null` means **not judged**, not wrong. Runs with no judgements are
  flagged `"unjudged": true` in `runs.json` and their `acc` is `null`.
* FanOutQA is scored by **loose list-recall** (`loose`), not by an LLM judge, so
  its runs have `correct: null` by design and `metric: "loose_list_recall"`.

### Recomputing a reported score

```python
import json, glob
run = "qwen3_5_122b__latentgraph_dualtree_seed"
rows = [r for s in sorted(glob.glob(f"../website/public/data/traces/browsecomp/{run}/s*.json"))
          for r in json.load(open(s))]
acc = 100 * sum(1 for r in rows if r["correct"]) / len(rows)
tools = sum(r["tools"] for r in rows) / len(rows)
print(len(rows), round(acc, 1), round(tools, 2))
```

This reproduces the run's entry in `runs.json`. It will **not** always reproduce
the paper cell to the decimal: the paper reports means over three judge passes
for the LLM-judged BrowseComp+ and MuSiQue cells, while the payload carries the
verdicts of a single pass. The measured spread of the Qwen3.5-122B judge at
`temperature=0` is 0.24–0.96 accuracy points, and differences below one point
should be read as judge variability rather than as a result. Where a run was
judged more than once, `runs.json` records `judge_passes` and `acc_spread`.

---

## 2. The released seeds

`seeds/<dataset>/<method>.json` is the ranked evidence each retrieve-then-read row
was given — the artifact you need to re-run those rows without rebuilding any
index or knowledge graph:

```jsonc
[{ "qid": "769", "q": "…", "gold_answer": "…", "seed": ["18639", "41759", …] }]
```

The methods correspond to the rows of Table 2:

| method | Table 2 row |
|---|---|
| `closed_book` | Closed-book (no evidence) |
| `qwen_read` | Qwen3-Embedding-8B |
| `reasonmcb_read` | Reason-ModernColBERT |
| `hipporag_read` | HippoRAG 2 |
| `doc_only_read` | Document-only |
| `memory_only_read` | Memory-only |
| `dual_z_read` | MMR-Tree + Z-Agreement |
| `hybrid_union_read`, `latentgraph_read` | further variants, appendix |

### Seed depth

Seeds are released exactly as the reader received them, so depth can be checked
per question rather than taken on trust. It is not uniform:

| dataset | our graph-based rows | HippoRAG 2 / dense baselines | hybrid union |
|---|---|---|---|
| MuSiQue | 10.00 | 10.00 | 14.97 |
| FanOutQA | 9.70 – 9.97 | 10.00 | 15.68 |
| BrowseComp+ | 7.82 – 8.32 | 10.00 | 14.22 |

On BrowseComp+ the graph-based rows received about eight documents where the
baselines received ten, because those bundles were built before the seed depth
was made uniform. The direction matters: it is *our* rows that are short, so the
BrowseComp+ column understates them relative to the baselines rather than
flattering them. The dense-retriever BrowseComp+ cells in Table 2 were
re-measured at a uniform top-10 (see the paper's caption). The hybrid-union row
is a union of two ranked lists and is expected to exceed ten by construction.

The retrieve-then-read runs are released **as seeds only**. Their result files
retained neither the trajectories (there are none — it is a single reader call)
nor, for most conditions, the generated answers, so publishing a trajectory view
of them would be misleading. The seeds are the faithful record, and they are
sufficient to reproduce the numbers with `harness/unified_runner.py`.

---

## 3. Re-running the evaluation

The scripts in [`harness/`](harness) are released as run. The only modification
is that the hard-coded cluster workspace path was replaced by `$LGR_ROOT`; each
file says so at the top.

### What you need

* An OpenAI-compatible endpoint per reader. We used vLLM 0.19:

  ```bash
  vllm serve Qwen/Qwen3.5-122B-A10B --tensor-parallel-size 8 \
      --gpu-memory-utilization 0.76 --max-model-len 32768 --port 8000
  ```

* `LGR_ROOT` pointing at a directory laid out like the cluster workspace:

  ```
  $LGR_ROOT/bundles/<dataset>/seed_<method>.jsonl     the seeds (convert from seeds/, below)
  $LGR_ROOT/search_index/<dataset>/{docs.json,emb.npy,docids.json}
  ```

* `pip install openai numpy transformers` (plus `pylate` for the
  Reason-ModernColBERT service).

### The harnesses

| script | what it produces | paper table |
|---|---|---|
| `unified_runner.py` | retrieve-then-read over a fixed top-10 | Table 2 |
| `xmodel_runner_all.py` | the seeded ReAct loop, per reader and seed | Tables 3, 15 |
| `bcfull_xloop.py` | the same loop against the official BrowseComp+ corpus | Tables 3, 15 |
| `bcfull_rmcb_run.py` | the BrowseComp+ agent with a Reason-ModernColBERT backend | Table 16 |
| `xjudge.py` | the fixed Qwen3.5-122B judge, as a separate pass | all |

Supporting services: `embed_service_bcfull.py` (dense retrieval over a prebuilt
index), `bcfull_rmcb_service.py` (late-interaction retrieval),
`encode_corpus.py` (build `emb.npy` for a corpus).

### Example: reproduce the Table 2 column

```bash
export LGR_ROOT=/path/to/workspace
python reproduce/convert_seeds.py            # seeds/*.json -> bundles/*.jsonl
DATASETS=browsecomp WORKERS=24 python reproduce/harness/unified_runner.py
```

`unified_runner.py` writes `res_<dataset>_<method>.jsonl` plus a `summary.json`
of accuracies into `$LGR_ROOT/results_unified/`.

### Example: reproduce a seeded ReAct row

```bash
export LGR_ROOT=/path/to/workspace
python reproduce/harness/embed_service_bcfull.py &      # retrieval on :8093
BC_INDEX_DIR=$LGR_ROOT/search_index/browsecomp_full \
  READERS=qwen3_5_122b CONDITIONS=latentgraph_dualtree_seed \
  python reproduce/harness/bcfull_xloop.py
python reproduce/harness/xjudge.py                       # judge as a separate pass
```

### Decoding settings used everywhere

`temperature=0`, `max_tokens` 400–500, `frequency_penalty` 0.3–0.5, thinking
disabled, documents truncated at 2,000 characters (1,800 for the benchmark
agent's `GET`), top-10 seed and top-5 per in-loop search. The verbatim prompts
for all three settings and for the judge are in the paper's appendix.

---

## 4. Rebuilding the released payload

`export_traces.py` is the script that produced `website/public/data` from the raw
result files. It resolves each stored document back to its corpus id, stores
documents once, attaches the official gold labels, and shards everything for
lazy loading.

```bash
export LGR_ROOT=/path/to/workspace          # holds results_*/, bundles/, search_index/
export LGR_QRELS=$LGR_ROOT/qrels            # topics-qrels/ and fanoutqa-topics-qrels/
export LGR_EXPORT_OUT=website/public/data
python reproduce/export_traces.py musique
python reproduce/export_traces.py fanoutqa
python reproduce/export_traces.py browsecomp
```

Two behaviours worth knowing:

* **Document ids are recovered, not read.** The raw result files store retrieved
  documents as text with no id field, in four different shapes across the
  harnesses (`[63071] …`, a bare leading number, plain corpus text, and a
  title-first rendering). The exporter resolves all four, and anything that is
  not a corpus document — the verbalized triplets that the memory-only, HippoRAG
  and dual-tree seeds retrieve — is kept as a `memory` item rather than dropped.
* **GPT-OSS-120B is excluded by default.** It does not reliably emit the
  benchmark scaffold's text markers (1.6 mean tool calls against 5–7 for the Qwen
  readers, and many empty first turns), so its accuracies do not measure
  retrieval quality. Set `EXCLUDE_READERS=` to include it anyway.

---

## 5. Retrieval side: rankings and index

The dense indices themselves are 11 GB and are not redistributable, but the
artifacts that let you *verify* the retrieval numbers are small and are included:

```
reproduce/rankings/*.txt        the actual retrieval outputs, TREC format, top-20
reproduce/index/browsecomp_docids.json   position -> official corpus docid, for all 100,195
```

`eval_recall.py` recomputes Recall@5/@10 straight from those, with no GPU, no
model and no index:

```bash
python reproduce/eval_recall.py
```

It reproduces the paper's BrowseComp+ rows exactly — document-only 21.18/28.87,
memory-only 9.28/13.19, MMR-Tree + Z-Agreement 18.62/25.94 — which is the
cheapest independent check of the retrieval claims available.

One row does **not** match and is flagged by the script: the Qwen3-Embedding-8B
baseline. The paper reports 14.60/20.30, which is the published BrowseComp+
figure; our own ranking of that retriever over the official 100,195-document
corpus gives 11.19/15.16 evidence recall. The direction matters — the published
number is the *higher* one, so the paper reports a stronger baseline than our own
run of it, which understates rather than inflates our margin.

To rebuild an index from scratch:

```bash
export LGR_ROOT=/path/to/workspace
python reproduce/harness/encode_corpus.py        # writes search_index/<ds>/emb.npy
```

---

## 6. Corpora

The document corpora are third-party and are not redistributed here:

| dataset | corpus | size |
|---|---|---|
| BrowseComp+ | [`Tevatron/browsecomp-plus-corpus`](https://huggingface.co/datasets/Tevatron/browsecomp-plus-corpus) | 100,195 documents |
| MuSiQue | MuSiQue-Ans dev paragraphs | 11,656 passages |
| FanOutQA | FanOutQA dev, chunked | 40,209 chunks |

Gold and evidence labels ship in `gold/`. BrowseComp+ and FanOutQA use the
benchmarks' official qrels, which distinguish *gold* from *evidence* documents.
MuSiQue has no qrels, so its labels are derived from the `is_supporting` flags on
each question's paragraphs, matched back to corpus positions (all 2,648
supporting paragraphs across all 1,000 questions matched exactly); MuSiQue
therefore has gold documents but no separate evidence tier.

Document ids are the official corpus ids for BrowseComp+, and positional ids
(`musique_000059`, `fanoutqa_000123`) into the index order for the other two;
the FanOutQA positional ids match those used by its qrels.
