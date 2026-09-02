# LatentGraphRAG

> **Anonymous ACL ARR submission — under review.**
> Author names, affiliations, logos and personal links have been removed from this
> repository and from the project site for anonymous review.

> Rethinking graph-based multi-hop retrieval through recursive dense retrieval over documents and verbalized relational memories.

LatentGraphRAG is a decomposition-free retrieval framework that treats graph-derived information not as fixed traversal edges but as retrievable textual *relational memories*. It applies recursive dense retrieval to **documents**, **memories**, or **both**, and unifies them through a small set of orthogonal axes.

## The three orthogonal axes

Every retrieval decision factors into three independent choices:

| Axis           | Values                                                           |
|----------------|------------------------------------------------------------------|
| **corpus**     | `document_only` \| `memory_only` \| `joint_index` \| `dual_tree` |
| **search**     | `full_expansion` \| `beamdr` \| `cross_view_beam` \| `mmr` \| `single_hop` |
| **fusion**     | `rrf` \| `agreement` (only valid for `dual_tree`)                |

## Quick start

```bash
pip install latentgraphrag[faiss-cpu,gritlm,openai]
```

```python
import latentgraphrag as lgr

rag = lgr.LatentGraphRAG(
    encoder="GritHopper-7B",
    openie_llm="gpt-4o-mini",
)

rag.build_graph(
    documents=["doc 1 text...", "doc 2 text..."],
    save_dir="./my_corpus",
)

# Paper's "MMR-Tree + Z-Agreement" (best mean R@5 and R@10 across all datasets):
results = rag.retrieve(
    queries=["Where does X live?"],
    corpus="dual_tree",
    search="full_expansion",   # document tree: full expansion
    search_memory="mmr",       # memory tree: MMR-decoded expansion
    fusion="agreement",        # Z-Agreement fusion (z_normalize=True by default)
    branching_doc=3,
    branching_memory=5,
    max_hops=4,
    k=10,
)
```

## Results

All numbers are Recall@5 / Recall@10, over the same HippoRAG-style extracted triplets so
that only the access interface varies (paper Table 1):

| Method | MuSiQue | BrowseComp+ | FanOutQA | Mean |
|---|---|---|---|---|
| Qwen3-Embedding-8B (single-hop) | 62.10 / 69.92 | 14.60 / 20.30 | 20.76 / 28.55 | 32.49 / 39.59 |
| HippoRAG 2 (graph traversal) | 74.47 / 81.94 | 8.12 / 12.83 | 26.07 / 36.86 | 36.22 / 43.88 |
| Document-only, full tree | 79.73 / 87.73 | **21.18** / **28.87** | 22.40 / 29.24 | 41.10 / 48.61 |
| Memory-only, full expansion | 76.15 / 84.40 | 9.28 / 13.19 | 31.45 / 44.14 | 38.96 / 47.24 |
| Joint index, full tree | 76.14 / 84.05 | 16.62 / 27.61 | 30.52 / 40.66 | 41.09 / 50.77 |
| Dual-tree + RRF | 79.64 / 89.49 | 16.31 / 25.65 | 27.85 / 38.82 | 41.27 / 51.32 |
| **MMR-Tree + Z-Agreement** | **82.12** / **90.02** | 18.62 / 25.94 | **33.22** / **46.83** | **44.65** / **54.26** |

Retrieving verbalized triplets beats traversing the same graph on all three benchmarks.
The two views are complementary rather than redundant: documents are strongest on noisy
web-scale retrieval, memories on breadth-oriented collection, and per-query calibrated
fusion attains the best mean Recall.

### It also makes agents cheaper

Injected as a one-shot seed into a fixed ReAct loop (reader Qwen3.5-122B), a
LatentGraphRAG ranking raises mean answer accuracy from 42.9 to 49.2 while cutting the
searches the agent issues itself from 2.30 to 0.86 per question — a **2.7x reduction**.
Every avoided tool call is one fewer LLM invocation over an ever-growing cached context.
The effect holds across readers from 9B to 122B and also when the agent's own live
retriever is already a strong late-interaction model.

## Trajectories and reproduction

Every downstream number is released in full, not sampled:

* **[`reproduce/`](reproduce)** — the released trajectories, the retrieval seeds, the
  evaluation harness as it was run, and a README explaining how to re-run any cell.
* **[`website/`](website)** — the project site, including a trajectory viewer that shows,
  for all 74,678 released trajectories: the injected seed with its ranked documents and
  their gold labels, every reasoning step and search the agent issued with what that
  search returned, the final answer, and the judge's verdict.

```bash
cd website && npm install && npm run dev     # then open /traces
```

The site is also published for review at
[anonymous.4open.science/w/Anonymous-LatenGraphRag-57C9](https://anonymous.4open.science/w/Anonymous-LatenGraphRag-57C9/)
— the trajectory viewer is under
[`/traces`](https://anonymous.4open.science/w/Anonymous-LatenGraphRag-57C9/traces/).

## Citation

```bibtex
@inproceedings{anonymous2026latentgraphrag,
  title     = {LatentGraphRAG: Overcoming the Missing-Edge Problem in Knowledge Graphs with Recursive Dense Retrieval},
  author    = {Anonymous ACL Submission},
  booktitle = {Under review},
  year      = {2026},
}
```

## License

Apache 2.0

## Using a local LLM (vLLM / Qwen3) for graph construction

Graph construction (OpenIE triple extraction and verbalization) can be done with any
OpenAI-compatible endpoint, including a local vLLM server. This avoids cloud API costs
and works fully offline.

**Start a vLLM server:**

```bash
pip install latentgraphrag[faiss-cpu,gritlm,vllm]
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen3-8B \
    --served-model-name qwen3
```

**Point LatentGraphRAG at it:**

```python
import latentgraphrag as lgr

rag = lgr.LatentGraphRAG(
    encoder="GritHopper-7B",
    openie_llm="qwen3",                      # model name served by vLLM
    config=lgr.LatentGraphRAGConfig(
        openai_base_url="http://localhost:8000/v1",
        openai_api_key="EMPTY",              # vLLM does not require a real key
    ),
)
```

Qwen3's native thinking mode is disabled automatically when used as an OpenIE extractor
(extraction is a structured task, not a reasoning task). Swap `Qwen/Qwen3-8B` for any
other vLLM-served model to taste.

## Batched / parallel retrieval

For large evaluation runs (hundreds of queries), use `batched=True` to pool all query
frontiers into a single encoder call per hop instead of one call per query:

```python
results = rag.retrieve(
    queries=["Q1", "Q2", ..., "Q300"],
    corpus="dual_tree",
    search="full_expansion",
    fusion="agreement",
    batched=True,           # hop-synchronous batching — same results, faster
    encode_chunk_size=64,   # optional: cap the batch size per encoder call
    k=10,
)
```

`batched=True` is mathematically equivalent to the default sequential mode — same
context construction, same branch selection, same deduplication — but reduces
encoder calls from `N_queries × N_hops` down to `N_hops` mega-batched calls.
