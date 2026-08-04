# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
