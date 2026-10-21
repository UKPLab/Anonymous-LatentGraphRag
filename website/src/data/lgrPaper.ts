/**
 * Every number the LatentGraphRAG website shows, taken from the submitted paper:
 * "LatentGraphRAG: Composing Constructed Knowledge at Test Time with Recursive Dense
 * Retrieval" (ARR, OpenReview submission #1618; identical to LatentGraphRAGPaper (30).pdf).
 *
 * The site states what the submitted paper states. Values are kept as printed (strings),
 * so signs, trailing zeros and the paper's minus sign (U+2212) survive. Each block names its
 * table or figure; every row was checked positionally against the PDF text.
 *
 * Cell markers follow the paper: `best` = bold, `second` = underlined, `sig` = the paper's
 * significance highlighting (bold Δ / green Δ), `dagger` = †, `star` = ∗.
 */

export interface Cell {
  value: string;
  best?: boolean;
  second?: boolean;
  sig?: boolean;
  dagger?: boolean;
  star?: boolean;
}

const c = (value: string, ...marks: ("best" | "second" | "sig" | "dagger" | "star")[]): Cell => {
  const cell: Cell = { value };
  for (const m of marks) cell[m] = true;
  return cell;
};

/* --------------------------------------------------------------------- title */

export const paperMeta = {
  title: "LatentGraphRAG: Composing Constructed Knowledge at Test Time with Recursive Dense Retrieval",
  shortTitle: "LatentGraphRAG",
  venue: "Anonymous ACL submission",
  /** The paper cites its backbone anonymously. */
  backbone: "Recursive Dense Retrieval (RDR)",
  backboneCitation: "Anonymous (2026)",
  benchmarks: ["MuSiQue", "FanOutQA", "BrowseComp+ (pool)"] as const,
};

/* ------------------------------------------------- configuration labels used */

/**
 * The paper names configurations by their components. Long forms appear in Table 1,
 * short forms in Tables 3–5 and Figure 1 (LGR = LatentGraphRAG).
 */
export const configLabels = {
  docOnly: {
    long: "LatentGraphRAG (documents only), document tree D, RDR(4, 3)",
    short: "LatentGraphRAG (doc. only)",
    abbrev: "LGR (doc. only)",
  },
  triOnly: { long: "LatentGraphRAG (triples only), memory tree M", short: "LatentGraphRAG (tri. only)" },
  propOnly: { long: "LatentGraphRAG (propositions only), memory tree M", short: "LatentGraphRAG (prop. only)" },
  docTriJoint: { long: "LatentGraphRAG (documents + triples), joint index J" },
  docTriFused: { long: "LatentGraphRAG (documents + triples), fused D+M", short: "LatentGraphRAG (doc. + tri.)" },
  docPropJoint: { long: "LatentGraphRAG (documents + propositions), joint index J" },
  docPropFused: { long: "LatentGraphRAG (documents + propositions), fused D+M", short: "LatentGraphRAG (doc. + prop.)" },
  full: {
    long: "LatentGraphRAG (documents + triples + propositions), fused D+M",
    short: "LatentGraphRAG (doc. + tri. + prop.)",
    abbrev: "LGR (doc. + tri. + prop.)",
    figure: "LGR (fused)",
  },
  /** Figure 1 caption: "document-only Recursive Dense Retrieval (RDR), labeled LGR (doc. only)". */
  plainReAct: "Plain ReAct (unseeded agent)",
} as const;

/* ------------------------------------------------------- headline claims */

export interface Claim {
  id: string;
  text: string;
  where: string;
}

