"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAutoPlay } from "../useAutoPlay";
import DemoControls from "./DemoControls";

/**
 * `corpus="joint_index"` — chunks and memories live in the SAME index. Each tree node
 * is either a document (blue) or a memory (green), randomly sampled per hop.
 *
 * Visual signal: one tree, but nodes alternate color according to which substrate
 * each candidate happened to be.
 */
export default function JointIndexDemo({
  branching = 3,
  maxHops = 4,
  width = 460,
  height = 360,
}: {
  branching?: number;
  maxHops?: number;
  width?: number;
  height?: number;
}) {
  const { step, paused, toggle, replay } = useAutoPlay({ maxStep: maxHops });

  // Pre-compute a deterministic doc/memory tag per (depth, branchIdx) so animation is
  // stable across re-renders. Active path is the middle branch (idx 1).
  const labelOf = useMemo(() => {
    const map = new Map<string, "doc" | "mem">();
    for (let d = 1; d <= maxHops; d++) {
      const total = Math.pow(branching, d);
      for (let i = 0; i < total; i++) {
        // hash-ish: alternate but keep middle-of-active-path consistent
        const isActive = i === Math.floor(total / 2);
        const tag: "doc" | "mem" = isActive
          ? d % 2 === 0
            ? "mem"
            : "doc"
          : (i + d) % 3 === 0
            ? "mem"
            : "doc";
        map.set(`${d}.${i}`, tag);
      }
    }
    return map;
  }, [branching, maxHops]);

  type Node = { id: string; depth: number; x: number; y: number; parent: string | null; tag: "doc" | "mem" | "query"; active: boolean };

  const { nodes, edges } = useMemo(() => {
    const vPad = 40;
    const hPad = 20;
    const usableHeight = height - vPad * 2;
    const usableWidth = width - hPad * 2;
    const levelHeight = usableHeight / maxHops;
    const nodes: Node[] = [];
    const edges: { from: string; to: string; active: boolean }[] = [];

    nodes.push({ id: "Q", depth: 0, x: width / 2, y: vPad, parent: null, tag: "query", active: true });

    type Q = { id: string; depth: number; parentX: number; branchIdx: number; parent: string; activeOnPath: boolean };
    const queue: Q[] = [];
    for (let c = 0; c < branching; c++) {
      queue.push({
        id: `1.${c}`,
        depth: 1,
        parentX: width / 2,
        branchIdx: c,
        parent: "Q",
        activeOnPath: c === Math.floor(branching / 2),
      });
    }

    let i = 0;
    while (i < queue.length) {
      const item = queue[i++];
      const { id, depth, parentX, branchIdx, parent, activeOnPath } = item;
      const total = Math.pow(branching, depth);
      const spacing = usableWidth / total;
      const offset = (branchIdx - (branching - 1) / 2) * spacing;
      const x = parentX + offset;
      const y = vPad + depth * levelHeight;
      const tag = labelOf.get(id) ?? "doc";
      nodes.push({ id, depth, x, y, parent, tag, active: activeOnPath });
      edges.push({ from: parent, to: id, active: activeOnPath });

      if (depth < maxHops) {
        for (let c = 0; c < branching; c++) {
          queue.push({
            id: `${depth + 1}.${nodes.filter((n) => n.depth === depth).length * branching + c - branching + c}`,
            depth: depth + 1,
            parentX: x,
            branchIdx: c,
            parent: id,
            activeOnPath: activeOnPath && c === Math.floor(branching / 2),
          });
        }
      }
    }
    return { nodes, edges };
  }, [branching, maxHops, width, height, labelOf]);

  const visibleDepth = step;
  const COLORS = {
    doc: { fill: "#3b82f6", stroke: "#93c5fd" },
    mem: { fill: "#22c55e", stroke: "#86efac" },
    query: { fill: "#1e293b", stroke: "#475569" },
  };

  return (
    <div className="w-full">
      <div className="aspect-[5/4] w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {edges.map((e) => {
            const f = nodes.find((n) => n.id === e.from);
            const t = nodes.find((n) => n.id === e.to);
            if (!f || !t) return null;
            if (t.depth > visibleDepth) return null;
            const isActive = e.active;
            return (
              <motion.line
                key={`${e.from}-${e.to}`}
                x1={f.x}
                y1={f.y}
                x2={t.x}
                y2={t.y}
                stroke={isActive ? "#6366f1" : "#d1d5db"}
                strokeWidth={isActive ? 2.5 : 1}
                strokeOpacity={isActive ? 1 : 0.35}
                initial={{ opacity: 0 }}
                animate={{ opacity: isActive ? 1 : 0.35 }}
                transition={{ duration: 0.4 }}
              />
            );
          })}
          {nodes.map((n) => {
            if (n.depth > visibleDepth) return null;
            const c = COLORS[n.tag];
            const isRoot = n.id === "Q";
            const r = isRoot || n.active ? 11 : 9;
            return (
              <motion.g
                key={n.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: n.depth * 0.12 }}
              >
                <circle cx={n.x} cy={n.y} r={r} fill={c.fill} stroke={c.stroke} strokeWidth={2} />
                <text
                  x={n.x}
                  y={n.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize={isRoot ? 10 : 8}
                  fontWeight={600}
                >
                  {isRoot ? "Q" : n.tag === "doc" ? "D" : "M"}
                </text>
              </motion.g>
            );
          })}
          <text x={width - 12} y={20} textAnchor="end" fontSize={10} fontWeight={600} fill="#6366f1">
            Hop {step} / {maxHops}
          </text>
        </svg>
      </div>
      <DemoControls
        paused={paused}
        step={step}
        maxStep={maxHops}
        onPlayPause={toggle}
        onReplay={replay}
        rightSide={
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>document</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span>memory</span>
            </span>
          </span>
        }
      />
      <p className="text-[11px] text-gray-500 mt-2 px-2">
        Joint index: chunks and memories live together. Each retrieved node is either a document (blue) or a memory (green).
      </p>
    </div>
  );
}
