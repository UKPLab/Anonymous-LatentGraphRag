# LatentGraphRAG

> **Anonymous ACL ARR submission — under review.**
> Author names, affiliations, logos and personal links have been removed from this
> repository and from the project site for anonymous review.

**LatentGraphRAG: Composing Constructed Knowledge at Test Time with Recursive Dense Retrieval**

Project page: https://anonymous.4open.science/w/Anonymous-LatenGraphRag-57C9/

Retrieval backbone, Recursive Dense Retrieval (RDR, anonymous submission): https://anonymous.4open.science/w/Recursive-Dense-Retrieval/

LatentGraphRAG reuses knowledge constructed for graph-based retrieval — triples and propositions — without
traversing a fixed graph. Two recursive searches run side by side: a **document tree** over the source
passages and a **memory tree** over the constructed units. Each unit keeps a link to the passage it was
extracted from, so the memory readout is projected back onto documents and fused with the document readout
into one source-document ranking. The ranking can be read directly or used as the initial evidence of a
ReAct agent.

## What comes from RDR, and what this package adds

Recursive Dense Retrieval (RDR) supplies the encoder, the recursive update (each query state encodes the
question together with the units observed so far) and the global readout over all search states.
LatentGraphRAG uses them unchanged and adds:

| Component | Module |
|---|---|
| Knowledge construction: triples rendered literally as `"head relation tail."`, propositions, inventories with provenance | `latentgraphrag.construction`, `latentgraphrag.inventory` |
| The memory tree's search: RDR's tree with maximal-marginal-relevance selection | `latentgraphrag.retrieval.MMRTreeSearch` |
| Projection of memory scores to their source documents, and view fusion | `latentgraphrag.retrieval.project`, `fuse` |
| The retriever over documents, memories and a joint index | `latentgraphrag.LatentGraphRAG` |
| Retrieval-first seeding of a ReAct agent, search tools | `latentgraphrag.agent` |
| Retrieve-then-read reader, BrowseComp grader, list recall, recall@k | `latentgraphrag.evaluation` |

## Installation

LatentGraphRAG depends on RDR. Download RDR from its anonymous repository,
https://anonymous.4open.science/r/Recursive-Dense-Retrieval, and install both:

```bash
pip install -e ./Recursive-Dense-Retrieval        # RDR
pip install -e ".[agent]"                          # LatentGraphRAG, with the ReAct agent's dependencies
pip install -e ".[construction]"                   # optional: HippoRAG's OpenIE for extracting triples
```

## Quick start

```python
from latentgraphrag import LatentGraphRAG, MemoryInventory, PAPER, triples, propositions

# 1. Constructed knowledge with provenance: triples from a HippoRAG-format OpenIE cache, propositions from
#    PropRAG's output, one inventory over both. Sources are document ids of the corpus below.
tri = triples.from_openie(triples.load_openie("openie.jsonl.gz"), source_of=chunk_to_doc)
pro = propositions.from_records(propositions.load_records("proprag_openie.json"), source_of=chunk_to_doc)
inventory = MemoryInventory.union(tri, pro)

# 2. Two recursive trees on an RDR checkpoint, fused at the source (the paper's configuration).
lgr = LatentGraphRAG("path/to/rdr-checkpoint", config=PAPER)
index = lgr.build(documents, inventory)            # documents: {doc id: text}
index.save("lgr_index")                            # encoded once; later: index = lgr.load_index("lgr_index")
result = lgr.search([question], index, k=10)[0]
result.ranking                                     # [(doc id, score), ...], best first

# 3. The ranking as initial evidence of a ReAct agent, graded as in the paper.
from latentgraphrag import ReActAgent, Seed, OpenAIChatModel, BrowseCompGrader, DenseSearchTool
llm = OpenAIChatModel(model="Qwen/Qwen3.5-122B-A10B", base_url="http://localhost:8000/v1")
search_tool = DenseSearchTool(embeddings, texts, ids)   # the agent's own search index
agent = ReActAgent(llm, search_tool)
trajectory = agent.run(question, Seed.from_ranking(result.ids, documents))
verdict = BrowseCompGrader(llm).grade(question, trajectory.output, gold_answer)   # reads the final answer line
```

## The paper's configuration

`latentgraphrag.PAPER` holds every setting behind the paper's LatentGraphRAG rows:
- **Trees:** two trees of depth 4 with three children per state. The memory tree selects children by maximal marginal relevance (λ = 0.5).
- **Readout:** RDR's global readout over each tree with K = 200 and τ = 0.02 (RDR's default τ is 0.05).
- **Projection:** memory scores go to documents by the maximum over the memories a document supplied.
- **Fusion:** CombMNZ, with weight 1 for the document view and 0.5 for the memory view.

`LatentGraphRAG.search(..., view=...)` selects the views of the paper's ablations:
- `"D+M"` — the paper's configuration.
- `"D"` — documents only.
- `"M"` — the memory tree alone.
- `"J"` — documents and memories in one index.
- `"D+J"` — documents fused with the joint index.

The view fusion is `PAPER.with_(fusion=...)`, one of `combmnz`, `combsum`, `z`, `rrf` or `max`. The projection is `PAPER.with_(projection=...)`, one of `max`, `sum`, `mean`, `pmax2`, `pmax4` or `noisy_or`.

## Reproduction

The paper's retrieval numbers were produced by a research evaluator that re-implements RDR.
`tests/parity` runs that evaluator and this package side by side on a synthetic corpus with a deterministic
fake encoder, and requires identical rankings for every view, fusion operator and projection, on flat and
chunked corpora. Only the encoder's weights are not exercised by that test. See [reproduce/](reproduce/)
for the trace export behind the project page's trajectory viewer.

```bash
pytest tests                                          # unit tests, agent and evaluation tests
LGR_EVALUATOR=/path/to/evaluator.py pytest tests/parity
```

## Third-party code

Triples are extracted with HippoRAG's OpenIE (MIT license) when `[construction]` is installed. Propositions
are extracted by calling PropRAG from a local checkout (`propositions.extract_with_proprag`); PropRAG is
not bundled, since its repository ships without a license file.

## Citation

```bibtex
@misc{anonymous2026latentgraphrag,
  title  = {LatentGraphRAG: Composing Constructed Knowledge at Test Time with Recursive Dense Retrieval},
  author = {Anonymous},
  note   = {Under review},
}
```

## License

Apache 2.0