/** Abstract, Figure 1 and Section 5 statements, verbatim or near-verbatim, with their numbers. */
export const headlineClaims: Claim[] = [
  {
    id: "doc-only-beats-graph",
    text: "Document-only recursive retrieval with RDR outperforms all evaluated graph pipelines on the three benchmarks; adding triples and propositions further improves retrieval.",
    where: "Abstract",
  },
  {
    id: "mean-r5",
    text: "Document-only recursive retrieval reaches 48.32 mean R@5; constructed knowledge raises this to 49.35 with triples, 49.70 with propositions, and 50.09 with both in one index.",
    where: "Section 5, RQ1 (Table 1)",
  },
  {
    id: "removal-robustness",
    text: "When answer-bearing or random triples and propositions are removed, LatentGraphRAG loses less recall than the graph pipelines built on them.",
    where: "Abstract",
  },
  {
    id: "removal-props",
    text: "With propositions removed, LatentGraphRAG's document–proposition fusion loses 6.5 R@5 points, a third of PropRAG's 19.5.",
    where: "Section 5, RQ3 (Table 3)",
  },
  {
    id: "removal-triples",
    text: "With triples removed, document–triple fusion loses less than HippoRAG 2 (5.4 vs. 6.7 points) and stays above HippoRAG 2 with intact triples (75.7 vs. 71.4); adding propositions cuts the loss to 1.7.",
    where: "Section 5, RQ3 (Table 3)",
  },
  {
    id: "agent-search-reduction",
    text: "Recursive seeds improve agent accuracy on MuSiQue and the web pool, while reducing agent search calls by 46–54% compared with Plain ReAct (unseeded agent) across benchmarks.",
    where: "Abstract",
  },
  {
    id: "figure1-annotation",
    text: "LGR vs. no seed: −51% searches, −22% agent input tokens",
    where: "Figure 1",
  },
  {
    id: "agent-accuracy",
    text: "Mean accuracy is 15.1 points higher with the LatentGraphRAG seed than with Plain ReAct on MuSiQue and 19.8 points higher on BrowseComp+ (pool); against HippoRAG 2 seeds, the gains are 4.5 and 9.5 points.",
    where: "Section 5, RQ4 (Table 5)",
  },
  {
    id: "agent-tokens",
    text: "Relative to the unseeded agent, the LatentGraphRAG seed reduces mean agent input tokens by 16% on MuSiQue, 21% on FanOutQA, and 28% on BrowseComp+ (pool).",
    where: "Section 5, RQ4",
  },
  {
    id: "fanout-search",
    text: "On FanOutQA, the clearest benefit of seeds is fewer searches at similar observed answer quality.",
    where: "Abstract",
  },
  {
    id: "fused-vs-joint",
    text: "With triples, separate trees and source-level fusion exceed the joint index by 4.10 R@5 points on MuSiQue and 3.83 on FanOutQA.",
    where: "Section 5, RQ2 (Table 1)",
  },
  {
    id: "read-only-web",
    text: "In read-only use, constructed knowledge adds 3.73 answer-accuracy points over the document ranking on BrowseComp+ (pool).",
    where: "Section 5, RQ4 (Table 4)",
  },
];

/* ----------------------------------------------------------------- Figure 1 */

/**
 * Figure 1: answer quality vs. agent search calls per question, ReAct controller, tool and
 * budget shared (Table 5). Points average runs and benchmarks (final-answer accuracy on
 * MuSiQue/BC+ (pool), list recall on FanOutQA); bars are 95% bootstrap intervals; the x-axis
 * is broken before "No seed".
 *
 * The macro coordinates and intervals exist only in the figure's data file
 * (figures/performance_efficiency_data.csv), not as printed numbers — hence
 * `figureSourceOnly`. Their per-benchmark components equal Table 5 to the printed precision,
 * and the annotation (−51% searches, −22% tokens) is printed in the figure.
 */
export interface Figure1Point {
  key: string;
  label: string;
  role: "lgr" | "rdr" | "graph" | "none";
  marker: "star" | "cross" | "diamond" | "square" | "triangle-up" | "triangle-down" | "circle";
  acc: number; accLo: number; accHi: number;
  searches: number; searchesLo: number; searchesHi: number;
  relSearchesVsNoSeed: number;
  relTokensVsNoSeed: number;
  figureSourceOnly: true;
}

