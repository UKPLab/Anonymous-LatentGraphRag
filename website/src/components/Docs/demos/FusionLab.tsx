"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

/**
 * FusionLab — interactive illustration of how dual-tree fusion combines a
 * document-view ranking with a memory-view ranking into one document ranking.
 *
 * Faithful to the paper (acl2023_contextual_dense.tex, §"Document-Memory Fusion"):
 *
 *   • Plain additive agreement (ablation):  s_final(d) = s_D(d) + s_M(d)
 *     with the appendix γ-ablation applied multiplicatively to docs found by both
 *     views:  s_final(d) = (s_D(d) + s_M(d)) · (1 + γ).
 *
 *   • Z-Agreement (the paper's method, PARAMETER-FREE):
 *     s_final^z(d) = (s_D − μ_D)/σ_D + (s_M − μ_M)/σ_M
 *     per-query, per-view standardisation — no γ.
 *
 *   • RRF:  Σ 1/(k + rank_L(d))   (rank-based, scale-free).
 *
 * Both s_D and s_M are cumulative path scores (products of per-hop cosines) from the
 * SAME encoder, so they live in comparable ranges. The paper's diagnostics report a
 * median σ_doc/σ_mem ≈ 1.09 (range up to ~2.0); this example uses ≈1.9 so the
 * scale-mismatch — and what Z-Agreement fixes — is visible. The 5-doc example is
 * tuned so the fused ranking *reorders* across all three fusions.
 */

export type FusionMode = "agreement" | "rrf";
type Variant = "plain" | "z";

type Doc = { id: string; title: string };
const DOCS: Doc[] = [
  { id: "D₁", title: "Einstein biography" },
  { id: "D₂", title: "Ulm — city history" },
  { id: "D₃", title: "Nobel Prize records" },
  { id: "D₄", title: "German geography" },
  { id: "D₅", title: "Physics fundamentals" },
];

// Raw per-view cumulative path scores. null = not retrieved by that view.
// Both are cosine-product scores from the same encoder — comparable ranges, NOT a
// fabricated 20× gap. Here σ_doc ≈ 1.9 × σ_mem (the doc view is more spread out).
const S_D: Record<string, number | null> = { "D₁": 0.55, "D₂": 0.30, "D₃": null, "D₄": 0.26, "D₅": 0.22 };
const S_M: Record<string, number | null> = { "D₁": 0.24, "D₂": 0.36, "D₃": 0.34, "D₄": null, "D₅": 0.20 };
const RRF_K = 60;

const BLUE = "#3b82f6";
const GREEN = "#22c55e";

function zNormalize(scores: Record<string, number | null>): Record<string, number> {
  const active = Object.entries(scores).filter(([, v]) => v !== null && v !== 0) as [string, number][];
  const out: Record<string, number> = {};
  for (const k of Object.keys(scores)) out[k] = 0;
  if (active.length < 2) return out;
  const vals = active.map(([, v]) => v);
  const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sigma = Math.sqrt(vals.reduce((a, b) => a + (b - mu) ** 2, 0) / vals.length);
  if (sigma < 1e-9) return out;
  for (const [k, v] of active) out[k] = (v - mu) / sigma;
  return out;
}

function ranksOf(scores: Record<string, number | null>): Record<string, number | null> {
  const active = Object.entries(scores).filter(([, v]) => v !== null) as [string, number][];
  active.sort((a, b) => b[1] - a[1]);
  const out: Record<string, number | null> = {};
  for (const k of Object.keys(scores)) out[k] = null;
  active.forEach(([k], i) => (out[k] = i + 1));
  return out;
}

const Z_D = zNormalize(S_D);
const Z_M = zNormalize(S_M);
const RANK_D = ranksOf(S_D);
const RANK_M = ranksOf(S_M);
const MAX_ABS_Z = Math.max(...Object.values(Z_D).map(Math.abs), ...Object.values(Z_M).map(Math.abs));
// Common scale across BOTH views so the comparable (non-20×) magnitudes read honestly.
const MAX_RAW = Math.max(
  ...(Object.values(S_D).filter((v) => v !== null) as number[]),
  ...(Object.values(S_M).filter((v) => v !== null) as number[]),
);

