/**
 * Single source of truth for every number shown on this site.
 *
 * All values are transcribed verbatim from LatentGraphPaper.tex (ARR/ACL
 * submission). Each block names the LaTeX table it comes from so a value can be
 * traced back and re-checked. Do not compute results here and do not copy
 * numbers from the trace payload in public/data: the payload's per-sample
 * verdicts come from a single judge pass, whereas the paper reports means over
 * three passes for the LLM-judged BrowseComp+/MuSiQue cells. Small differences
 * between the two are expected and documented (judge spread up to 1.33 points).
 */

export type Category = "non-structure" | "graph-enhanced" | "ours";

export interface BarDatum {
  name: string;
  value: number;
  category: Category;
  highlight?: boolean;
}

/* ------------------------------------------------------------------ Table 1
 * tab:full-ablation - the controlled access-mechanism comparison. Every row
 * uses the same HippoRAG-style extracted triplets, so only the access
 * interface varies.
 */
export interface AblationRow {
  method: string;
  short: string;
  substrate: "documents" | "memories" | "joint" | "dual-tree";
  musiqueR5: number;
  musiqueR10: number;
  browseCompR5: number;
  browseCompR10: number;
  fanoutqaR5: number;
  fanoutqaR10: number;
  meanR5: number;
  meanR10: number;
  isBest?: boolean;
}

export const HEADLINE_CONFIG = "MMR-Tree + Z-Agreement";

export const fullAblation: AblationRow[] = [
  {
    method: "Document-Only, Full Tree Expansion (b=3, H=4)",
    short: "Document-only",
    substrate: "documents",
    musiqueR5: 79.73, musiqueR10: 87.73,
    browseCompR5: 21.18, browseCompR10: 28.87,
    fanoutqaR5: 22.40, fanoutqaR10: 29.24,
    meanR5: 41.10, meanR10: 48.61,
  },
  {
    method: "Memory-Only, Full Expansion (b=3, H=4)",
    short: "Memory-only",
    substrate: "memories",
    musiqueR5: 76.15, musiqueR10: 84.40,
    browseCompR5: 9.28, browseCompR10: 13.19,
    fanoutqaR5: 31.45, fanoutqaR10: 44.14,
    meanR5: 38.96, meanR10: 47.24,
  },
  {
    method: "Joint-Index, Full Tree Expansion (b=5)",
    short: "Joint index",
    substrate: "joint",
    musiqueR5: 76.14, musiqueR10: 84.05,
    browseCompR5: 16.62, browseCompR10: 27.61,
    fanoutqaR5: 30.52, fanoutqaR10: 40.66,
    meanR5: 41.09, meanR10: 50.77,
  },
  {
    method: "Dual-Tree RRF, Full Expansion (b_d=3, b_t=5)",
    short: "Dual-tree + RRF",
    substrate: "dual-tree",
    musiqueR5: 79.64, musiqueR10: 89.49,
    browseCompR5: 16.31, browseCompR10: 25.65,
    fanoutqaR5: 27.85, fanoutqaR10: 38.82,
    meanR5: 41.27, meanR10: 51.32,
  },
  {
    method: "MMR-Tree + Z-Agreement (b_d=3, b_t=5)",
    short: HEADLINE_CONFIG,
    substrate: "dual-tree",
    musiqueR5: 82.12, musiqueR10: 90.02,
    browseCompR5: 18.62, browseCompR10: 25.94,
    fanoutqaR5: 33.22, fanoutqaR10: 46.83,
    meanR5: 44.65, meanR10: 54.26,
    isBest: true,
  },
];

/** HippoRAG 2 reproduced under our own pipeline (Table 1, traversal row). */
export const hippoRagTraversal = {
  method: "HippoRAG 2 (explicit graph traversal)",
  musiqueR5: 74.47, musiqueR10: 81.94,
  browseCompR5: 8.12, browseCompR10: 12.83,
  fanoutqaR5: 26.07, fanoutqaR10: 36.86,
  meanR5: 36.22, meanR10: 43.88,
};