export const figure1 = {
  xLabel: "Agent search calls per question",
  yLabel: "Answer quality (%)",
  annotation: "LGR vs. no seed: −51% searches, −22% agent input tokens",
  points: [
    { key: "no_seed", label: "No seed", role: "none", marker: "circle", acc: 40.82, accLo: 38.87, accHi: 42.87, searches: 4.968, searchesLo: 4.838, searchesHi: 5.092, relSearchesVsNoSeed: 0.0, relTokensVsNoSeed: 0.0, figureSourceOnly: true },
    { key: "hipporag2", label: "HippoRAG 2", role: "graph", marker: "triangle-up", acc: 47.31, accLo: 45.42, accHi: 49.21, searches: 2.917, searchesLo: 2.799, searchesHi: 3.038, relSearchesVsNoSeed: -41.5, relTokensVsNoSeed: -8.0, figureSourceOnly: true },
    { key: "greasoner", label: "G-Reasoner", role: "graph", marker: "triangle-down", acc: 47.52, accLo: 45.61, accHi: 49.34, searches: 2.933, searchesLo: 2.819, searchesHi: 3.052, relSearchesVsNoSeed: -41.3, relTokensVsNoSeed: -8.0, figureSourceOnly: true },
    { key: "hgrag", label: "HGRAG", role: "graph", marker: "square", acc: 48.32, accLo: 46.49, accHi: 50.33, searches: 3.033, searchesLo: 2.917, searchesHi: 3.152, relSearchesVsNoSeed: -39.0, relTokensVsNoSeed: -8.2, figureSourceOnly: true },
    { key: "proprag", label: "PropRAG", role: "graph", marker: "diamond", acc: 50.79, accLo: 48.85, accHi: 52.67, searches: 2.781, searchesLo: 2.668, searchesHi: 2.902, relSearchesVsNoSeed: -44.0, relTokensVsNoSeed: -11.9, figureSourceOnly: true },
    { key: "lgr_doc_only", label: "LGR (doc. only)", role: "rdr", marker: "cross", acc: 51.45, accLo: 49.56, accHi: 53.40, searches: 2.479, searchesLo: 2.371, searchesHi: 2.582, relSearchesVsNoSeed: -49.8, relTokensVsNoSeed: -19.7, figureSourceOnly: true },
    { key: "lgr_full", label: "LGR (fused)", role: "lgr", marker: "star", acc: 52.77, accLo: 50.84, accHi: 54.72, searches: 2.403, searchesLo: 2.295, searchesHi: 2.505, relSearchesVsNoSeed: -51.1, relTokensVsNoSeed: -21.9, figureSourceOnly: true },
  ] as Figure1Point[],
};

/* ------------------------------------------------------------------ Table 1 */

/**
 * Table 1 (tab:main): retrieval across evidence depth, breadth and web documents
 * (R@5 / R@10). BrowseComp+ (pool) is the shared corpus subset. All triple-based rows use the
 * same triples; LatentGraphRAG stores each triple as one "head relation tail." memory. All RDR
 * rows use one frozen configuration. Best bold, second underlined.
 * Column order: MuSiQue R@5, R@10 · BrowseComp+ (pool) R@5, R@10 · FanOutQA R@5, R@10 · Mean R@5, R@10.
 */
export interface Table1Row {
  method: string;
  citation?: string;
  kind: "dense" | "recursive-baseline" | "graph" | "lgr";
  cells: Cell[];
  headline?: boolean;
}
export interface Table1Group {
  title: string;
  construction?: string;
  rows: Table1Row[];
}

export const table1Columns = [
  { benchmark: "MuSiQue", metrics: ["R@5", "R@10"] },
  { benchmark: "BrowseComp+ (pool)", metrics: ["R@5", "R@10"] },
  { benchmark: "FanOutQA", metrics: ["R@5", "R@10"] },
  { benchmark: "Mean", metrics: ["R@5", "R@10"] },
] as const;

