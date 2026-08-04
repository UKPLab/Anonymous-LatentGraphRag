"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

// Branching factor = 2, depth = 4
const B = 2;
const DEPTH = 4;

// ─── Z-normalization dot-plot (used in the Combine step) ──────────────────────
// 5 documents retrieved by each tree – intentionally different raw scales
const ZS_D_RAW = [0.61, 0.58, 0.52, 0.45, 0.39]; // doc tree (high range)
const ZS_M_RAW = [0.031, 0.029, 0.025, 0.018, 0.012]; // memory tree (low range)

function _avg(a: number[]) { return a.reduce((s, v) => s + v, 0) / a.length; }
function _sdv(a: number[]) {
  const m = _avg(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
}
function _znorm(a: number[]) {
  const m = _avg(a), s = _sdv(a);
  return s < 1e-9 ? a.map(() => 0) : a.map((v) => (v - m) / s);
}

const ZS_MU_D = _avg(ZS_D_RAW);
const ZS_SIG_D = _sdv(ZS_D_RAW);
const ZS_MU_M = _avg(ZS_M_RAW);
const ZS_SIG_M = _sdv(ZS_M_RAW);
const ZS_Z_D = _znorm(ZS_D_RAW); // ≈ [+1.23, +0.86, +0.12, −0.74, −1.48]
const ZS_Z_M = _znorm(ZS_M_RAW); // ≈ [+1.13, +0.85, +0.28, −0.71, −1.55]

// Both strips share this raw x-axis (0 → 0.65) so the scale gap is obvious
const ZS_RAW_MIN = 0, ZS_RAW_MAX = 0.65;
const ZS_Z_MIN = -3, ZS_Z_MAX = 3;
// Wide viewBox (7:1) so the SVG renders short on screen — matching formula chip height
const ZS_W = 440, ZS_H = 56, ZS_PAD = 24, ZS_DOT_Y = 28, ZS_AX_Y = 42;

function _rawX(v: number) {
  return ZS_PAD + ((v - ZS_RAW_MIN) / (ZS_RAW_MAX - ZS_RAW_MIN)) * (ZS_W - 2 * ZS_PAD);
}
function _zX(v: number) {
  return ZS_PAD + ((v - ZS_Z_MIN) / (ZS_Z_MAX - ZS_Z_MIN)) * (ZS_W - 2 * ZS_PAD);
}

const ZS_DOC_RAW_PX = ZS_D_RAW.map(_rawX);  // 154 … 235 (spread)
const ZS_MEM_RAW_PX = ZS_M_RAW.map(_rawX);  //  24 …  31 (squished!)
const ZS_DOC_Z_PX   = ZS_Z_D.map(_zX);       //  73 … 184
const ZS_MEM_Z_PX   = ZS_Z_M.map(_zX);       //  70 … 179

// Compact inline strip used inside the Combine panel
function CombineStrip({
  color,
  label,
  rawPx,
  zPx,
  rawScores,
  zScores,
  mu,
  sigma,
  normalized,
}: {
  color: "blue" | "green";
  label: string;
  rawPx: number[];
  zPx: number[];
  rawScores: number[];
  zScores: number[];
  mu: number;
  sigma: number;
  normalized: boolean;
}) {
  const c = color === "blue" ? "#3b82f6" : "#22c55e";
  const bg = color === "blue" ? "#eff6ff" : "#f0fdf4";
  const border = color === "blue" ? "#bfdbfe" : "#bbf7d0";
  const tc = color === "blue" ? "text-blue-700" : "text-green-700";

  const positions = normalized ? zPx : rawPx;
  const meanX = normalized ? _zX(0) : _rawX(mu);
  // Band spans the full data range so all dots sit inside it
  const dataMin = Math.min(...(normalized ? zScores : rawScores));
  const dataMax = Math.max(...(normalized ? zScores : rawScores));
  const sig1mX = normalized ? _zX(dataMin) : _rawX(dataMin);
  const sig1X  = normalized ? _zX(dataMax) : _rawX(dataMax);

  return (
    <div>
      <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${tc}`}>{label}</p>
      <div style={{ background: bg, borderColor: border }} className="border rounded-lg px-1 pt-1.5 pb-0.5">
        <svg viewBox={`0 0 ${ZS_W} ${ZS_H}`} className="w-full overflow-visible" preserveAspectRatio="xMidYMid meet">
          {/* ±1σ band — top and bottom aligned exactly with mean line */}
          <motion.rect
            y={ZS_DOT_Y - 16} height={ZS_AX_Y - (ZS_DOT_Y - 16)} fill={c} opacity={0.12} rx={3}
            animate={{ x: sig1mX, width: Math.max(0, sig1X - sig1mX) }}
            transition={{ duration: 0.65, ease: "easeInOut" }}
          />
          {/* axis */}
          <line x1={ZS_PAD} y1={ZS_AX_Y} x2={ZS_W - ZS_PAD} y2={ZS_AX_Y} stroke="#e5e7eb" strokeWidth={1.5} />
          {/* mean line — same y extent as the ±1σ band, ends exactly on the axis */}
          <motion.line
            y1={ZS_DOT_Y - 16} y2={ZS_AX_Y} stroke={c} strokeWidth={1.5} strokeDasharray="3,2" opacity={0.8}
            animate={{ x1: meanX, x2: meanX }}
            transition={{ duration: 0.65, ease: "easeInOut" }}
          />
          {/* dots */}
          {rawScores.map((_, i) => (
            <motion.circle
              key={i}
              cy={ZS_DOT_Y}
              r={i === 0 ? 10 : 6}
              fill={i === 0 ? c : c + "88"}
              stroke={i === 0 ? "white" : "none"}
              strokeWidth={2}
              initial={{ cx: rawPx[i] }}
              animate={{ cx: positions[i] }}
              transition={{ duration: 0.7, ease: "easeInOut", delay: i * 0.04 }}
            />
          ))}
          {/* axis labels */}
          {normalized ? (
            <>
              <text x={ZS_PAD} y={ZS_H - 3} textAnchor="middle" fontSize={7} fill="#9ca3af" fontFamily="ui-monospace">−3σ</text>
              <text x={_zX(0)} y={ZS_H - 3} textAnchor="middle" fontSize={7} fill={c} fontFamily="ui-monospace" fontWeight="600">0</text>
              <text x={ZS_W - ZS_PAD} y={ZS_H - 3} textAnchor="middle" fontSize={7} fill="#9ca3af" fontFamily="ui-monospace">+3σ</text>
            </>
          ) : (
            <>
              <text x={ZS_PAD} y={ZS_H - 3} textAnchor="middle" fontSize={7} fill="#9ca3af" fontFamily="ui-monospace">0</text>
              <text x={ZS_W - ZS_PAD} y={ZS_H - 3} textAnchor="middle" fontSize={7} fill="#9ca3af" fontFamily="ui-monospace">0.65</text>
            </>
          )}
          {/* label above D₁ — sits just above the ±1σ band top */}
          <AnimatePresence mode="wait">
            {normalized ? (
              <motion.text key="z" x={positions[0]} y={ZS_DOT_Y - 16} textAnchor="middle"
                fontSize={9} fontWeight="bold" fill={c} fontFamily="ui-monospace,monospace"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                z={zScores[0].toFixed(2)}
              </motion.text>
            ) : (
              <motion.text key="raw" x={positions[0]} y={ZS_DOT_Y - 16} textAnchor="middle"
                fontSize={9} fontWeight="bold" fill={c} fontFamily="ui-monospace,monospace"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                {rawScores[0].toFixed(3)}
              </motion.text>
            )}
          </AnimatePresence>
        </svg>
      </div>
    </div>
  );
}

// Example document results — scores are z-normalised (ẑ = (s−μ)/σ per view).
// null = not retrieved by that view (absent score treated as 0 in fusion).
// Combined = ẑ_D + ẑ_M (Z-Agreement, γ=0).
const FINAL_RESULTS = [
  { id: "D1", title: "Einstein biography",    docScore: 1.04,  memScore: 1.03,  combined:  2.07, agreement: true  },
  { id: "D2", title: "Ulm city history",      docScore: 0.63,  memScore: 0.41,  combined:  1.04, agreement: true  },
  { id: "D3", title: "Nobel Prize records",   docScore: null,  memScore: 0.22,  combined:  0.22, agreement: false },
  { id: "D4", title: "German geography",      docScore: -0.08, memScore: null,  combined: -0.08, agreement: false },
  { id: "D5", title: "Physics fundamentals",  docScore: -1.58, memScore: -1.65, combined: -3.23, agreement: true  },
] as const;

type Phase =
  | "idle"
  | "trees-expand"      // Both trees expand in parallel
  | "memory-mapping"
  | "score-highlight"
  | "combine-scores"
  | "flatten-list"
  | "complete";

// Generate tree node positions for a binary tree (top-to-bottom)
function generateTreeNodes(mode: "doc" | "mem", width: number, height: number) {
  const nodes: { id: string; x: number; y: number; depth: number; isActive: boolean }[] = [];
  const prefix = mode === "doc" ? "D" : "M";

  const vertPad = 25;
  const horzPad = 15;
  const levelHeight = (height - vertPad * 2) / DEPTH;

  // Root
  nodes.push({ id: "Q", x: width / 2, y: vertPad, depth: 0, isActive: true });

  // Generate all nodes level by level
  for (let d = 1; d <= DEPTH; d++) {
    const nodesAtLevel = Math.pow(B, d);
    const levelWidth = width - horzPad * 2;
    const spacing = levelWidth / nodesAtLevel;

    for (let i = 0; i < nodesAtLevel; i++) {
      const x = horzPad + spacing * (i + 0.5);
      const y = vertPad + d * levelHeight;
      // Active path: always take first child (leftmost)
      const isActive = i === 0;
      nodes.push({
        id: `${prefix}${d}.${i}`,
        x,
        y,
        depth: d,
        isActive,
      });
    }
  }

  return nodes;
}

// Generate edges between nodes
function generateEdges(nodes: ReturnType<typeof generateTreeNodes>) {
  const edges: { from: string; to: string; isActive: boolean }[] = [];

  for (const node of nodes) {
    if (node.depth === 0) continue;

    // Find parent
    const parentDepth = node.depth - 1;
    const nodeIndex = parseInt(node.id.split(".")[1] || "0");
    const parentIndex = Math.floor(nodeIndex / B);
    const parentId = parentDepth === 0 ? "Q" : `${node.id[0]}${parentDepth}.${parentIndex}`;

    edges.push({
      from: parentId,
      to: node.id,
      isActive: node.isActive,
    });
  }

  return edges;
}

interface MiniTreeProps {
  mode: "doc" | "mem";
  width: number;
  height: number;
  expandedDepth: number;
  showScores: boolean;
  isMapped: boolean; // For memory tree: turns light blue after mapping
  highlightPath: boolean;
  pathScores?: number[];
}

function MiniTree({ mode, width, height, expandedDepth, showScores, isMapped, highlightPath, pathScores = [] }: MiniTreeProps) {
  const nodes = generateTreeNodes(mode, width, height);
  const edges = generateEdges(nodes);

  const baseColor = mode === "doc" ? "#3b82f6" : "#166534"; // Blue for docs, dark green for memories
  const mappedColor = "#86efac"; // Light green for mapped memories
  const activeColor = isMapped ? mappedColor : baseColor;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Edges */}
      {edges.map((edge) => {
        const fromNode = nodes.find((n) => n.id === edge.from);
        const toNode = nodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) return null;

        const isVisible = toNode.depth <= expandedDepth;
        const isActivePath = edge.isActive && toNode.depth <= expandedDepth;

        return (
          <motion.line
            key={`${edge.from}-${edge.to}`}
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            stroke={isActivePath ? activeColor : "#e5e7eb"}
            strokeWidth={isActivePath ? 2.5 : 1}
            initial={{ opacity: 0 }}
            animate={{ opacity: isVisible ? (isActivePath ? 1 : 0.4) : 0 }}
            transition={{ duration: 0.3 }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const isVisible = node.depth <= expandedDepth;
        const isActive = node.isActive && node.depth <= expandedDepth;
        const radius = node.id === "Q" ? 10 : 7;

        return (
          <motion.g key={node.id}>
            {/* Glow for active path */}
            {isActive && highlightPath && (
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={radius + 4}
                fill={activeColor}
                opacity={0.25}
                animate={{ r: [radius + 3, radius + 6, radius + 3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}

            <motion.circle
              cx={node.x}
              cy={node.y}
              r={radius}
              fill={isActive ? activeColor : "#e5e7eb"}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            />

            {/* Node label */}
            <motion.text
              x={node.x}
              y={node.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={isActive ? "white" : "#9ca3af"}
              fontSize={node.id === "Q" ? 9 : 6}
              fontWeight={600}
              initial={{ opacity: 0 }}
              animate={{ opacity: isVisible ? 1 : 0 }}
            >
              {node.id === "Q" ? "Q" : node.depth}
            </motion.text>
          </motion.g>
        );
      })}

      {/* Path scores overlay */}
      {showScores && pathScores.length > 0 && (
        <>
          {pathScores.map((score, i) => {
            const depth = i + 1;
            const activeNodeAtDepth = nodes.find((n) => n.depth === depth && n.isActive);
            const parentNode = nodes.find((n) => n.depth === depth - 1 && n.isActive);
            if (!activeNodeAtDepth || !parentNode) return null;

            const midX = (activeNodeAtDepth.x + parentNode.x) / 2 + 12;
            const midY = (activeNodeAtDepth.y + parentNode.y) / 2;

            return (
              <motion.g
                key={`score-${i}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.15 }}
              >
                <rect x={midX - 14} y={midY - 7} width={28} height={14} rx={3} fill="white" stroke={activeColor} strokeWidth={1} />
                <text x={midX} y={midY + 3} textAnchor="middle" fill={activeColor} fontSize={7} fontWeight={600}>
                  ×{score.toFixed(2)}
                </text>
              </motion.g>
            );
          })}
        </>
      )}
    </svg>
  );
}