/** Single-hop embedding baseline (Table 1). */
export const singleHopBaseline = {
  method: "Qwen3-Embedding-8B (single-hop)",
  musiqueR5: 62.10, musiqueR10: 69.92,
  browseCompR5: 14.60, browseCompR10: 20.30,
  fanoutqaR5: 20.76, fanoutqaR10: 28.55,
  meanR5: 32.49, meanR10: 39.59,
};

/* --------------------------------------------- tab:musique-retrieval (R@5)
 * Published baselines. The LatentGraphRAG entry is the best MuSiQue R@5 in the
 * family (Full Dual-Tree + Agreement, 82.32); the headline configuration in
 * Table 1 is MMR-Tree + Z-Agreement at 82.12.
 */
export const musiqueR5Data: BarDatum[] = [
  { name: "LightRAG", value: 34.7, category: "graph-enhanced" },
  { name: "BM25", value: 41.2, category: "non-structure" },
  { name: "G-retriever", value: 43.5, category: "graph-enhanced" },
  { name: "RAPTOR", value: 45.3, category: "graph-enhanced" },
  { name: "SubgraphRAG", value: 48.1, category: "graph-enhanced" },
  { name: "ColBERTv2", value: 49.2, category: "non-structure" },
  { name: "GraphRAG (MS)", value: 49.3, category: "graph-enhanced" },
  { name: "HippoRAG", value: 53.2, category: "graph-enhanced" },
  { name: "GFM-RAG", value: 57.6, category: "graph-enhanced" },
  { name: "Qwen3-Emb (8B)", value: 62.1, category: "non-structure" },
  { name: "KAG", value: 62.4, category: "graph-enhanced" },
  { name: "HippoRAG 2", value: 74.2, category: "graph-enhanced" },
  { name: "G-Reasoner", value: 74.9, category: "graph-enhanced" },
  { name: "LatentGraphRAG (docs only)", value: 79.73, category: "ours" },
  { name: "LatentGraphRAG", value: 82.32, category: "ours", highlight: true },
];

/* ------------------------------------ tab:browsecomp-plus-retrieval (R@5) */
export const browseCompEvidenceR5: BarDatum[] = [
  { name: "BM25", value: 1.2, category: "non-structure" },
  { name: "Qwen3-Embed-0.6B", value: 6.2, category: "non-structure" },
  { name: "Qwen3-Embed-4B", value: 9.8, category: "non-structure" },
  { name: "ReasonIR-8B", value: 12.2, category: "non-structure" },
  { name: "Qwen3-Embed-8B", value: 14.5, category: "non-structure" },
  { name: "HippoRAG 2", value: 8.12, category: "graph-enhanced" },
  { name: "LatentGraphRAG on docs", value: 21.18, category: "ours", highlight: true },
];

export const browseCompGoldR5: BarDatum[] = [
  { name: "BM25", value: 1.4, category: "non-structure" },
  { name: "Qwen3-Embed-0.6B", value: 8.5, category: "non-structure" },
  { name: "Qwen3-Embed-4B", value: 13.0, category: "non-structure" },
  { name: "ReasonIR-8B", value: 15.3, category: "non-structure" },
  { name: "Qwen3-Embed-8B", value: 18.5, category: "non-structure" },
  { name: "LatentGraphRAG on docs", value: 27.28, category: "ours", highlight: true },
];

/* ----------------------------------------------- FanOutQA R@5 (Table 1) */
export const fanoutqaR5Data: BarDatum[] = [
  { name: "Qwen3-Embed-8B", value: 20.76, category: "non-structure" },
  { name: "Doc-only full tree", value: 22.40, category: "ours" },
  { name: "HippoRAG 2", value: 26.07, category: "graph-enhanced" },
  { name: "Dual-tree + RRF", value: 27.85, category: "ours" },
  { name: "Joint-index tree", value: 30.52, category: "ours" },
  { name: "Memory-only full expansion", value: 31.45, category: "ours" },
  { name: HEADLINE_CONFIG, value: 33.22, category: "ours", highlight: true },
];

