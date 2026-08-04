"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { AnimationPhase } from "@/hooks/useAnimationPhase";

interface Props {
  currentHop: number;
  isComplete: boolean;
  phase: AnimationPhase;
}

// ── SVG viewport ──────────────────────────────────────────────────────────
const VW = 540;
const VH = 165;

// ── Nodes in the sequential chain (non-linear path through embedding space)
const Q_POS = { x: 38, y: 82 };
const CHAIN = [
  { x: 145, y: 45  }, // D1 – up
  { x: 258, y: 108 }, // D2 – down
  { x: 365, y: 50  }, // D3 – up
  { x: 472, y: 90  }, // D4 – middle
];


const DOC_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c084fc"];

// ── Growing oval enclosing Q + retrieved nodes ────────────────────────────
const OVALS = [
  { cx: 38,  cy: 82, rx: 24,  ry: 22 }, // 0 retrieved
  { cx: 91,  cy: 63, rx: 80,  ry: 50 }, // 1 – Q + D1
  { cx: 148, cy: 76, rx: 132, ry: 55 }, // 2 – + D2
  { cx: 201, cy: 68, rx: 183, ry: 53 }, // 3 – + D3
  { cx: 255, cy: 76, rx: 238, ry: 57 }, // 4 – + D4
];

// ── Per-hop candidate documents (new set each hop) ────────────────────────
// isWinner = true → this candidate becomes the next chain node
const CANDIDATES = [
  // Hop 0 – searching around Q
  [
    { x: 145, y: 45,  sim: 0.89, winner: true  },
    { x: 78,  y: 22,  sim: 0.34, winner: false },
    { x: 88,  y: 148, sim: 0.52, winner: false },
    { x: 178, y: 125, sim: 0.23, winner: false },
    { x: 58,  y: 115, sim: 0.41, winner: false },
    { x: 172, y: 16,  sim: 0.63, winner: false },
  ],
  // Hop 1 – searching around Q + D1
  [
    { x: 258, y: 108, sim: 0.83, winner: true  },
    { x: 205, y: 18,  sim: 0.45, winner: false },
    { x: 198, y: 145, sim: 0.62, winner: false },
    { x: 305, y: 22,  sim: 0.31, winner: false },
    { x: 290, y: 150, sim: 0.24, winner: false },
    { x: 322, y: 78,  sim: 0.57, winner: false },
  ],
  // Hop 2 – searching around Q + D1 + D2
  [
    { x: 365, y: 50,  sim: 0.85, winner: true  },
    { x: 298, y: 18,  sim: 0.47, winner: false },
    { x: 312, y: 150, sim: 0.38, winner: false },
    { x: 418, y: 28,  sim: 0.62, winner: false },
    { x: 420, y: 132, sim: 0.29, winner: false },
    { x: 410, y: 82,  sim: 0.54, winner: false },
  ],
  // Hop 3 – searching around Q + D1 + D2 + D3
  [
    { x: 472, y: 90,  sim: 0.91, winner: true  },
    { x: 402, y: 16,  sim: 0.38, winner: false },
    { x: 404, y: 155, sim: 0.67, winner: false },
    { x: 494, y: 26,  sim: 0.43, winner: false },
    { x: 496, y: 155, sim: 0.25, winner: false },
    { x: 516, y: 78,  sim: 0.59, winner: false },
  ],
];

function candColor(sim: number, winner: boolean) {
  if (winner) return "#f59e0b";
  if (sim > 0.6) return "#6366f1";
  if (sim > 0.35) return "#a78bfa";
  return "#d1d5db";
}