export default function FusionLab({
  mode = "agreement",
  showTrees = true,
}: {
  mode?: FusionMode;
  showTrees?: boolean;
}) {
  // Z-Agreement is the paper's headline method → default to it.
  const [variant, setVariant] = useState<Variant>("z");
  const [gamma, setGamma] = useState(0);

  // rrf has no variants; agreement toggles plain ↔ z. γ only applies to plain.
  const useZ = mode === "agreement" && variant === "z";
  const showGamma = mode === "agreement" && variant === "plain";
  const g = showGamma ? gamma : 0;

  const fused = useMemo(() => {
    return DOCS.map((d) => {
      const inD = S_D[d.id] !== null;
      const inM = S_M[d.id] !== null;
      const both = inD && inM;
      let dPart: number, mPart: number, total: number;
      let mult = 1;
      if (mode === "rrf") {
        dPart = RANK_D[d.id] !== null ? 1 / (RRF_K + (RANK_D[d.id] as number)) : 0;
        mPart = RANK_M[d.id] !== null ? 1 / (RRF_K + (RANK_M[d.id] as number)) : 0;
        total = dPart + mPart;
      } else if (useZ) {
        dPart = Z_D[d.id];
        mPart = Z_M[d.id];
        total = dPart + mPart; // parameter-free
      } else {
        dPart = S_D[d.id] ?? 0;
        mPart = S_M[d.id] ?? 0;
        mult = both ? 1 + g : 1; // paper's γ ablation: ×(1+γ) for agreement docs
        total = (dPart + mPart) * mult;
      }
      return { ...d, dPart, mPart, mult, both, inD, inM, total };
    }).sort((a, b) => b.total - a.total);
  }, [mode, useZ, g]);

  const caption =
    mode === "rrf"
      ? "Rank-based and scale-free — only positions matter, magnitudes are discarded. D₂ (rank 1 in memory, rank 2 in docs) edges out D₁ (rank 1 in docs, but only rank 3 in memory)."
      : useZ
      ? "Z-Agreement (the paper's method) standardises each view to zero mean / unit variance per query, so neither dominates by scale. Memory-only D₃ — strong relative to the memory distribution — climbs above D₅, which is below average in both views. Parameter-free."
      : "Plain additive sum of cumulative path scores. Both are cosine scores from the same encoder, so summing is meaningful — but here the document view is ~1.9× wider, so it dominates: weak-in-both D₅ still outranks the strongly-relational D₃. γ multiplies agreement docs by (1+γ).";

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* ── Two latent-graph trees → fusion (compact illustration) ── */}
      {showTrees && <MiniDualTrees mode={mode} />}

      {/* ── Controls ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 min-h-[34px]">
        {mode === "agreement" ? (
          <div className="flex gap-1 text-[11px] font-semibold">
            <button
              onClick={() => setVariant("plain")}
              className={`px-3 py-1.5 rounded-md border transition ${
                variant === "plain"
                  ? "bg-gray-700 text-white border-gray-700"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              Plain additive
            </button>
            <button
              onClick={() => setVariant("z")}
              className={`px-3 py-1.5 rounded-md border transition ${
                variant === "z"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              Z-Agreement (paper)
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-gray-500 font-mono">k = {RRF_K} · rank-based · scale-free</span>
        )}

        {showGamma ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-600 font-medium">agreement γ</span>
            <input
              type="range"
              min={-0.3}
              max={0.9}
              step={0.05}
              value={gamma}
              onChange={(e) => setGamma(parseFloat(e.target.value))}
              className="w-28 accent-purple-600"
            />
            <span className="font-mono text-[11px] text-purple-700 font-semibold w-16 text-right">
              ×(1{gamma >= 0 ? "+" : "−"}{Math.abs(gamma).toFixed(2)})
            </span>
          </div>
        ) : (
          mode === "agreement" && (
            <span className="text-[11px] text-blue-600 font-medium">parameter-free</span>
          )
        )}
      </div>

      {/* ── Two views ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <ViewColumn view="D" title="Document view" color={BLUE} mode={mode} useZ={useZ} />
        <ViewColumn view="M" title="Memory view" color={GREEN} mode={mode} useZ={useZ} />
      </div>

      {/* ── Formula ────────────────────────────────────────────── */}
      <div className="text-center text-[11px] text-gray-500 font-mono mb-4">
        {mode === "rrf" ? (
          <>
            s<sub>final</sub>(d) = 1/(k + rank<sub style={{ color: BLUE }}>D</sub>) + 1/(k + rank<sub style={{ color: GREEN }}>M</sub>)
          </>
        ) : useZ ? (
          <>
            s<sup>z</sup>
            <sub>final</sub>(d) = ẑ<sub style={{ color: BLUE }}>D</sub>(d) + ẑ<sub style={{ color: GREEN }}>M</sub>(d)
          </>
        ) : (
          <>
            s<sub>final</sub>(d) = (s<sub style={{ color: BLUE }}>D</sub>(d) + s<sub style={{ color: GREEN }}>M</sub>(d))
            {g !== 0 && <> · (1 {g > 0 ? "+" : "−"} {Math.abs(g).toFixed(2)})</>}
          </>
        )}
      </div>

      {/* ── Fused ranking (reorders with layout animation) ─────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2 text-center">
          Fused ranking
        </p>
        <div className="space-y-1.5">
          {fused.map((row, i) => (
            <motion.div
              layout
              key={row.id}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
                row.both ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-200"
              }`}
            >
              <span className="font-mono text-xs text-gray-400 w-4">{i + 1}.</span>
              <span className="font-mono text-xs font-bold text-gray-700 w-7">{row.id}</span>
              <span className="flex-1 text-xs text-gray-600 truncate">{row.title}</span>

              {/* breakdown */}
              <span className="font-mono text-[10px] tabular-nums" style={{ color: BLUE }}>
                {fmtPart(row.dPart, row.inD, mode, useZ)}
              </span>
              <span className="text-gray-300 text-[10px]">+</span>
              <span className="font-mono text-[10px] tabular-nums" style={{ color: GREEN }}>
                {fmtPart(row.mPart, row.inM, mode, useZ)}
              </span>
              {row.mult !== 1 && (
                <span className="font-mono text-[10px] tabular-nums text-purple-500">
                  ×{row.mult.toFixed(2)}
                </span>
              )}
              <span className="text-gray-300 text-[10px]">=</span>
              <span
                className={`font-mono text-xs font-bold tabular-nums w-12 text-right ${
                  row.total >= 0 ? "text-amber-800" : "text-red-400"
                }`}
              >
                {fmtTotal(row.total, mode)}
              </span>
              {row.both && (
                <span className="text-[8px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                  both
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-gray-500 mt-3 px-1 leading-5">{caption}</p>
    </div>
  );
}