export const table1: Table1Group[] = [
  {
    title: "Single-step embedding baselines",
    rows: [
      { method: "Qwen3-Embedding-8B", citation: "Zhang et al., 2025b", kind: "dense",
        cells: [c("63.13"), c("72.19"), c("14.59"), c("19.74"), c("26.84"), c("40.32"), c("34.85"), c("44.08")] },
      { method: "RDR-8B, root state only", citation: "Anonymous, 2026", kind: "dense",
        cells: [c("58.51"), c("65.99"), c("13.29"), c("18.51"), c("28.39"), c("42.65"), c("33.39"), c("42.39")] },
    ],
  },
  {
    title: "Recursive retrieval over documents only",
    rows: [
      { method: "GRITHopper-7B, own recursive procedure", citation: "Erker et al., 2026", kind: "recursive-baseline",
        cells: [c("78.55"), c("86.87"), c("16.33"), c("23.84"), c("31.96"), c("43.83"), c("42.28"), c("51.51")] },
      { method: "LatentGraphRAG (documents only), document tree D, RDR(4, 3)", kind: "lgr",
        cells: [c("82.00"), c("88.10"), c("21.35"), c("29.44"), c("41.61"), c("60.51"), c("48.32"), c("59.35")] },
    ],
  },
  {
    title: "Graph-based retrieval",
    construction: "Knowledge construction 1: HippoRAG 2 OpenIE triples",
    rows: [
      { method: "HippoRAG 2 (reproduced)", citation: "Gutiérrez et al., 2025", kind: "graph",
        cells: [c("74.47"), c("81.94"), c("8.12"), c("12.83"), c("26.07"), c("36.86"), c("36.22"), c("43.88")] },
      { method: "G-Reasoner 34M, LLM fact filter", citation: "Luo et al., 2026", kind: "graph",
        cells: [c("71.14"), c("80.83"), c("13.51"), c("19.00"), c("28.70"), c("40.05"), c("37.78"), c("46.63")] },
      { method: "HGRAG, entity–passage hypergraph", citation: "Wang et al., 2026", kind: "graph",
        cells: [c("71.11"), c("78.59"), c("13.17"), c("17.52"), c("30.37"), c("43.21"), c("38.22"), c("46.44")] },
    ],
  },
  {
    title: "Recursive composition (LatentGraphRAG)",
    construction: "Knowledge construction 1: HippoRAG 2 OpenIE triples",
    rows: [
      { method: "LatentGraphRAG (triples only), memory tree M", kind: "lgr",
        cells: [c("72.97"), c("81.60"), c("12.16"), c("18.40"), c("36.19"), c("52.73"), c("40.44"), c("50.91")] },
      { method: "LatentGraphRAG (documents + triples), joint index J", kind: "lgr",
        cells: [c("79.37"), c("86.84"), c("21.74"), c("30.16"), c("39.19"), c("56.47"), c("46.77"), c("57.83")] },
      { method: "LatentGraphRAG (documents + triples), fused D+M", kind: "lgr",
        cells: [c("83.47"), c("89.74"), c("21.55"), c("30.73"), c("43.02", "second"), c("62.54", "best"), c("49.35"), c("61.01")] },
    ],
  },
  {
    title: "Graph-based retrieval",
    construction: "Knowledge construction 2: PropRAG propositions",
    rows: [
      { method: "PropRAG (reproduced)", citation: "Wang and Han, 2025", kind: "graph",
        cells: [c("78.27"), c("86.40"), c("17.35"), c("23.51"), c("31.49"), c("46.69"), c("42.37"), c("52.20")] },
    ],
  },
  {
    title: "Recursive composition (LatentGraphRAG)",
    construction: "Knowledge construction 2: PropRAG propositions",
    rows: [
      { method: "LatentGraphRAG (propositions only), memory tree M", kind: "lgr",
        cells: [c("80.24"), c("86.62"), c("17.89"), c("26.00"), c("40.10"), c("58.29"), c("46.08"), c("56.97")] },
      { method: "LatentGraphRAG (documents + propositions), joint index J", kind: "lgr",
        cells: [c("83.33"), c("89.91", "second"), c("22.41"), c("30.77"), c("42.06"), c("60.81"), c("49.27"), c("60.50")] },
      { method: "LatentGraphRAG (documents + propositions), fused D+M", kind: "lgr",
        cells: [c("83.83", "second"), c("89.63"), c("22.57", "second"), c("32.22", "second"), c("42.71"), c("62.47", "second"), c("49.70", "second"), c("61.44", "second")] },
    ],
  },
  {
    title: "Triples and propositions in one memory index",
    construction: "Knowledge constructions 1 + 2: triples and propositions in one memory index",
    rows: [
      { method: "LatentGraphRAG (documents + triples + propositions), fused D+M", kind: "lgr", headline: true,
        cells: [c("84.33", "best"), c("90.07", "best"), c("22.88", "best"), c("32.29", "best"), c("43.06", "best"), c("62.34"), c("50.09", "best"), c("61.57", "best")] },
    ],
  },
];

