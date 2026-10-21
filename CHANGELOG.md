# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-15

### Changed
- Rebuilt on Recursive Dense Retrieval (RDR): the encoder, recursive search and global readout come from
  RDR; LatentGraphRAG runs a document tree and a memory tree on it and fuses them at the source documents.
- Memories are triples rendered literally as "head relation tail." and propositions, each linked to the
  documents it was extracted from (`MemoryInventory`).
- Retrieval views `D+M` (paper), `D`, `M`, `J` (joint index) and `D+J`; fusion operators CombMNZ, CombSUM,
  z-agreement, RRF and max; projections max, sum, mean, soft maximum and noisy-OR.

### Added
- `latentgraphrag.agent`: the retrieval-first ReAct agent (seeds, search tools, policies, seed placement).
- `latentgraphrag.evaluation`: retrieve-then-read reader, BrowseComp grader, list recall, recall@k.
- `tests/parity`: identical rankings to the paper's research evaluator for every view and operator.
- `LGRIndex.save` / `LGRIndex.load` and `LatentGraphRAG.load_index`: an encoded index (documents, memories,
  inventory) is written to one directory and reused without encoding again.

### Removed
- The previous package: its own encoders and search strategies, the LLM verbalizer, the agreement and RRF
  fusion modules, the old pipeline and the old reproduction harness and rankings.


### Added (v0.1.0-alpha)
- **Three-axis API**: `corpus` × `search` × `fusion` — every paper-canonical combination
  expressible as a single `retrieve()` call.
- `LatentGraphRAG` main class with `build_graph()`, `from_documents()`, `retrieve()`,
  `save()`, `load()`.
- **Graph construction**: token-based chunker, OpenIE extractor (NER + triple extraction,
  with disk cache), triplet verbalizer (LM-based with template fallback), typed igraph
  builder (chunk/entity/memory nodes; chunk-entity, chunk-memory, entity-relation edges).
- **MemoryIndex**: parquet-canonical storage with optional FAISS-accelerated ANN search.
  Auto-dispatches `faiss-cpu` / `faiss-gpu` / numpy brute-force. Auto-picks FlatIP vs HNSW
  by corpus size.
- **Search strategies**: `single_hop`, `full_expansion` (with `branching="adaptive"`),
  `beamdr`, `cross_view_beam`, `mmr` (with `lambda_mmr` diversity weight).
- **Fusion methods**: `rrf` (reciprocal rank, default k=60), `agreement` (gamma-weighted
  document-memory score agreement).
- **Encoders**: `GritHopperEncoder` (paper-canonical, uses gritlm + paper instructions),
  `SentenceTransformerEncoder`, `OpenAIEncoder`, `NVEmbedV2Encoder`, `HashEncoder` (test).
  Factory dispatch via `load_encoder("GritHopper-7B")`.
- **Evaluation**: `recall_at_k`, `qa_exact_match`, `qa_f1`.
- **Validation rules** (§A.5 of plan): fusion requires dual_tree; cross_view_beam requires
  dual_tree; memory modes require a built memory index; invalid axis values rejected.
- **Tests**: 53 tests passing — unit tests for chunker, encoder factory, memory index,
  validation rules, every search strategy, both fusion methods; integration tests for the
  full end-to-end pipeline and every (corpus × search × fusion) combination from the paper.
- **Packaging**: `pyproject.toml` with extras for `faiss-cpu`, `faiss-gpu`, `gritlm`,
  `sentence-transformers`, `openai`, `vllm`, `nvembed`, `all`, `dev`.