export default function UnifiedDualTreeSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-5%" });
  const [phase, setPhase] = useState<Phase>("idle");
  const [docDepth, setDocDepth] = useState(0);
  const [memDepth, setMemDepth] = useState(0);
  const [flattenIndex, setFlattenIndex] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  // sub-steps within the Combine phase: 0=raw strips, 1=z-normalized, 2=formula
  const [combineStep, setCombineStep] = useState(0);

  // Path scores for demonstration
  const docPathScores = [0.89, 0.85, 0.78, 0.88];
  const memPathScores = [0.91, 0.82, 0.73, 0.88];

  const docCumulativeScore = docPathScores.reduce((a, b) => a * b, 1);
  const memCumulativeScore = memPathScores.reduce((a, b) => a * b, 1);

  const resetAnimation = () => {
    setPhase("idle");
    setDocDepth(0);
    setMemDepth(0);
    setFlattenIndex(0);
    setCombineStep(0);
    setAnimationKey((k) => k + 1);
  };

  useEffect(() => {
    if (!isInView && animationKey === 0) return;

    const timers: NodeJS.Timeout[] = [];
    let t = 0;

    // Phase 1: Both trees expand in parallel
    timers.push(setTimeout(() => setPhase("trees-expand"), (t += 300)));
    for (let d = 1; d <= DEPTH; d++) {
      // Both trees expand simultaneously
      timers.push(setTimeout(() => {
        setDocDepth(d);
        setMemDepth(d);
      }, t + d * 400));
    }
    t += DEPTH * 400 + 300;

    // Phase 2: Memory mapping (memory tree turns light green)
    timers.push(setTimeout(() => setPhase("memory-mapping"), (t += 300)));

    // Phase 3: Score highlighting
    timers.push(setTimeout(() => setPhase("score-highlight"), (t += 1200)));

    // Phase 4: Combine scores — runs 3 internal sub-steps (raw → z-norm → formula)
    timers.push(setTimeout(() => setPhase("combine-scores"), (t += 1500)));
    timers.push(setTimeout(() => setCombineStep(1), t + 800));  // animate dots to z-space
    timers.push(setTimeout(() => setCombineStep(2), t + 1700)); // show combination formula

    // Phase 5: Flatten to list (give combine phase 3 s total)
    timers.push(setTimeout(() => setPhase("flatten-list"), (t += 3200)));
    for (let i = 0; i < FINAL_RESULTS.length; i++) {
      timers.push(setTimeout(() => setFlattenIndex(i + 1), t + 200 + i * 200));
    }
    t += FINAL_RESULTS.length * 200 + 300;

    // Complete
    timers.push(setTimeout(() => setPhase("complete"), (t += 300)));

    return () => timers.forEach(clearTimeout);
  }, [isInView, animationKey]);

  const showDocScores = phase === "score-highlight" || phase === "combine-scores" || phase === "flatten-list" || phase === "complete";
  const showMemScores = phase === "score-highlight" || phase === "combine-scores" || phase === "flatten-list" || phase === "complete";
  const isMapped = phase === "memory-mapping" || phase === "score-highlight" || phase === "combine-scores" || phase === "flatten-list" || phase === "complete";
  const showCombination = phase === "combine-scores" || phase === "flatten-list" || phase === "complete";
  const showFlatList = phase === "flatten-list" || phase === "complete";

  return (
    <section ref={containerRef} className="py-12 px-4 bg-gray-50/50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
            Dual Tree Search with Document–Memory Agreement
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-sm">
            Both indices, documents and verbalized memories, are searched in parallel using
            the same GritHopper tree search. Documents found by both trees receive a score
            boost: the document–memory agreement signal. Memory results are mapped back to their
            source documents so all scores land on the same result set.
          </p>
        </motion.div>

        {/* Main animation: Two trees side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Document Tree */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl border border-blue-200 p-4"
          >
            <h3 className="text-sm font-bold text-blue-700 mb-1 flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              Document Tree
            </h3>
            <p className="text-[10px] text-gray-500 mb-2">Binary tree search (b=2, depth=4)</p>

            <div className="h-[220px]">
              <MiniTree
                mode="doc"
                width={340}
                height={220}
                expandedDepth={docDepth}
                showScores={showDocScores}
                isMapped={false}
                highlightPath={showDocScores}
                pathScores={showDocScores ? docPathScores : []}
              />
            </div>

            {/* Cumulative score */}
            <AnimatePresence>
              {showDocScores && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-center"
                >
                  <span className="text-xs text-gray-500">Cumulative: </span>
                  <span className="text-sm font-bold font-mono text-blue-600">{docCumulativeScore.toFixed(3)}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Memory Tree */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className={`bg-white rounded-2xl border p-4 transition-colors duration-500 ${
              isMapped ? "border-green-300" : "border-green-700"
            }`}
          >
            <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full transition-colors duration-500 ${
                isMapped ? "bg-green-400" : "bg-green-700"
              }`} />
              <span className="text-green-800">Memory Tree</span>
              {isMapped && (
                <span className="text-green-500">→ Documents</span>
              )}
            </h3>
            <p className="text-[10px] text-gray-500 mb-2">
              {isMapped ? "Results mapped to source documents" : "Same structure over memories"}
            </p>

            <div className="h-[220px]">
              <MiniTree
                mode="mem"
                width={340}
                height={220}
                expandedDepth={memDepth}
                showScores={showMemScores}
                isMapped={isMapped}
                highlightPath={showMemScores}
                pathScores={showMemScores ? memPathScores : []}
              />
            </div>

            {/* Cumulative score */}
            <AnimatePresence>
              {showMemScores && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-center"
                >
                  <span className="text-xs text-gray-500">Cumulative: </span>
                  <span className="text-sm font-bold font-mono text-green-600">
                    {memCumulativeScore.toFixed(3)}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Combine step: Z-Agreement animated dot-plot + formula */}
        <AnimatePresence>
          {showCombination && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-amber-50 rounded-2xl border border-amber-300 p-5 mb-6"
            >
              <h3 className="text-sm font-bold text-amber-700 mb-3 text-center">
                Z-Agreement Fusion
              </h3>

              {/* Dot-plot strips */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <CombineStrip
                  color="blue" label="Doc Tree (D₁ highlighted)"
                  rawPx={ZS_DOC_RAW_PX} zPx={ZS_DOC_Z_PX}
                  rawScores={ZS_D_RAW} zScores={ZS_Z_D}
                  mu={ZS_MU_D} sigma={ZS_SIG_D}
                  normalized={combineStep >= 1}
                />
                <CombineStrip
                  color="green" label="Memory Tree (D₁ highlighted)"
                  rawPx={ZS_MEM_RAW_PX} zPx={ZS_MEM_Z_PX}
                  rawScores={ZS_M_RAW} zScores={ZS_Z_M}
                  mu={ZS_MU_M} sigma={ZS_SIG_M}
                  normalized={combineStep >= 1}
                />
              </div>

              {/* Caption below strips */}
              <div className="text-center min-h-[18px] mb-3">
                <AnimatePresence mode="wait">
                  {combineStep === 0 ? (
                    <motion.p key="raw" className="text-[10px] text-gray-500"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      Same axis (0 → 0.65). Memory dots squished into 5% of strip — 20× scale gap.
                    </motion.p>
                  ) : (
                    <motion.p key="z" className="text-[10px] text-gray-500"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      After <span className="font-mono font-semibold">ẑ = (s − μ) / σ</span>: both views on −3σ … +3σ. D₁ ranks high in both.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Formula chips — appear at combineStep 2 */}
              <AnimatePresence>
                {combineStep >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row items-center justify-center gap-2 flex-wrap"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 rounded-lg border border-blue-300">
                      <span className="text-xs text-blue-600">ẑ<sub>D</sub> =</span>
                      <span className="text-base font-bold font-mono text-blue-700">+{ZS_Z_D[0].toFixed(2)}</span>
                    </div>
                    <span className="text-lg text-gray-400">+</span>
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-100 rounded-lg border border-green-300">
                      <span className="text-xs text-green-600">ẑ<sub>M</sub> =</span>
                      <span className="text-base font-bold font-mono text-green-700">+{ZS_Z_M[0].toFixed(2)}</span>
                    </div>
                    <span className="text-lg text-gray-400">=</span>
                    <motion.div
                      initial={{ scale: 0.85 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-xl border-2 border-amber-400"
                    >
                      <span className="text-xs text-amber-700">s<sup>z</sup><sub>final</sub> =</span>
                      <span className="text-xl font-bold font-mono text-amber-800">
                        +{(ZS_Z_D[0] + ZS_Z_M[0]).toFixed(2)}
                      </span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="text-[10px] text-purple-600 text-center mt-3">
                s<sup>z</sup><sub>final</sub>(d) = ẑ<sub>D</sub>(d) + ẑ<sub>M</sub>(d)
                &ensp;·&ensp; per-query, per-view z-normalisation before summing
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flattened Ranked List */}
        <AnimatePresence>
          {showFlatList && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-200 p-5"
            >
              <h3 className="text-sm font-bold text-gray-700 mb-4 text-center">
                Final Ranked Document List
              </h3>

              <div className="max-w-lg mx-auto space-y-2">
                {FINAL_RESULTS.map((doc, i) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{
                      opacity: flattenIndex > i ? 1 : 0.3,
                      x: flattenIndex > i ? 0 : -20,
                    }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${
                      doc.agreement && flattenIndex > i
                        ? "bg-purple-50 border-purple-200"
                        : flattenIndex > i
                        ? "bg-gray-50 border-gray-200"
                        : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <span className="text-sm font-mono text-gray-400 w-5">{i + 1}.</span>
                    <span className="flex-1 text-sm font-medium text-gray-700">{doc.title}</span>

                    {flattenIndex > i && (
                      <>
                        <span className="text-xs font-mono text-blue-500">
                          {doc.docScore !== null ? (doc.docScore >= 0 ? "+" : "") + doc.docScore.toFixed(2) : "n/a"}
                        </span>
                        <span className="text-gray-300">+</span>
                        <span className="text-xs font-mono text-green-500">
                          {doc.memScore !== null ? (doc.memScore >= 0 ? "+" : "") + doc.memScore.toFixed(2) : "n/a"}
                        </span>
                        <span className="text-gray-300">=</span>
                        <span className={`text-sm font-bold font-mono ${
                          doc.combined > 0
                            ? doc.agreement ? "text-purple-600" : "text-gray-700"
                            : "text-red-400"
                        }`}>
                          {(doc.combined >= 0 ? "+" : "") + doc.combined.toFixed(2)}
                        </span>
                        {doc.agreement && (
                          <span className="text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                            ✓ Both
                          </span>
                        )}
                      </>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-purple-500 rounded" />
                  <span>Found by both trees (✓ Both views)</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase indicator + Replay button */}
        <div className="flex justify-center items-center mt-6 gap-2 flex-wrap">
          {[
            { label: "Tree Search", active: phase === "trees-expand" },
            { label: "Map to Docs", active: phase === "memory-mapping" },
            { label: "Score Paths", active: phase === "score-highlight" },
            { label: "Combine", active: phase === "combine-scores" },
            { label: "Rank", active: phase === "flatten-list" || phase === "complete" },
          ].map((step, i, arr) => {
            const phaseOrder = ["trees-expand", "memory-mapping", "score-highlight", "combine-scores", "flatten-list", "complete"];
            const currentIdx = phaseOrder.indexOf(phase);
            const stepIdx = i;
            const isComplete = currentIdx > stepIdx;
            const isActive = step.active;

            return (
              <div key={step.label} className="flex items-center">
                <motion.div
                  animate={{
                    backgroundColor: isComplete ? "#22c55e" : isActive ? "#3b82f6" : "#e5e7eb",
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                >
                  {isComplete ? "✓" : i + 1}
                </motion.div>
                <span className={`text-[10px] ml-1 ${isActive ? "text-blue-600 font-medium" : isComplete ? "text-green-600" : "text-gray-400"}`}>
                  {step.label}
                </span>
                {i < arr.length - 1 && <span className="text-gray-300 mx-1">→</span>}
              </div>
            );
          })}

          {/* Replay button */}
          {phase === "complete" && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={resetAnimation}
              className="ml-4 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg text-xs flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Replay
            </motion.button>
          )}
        </div>
      </div>
    </section>
  );
}
