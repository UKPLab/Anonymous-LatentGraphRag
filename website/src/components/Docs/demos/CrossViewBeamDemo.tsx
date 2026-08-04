"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAutoPlay } from "../useAutoPlay";
import DemoControls from "./DemoControls";

/**
 * Cross-view beam: a single beam queries BOTH the document index and the memory index
 * at every hop. Each beam member is tagged with its source (D / M) so the viewer can
 * see how the beam mixes.
 */
export default function CrossViewBeamDemo({
  beamWidth = 4,
  branchPerState = 2,
  maxHops = 4,
  width = 480,
  height = 360,
}: {
  beamWidth?: number;
  branchPerState?: number;
  maxHops?: number;
  width?: number;
  height?: number;
}) {
  const { step, paused, toggle, replay } = useAutoPlay({ maxStep: maxHops });

  type Node = {
    id: string;
    depth: number;
    x: number;
    y: number;
    tag: "doc" | "mem" | "query";
    inBeam: boolean;
  };

  const { nodes, edges } = useMemo(() => {
    const vPad = 28;
    const hPad = 14;
    const usableHeight = height - vPad * 2;
    const usableWidth = width - hPad * 2;
    const levelHeight = usableHeight / maxHops;
    const nodes: Node[] = [];
    const edges: { from: string; to: string; tag: "doc" | "mem"; inBeam: boolean }[] = [];

    nodes.push({ id: "Q", depth: 0, x: width / 2, y: vPad, tag: "query", inBeam: true });
    type Frame = { id: string; x: number };
    let frontier: Frame[] = [{ id: "Q", x: width / 2 }];

    for (let d = 1; d <= maxHops; d++) {
      // For each frontier state, generate `branchPerState` candidates split between
      // the doc index and the memory index. We sort by a synthetic relevance and keep
      // the top-`beamWidth`.
      const candidates: {
        id: string;
        parent: string;
        rank: number;
        tag: "doc" | "mem";
      }[] = [];
      let r = 0;
      for (const f of frontier) {
        for (let c = 0; c < branchPerState; c++) {
          const tag: "doc" | "mem" = (r + d) % 2 === 0 ? "doc" : "mem";
          candidates.push({ id: `${d}.${r}`, parent: f.id, rank: r, tag });
          r++;
        }
      }
      const spacing = usableWidth / Math.max(candidates.length, 1);
      candidates.forEach((c, i) => {
        const x = hPad + spacing * (i + 0.5);
        const y = vPad + d * levelHeight;
        const inBeam = c.rank < beamWidth;
        nodes.push({ id: c.id, depth: d, x, y, tag: c.tag, inBeam });
        edges.push({ from: c.parent, to: c.id, tag: c.tag, inBeam });
      });
      frontier = candidates
        .filter((c) => c.rank < beamWidth)
        .map((c) => {
          const node = nodes.find((n) => n.id === c.id)!;
          return { id: c.id, x: node.x };
        });
    }
    return { nodes, edges };
  }, [beamWidth, branchPerState, maxHops, width, height]);

  const COLORS = {
    doc: { fill: "#3b82f6", stroke: "#93c5fd", line: "#3b82f6" },
    mem: { fill: "#22c55e", stroke: "#86efac", line: "#22c55e" },
    query: { fill: "#1e293b", stroke: "#475569", line: "#475569" },
  };

  return (
    <div className="w-full">
      <div className="aspect-[5/4] w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {edges.map((e) => {
            const f = nodes.find((n) => n.id === e.from)!;
            const t = nodes.find((n) => n.id === e.to)!;
            if (t.depth > step) return null;
            const c = COLORS[e.tag];
            return (
              <motion.line
                key={`${e.from}-${e.to}`}
                x1={f.x}
                y1={f.y}
                x2={t.x}
                y2={t.y}
                stroke={e.inBeam ? c.line : "#cbd5e1"}
                strokeWidth={e.inBeam ? 1.8 : 1}
                strokeOpacity={e.inBeam ? 1 : 0.3}
                strokeDasharray={e.tag === "mem" ? "3 2" : undefined}
                initial={{ opacity: 0 }}
                animate={{ opacity: e.inBeam ? 1 : 0.3 }}
                transition={{ duration: 0.4 }}
              />
            );
          })}
          {nodes.map((n) => {
            if (n.depth > step) return null;
            const c = COLORS[n.tag];
            const isRoot = n.id === "Q";
            const r = isRoot ? 11 : n.inBeam ? 9 : 5;
            return (
              <motion.g
                key={n.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: n.inBeam ? 1 : 0.4, scale: 1 }}
                transition={{ delay: n.depth * 0.1 }}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={1.5}
                />
                {n.inBeam && !isRoot ? (
                  <text
                    x={n.x}
                    y={n.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={8}
                    fontWeight={600}
                    fill="#fff"
                  >
                    {n.tag === "doc" ? "D" : "M"}
                  </text>
                ) : null}
              </motion.g>
            );
          })}
        </svg>
      </div>
      <DemoControls
        paused={paused}
        step={step}
        maxStep={maxHops}
        onPlayPause={toggle}
        onReplay={replay}
        rightSide={
          <span className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>doc index</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>mem index</span>
            </span>
          </span>
        }
      />
      <p className="text-[11px] text-gray-500 mt-2 px-2">
        Single beam, two indices. Each beam member can come from either substrate.
      </p>
    </div>
  );
}
