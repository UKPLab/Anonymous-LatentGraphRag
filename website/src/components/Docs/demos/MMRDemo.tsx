"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAutoPlay } from "../useAutoPlay";
import DemoControls from "./DemoControls";
import { jointTag, DOC_COLOR, MEM_COLOR } from "./jointTag";

/**
 * MMR-decoded expansion: at each hop we pick branching items that maximize relevance
 * MINUS redundancy with already-retrieved items. The animation shows two trees
 * side by side — left is λ=1.0 (pure relevance, sibling items clump together) and right
 * is λ=0.5 (relevance + diversity, siblings spread out).
 */
type Mode = "documents" | "memories" | "joint";

const MODE_COLORS: Record<Mode, { line: string; label: string }> = {
  documents: { line: "#3b82f6", label: "docs" },
  memories: { line: "#22c55e", label: "memories" },
  joint: { line: "#6366f1", label: "docs ∪ memories" },
};

export default function MMRDemo({
  mode = "documents",
  branching = 3,
  maxHops = 3,
}: {
  mode?: Mode;
  branching?: number;
  maxHops?: number;
}) {
  const { step, paused, toggle, replay } = useAutoPlay({ maxStep: maxHops });
  const mc = MODE_COLORS[mode];

  const width = 240;
  const height = 320;

  // Two trees: left uses tight horizontal spread (clustered), right uses wide spread
  // (diverse). Both are 3-ary trees of depth maxHops, only the active path expands.
  const tree = (spreadFactor: number, side: string) => {
    type Node = { id: string; depth: number; x: number; y: number; active: boolean; tag?: "doc" | "mem" };
    const vPad = 24;
    const hPad = 12;
    const usableH = height - vPad * 2;
    const lh = usableH / maxHops;
    const nodes: Node[] = [{ id: "Q", depth: 0, x: width / 2, y: vPad, active: true }];
    const edges: { from: string; to: string; active: boolean }[] = [];
    type Frame = { id: string; x: number; active: boolean };
    let frontier: Frame[] = [{ id: "Q", x: width / 2, active: true }];
    for (let d = 1; d <= maxHops; d++) {
      const next: Frame[] = [];
      // Only the active path expands further (one node per level).
      for (const f of frontier) {
        const usableW = (width - hPad * 2) * spreadFactor;
        const span = usableW;
        const half = span / 2;
        for (let c = 0; c < branching; c++) {
          const childId = `${d}.${c}`;
          const offset = ((c - (branching - 1) / 2) / Math.max((branching - 1) / 2, 1)) * half;
          const x = f.x + offset / Math.max(d, 1);
          const y = vPad + d * lh;
          const active = f.active && c === Math.floor(branching / 2);
          // Joint index: each retrieved candidate is a document OR a memory (random mix).
          const tag = mode === "joint" ? jointTag(`${side}.${childId}`) : undefined;
          nodes.push({ id: childId, depth: d, x, y, active, tag });
          edges.push({ from: f.id, to: childId, active });
          if (active) next.push({ id: childId, x, active: true });
        }
      }
      frontier = next;
    }
    return { nodes, edges };
  };

  const left = useMemo(() => tree(0.3, "L"), [branching, maxHops, mode]);
  const right = useMemo(() => tree(1.0, "R"), [branching, maxHops, mode]);

  function svg(
    t: { nodes: { id: string; depth: number; x: number; y: number; active: boolean; tag?: "doc" | "mem" }[]; edges: { from: string; to: string; active: boolean }[] },
    color: string,
    joint = false,
  ) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {t.edges.map((e, idx) => {
          const f = t.nodes.find((n) => n.id === e.from)!;
          const to = t.nodes.find((n) => n.id === e.to)!;
          if (to.depth > step) return null;
          return (
            <line key={idx} x1={f.x} y1={f.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={e.active ? 2 : 1} strokeOpacity={e.active ? 1 : 0.4} />
          );
        })}
        {t.nodes.map((n) => {
          if (n.depth > step) return null;
          const isRoot = n.id === "Q";
          const isMem = n.tag === "mem";
          const r = isRoot ? 9 : n.active ? 7 : 6;
          const fill = isRoot
            ? "#1e293b"
            : joint
              ? isMem ? MEM_COLOR.fill : DOC_COLOR.fill
              : color;
          return (
            <motion.g
              key={n.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: n.depth * 0.1 }}
            >
              <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke="#fff" strokeWidth={1} />
              {joint && !isRoot ? (
                <text
                  x={n.x}
                  y={n.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={7}
                  fontWeight={600}
                  fill="#fff"
                >
                  {isMem ? "M" : "D"}
                </text>
              ) : null}
            </motion.g>
          );
        })}
      </svg>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-semibold text-gray-600 mb-1 text-center font-mono">λ = 1.0 (no diversity)</p>
          <div className="aspect-[3/4]">{svg(left, "#94a3b8")}</div>
        </div>
        <div>
          <p className="text-[10px] font-semibold mb-1 text-center font-mono" style={{ color: mc.line }}>
            λ = 0.5 (diverse, over {mc.label})
          </p>
          <div className="aspect-[3/4]">{svg(right, mc.line, mode === "joint")}</div>
        </div>
      </div>
      <DemoControls
        paused={paused}
        step={step}
        maxStep={maxHops}
        onPlayPause={toggle}
        onReplay={replay}
      />
      <p className="text-[11px] text-gray-500 mt-2 px-2">
        Lower λ spreads siblings apart — they cover more of the semantic space. Useful for width-oriented tasks (FanOutQA).
      </p>
    </div>
  );
}