/* ------------------------------------------------------------------ Table 2 */

/**
 * Table 2 (tab:depth): MuSiQue R@5 by hop count for LatentGraphRAG with documents and triples
 * (configuration of Table 1). Brackets: within-group paired 95% confidence intervals; D+M bold;
 * green (significant) Δ for 2 and 4 hops.
 */
export const table2Depth = {
  columns: ["Hops", "n", "q0", "D", "M", "J", "D+M", "D+M − D"],
  rows: [
    { hops: "2", n: "518", q0: "69.79", D: "90.06", M: "82.53", J: "87.07", DM: c("91.51", "best"), delta: c("+1.45", "sig"), ci: "[+0.19, +2.70]" },
    { hops: "3", n: "316", q0: "51.05", D: "81.96", M: "69.30", J: "79.11", DM: c("82.49", "best"), delta: c("+0.53"), ci: "[−0.95, +2.00]" },
    { hops: "4", n: "166", q0: "37.50", D: "56.93", M: "50.15", J: "55.87", DM: c("60.24", "best"), delta: c("+3.31", "sig"), ci: "[+1.20, +5.27]" },
  ],
  /** Section 5, RQ2: between-group difference, not significant. */
  betweenGroup: { value: "+1.87", ci: "[−0.51, +4.28]" },
};

/* ------------------------------------------------------------------ Table 3 */

/**
 * Table 3 (tab:edge-deletion): controlled removal of constructed knowledge on MuSiQue;
 * hop-level R@5 on the affected hops before/after deleting every triple or proposition of the
 * gold paragraph that mentions the hop answer (2,838 release triples, 2,568 PropRAG
 * propositions; same for all systems; documents unchanged). Rand.: Δ when as many triples or
 * propositions without the answer are deleted instead (three seeds; ∗: 95% interval excludes
 * zero). Intervals: paired bootstrap over questions.
 */