/**
 * Compact two-tree header. Shows that the two rankings being fused below come from
 * two independent latent-graph expansions — a document tree and a (wider) memory
 * tree — that are combined *after* expansion. Deliberately small (≈ one cell tall)
 * so the normalized fusion math underneath stays the focus.
 */
function miniTree(branching: number, depth: number, w: number, h: number) {
  const vPad = 11;
  const hPad = 5;
  const lh = (h - vPad * 2) / depth;
  const uW = w - hPad * 2;
  type N = { id: string; depth: number; x: number; y: number };
  const nodes: N[] = [{ id: "r", depth: 0, x: w / 2, y: vPad }];
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let frontier: { x: number }[] = [{ x: w / 2 }];
  for (let d = 1; d <= depth; d++) {
    const total = Math.pow(branching, d);
    const spacing = uW / total;
    const next: { x: number }[] = [];
    let idx = 0;
    for (const f of frontier) {
      for (let c = 0; c < branching; c++) {
        const x = hPad + spacing * (idx + 0.5);
        const y = vPad + d * lh;
        nodes.push({ id: `${d}.${idx}`, depth: d, x, y });
        edges.push({ x1: f.x, y1: vPad + (d - 1) * lh, x2: x, y2: y });
        next.push({ x });
        idx++;
      }
    }
    frontier = next;
  }
  return { nodes, edges };
}

function TreeSVG({ branching, color, stroke }: { branching: number; color: string; stroke: string }) {
  const W = 220;
  const H = 78;
  const { nodes, edges } = useMemo(() => miniTree(branching, 2, W, H), [branching]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {edges.map((e, i) => (
        <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={color} strokeWidth={0.8} strokeOpacity={0.4} />
      ))}
      {nodes.map((n) => {
        const isRoot = n.id === "r";
        const r = isRoot ? 4 : Math.max(1.6, 3 - n.depth * 0.5);
        return (
          <circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={r}
            fill={isRoot ? "#1e293b" : color}
            stroke={isRoot ? "#475569" : stroke}
            strokeWidth={0.8}
          />
        );
      })}
    </svg>
  );
}

