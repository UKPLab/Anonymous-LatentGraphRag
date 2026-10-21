"use client";

/**
 * Two recursive trees and source-level fusion (paper §3.1–3.3), as one connected figure:
 *   document tree D (left) and memory tree M (right), roots on top
 *     → each tree's global readout flows down into a score list: r_D(d) over passages, r_M(m) over memories
 *     → projection π: every memory score flows to its source passage's row (max over its memories)
 *     → CombMNZ merges both views per passage, (w_D·r_D + w_M·r_{M→D}) · n(d), and the rows re-rank.
 *
 * Real (MuSiQue 4hop1__39871_314549_131976_56103, released Table 5 runs): the question, both top-10
 * lists (the documents-only seed and the documents + triples + propositions seed), the gold flags and the
 * memories of the passages (release triples rendered literally, PropRAG propositions).
 * Illustrative: the tree paths and every score. Scores only set bar lengths; they are chosen so that r_D
 * reproduces the real documents-only order and CombMNZ the real fused order. No setting is printed here.
 */

import { useState } from "react";
import { LGR } from "@/components/lgrPalette";
import { frozenConfig } from "@/data/lgrPaper";
import { c01, ease, locate, PlayButton, startAt, StepChip, usePlayback } from "@/components/KnowledgeGraph/usePlayback";

const B = frozenConfig.treeBranching;
const W_D = frozenConfig.documentWeight;
const W_M = frozenConfig.memoryWeight;
const statesAt = (l: number) => Math.pow(B, l - 1);

type Kind = "tri" | "prop";
const KIND_COL: Record<Kind, string> = { tri: LGR.triple, prop: LGR.prop };

/* ---------------- the example (MuSiQue) ---------------- */
const QUESTION =
  "When do hurricanes occur in the ocean that borders the state where Williamsburg, Main Street Station and another share a track?";
const GOLD_ANSWER = "usually in the summer or fall";
const GOLD = new Set(["Atlantic hurricane", "Richmond, Virginia", "Virginia", "Newport News, Virginia"]);

/** Real: the documents-only seed (released Table 5 run), in order. */
const D_ONLY = [
  "Atlantic hurricane", "Richmond, Virginia", "2016 Atlantic hurricane season", "East Coast of the United States",
  "Wassaw Sound", "Metropolitan Avenue/Lorimer Street station", "Newport News, Virginia",
  "Geography of the United States", "Maine", "Otho Holland Williams",
];
/** Real: the documents + triples + propositions seed (released Table 5 run), in order. */
const FUSED_REAL = [
  "Atlantic hurricane", "Richmond, Virginia", "2016 Atlantic hurricane season", "East Coast of the United States",
  "Virginia", "Typhoon", "Metropolitan Avenue/Lorimer Street station", "Wassaw Sound",
  "Geography of the United States", "Newport News, Virginia",
];
/** rows of the document score list: the documents-only top 10, then two passages below it */
const DOCS = [...D_ONLY, "Virginia", "Typhoon"];

/** Illustrative r_D: reproduces D_ONLY; Virginia and Typhoon score below its top 10. */
const R_D: Record<string, number> = {
  "Atlantic hurricane": 0.3, "Richmond, Virginia": 0.26, "2016 Atlantic hurricane season": 0.21,
  "East Coast of the United States": 0.18, "Wassaw Sound": 0.15, "Metropolitan Avenue/Lorimer Street station": 0.13,
  "Newport News, Virginia": 0.11, "Geography of the United States": 0.09, Maine: 0.07, "Otho Holland Williams": 0.06,
  Virginia: 0.05, Typhoon: 0.04,
};

/** The highlighted paths (illustrative). The memory path composes facts from three source passages. */
const DOC_PATH = ["Richmond, Virginia", "East Coast of the United States", "Atlantic hurricane"];
const MEM_PATH: { text: string; kind: Kind }[] = [
  { text: "Main Street Station … trains to and from Newport News and Williamsburg", kind: "prop" },
  { text: "Virginia is bordered by Atlantic Ocean.", kind: "tri" },
  { text: "Atlantic hurricane … usually in the summer or fall", kind: "prop" },
];