/* ------------------------------------------------------------------ Table 2
 * tab:e2e-read - retrieve-then-read, reader Qwen3.5-122B, top-10 documents.
 * LLM-judged correctness for MuSiQue/BrowseComp+, loose list-recall for
 * FanOutQA. On BrowseComp+ the dense rows use the full official
 * 100,195-document corpus at a uniform top-10.
 */
export interface ReadRow {
  seed: string;
  /** matches the method name of the released seed set in public/data/seeds */
  seedMethod?: string;
  musique: number;
  browseComp: number;
  fanoutqa: number;
  isBest?: boolean;
  isSecond?: boolean;
}

export const retrieveThenRead: ReadRow[] = [
  { seed: "Closed-book (no evidence)", seedMethod: "closed_book", musique: 19.5, browseComp: 0.5, fanoutqa: 42.5 },
  { seed: "Qwen3-Embedding-8B", seedMethod: "qwen_read", musique: 43.6, browseComp: 24.5, fanoutqa: 33.0 },
  { seed: "HippoRAG 2", seedMethod: "hipporag_read", musique: 52.2, browseComp: 26.5, fanoutqa: 33.2 },
  { seed: "Document-only", seedMethod: "doc_only_read", musique: 57.5, browseComp: 30.4, fanoutqa: 30.0, isSecond: true },
  { seed: "Memory-only", seedMethod: "memory_only_read", musique: 54.4, browseComp: 16.3, fanoutqa: 37.9 },
  { seed: HEADLINE_CONFIG, seedMethod: "dual_z_read", musique: 61.6, browseComp: 31.5, fanoutqa: 37.9, isBest: true },
];

/* ------------------------------------------------------------------ Table 3
 * tab:e2e-react - ReAct loop, reader Qwen3.5-122B. The injected seed is
 * excluded from the tool count.
 */
export interface ReactRow {
  config: string;
  /** run_id in public/data/runs.json, when traces exist for this row */
  runId?: string;
  block: "ours" | "benchmark";
  musiqueAcc: number; musiqueTools: number;
  browseCompAcc: number; browseCompTools: number;
  fanoutqaAcc: number; fanoutqaTools: number;
  isBest?: boolean;
  note?: string;
}

export const reactLoop: ReactRow[] = [
  {
    config: "No seed", runId: "qwen3_5_122b__no_seed", block: "ours",
    musiqueAcc: 47.4, musiqueTools: 4.04,
    browseCompAcc: 23.9, browseCompTools: 7.57,
    fanoutqaAcc: 45.1, fanoutqaTools: 5.31,
  },
  {
    config: "+ Qwen3-Emb seed", runId: "qwen3_5_122b__qwen_seed", block: "ours",
    musiqueAcc: 55.6, musiqueTools: 3.94,
    browseCompAcc: 33.3, browseCompTools: 6.97,
    fanoutqaAcc: 39.9, fanoutqaTools: 3.52,
  },
  {
    config: "+ HippoRAG 2 seed", runId: "qwen3_5_122b__hipporag_seed", block: "ours",
    musiqueAcc: 58.1, musiqueTools: 3.29,
    browseCompAcc: 34.7, browseCompTools: 4.82,
    fanoutqaAcc: 41.2, fanoutqaTools: 3.01,
  },
  {
    config: "+ LatentGraphRAG", runId: "qwen3_5_122b__latentgraph_dualtree_seed", block: "ours",
    musiqueAcc: 62.1, musiqueTools: 3.23,
    browseCompAcc: 38.0, browseCompTools: 5.77,
    fanoutqaAcc: 42.4, fanoutqaTools: 1.81,
    isBest: true,
  },
  {
    config: "No seed", runId: "qwen3_5_122b__benchmark_no_seed", block: "benchmark",
    musiqueAcc: 51.4, musiqueTools: 18.48,
    browseCompAcc: 33.9, browseCompTools: 20.70,
    fanoutqaAcc: 51.6, fanoutqaTools: 12.74,
  },
  {
    config: "+ Qwen3-Emb seed", runId: "qwen3_5_122b__benchmark_qwen_seed", block: "benchmark",
    musiqueAcc: 55.4, musiqueTools: 6.34,
    browseCompAcc: 40.4, browseCompTools: 15.20,
    fanoutqaAcc: 54.2, fanoutqaTools: 10.62,
  },
  {
    config: "+ HippoRAG 2 seed", runId: "qwen3_5_122b__benchmark_hipporag_seed", block: "benchmark",
    musiqueAcc: 59.4, musiqueTools: 5.27,
    browseCompAcc: 44.0, browseCompTools: 14.18,
    fanoutqaAcc: 53.7, fanoutqaTools: 10.38,
  },
  {
    config: "+ LatentGraphRAG seed", runId: "qwen3_5_122b__benchmark_latentgraph_dualtree_seed", block: "benchmark",
    musiqueAcc: 61.9, musiqueTools: 4.17,
    browseCompAcc: 44.3, browseCompTools: 13.64,
    // 53.6 as printed in the submitted paper. A later re-measurement of this cell
    // gives 51.6; the site tracks the submission, so the two can be compared.
    fanoutqaAcc: 53.6, fanoutqaTools: 9.38,
    isBest: true,
  },
];