// ─────────────────────────────────────────────────────────────────────────
export default function LatentGraphSimilarityPanel({ currentHop, isComplete, phase }: Props) {
  const retrieved = isComplete ? 4 : currentHop;
  const oval      = OVALS[Math.min(retrieved, 4)];

  // Candidates visible only during cloud-searching (or document-returning for winner highlight)
  const showCands   = phase === "cloud-searching";
  const showWinner  = phase === "document-returning";
  const candidates  = (showCands || showWinner) && currentHop < 4
    ? CANDIDATES[currentHop]
    : [];


  return (
    <div className="mt-6 border-t border-gray-100 pt-4">

      {/* ── Title ──────────────────────────────────────────────────── */}
      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-violet-500 rounded-full" />
        Similarity-Driven Connections
      </h3>

      {/* ── Legend ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-[9px] text-gray-500 mb-3">
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" fill="#3b82f6"/>
            <text x="8" y="9" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="5" fontWeight="700">Q</text>
          </svg>
          <span>Query</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" fill="#8b5cf6"/>
            <text x="8" y="9" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="5" fontWeight="700">Dᵢ</text>
          </svg>
          <span>Retrieved document</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="22" height="16" viewBox="0 0 22 16">
            <ellipse cx="11" cy="8" rx="9" ry="5" fill="#7c3aed" fillOpacity="0.07" stroke="#7c3aed" strokeWidth="1.2" strokeDasharray="4 3"/>
          </svg>
          <span>ctx = encode(Q, D₁…Dₙ)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="22" height="16" viewBox="0 0 22 16">
            <circle cx="11" cy="8" r="5" fill="none" stroke="#f59e0b" strokeWidth="1.8"/>
          </svg>
          <span>Selected (highest sim)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="22" height="16" viewBox="0 0 22 16">
            <line x1="1" y1="8" x2="21" y2="8" stroke="#6366f1" strokeWidth="2.5" strokeDasharray="3 2"/>
            <line x1="1" y1="13" x2="21" y2="13" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3 2"/>
          </svg>
          <span>sim strength</span>
        </div>
      </div>

      {/* ── Main SVG ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-2 overflow-hidden">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ maxHeight: VH }}>

          {/* Growing context oval */}
          <motion.ellipse
            cy={oval.cy} ry={oval.ry}
            fill="#7c3aed" fillOpacity={0.05}
            stroke="#7c3aed" strokeWidth={1.4}
            strokeDasharray="5 4"
            animate={{ cx: oval.cx, rx: oval.rx, cy: oval.cy, ry: oval.ry }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />

          {/* ctx label inside oval */}
          <motion.text
            animate={{ x: oval.cx, y: oval.cy + oval.ry + 10 }}
            transition={{ duration: 0.55 }}
            textAnchor="middle" fill="#7c3aed" fontSize={8} fontStyle="italic" opacity={0.7}
          >
            ctx
          </motion.text>

          {/* Chain straight edges (draw as each hop completes) */}
          {[0, 1, 2, 3].map(i => {
            if (i >= retrieved) return null;
            const from = i === 0 ? Q_POS : CHAIN[i - 1];
            const to   = CHAIN[i];
            return (
              <motion.line
                key={`edge-${i}`}
                x1={from.x} y1={from.y}
                x2={to.x}   y2={to.y}
                stroke={i === 0 ? "#3b82f6" : DOC_COLORS[i]}
                strokeWidth={2.2}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            );
          })}

          {/* Candidate documents + similarity lines (cloud-searching only) */}
          <AnimatePresence>
            {candidates.map((c, i) => {
              const show = showCands || (showWinner && c.winner);
              return (
                <motion.g
                  key={`cand-${currentHop}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: show ? 1 : 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                >
                  {/* Similarity line from oval center to candidate */}
                  <line
                    x1={oval.cx} y1={oval.cy}
                    x2={c.x} y2={c.y}
                    stroke={candColor(c.sim, c.winner)}
                    strokeWidth={Math.max(0.5, c.sim * 4)}
                    strokeDasharray="4 3"
                    opacity={0.2 + c.sim * 0.75}
                  />
                  {/* Candidate circle */}
                  <circle
                    cx={c.x} cy={c.y} r={9}
                    fill="white"
                    stroke={candColor(c.sim, c.winner)}
                    strokeWidth={c.winner ? 2.2 : 1.2}
                  />
                  {/* sim label */}
                  <text
                    x={c.x} y={c.y + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={candColor(c.sim, c.winner)}
                    fontSize={5.5} fontWeight={700}
                  >
                    {c.sim.toFixed(2)}
                  </text>
                </motion.g>
              );
            })}
          </AnimatePresence>

          {/* Q node */}
          <motion.circle
            cx={Q_POS.x} cy={Q_POS.y} r={14}
            fill="#3b82f6"
            animate={{ r: [13, 15, 13] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <text x={Q_POS.x} y={Q_POS.y + 1}
            textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={8} fontWeight={700}>Q</text>

          {/* Chain doc nodes (D1–D4, appear sequentially) */}
          {[0, 1, 2, 3].map(i => {
            if (i >= retrieved) return null;
            const pos = CHAIN[i];
            return (
              <motion.g key={`cn-${i}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35 }}
              >
                <circle cx={pos.x} cy={pos.y} r={12}
                  fill={DOC_COLORS[i]} stroke={DOC_COLORS[i]} strokeWidth={1.5}/>
                <text x={pos.x} y={pos.y + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="white" fontSize={7} fontWeight={700}>D{i + 1}</text>
              </motion.g>
            );
          })}

          {/* Phase label */}
          <text x={VW - 6} y={VH - 6}
            textAnchor="end" fill="#c4b5fd" fontSize={8} fontWeight={600}>
            {isComplete ? "complete" : `hop ${currentHop + 1}/4 · ${phase}`}
          </text>

        </svg>
      </div>

      {/* ── Info box: text → formula → text ────────────────────────── */}
      <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-[11px] text-gray-600 leading-relaxed">
        <p>
          We represent <strong>all potential connections</strong> to documents via cosine
          similarity. At each hop, the context vector{" "}
          <span className="font-mono text-violet-700">ctx = encode(Q, D₁,…,Dₙ)</span>{" "}
          (encoding the query together with all documents retrieved so far) is compared
          against every document <span className="font-mono text-blue-700">d ∈ D</span>:
        </p>

        <div className="my-2 bg-white border border-blue-200 rounded-lg px-4 py-2 text-center font-mono text-xs text-blue-900 flex items-center justify-center gap-1.5 flex-wrap">
          <span className="text-gray-400">∀ d ∈ D :</span>
          <span className="font-bold">sim(ctx, d)</span>
          <span>=</span>
          <span className="inline-flex flex-col items-center align-middle leading-none mx-0.5">
            <span className="px-1 pb-0.5">ctx · d</span>
            <span className="w-full border-t border-blue-500" />
            <span className="px-1 pt-0.5">‖ctx‖ · ‖d‖</span>
          </span>
          <span className="text-violet-600 font-bold">∈ [0, 1]</span>
        </div>

        <p>
          Unlike static knowledge graphs with binary edges, documents remain softly activated,
          and a context-conditioned subgraph emerges dynamically as the{" "}
          <span className="font-mono text-violet-700">ctx</span>{" "}
          representation evolves.
        </p>
      </div>
    </div>
  );
}