export const table3Removal = {
  columns: ["System", "Deleted", "# Hops", "Before", "After", "Δ [95%]", "Rand."],
  deletedUnits: { triples: "2,838", propositions: "2,568" },
  groups: [
    {
      title: "Hybrid pipelines: documents and constructed knowledge",
      rows: [
        { system: "HippoRAG 2 (doc. + tri.)", deleted: "triples", hops: "2,259", before: "71.4", after: "64.7", delta: "−6.7", ci: "[−7.8, −5.6]", rand: c("−0.5", "star"), kind: "graph" },
        { system: "LatentGraphRAG (doc. + tri.)", deleted: "triples", hops: "2,259", before: "81.1", after: "75.7", delta: "−5.4", ci: "[−6.3, −4.5]", rand: c("+0.0"), kind: "lgr" },
        { system: "LatentGraphRAG (doc. + tri. + prop.)", deleted: "triples", hops: "2,259", before: "81.5", after: "79.8", delta: "−1.7", ci: "[−2.4, −1.1]", rand: c("+0.1"), kind: "lgr" },
      ],
    },
    {
      title: "",
      rows: [
        { system: "PropRAG (doc. + prop.)", deleted: "propositions", hops: "2,539", before: "74.5", after: "55.0", delta: "−19.5", ci: "[−21.1, −18.0]", rand: c("−2.0", "star"), kind: "graph" },
        { system: "LatentGraphRAG (doc. + prop.)", deleted: "propositions", hops: "2,539", before: "80.5", after: "74.0", delta: "−6.5", ci: "[−7.5, −5.6]", rand: c("−0.1"), kind: "lgr" },
      ],
    },
    {
      title: "",
      rows: [
        { system: "LatentGraphRAG (doc. + tri. + prop.)", deleted: "both", hops: "2,556", before: "81.2", after: "76.1", delta: "−5.1", ci: "[−6.0, −4.3]", rand: c("+0.3"), kind: "lgr" },
      ],
    },
    {
      title: "Single-view ablations",
      rows: [
        { system: "LatentGraphRAG (doc. only)", deleted: "–", hops: "2,259", before: "79.4", after: "79.4", delta: "+0.0", ci: "[+0.0, +0.0]", rand: c("+0.0"), kind: "lgr" },
        { system: "LatentGraphRAG (tri. only)", deleted: "triples", hops: "2,259", before: "71.2", after: "51.9", delta: "−19.3", ci: "[−20.8, −17.8]", rand: c("−0.8", "star"), kind: "lgr" },
        { system: "LatentGraphRAG (prop. only)", deleted: "propositions", hops: "2,539", before: "77.3", after: "46.7", delta: "−30.6", ci: "[−32.5, −28.8]", rand: c("−0.1"), kind: "lgr" },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ Table 4 */

/**
 * Table 4 (tab:read-only): read-only answers from each method's top-ten texts
 * (Qwen3.5-122B-A10B). Acc = final-answer accuracy, List = loose list recall (FanOutQA).
 * Δ: LGR (doc. + tri. + prop.) minus each row; bold Δ: paired question-bootstrap 95% interval
 * excludes zero. Bottom block: matched ReAct minus read-only answer quality. Each benchmark
 * shares one server and its own ReAct controls, separate from Table 5.
 * Column order: MuSiQue Acc, Δ · FanOutQA List, Δ · BC+ (pool) Acc, Δ.
 */
export const table4ReadOnly = {
  columns: [
    { benchmark: "MuSiQue", metrics: ["Acc", "Δ"] },
    { benchmark: "FanOutQA", metrics: ["List", "Δ"] },
    { benchmark: "BC+ (pool)", metrics: ["Acc", "Δ"] },
  ],
  rows: [
    { evidence: "No evidence", kind: "none", cells: [c("21.10"), c("+47.60", "sig"), c("26.30"), c("+2.86"), c("1.20"), c("+38.19", "sig")] },
    { evidence: "Qwen3-Embedding-8B", kind: "dense", cells: [c("49.30"), c("+19.40", "sig"), c("17.80"), c("+11.36", "sig"), c("24.70"), c("+14.70", "sig")] },
    { evidence: "HippoRAG 2", kind: "graph", cells: [c("56.70"), c("+12.00", "sig"), c("19.08"), c("+10.08", "sig"), c("28.07"), c("+11.33", "sig")] },
    { evidence: "G-Reasoner", kind: "graph", cells: [c("61.60"), c("+7.10", "sig"), c("18.67"), c("+10.49", "sig"), c("27.59"), c("+11.81", "sig")] },
    { evidence: "HGRAG", kind: "graph", cells: [c("57.60"), c("+11.10", "sig"), c("19.67"), c("+9.50", "sig"), c("25.78"), c("+13.61", "sig")] },
    { evidence: "PropRAG", kind: "graph", cells: [c("63.10"), c("+5.60", "sig"), c("19.79"), c("+9.38", "sig"), c("34.70"), c("+4.70", "sig")] },
    { evidence: "LGR (doc. only)", kind: "rdr", cells: [c("67.60"), c("+1.10"), c("30.95", "best"), c("−1.79"), c("35.66"), c("+3.73", "sig")] },
    { evidence: "LGR (doc. + tri. + prop.)", kind: "lgr", cells: [c("68.70", "best"), c("–"), c("29.16"), c("–"), c("39.40", "best"), c("–")] },
  ],
  reactMinusReadOnly: {
    title: "Standard ReAct minus read-only, same evidence",
    rows: [
      { evidence: "LGR (doc. only)", musique: c("−1.30"), fanoutqa: c("+10.78", "sig"), browsecomp: c("+10.84", "sig") },
      /** Printed as "LGR (doc. + tri.+ prop.)" (missing space) in the paper. */
      { evidence: "LGR (doc. + tri. + prop.)", musique: c("−0.60"), fanoutqa: c("+9.43", "sig"), browsecomp: c("+10.24", "sig") },
    ],
  },
};

/* ------------------------------------------------------------------ Table 5 */

/**
 * Table 5 (tab:react): shared ReAct controller, embedding-search tool and budget; only top-ten
 * seeds vary. Acc/List: final-answer accuracy / loose list recall (%; best bold). Srch:
 * searches per question after seeding. Means of three paired runs (BC+: two; † one).
 * Column order: MuSiQue Acc, Srch · FanOutQA List, Srch · BC+ (pool) Acc, Srch.
 */
export const table5React = {
  columns: [
    { benchmark: "MuSiQue", metrics: ["Acc", "Srch"] },
    { benchmark: "FanOutQA", metrics: ["List", "Srch"] },
    { benchmark: "BC+ (pool)", metrics: ["Acc", "Srch"] },
  ],
  rows: [
    { seed: "No seed", kind: "none", cells: [c("52.20", "dagger"), c("3.82", "dagger"), c("40.02"), c("5.15"), c("30.24"), c("5.93")] },
    { seed: "HippoRAG 2", kind: "graph", cells: [c("62.83"), c("2.18"), c("38.56"), c("3.01"), c("40.54"), c("3.56")] },
    { seed: "G-Reasoner", kind: "graph", cells: [c("64.33"), c("2.14"), c("39.31"), c("3.07"), c("38.92"), c("3.59")] },
    { seed: "HGRAG", kind: "graph", cells: [c("64.87"), c("2.31"), c("39.73"), c("3.16"), c("40.36"), c("3.63")] },
    { seed: "PropRAG", kind: "graph", cells: [c("65.37"), c("2.13"), c("39.64"), c("2.95"), c("47.35"), c("3.26")] },
    { seed: "LGR (doc. only)", kind: "rdr", cells: [c("66.57"), c("2.07"), c("40.85"), c("2.38"), c("46.93"), c("2.99")] },
    { seed: "LGR (doc. + tri. + prop.)", kind: "lgr", cells: [c("67.30", "best"), c("2.05"), c("40.95", "best"), c("2.37"), c("50.06", "best"), c("2.79")] },
  ],
};

/* ----------------------------------------------------------------- Table 13 */

/**
 * Table 13 (tab:allviews, appendix): all views and fusion operators of LatentGraphRAG with
 * documents and triples at the frozen configuration; the reported fusion is D+M with CombMNZ.
 * Bold: best per column. Column order: MuSiQue R@5, R@10 · BrowseComp+ (pool) R@5, R@10 ·
 * FanOutQA R@5, R@10.
 */
export const table13AllViews = [
  {
    title: "Single step and path readout",
    rows: [
      { view: "q0 (root state)", cells: [c("58.51"), c("65.99"), c("13.29"), c("18.51"), c("28.39"), c("42.65")] },
      { view: "Document tree, path-product readout", cells: [c("75.56"), c("85.01"), c("17.58"), c("26.43"), c("36.54"), c("56.29")] },
    ],
  },
  {
    title: "Single views, global readout",
    rows: [
      { view: "D (document tree)", cells: [c("82.00"), c("88.10"), c("21.35"), c("29.44"), c("41.61"), c("60.51")] },
      { view: "M (memory tree)", cells: [c("72.97"), c("81.60"), c("12.16"), c("18.40"), c("36.19"), c("52.73")] },
      { view: "J (joint index)", cells: [c("79.37"), c("86.84"), c("21.74"), c("30.16"), c("39.19"), c("56.47")] },
    ],
  },
  {
    title: "Fused views",
    rows: [
      { view: "D+M (CombSUM)", cells: [c("83.41"), c("89.36"), c("21.31"), c("30.42"), c("43.01"), c("61.18")] },
      { view: "D+M (CombMNZ)", reported: true, cells: [c("83.47"), c("89.74"), c("21.55"), c("30.73", "best"), c("43.02"), c("62.54", "best")] },
      { view: "D+M (z-agreement)", cells: [c("83.28"), c("89.29"), c("20.46"), c("29.33"), c("42.56"), c("60.53")] },
      { view: "D+M (RRF)", cells: [c("81.56"), c("88.48"), c("20.00"), c("28.46"), c("42.30"), c("60.77")] },
      { view: "D+J (CombSUM)", cells: [c("83.88"), c("90.31"), c("21.72"), c("29.81"), c("42.84"), c("60.91")] },
      { view: "D+J (CombMNZ)", cells: [c("83.99", "best"), c("90.64", "best"), c("21.76", "best"), c("29.77"), c("42.75"), c("60.78")] },
      { view: "D+J (z-agreement)", cells: [c("83.91"), c("90.18"), c("21.66"), c("29.81"), c("43.06", "best"), c("60.95")] },
      { view: "D+J (RRF)", cells: [c("83.42"), c("89.93"), c("21.48"), c("29.64"), c("40.82"), c("60.27")] },
    ],
  },
];

/* ----------------------------------------------------------------- Table 14 */

/**
 * Table 14 (tab:projagg, appendix): alternative memory-to-document projections — change in
 * fused R@5 relative to the maximum (Equation 2) at the frozen configuration with triples and
 * propositions. ∗: paired 95% interval excludes zero (2,000 question resamples).
 * Column order: MuSiQue, FanOutQA, BC+ (pool).
 */
export const table14Projection = {
  reference: "max",
  rows: [
    { projection: "sum", cells: [c("+0.51", "star"), c("−0.90", "star"), c("−0.16")] },
    { projection: "mean", cells: [c("−0.92", "star"), c("−0.26"), c("−0.54")] },
    { projection: "soft max (Q = 2)", cells: [c("+0.37", "star"), c("+0.01"), c("−0.19")] },
    { projection: "soft max (Q = 4)", cells: [c("+0.15", "star"), c("+0.02"), c("−0.14", "star")] },
    { projection: "noisy-OR", cells: [c("+0.33"), c("−0.53"), c("−0.22")] },
  ],
};

/* ---------------------------------------------------- frozen configuration */

/**
 * The one configuration used across benchmarks, constructions and downstream interfaces
 * (Section 4, Section 3.3, Appendix A.3/A.4). LatentGraphRAG departs from RDR's published
 * configuration in one component: the readout temperature.
 */
export const frozenConfig = {
  encoder: "RDR-8B (used without further training)",
  tree: "RDR(4, 3)",
  treeDepth: 4,
  treeBranching: 3,
  memoryTreeMmrWeight: 0.5,
  observationTruncationTokens: 512,
  unitsRetainedPerState: 200,
  readoutTopK: 200,
  readoutTemperature: 0.02,
  rdrPublishedTemperature: 0.05,
  temperatureCalibration: "held-out optimum on the 1,417 MuSiQue development questions outside the 1,000-question evaluation sample",
  projection: "max",
  projectionFormula: "r_{M→D}(d) = max_{m: π(m) = d} r_M(m), zero when no retrieved memory maps to d",
  viewFusion: "CombMNZ",
  documentWeight: 1,
  memoryWeight: 0.5,
  fusionOperatorsCompared: ["CombSUM", "CombMNZ", "z-agreement", "RRF (k = 60)"],
  tripleVerbalization: "head relation tail.",
  seedSize: 10,
  reader: "Qwen3.5-122B-A10B",
  controller: "Qwen3.5-122B-A10B",
  agentSearchTool: "Qwen3-Embedding-8B",
  agentMaxSearches: 10,
  textsPerSearch: 5,
  pairedResamples: 2000,
  /** Section 4: corpus sizes. */
  corpora: {
    musique: { questions: "1,000", passages: "11,656", note: "development questions of the HippoRAG 2 release" },
    fanoutqa: { questions: "310", chunks: "40,209", note: "development questions, Wikipedia chunks" },
    browsecomp: { questions: "830", note: "BrowseComp+ (pool): evidence documents and ten negatives per question" },
  },
  /** Appendix A.3: knowledge gains also hold at RDR's own temperature (fusing documents with
   * triples and propositions over the document tree, R@5). */
  gainsAtRdrTemperature: { musique: "+2.10", fanoutqa: "+1.44", browsecomp: "+1.37" },
} as const;