function MiniDualTrees({ mode }: { mode: FusionMode }) {
  const label = mode === "rrf" ? "RRF" : "agreement";
  return (
    <div className="mb-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-2 pt-1.5 pb-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-center mb-0.5" style={{ color: BLUE }}>
            Document tree · b_D = 3
          </p>
          <div className="h-[58px]">
            <TreeSVG branching={3} color={BLUE} stroke="#93c5fd" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-2 pt-1.5 pb-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-center mb-0.5" style={{ color: GREEN }}>
            Memory tree · b_M = 5
          </p>
          <div className="h-[58px]">
            <TreeSVG branching={5} color={GREEN} stroke="#86efac" />
          </div>
        </div>
      </div>
      {/* converging "fuse" connector pointing down to the rankings below */}
      <div className="flex items-center justify-center gap-2 mt-1.5">
        <span className="h-px w-12 bg-gradient-to-r from-transparent" style={{ backgroundImage: `linear-gradient(to right, transparent, ${BLUE})` }} />
        <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
          fuse · {label} ↓
        </span>
        <span className="h-px w-12" style={{ backgroundImage: `linear-gradient(to left, transparent, ${GREEN})` }} />
      </div>
    </div>
  );
}

/** One view's ranked docs with a per-row score bar. */
function ViewColumn({
  view,
  title,
  color,
  mode,
  useZ,
}: {
  view: "D" | "M";
  title: string;
  color: string;
  mode: FusionMode;
  useZ: boolean;
}) {
  const raw = view === "D" ? S_D : S_M;
  const z = view === "D" ? Z_D : Z_M;
  const rank = view === "D" ? RANK_D : RANK_M;

  const rows = DOCS.filter((d) => raw[d.id] !== null)
    .map((d) => {
      const r = raw[d.id] as number;
      const value = mode === "rrf" ? (rank[d.id] as number) : useZ ? z[d.id] : r;
      // frac drives the bar: [0,1] for plain/rrf, [-1,1] for z (diverging)
      let frac: number;
      if (mode === "rrf") frac = 1 / (RRF_K + (rank[d.id] as number)) / (1 / (RRF_K + 1));
      else if (useZ) frac = z[d.id] / MAX_ABS_Z;
      else frac = r / MAX_RAW;
      return { d, r, value, frac };
    })
    .sort((a, b) =>
      mode === "rrf" ? (a.value as number) - (b.value as number) : (b.value as number) - (a.value as number)
    );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-center" style={{ color }}>
        {title}
      </p>
      <div className="space-y-1.5">
        {rows.map(({ d, r, value, frac }) => (
          <motion.div layout key={d.id} className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold w-6" style={{ color }}>
              {d.id}
            </span>
            <div className="flex-1">
              <Bar frac={frac} signed={mode === "agreement" && useZ} color={color} />
            </div>
            <span className="font-mono text-[10px] text-gray-500 tabular-nums w-11 text-right">
              {mode === "rrf"
                ? `#${value}`
                : useZ
                ? `${(value as number) >= 0 ? "+" : ""}${(value as number).toFixed(2)}`
                : (r as number).toFixed(2)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar. signed → diverging from a centre line (for z-scores). */
function Bar({ frac, signed, color }: { frac: number; signed?: boolean; color: string }) {
  if (signed) {
    const leftPct = frac >= 0 ? 50 : 50 + frac * 50; // frac<0 → start left of centre
    const widthPct = Math.abs(frac) * 50;
    return (
      <div className="relative h-2.5 rounded bg-gray-100 overflow-hidden">
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300" />
        <motion.div
          className="absolute top-0 bottom-0 rounded"
          style={{ background: color }}
          animate={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
        />
      </div>
    );
  }
  const widthPct = Math.max(2, Math.min(1, frac) * 100);
  return (
    <div className="h-2.5 rounded bg-gray-100 overflow-hidden">
      <motion.div
        className="h-full rounded"
        style={{ background: color }}
        animate={{ width: `${widthPct}%` }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
      />
    </div>
  );
}

function fmtPart(v: number, inView: boolean, mode: FusionMode, useZ: boolean): string {
  if (!inView) return "·";
  if (mode === "rrf") return v.toFixed(4);
  if (useZ) return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
  return v.toFixed(2);
}

function fmtTotal(v: number, mode: FusionMode): string {
  if (mode === "rrf") return v.toFixed(4);
  if (v < 0) return v.toFixed(2);
  return v.toFixed(2);
}
