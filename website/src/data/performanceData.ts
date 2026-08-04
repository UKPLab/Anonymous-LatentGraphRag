/**
 * Compatibility layer over paperResults.ts.
 *
 * This module used to hold its own copy of the numbers, which had drifted from
 * the paper (and disagreed with a second copy in GroundTruthTripletSection). It
 * is now a thin adapter, so the existing chart/ablation components keep their
 * shape while every value comes from the single source of truth. New consumers
 * should import from paperResults.ts directly.
 */

import {
  browseCompEvidenceR5,
  fanoutqaR5Data as fanoutR5,
  fullAblation,
  musiqueR5Data as musiqueR5,
  type BarDatum,
} from "./paperResults";

export interface BarChartEntry {
  name: string;
  displayName: string;
  value: number;
  category: "non-structure" | "graph-enhanced" | "ours";
  highlight?: boolean;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const toEntries = (rows: BarDatum[]): BarChartEntry[] =>
  rows.map((r) => ({
    name: slug(r.name),
    displayName: r.name,
    value: r.value,
    category: r.category,
    highlight: r.highlight,
  }));

export const musiqueR5Data = toEntries(musiqueR5);
export const browseCompR5Data = toEntries(browseCompEvidenceR5);
export const fanoutqaR5Data = toEntries(fanoutR5);

export interface AblationEntry {
  method: string;
  shortName: string;
  description: string;
  musiqueR5: number;
  musiqueR10: number;
  fanoutqaR5: number;
  fanoutqaR10: number;
  isBest?: boolean;
}

const ABLATION_DESCRIPTIONS: Record<string, string> = {
  "Joint index":
    "Documents and verbalized memories in one index, expanded by a single tree.",
  "Dual-tree + RRF":
    "Two independent trees, fused by reciprocal rank without touching the scores.",
  "MMR-Tree + Z-Agreement":
    "Diversified memory expansion, fused by per-query score calibration across both views.",
};

/**
 * The fusion comparison on the landing page: how best to combine the two views.
 * Document-only and memory-only are the single-view references and are shown in
 * the Table 1 comparison instead.
 */
export const ablationData: AblationEntry[] = fullAblation
  .filter((r) => r.substrate === "joint" || r.substrate === "dual-tree")
  .map((r) => ({
    method: r.method,
    shortName: r.short,
    description: ABLATION_DESCRIPTIONS[r.short] ?? "",
    musiqueR5: r.musiqueR5,
    musiqueR10: r.musiqueR10,
    fanoutqaR5: r.fanoutqaR5,
    fanoutqaR10: r.fanoutqaR10,
    isBest: r.isBest,
  }));

// ============================================================
// Example data for the GritHopper animation (illustrative, not a result).
// ============================================================
export const exampleQuery =
  "Where does the body of water by the city that shares a border with Elizabeth Berg's birthplace and Ohio River meet?";

export const examplePassages = [
  {
    id: 1,
    title: "Elizabeth Berg",
    snippet: "Elizabeth Berg was born in Saint Paul, Minnesota...",
  },
  {
    id: 2,
    title: "Saint Paul Geography",
    snippet:
      "Saint Paul shares a border with Minneapolis, located along the Mississippi River...",
  },
  {
    id: 3,
    title: "Minneapolis Rivers",
    snippet:
      "The Mississippi River flows through Minneapolis and continues south...",
  },
  {
    id: 4,
    title: "River Confluence",
    snippet: "The Mississippi River meets the Ohio River at Cairo, Illinois...",
  },
];