/** Memory-tree readout r_M(m): real memories, illustrative scores, each with its source passages π(m). */
const MEMS: { text: string; kind: Kind; src: string[]; r: number }[] = [
  { text: "An Atlantic hurricane or tropical storm is a tropical cyclone that forms in the Atlantic Ocean, usually in the summer or fall.", kind: "prop", src: ["Atlantic hurricane"], r: 0.36 },
  { text: "Virginia is bordered by Atlantic Ocean.", kind: "tri", src: ["Virginia"], r: 0.33 },
  { text: "As of 2010, the Main Street Station in Richmond, Virginia, only receives trains headed to and from Newport News and Williamsburg due to track layout.", kind: "prop", src: ["Richmond, Virginia"], r: 0.3 },
  { text: "A hurricane occurs in the Atlantic Ocean and northeastern Pacific Ocean.", kind: "prop", src: ["Atlantic hurricane", "Typhoon"], r: 0.29 },
  { text: "Virginia is bordered by the Atlantic Ocean to the east.", kind: "prop", src: ["Virginia"], r: 0.27 },
  { text: "As of 2010 the station receives trains to and from Williamsburg.", kind: "tri", src: ["Richmond, Virginia"], r: 0.22 },
  { text: "The 2016 Atlantic hurricane season officially started on June 1 and ended on November 30.", kind: "prop", src: ["2016 Atlantic hurricane season"], r: 0.14 },
  { text: "Virginia is a coastal state of United States.", kind: "tri", src: ["East Coast of the United States"], r: 0.12 },
  { text: "Metropolitan Avenue/Lorimer Street located in Williamsburg.", kind: "tri", src: ["Metropolitan Avenue/Lorimer Street station"], r: 0.09 },
  { text: "Deadly and destructive hurricanes occur almost every year along the Atlantic seaboard and the Gulf of Mexico.", kind: "prop", src: ["Geography of the United States"], r: 0.06 },
  { text: "Wassaw Sound is a bay of Atlantic Ocean.", kind: "tri", src: ["Wassaw Sound"], r: 0.04 },
];

/** r_{M→D}(d) = max over the memories whose sources include d; the index of that memory */
const PROJ: Record<string, { r: number; j: number }> = {};
MEMS.forEach((m, j) => m.src.forEach((d) => { if (!PROJ[d] || m.r > PROJ[d].r) PROJ[d] = { r: m.r, j }; }));

/** CombMNZ over all twelve rows: (w_D·r_D + w_M·r_{M→D}) × n(d) */
const VIEWS: Record<string, number> = Object.fromEntries(DOCS.map((d) => [d, (R_D[d] !== undefined ? 1 : 0) + (PROJ[d] ? 1 : 0)]));
const SCORE: Record<string, number> = Object.fromEntries(DOCS.map((d) => [d, (W_D * (R_D[d] ?? 0) + W_M * (PROJ[d]?.r ?? 0)) * VIEWS[d]]));
const FUSED_ALL = [...DOCS].sort((a, b) => SCORE[b] - SCORE[a]);
if (process.env.NODE_ENV !== "production" && FUSED_REAL.some((d, k) => FUSED_ALL[k] !== d)) {
  console.warn("UnifiedDualTreeSection: illustrative scores no longer reproduce the real fused order");
}

/* ---------------- geometry (viewBox 1180 × 576) ---------------- */
const W = 1180, H = 576;
const TREE = { D: { x0: 30, x1: 560 }, M: { x0: 620, x1: 1150 } };
const LY = [40, 84, 128, 172];
const nodeX = (v: "D" | "M", l: number, i: number) => TREE[v].x0 + (i + 0.5) * ((TREE[v].x1 - TREE[v].x0) / statesAt(l));
const cxOf = (v: "D" | "M") => (TREE[v].x0 + TREE[v].x1) / 2;
const PATH_I = [0, 1, 4, 13];
const RO_Y = 206;                       // readout pill
const ROW0 = 256, RH = 22, SEP = 12;    // score rows; SEP = gap under the top 10
const slotY = (p: number) => ROW0 + p * RH + SEP * c01(p - 9);
const BX = 228, BW = 228;               // document bar area
const K = BW / Math.max(...Object.values(SCORE));
const MB = { x: 902, w: 150 };           // memory bar area
const KM = MB.w / Math.max(...MEMS.map((m) => m.r));
const memKind = (l: number, i: number): Kind =>
  l >= 2 && PATH_I[l - 1] === i ? MEM_PATH[l - 2].kind : (i * 5 + l * 2) % 3 === 1 ? "prop" : "tri";
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* ---------------- timeline ---------------- */
type Kk = "grow" | "readout" | "project" | "fuse" | "rank";
type Step = { k: Kk; lvl: number; ms: number };
const STEPS: Step[] = [
  ...[1, 2, 3, 4].map((l) => ({ k: "grow" as const, lvl: l, ms: l === 1 ? 900 : 1300 })),
  { k: "readout", lvl: 0, ms: 2600 },
  { k: "project", lvl: 0, ms: 3600 },
  { k: "fuse", lvl: 0, ms: 2000 },
  { k: "rank", lvl: 0, ms: 2600 },
];
const TOTAL = STEPS.reduce((a, s) => a + s.ms, 0);
const sIdx = (k: Kk, lvl = 0) => STEPS.findIndex((s) => s.k === k && (k !== "grow" || s.lvl === lvl));