/** Headline efficiency claim (paper, Section 'From Retrieval to Answers'). */
export const efficiency = {
  /** our own loop, mean over MuSiQue/BrowseComp+/FanOutQA */
  meanAccNoSeed: 38.8,
  meanAccSeeded: 47.5,
  meanToolsNoSeed: 5.64,
  meanToolsSeeded: 3.60,
  /** seed effect within our own conservative loop: 5.64 -> 3.60 */
  toolReductionFactor: 1.57,
  /** the released BrowseComp+ agent, unseeded, mean over the three datasets;
   * FanOutQA under the list-adapted prompt, as in the paper */
  benchmarkMeanTools: 17.31,
  /** the same agent with a LatentGraphRAG seed: 17.31 -> 9.06 */
  benchmarkSeededTools: 9.06,
  benchmarkSeededReduction: 1.91,
  /** our seeded conservative loop against the active agent unseeded: 17.31 -> 3.60 */
  benchmarkReductionFactor: 4.80,
  /** measured reader input tokens per question, thousands, mean over datasets */
  inputTokensBenchmark: 387,
  inputTokensBenchmarkSeeded: 199,
  inputTokensOursSeeded: 91,
  inputTokenReduction: 4.2,
};

/* ----------------------------------------------------------- oracle upper bound
 * app:oracle - answer-aware ("oracle") triplets, MuSiQue R@5/R@10.
 */
export const oracleUpperBound = [
  { method: "HippoRAG 2", r5: 74.47, r10: 81.94 },
  { method: "Memory-only", r5: 76.15, r10: 84.40 },
  { method: "Document-only full tree", r5: 79.73, r10: 87.73 },
  { method: "Full Dual-Tree + Agreement", r5: 82.32, r10: 90.36 },
  { method: "Memory-only (oracle triplets)", r5: 85.34, r10: 90.48, oracle: true },
  { method: "Dual-tree (oracle triplets)", r5: 86.07, r10: 93.14, oracle: true },
];

/* ------------------------------------------------------------- graph scale */
export const knowledgeGraphScale = {
  browseCompDocuments: 100195,
  uniqueTriples: 5_450_000,
  openIeTokens: "321.7M",
  gpuHours: 3252,
};

/** Measured non-determinism of the Qwen3.5-27B judge, disclosed in app:robustness.
 * The paper reports a maximum spread of 1.33 points over 29 judged conditions. */
export const judgeVariability = {
  maxSpread: 1.33,
  medianSpread: 0.50,
  passes: 3,
};

export const DATASETS = [
  { key: "musique", label: "MuSiQue", n: 1000, metric: "LLM-judged correctness" },
  { key: "browsecomp", label: "BrowseComp+", n: 830, metric: "LLM-judged correctness" },
  { key: "fanoutqa", label: "FanOutQA", n: 310, metric: "loose list-recall" },
] as const;

export type DatasetKey = (typeof DATASETS)[number]["key"];

/** Datasets whose trajectories are released. BrowseComp+ is withheld at the
 * benchmark authors' request, so it appears in every table but has no traces. */
export const TRACE_DATASETS = DATASETS.filter((d) => d.key !== "browsecomp");

