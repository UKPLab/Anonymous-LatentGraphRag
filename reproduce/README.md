# Reproduction

## Retrieval

`latentgraphrag.PAPER` is the frozen configuration of every LatentGraphRAG row in the paper; the views and
operators of the ablation tables are selected with `LatentGraphRAG.search(..., view=...)` and
`PAPER.with_(fusion=..., projection=...)` (see the top-level README).

The knowledge inventories reuse the graph baselines' constructed units:

| Benchmark | Triples | Propositions |
|---|---|---|
| MuSiQue | HippoRAG 2 release OpenIE | PropRAG release |
| FanOutQA, BrowseComp+ | OpenIE in HippoRAG's format (`construction.triples.extract_with_hipporag`) | PropRAG's extraction (`construction.propositions.extract_with_proprag`) |

Triples are rendered literally as `"head relation tail."`; triples and propositions form one memory index
(`MemoryInventory.union`), each memory linked to the documents it was extracted from.

The paper's numbers were computed with a research evaluator that re-implements RDR. `tests/parity` checks
this package against it: with a deterministic fake encoder on synthetic flat and chunked corpora, both
produce identical rankings for the document view, the memory view, the joint index and every fusion of
them under every operator and projection. Set `LGR_EVALUATOR` to the evaluator file to run it.

## Agents and grading

`latentgraphrag.agent.ReActAgent` reproduces the paper's ReAct runner: the prompt, at most ten searches
returning five texts of at most 2,000 characters, one follow-up request when a turn ends without an action,
and context fitting. Seeds hold the top ten documents of a ranking, each truncated to 2,200 characters.
`latentgraphrag.evaluation.BrowseCompGrader` grades the final answer line with the official BrowseComp
template; FanOutQA answers are scored with `loose_final`.

## Trajectories

`export_traces.py` converts run files into the payload of the project page's trajectory viewer (MuSiQue and
FanOutQA; BrowseComp+ trajectories are not published, since BrowseComp asks that its questions and answers
not appear online in plain text). Paths are passed through environment variables:

```bash
LGR_TRACES_ROOT=/path/to/runs LGR_MUSIQUE_QA=/path/to/musique.json LGR_FANOUTQA_GOLD=/path/to/qrels \
LGR_EXPORT_OUT=website/public/data python reproduce/export_traces.py
```