type Hover = { kind: "doc"; d: string } | { kind: "mem"; j: number } | null;

export default function UnifiedDualTreeSection() {
  const { el, playing, done, seek, toggle, replay, box } = usePlayback(TOTAL, "fus");
  const [hover, setHover] = useState<Hover>(null);
  const { si, sp } = locate(STEPS, el);
  const step = STEPS[si];
  const prog = (j: number) => (j < 0 ? 0 : si > j ? 1 : si === j ? sp : 0);
  const grown = (l: number) => (l === 1 ? 1 : prog(sIdx("grow", l)));
  const readP = prog(sIdx("readout"));
  const projP = prog(sIdx("project"));
  const fuseP = prog(sIdx("fuse"));
  const rankP = prog(sIdx("rank"));

  const arrowP = (j: number) => c01((projP - j * 0.065) / 0.22);
  const rowY = (d: string) => {
    const a = DOCS.indexOf(d), b = FUSED_ALL.indexOf(d);
    return slotY(a + (b - a) * ease(rankP));
  };
  const memY = (j: number) => ROW0 + j * RH;
  const mult = (d: string) => 1 + (VIEWS[d] - 1) * ease(fuseP);
  const segP = (d: string) => (PROJ[d] ? arrowP(PROJ[d].j) : 0);

  const hotDoc = (d: string) =>
    (hover?.kind === "doc" && hover.d === d) || (hover?.kind === "mem" && MEMS[hover.j].src.includes(d));
  const hotMem = (j: number) =>
    (hover?.kind === "mem" && hover.j === j) || (hover?.kind === "doc" && MEMS[j].src.includes(hover.d));

  const narration = (() => {
    switch (step.k) {
      case "grow": return {
        t: "Two recursive searches",
        s: "The document tree observes passages; the memory tree observes triples and propositions and composes them across passages: Main Street Station (Richmond) → Virginia borders the Atlantic → Atlantic hurricanes.",
      };
      case "readout": return {
        t: "Each tree's readout flows down into one score list",
        s: "r_D(d) over passages, r_M(m) over memories. The document view alone gives the documents-only ranking: Virginia is not in its top 10.",
      };
      case "project": return {
        t: "Projection π: memory scores flow to their source passages",
        s: "Each passage takes the maximum over its memories: a triple for Virginia, propositions for Atlantic hurricane and Richmond, and a memory with two sources supports both.",
      };
      case "fuse": return {
        t: "CombMNZ: weighted sum, times the number of views",
        s: "Passages that both views retrieved (n = 2) are boosted; passages with a single view keep n = 1.",
      };
      default: return {
        t: "One fused ranking · the top 10 become the agent's seed",
        s: "Virginia, the passage that links the state to the Atlantic Ocean, enters at rank 5; Newport News moves from 7 to 10; Maine and Otho Holland Williams leave the top 10.",
      };
    }
  })();
  const chips: { label: string; j: number; ks: Kk[] }[] = [
    { label: "1 · two trees", j: sIdx("grow", 1), ks: ["grow"] },
    { label: "2 · readouts", j: sIdx("readout"), ks: ["readout"] },
    { label: "3 · projection π", j: sIdx("project"), ks: ["project"] },
    { label: "4 · CombMNZ", j: sIdx("fuse"), ks: ["fuse", "rank"] },
  ];

  /* ---- one tree ---- */
  const tree = (v: "D" | "M") => {
    const isM = v === "M";
    const cx = cxOf(v);
    return (
      <g key={v}>
        <text x={TREE[v].x0} y={18} fontSize="9.5" fill="#94a3b8" letterSpacing="0.08em">
          {isM ? "MEMORY TREE M · TRIPLES AND PROPOSITIONS" : "DOCUMENT TREE D · PASSAGES"}
        </text>
        {/* edges */}
        {[2, 3, 4].map((l) => {
          const g = grown(l);
          if (g <= 0) return null;
          return Array.from({ length: statesAt(l) }, (_, i) => {
            const pi = Math.floor(i / B);
            const x0 = nodeX(v, l - 1, pi), y0 = LY[l - 2], x1 = nodeX(v, l, i), y1 = LY[l - 1];
            const onPath = PATH_I[l - 1] === i && PATH_I[l - 2] === pi;
            const u = c01(g * 1.4);
            return <line key={`e${l}-${i}`} x1={x0} y1={y0} x2={x0 + (x1 - x0) * u} y2={y0 + (y1 - y0) * u}
              stroke={onPath ? LGR.path : "#d5dbe3"} strokeWidth={onPath ? 2.2 : 0.9} />;
          });
        })}
        {/* readout fan-in */}
        {readP > 0 && [1, 2, 3, 4].map((l) => Array.from({ length: statesAt(l) }, (_, i) => {
          const x = nodeX(v, l, i), y = LY[l - 1];
          const u = ease(c01(readP * 2.2 - (l - 1) * 0.1));
          return <line key={`f${l}-${i}`} x1={x} y1={y} x2={x + (cx - x) * u} y2={y + (RO_Y - 11 - y) * u}
            stroke="#e2c94a" strokeWidth={0.5} opacity={0.35} />;
        }))}
        {/* nodes */}
        {[1, 2, 3, 4].map((l) => {
          const g = grown(l);
          if (g <= 0) return null;
          return Array.from({ length: statesAt(l) }, (_, i) => {
            const x = nodeX(v, l, i), y = LY[l - 1];
            const onPath = PATH_I[l - 1] === i;
            const r = l === 1 ? 7 : l === 4 ? 3.3 : onPath ? 5.4 : 4.4;
            const o = l === 1 ? 1 : c01((g - 0.6) / 0.4);
            if (l === 1) return <circle key={`n${l}-${i}`} cx={x} cy={y} r={r} fill={LGR.state} />;
            if (!isM) return <circle key={`n${l}-${i}`} cx={x} cy={y} r={r} opacity={o}
              fill={onPath ? LGR.path : "#dbe7f7"} stroke={onPath ? LGR.path : "#7aa3d6"} strokeWidth={0.9} />;
            const k = memKind(l, i), col = KIND_COL[k];
            const fill = onPath ? col : k === "tri" ? LGR.tripleSoft : LGR.propSoft;
            return k === "tri"
              ? <rect key={`n${l}-${i}`} x={x - r} y={y - r} width={2 * r} height={2 * r} rx={1.2} opacity={o} fill={fill} stroke={col} strokeWidth={0.9} />
              : <circle key={`n${l}-${i}`} cx={x} cy={y} r={r} opacity={o} fill={fill} stroke={col} strokeWidth={0.9} />;
          });
        })}
        <text x={cx - 12} y={LY[0] + 3.5} textAnchor="end" fontSize="9" fill={LGR.state}>q₀</text>
        {/* labels on the highlighted path */}
        {[2, 3, 4].map((l) => {
          if (grown(l) < 0.9) return null;
          const y = (LY[l - 2] + LY[l - 1]) / 2;
          const lab = isM ? MEM_PATH[l - 2].text : DOC_PATH[l - 2];
          const col = isM ? (MEM_PATH[l - 2].kind === "tri" ? "#065f46" : "#5b21b6") : "#0c4a6e";
          const w = Math.min(232, lab.length * 4.5 + 10);
          return (
            <g key={`lab${l}`}>
              <rect x={cx + 7} y={y - 8} width={w} height={14} rx={3} fill="#fff" opacity={0.94} />
              {isM && (MEM_PATH[l - 2].kind === "tri"
                ? <rect x={cx + 10} y={y - 3.5} width={6} height={6} rx={1} fill={LGR.triple} />
                : <circle cx={cx + 13} cy={y - 0.5} r={3} fill={LGR.prop} />)}
              <text x={cx + (isM ? 20 : 11)} y={y + 2.8} fontSize="8.2" fill={col}>{trunc(lab, 50)}</text>
            </g>
          );
        })}
        {/* readout pill + arrow into the score list */}
        <g opacity={readP > 0 ? 1 : 0.35}>
          <rect x={cx - 92} y={RO_Y - 11} width={184} height={22} rx={11} fill="#fffdf2" stroke="#e2c94a" strokeWidth={1.1} />
          <text x={cx} y={RO_Y + 3.5} textAnchor="middle" fontSize="9.5" fill="#7a6410">
            global readout → r<tspan fontSize="7" dy="2">{v}</tspan><tspan dy="-2">({isM ? "m" : "d"})</tspan>
          </text>
          <line x1={cx} y1={RO_Y + 11} x2={cx} y2={ROW0 - 22} stroke="#e2c94a" strokeWidth={1.1} markerEnd="url(#fus-ar)" />
        </g>
      </g>
    );
  };

  return (
    <section className="bg-gray-50/50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 text-center">
          <h2 className="mb-2 text-xl font-bold text-gray-900 md:text-2xl lg:text-3xl">
            Two Trees, One Ranking: Source-Level Fusion
          </h2>
          <p className="mx-auto max-w-3xl text-sm text-gray-600">
            A <span className="font-semibold text-blue-700">document tree</span> accumulates passages; a{" "}
            <span className="font-semibold text-slate-800">memory tree</span> accumulates{" "}
            <span className="font-medium" style={{ color: LGR.triple }}>triples</span> and{" "}
            <span className="font-medium" style={{ color: LGR.prop }}>propositions</span>. Source links carry each
            memory&apos;s score to its passage, and CombMNZ fuses both views into one ranking.
          </p>
        </div>

        <div ref={box} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <PlayButton playing={playing} onClick={toggle} />
            {chips.map((c) => {
              const active = c.ks.includes(step.k) && !done;
              return <StepChip key={c.label} label={c.label} tone={c.j >= sIdx("readout") ? "amber" : "indigo"}
                state={active ? "active" : done || si > c.j ? "past" : "next"} onClick={() => seek(startAt(STEPS, c.j))} />;
            })}
            <button onClick={replay}
              className="ml-auto rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:border-slate-300 hover:bg-slate-50">
              {playing ? "Restart" : "Replay"}
            </button>
          </div>
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5">
            <span className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[11px] font-bold"
              style={{ background: "#d6e8f5", color: "#00507d" }}>q</span>
            <p className="text-[12px] leading-snug text-slate-800">
              {QUESTION} <span className="text-slate-400">· gold answer: {GOLD_ANSWER}</span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[860px]" role="img"
              aria-label="Document tree and memory tree, their readouts, the projection of memory scores to passages and the fused ranking">
              <defs>
                <marker id="fus-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#e2c94a" />
                </marker>
                {(["tri", "prop"] as Kind[]).map((k) => (
                  <marker key={k} id={`fus-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill={KIND_COL[k]} />
                  </marker>
                ))}
              </defs>

              {tree("D")}
              {tree("M")}

              {/* ---------- score list headers ---------- */}
              <g opacity={readP > 0 ? 1 : 0.4}>
                <text x={36} y={ROW0 - 8} fontSize="9" fill="#64748b" letterSpacing="0.06em">
                  DOCUMENT SCORES · r<tspan fontSize="6.5" dy="2">D</tspan><tspan dy="-2">(d)</tspan>
                  {projP > 0 && <tspan fill={LGR.prop}> + w<tspan fontSize="6.5" dy="2">M</tspan><tspan dy="-2">·r</tspan><tspan fontSize="6.5" dy="2">M→D</tspan><tspan dy="-2">(d)</tspan></tspan>}
                  {fuseP > 0 && <tspan fill={LGR.fused}> · n(d)</tspan>}
                </text>
                <text x={626} y={ROW0 - 8} fontSize="9" fill="#64748b" letterSpacing="0.06em">
                  MEMORY SCORES · r<tspan fontSize="6.5" dy="2">M</tspan><tspan dy="-2">(m)</tspan>
                </text>
              </g>

              {/* the top-10 line */}
              {readP > 0.3 && (
                <g>
                  <line x1={36} y1={ROW0 + 10 * RH + 1} x2={556} y2={ROW0 + 10 * RH + 1} stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={0.9} />
                  <text x={71} y={ROW0 + 10 * RH + 10} fontSize="7.6" fill="#64748b">
                    {rankP > 0.5 ? "↑ top 10: the agent's seed" : "↑ documents-only top 10"}
                  </text>
                </g>
              )}

              {/* ---------- projection arrows π (drawn under the rows) ---------- */}
              {MEMS.map((m, j) => m.src.map((d) => {
                const a = arrowP(j);
                if (a <= 0) return null;
                const isMax = PROJ[d].j === j;
                const y0 = memY(j) + 7, y1 = rowY(d) + 7;
                const x0 = 622, x1 = 560;
                const hot = hotMem(j) || hotDoc(d);
                return (
                  <path key={`${j}-${d}`} d={`M${x0},${y0} C${x0 - 30},${y0} ${x1 + 30},${y1} ${x1 + 1},${y1}`}
                    fill="none" stroke={KIND_COL[m.kind]} strokeWidth={hot ? 2 : isMax ? 1.3 : 0.9}
                    {...(isMax ? { pathLength: 1, strokeDasharray: `${a} 1` } : { strokeDasharray: "3 3" })}
                    opacity={(hot ? 1 : isMax ? 0.85 : 0.45) * (isMax ? 1 : a)}
                    markerEnd={a >= 1 && isMax ? `url(#fus-${m.kind})` : undefined} />
                );
              }))}

              {/* ---------- document rows ---------- */}
              {DOCS.map((d) => {
                const y = rowY(d);
                const below = DOCS.indexOf(d) >= 10;
                const shown = readP > 0 ? c01(readP * 3 - DOCS.indexOf(d) * 0.12) : 0;
                if (shown <= 0) return null;
                const fusedRank = FUSED_ALL.indexOf(d) + 1;
                const rank = rankP > 0.6 ? fusedRank : DOCS.indexOf(d) + 1;
                const dRank = D_ONLY.indexOf(d) + 1;
                const wD = (R_D[d] ?? 0) * W_D * K * mult(d) * ease(c01(readP * 2));
                const wM = (PROJ[d]?.r ?? 0) * W_M * K * mult(d) * segP(d);
                const hot = hotDoc(d);
                const out = rankP > 0.6 && fusedRank > 10;
                const pk = PROJ[d] ? MEMS[PROJ[d].j].kind : null;
                return (
                  <g key={d} opacity={shown * (out ? 0.45 : below && rankP < 0.5 && segP(d) <= 0 ? 0.6 : 1)}
                    onMouseEnter={() => setHover({ kind: "doc", d })} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
                    <rect x={32} y={y - 1} width={526} height={RH - 4} rx={4} fill={hot ? "#fff7ed" : "transparent"} />
                    <text x={50} y={y + 11.5} textAnchor="end" fontSize="8.6" fill="#94a3b8" fontFamily="ui-monospace, monospace">
                      {below && rankP <= 0.6 ? "·" : rank}
                    </text>
                    <rect x={55} y={y + 3} width={10} height={10} rx={2.2}
                      fill={GOLD.has(d) ? LGR.gold : "#fff"} stroke={GOLD.has(d) ? LGR.gold : "#cbd5e1"} />
                    <text x={71} y={y + 11.5} fontSize="9" fill={LGR.ink}>{trunc(d, 25)}</text>
                    {rankP > 0.6 && (
                      <text x={222} y={y + 11.5} textAnchor="end" fontSize="7.8"
                        fill={dRank ? "#94a3b8" : LGR.fused} fontWeight={dRank ? 400 : 700}>{dRank ? `D ${dRank}` : "new"}</text>
                    )}
                    <rect x={BX} y={y + 3} width={BW} height={10} rx={5} fill="#f1f5f9" />
                    <rect x={BX} y={y + 3} width={wD} height={10} rx={2} fill={LGR.doc} />
                    {pk && <rect x={BX + wD} y={y + 3} width={wM} height={10} rx={2} fill={KIND_COL[pk]} />}
                    {fuseP > 0.2 && (
                      <g opacity={c01((fuseP - 0.2) * 3)}>
                        <rect x={BX + BW + 6} y={y + 1.5} width={30} height={13} rx={6.5}
                          fill={VIEWS[d] === 2 ? LGR.fused : "#f1f5f9"} />
                        <text x={BX + BW + 21} y={y + 11} textAnchor="middle" fontSize="8" fontWeight={700}
                          fill={VIEWS[d] === 2 ? "#fff" : "#64748b"}>n={VIEWS[d]}</text>
                      </g>
                    )}
                    {/* where the projected score lands */}
                    {pk && segP(d) >= 1 && (pk === "tri"
                      ? <rect x={545} y={y + 4} width={7} height={7} rx={1.2} fill={LGR.triple} />
                      : <circle cx={548.5} cy={y + 7.5} r={3.6} fill={LGR.prop} />)}
                  </g>
                );
              })}

              {/* ---------- memory rows ---------- */}
              {MEMS.map((m, j) => {
                const shown = readP > 0 ? c01(readP * 3 - j * 0.1) : 0;
                if (shown <= 0) return null;
                const y = memY(j);
                const hot = hotMem(j);
                const col = KIND_COL[m.kind];
                return (
                  <g key={j} opacity={shown} onMouseEnter={() => setHover({ kind: "mem", j })} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
                    <rect x={622} y={y - 1} width={528} height={RH - 4} rx={4} fill={hot ? (m.kind === "tri" ? LGR.tripleSoft : LGR.propSoft) : "transparent"} />
                    {m.kind === "tri"
                      ? <rect x={630} y={y + 4} width={7} height={7} rx={1.2} fill={col} />
                      : <circle cx={633.5} cy={y + 7.5} r={3.6} fill={col} />}
                    <text x={644} y={y + 11.2} fontSize="8.6" fill={LGR.ink}>{trunc(m.text, 52)}</text>
                    <rect x={MB.x} y={y + 3} width={MB.w} height={10} rx={5} fill="#f1f5f9" />
                    <rect x={MB.x} y={y + 3} width={m.r * KM * ease(c01(readP * 2 - 0.3))} height={10} rx={2} fill={col} />
                    <text x={MB.x + MB.w + 8} y={y + 11} fontSize="7.8" fill="#64748b">
                      π → {m.src.length > 1 ? "2 passages" : trunc(m.src[0], 18)}
                    </text>
                  </g>
                );
              })}

              {/* ---------- CombMNZ, symbolic ---------- */}
              <g opacity={fuseP > 0 ? 1 : 0.35}>
                <rect x={300} y={H - 34} width={580} height={28} rx={8} fill={LGR.fusedSoft} stroke="#fed7aa" />
                <text x={590} y={H - 15.5} textAnchor="middle" fontSize="10.5" fill="#9a3412">
                  CombMNZ: s(d) = ( w<tspan fontSize="7.5" dy="2">D</tspan><tspan dy="-2"> · r</tspan><tspan fontSize="7.5" dy="2">D</tspan><tspan dy="-2">(d) + w</tspan><tspan fontSize="7.5" dy="2">M</tspan><tspan dy="-2"> · r</tspan><tspan fontSize="7.5" dy="2">M→D</tspan><tspan dy="-2">(d) ) · n(d),   r</tspan><tspan fontSize="7.5" dy="2">M→D</tspan><tspan dy="-2">(d) = max</tspan><tspan fontSize="7.5" dy="2">π(m)=d</tspan><tspan dy="-2"> r</tspan><tspan fontSize="7.5" dy="2">M</tspan><tspan dy="-2">(m)</tspan>
                </text>
              </g>
            </svg>
          </div>

          <div className="mt-2 rounded-md bg-slate-50 px-3 py-2">
            <p className="text-[12.5px] font-semibold text-slate-900">{done ? "One fused ranking · the top 10 become the agent's seed" : narration.t}</p>
            <p className="text-[11.5px] text-slate-500">
              {done
                ? "Virginia enters at rank 5 through the memory view. Hover a passage or a memory to follow its source link."
                : narration.s}
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-600">
            <span className="font-semibold text-slate-700">Real:</span> Virginia is not in the documents-only top 10. With
            this seed the agent answered without searching (documents-only seed: 1 search; no seed: 3 searches, wrong); one
            released run per condition.
          </p>
          <p className="mt-1 text-[10.5px] leading-snug text-slate-400">
            Real: the question, both top-10 lists (documents-only run and documents + triples + propositions run), gold
            flags, the memories of the passages. Illustrative: tree paths and scores.
          </p>
        </div>
      </div>
    </section>
  );
}
