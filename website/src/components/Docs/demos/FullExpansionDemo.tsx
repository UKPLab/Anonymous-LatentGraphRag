"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAutoPlay } from "../useAutoPlay";
import DemoControls from "./DemoControls";
import { jointTag } from "./jointTag";

/**
 * Full expansion: at every hop, every state branches into top-`b` children, with no
 * pruning. The animation grows the full b-ary tree level by level — emphasizing that
 * the population at depth t is exactly b^t.
 */
type Mode = "documents" | "memories" | "joint";

const COLORS = {
  documents: { fill: "#3b82f6", stroke: "#93c5fd", line: "#3b82f6", label: "docs" },
  memories: { fill: "#22c55e", stroke: "#86efac", line: "#22c55e", label: "memories" },
  joint: { fill: "#6366f1", stroke: "#a5b4fc", line: "#6366f1", label: "docs ∪ memories" },
};

export default function FullExpansionDemo({
  mode = "documents",
  branching = 3,
  maxHops = 4,
  width = 480,
  height = 360,
}: {
  mode?: Mode;
  branching?: number;
  maxHops?: number;
  width?: number;
  height?: number;
}) {
  const { step, paused, toggle, replay } = useAutoPlay({ maxStep: maxHops });
  const c = COLORS[mode];

  type Node = { id: string; depth: number; x: number; y: number; tag?: "doc" | "mem" };
  const { nodes, edges } = useMemo(() => {
    const vPad = 30;
    const hPad = 14;
    const usableHeight = height - vPad * 2;
    const usableWidth = width - hPad * 2;
    const levelHeight = usableHeight / maxHops;
    const nodes: Node[] = [];
    const edges: { from: string; to: string }[] = [];

    nodes.push({ id: "Q", depth: 0, x: width / 2, y: vPad });

    type Frame = { id: string; depth: number; x: number };
    let frontier: Frame[] = [{ id: "Q", depth: 0, x: width / 2 }];
    for (let d = 1; d <= maxHops; d++) {
      const total = Math.pow(branching, d);
      const spacing = usableWidth / total;
      const next: Frame[] = [];
      let idx = 0;
      for (const f of frontier) {
        for (let cIdx = 0; cIdx < branching; cIdx++) {
          const absoluteIndex = idx;
          const xCenter = hPad + spacing * (absoluteIndex + 0.5);
          const childId = `${d}.${absoluteIndex}`;
          const y = vPad + d * levelHeight;
          // In joint mode the merged index returns documents OR memories — and we
          // don't control the mix. Assign the type pseudo-randomly (stable per node).
          const tag: "doc" | "mem" | undefined =
            mode === "joint" ? jointTag(childId) : undefined;
          nodes.push({ id: childId, depth: d, x: xCenter, y, tag });
          edges.push({ from: f.id, to: childId });
          next.push({ id: childId, depth: d, x: xCenter });
          idx++;
        }
      }
      frontier = next;
    }
    return { nodes, edges };
  }, [branching, maxHops, width, height, mode]);

  return (
    <div className="w-full">
      <div className="aspect-[5/4] w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {edges.map((e) => {
            const f = nodes.find((n) => n.id === e.from)!;
            const t = nodes.find((n) => n.id === e.to)!;
            if (t.depth > step) return null;
            return (
              <motion.line
                key={`${e.from}-${e.to}`}
                x1={f.x}
                y1={f.y}
                x2={t.x}
                y2={t.y}
                stroke={c.line}
                strokeWidth={1.2}
                strokeOpacity={0.5}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ duration: 0.4, delay: t.depth * 0.05 }}
              />
            );
          })}
          {nodes.map((n) => {
            if (n.depth > step) return null;
            const isRoot = n.id === "Q";
            const r = isRoot ? 11 : Math.max(3, 8 - n.depth * 0.6);
            // In joint mode each node carries a D/M tag with its substrate color.
            const isMem = n.tag === "mem";
            const nodeFill = isRoot
              ? "#1e293b"
              : mode === "joint"
                ? isMem
                  ? "#22c55e"
                  : "#3b82f6"
                : c.fill;
            const nodeStroke = isRoot
              ? "#475569"
              : mode === "joint"
                ? isMem
                  ? "#86efac"
                  : "#93c5fd"
                : c.stroke;
            return (
              <motion.g
                key={n.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: n.depth * 0.1 }}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill={nodeFill}
                  stroke={nodeStroke}
                  strokeWidth={1.5}
                />
                {mode === "joint" && !isRoot && r >= 6 ? (
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
          {[...Array(maxHops + 1)].map((_, d) => (
            <text
              key={d}
              x={width - 6}
              y={30 + d * ((height - 60) / maxHops)}
              textAnchor="end"
              fontSize={9}
              fill={d <= step ? c.line : "#cbd5e1"}
              fontFamily="ui-monospace,monospace"
            >
              {d === 0 ? "1" : `${Math.pow(branching, d)}`}
            </text>
          ))}
        </svg>
      </div>
      <DemoControls
        paused={paused}
        step={step}
        maxStep={maxHops}
        onPlayPause={toggle}
        onReplay={replay}
        rightSide={
          <span className="font-mono text-gray-500">
            index: <span style={{ color: c.line }} className="font-semibold">{c.label}</span>
            {" · "}states: <span style={{ color: c.line }} className="font-semibold">{Math.pow(branching, step)}</span>
          </span>
        }
      />
      <p className="text-[11px] text-gray-500 mt-2 px-2">
        Every state branches into top-{branching} at every hop over the{" "}
        <span style={{ color: c.line }} className="font-semibold">{c.label}</span> index.
        After {maxHops} hops: {Math.pow(branching, maxHops)} paths.
      </p>
    </div>
  );
}
