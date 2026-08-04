"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAutoPlay } from "../useAutoPlay";
import DemoControls from "./DemoControls";
import { jointTag, DOC_COLOR, MEM_COLOR } from "./jointTag";

/**
 * BeamDR: at every hop, expand the current beam by `branch_per_state`, then keep only
 * the top-B paths. Pruned states fade out instead of disappearing — the viewer
 * sees that BeamDR is a window onto the same latent graph that full_expansion explores
 * exhaustively.
 */
type Mode = "documents" | "memories" | "joint";

const COLORS: Record<Mode, { fill: string; stroke: string; line: string; label: string }> = {
  documents: { fill: "#3b82f6", stroke: "#93c5fd", line: "#3b82f6", label: "docs" },
  memories: { fill: "#22c55e", stroke: "#86efac", line: "#22c55e", label: "memories" },
  joint: { fill: "#6366f1", stroke: "#a5b4fc", line: "#6366f1", label: "docs ∪ memories" },
};

export default function BeamDRDemo({
  mode = "documents",
  beamWidth = 4,
  branchPerState = 2,
  maxHops = 4,
  width = 480,
  height = 360,
}: {
  mode?: Mode;
  beamWidth?: number;
  branchPerState?: number;
  maxHops?: number;
  width?: number;
  height?: number;
}) {
  const { step, paused, toggle, replay } = useAutoPlay({ maxStep: maxHops });
  const c = COLORS[mode];

  type Node = { id: string; depth: number; x: number; y: number; inBeam: boolean; rank: number; tag?: "doc" | "mem" };
  const { nodes, edges } = useMemo(() => {
    const vPad = 28;
    const hPad = 14;
    const usableHeight = height - vPad * 2;
    const usableWidth = width - hPad * 2;
    const levelHeight = usableHeight / maxHops;
    const nodes: Node[] = [];
    const edges: { from: string; to: string; inBeam: boolean }[] = [];

    nodes.push({ id: "Q", depth: 0, x: width / 2, y: vPad, inBeam: true, rank: 0 });

    type Frame = { id: string; x: number };
    let frontier: Frame[] = [{ id: "Q", x: width / 2 }];
    for (let d = 1; d <= maxHops; d++) {
      // Frontier has at most `beamWidth` items.
      const candidates: { id: string; parent: string; parentX: number; rank: number }[] = [];
      let rankCounter = 0;
      for (const f of frontier) {
        for (let c = 0; c < branchPerState; c++) {
          candidates.push({
            id: `${d}.${rankCounter}`,
            parent: f.id,
            parentX: f.x,
            rank: rankCounter,
          });
          rankCounter++;
        }
      }
      // Spread on x by rank.
      const spacing = usableWidth / Math.max(candidates.length, 1);
      candidates.forEach((c, i) => {
        const x = hPad + spacing * (i + 0.5);
        const y = vPad + d * levelHeight;
        const inBeam = c.rank < beamWidth; // top-`beamWidth` survive
        // Joint index: each candidate is a document OR a memory (random mix).
        const tag = mode === "joint" ? jointTag(c.id) : undefined;
        nodes.push({ id: c.id, depth: d, x, y, inBeam, rank: c.rank, tag });
        edges.push({ from: c.parent, to: c.id, inBeam });
      });
      frontier = candidates
        .filter((c) => c.rank < beamWidth)
        .map((c, i) => {
          const x = hPad + spacing * (c.rank + 0.5);
          return { id: c.id, x };
        });
    }
    return { nodes, edges };
  }, [beamWidth, branchPerState, maxHops, width, height, mode]);

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
                stroke={e.inBeam ? c.line : "#cbd5e1"}
                strokeWidth={e.inBeam ? 1.8 : 1}
                strokeOpacity={e.inBeam ? 1 : 0.35}
                initial={{ opacity: 0 }}
                animate={{ opacity: e.inBeam ? 1 : 0.35 }}
                transition={{ duration: 0.4 }}
              />
            );
          })}
          {nodes.map((n) => {
            if (n.depth > step) return null;
            const isRoot = n.id === "Q";
            const r = isRoot ? 11 : n.inBeam ? 8 : 5;
            // Joint mode: in-beam nodes carry their substrate (doc=blue / mem=green).
            const isMem = n.tag === "mem";
            const fill = isRoot
              ? "#1e293b"
              : !n.inBeam
                ? "#cbd5e1"
                : mode === "joint"
                  ? isMem ? MEM_COLOR.fill : DOC_COLOR.fill
                  : c.fill;
            const stroke = isRoot
              ? "#475569"
              : !n.inBeam
                ? "#e5e7eb"
                : mode === "joint"
                  ? isMem ? MEM_COLOR.stroke : DOC_COLOR.stroke
                  : c.stroke;
            return (
              <motion.g
                key={n.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: n.inBeam ? 1 : 0.45, scale: 1 }}
                transition={{ delay: n.depth * 0.1 }}
              >
                <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
                {mode === "joint" && n.inBeam && !isRoot ? (
                  <text
                    x={n.x}
                    y={n.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={8}
                    fontWeight={600}
                    fill="#fff"
                  >
                    {isMem ? "M" : "D"}
                  </text>
                ) : null}
              </motion.g>
            );
          })}
          <text
            x={width - 6}
            y={20}
            textAnchor="end"
            fontSize={10}
            fontWeight={600}
            fill={c.line}
            fontFamily="ui-monospace,monospace"
          >
            B = {beamWidth}
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
          <span className="font-mono text-gray-500">
            index: <span style={{ color: c.line }} className="font-semibold">{c.label}</span>
            {" · "}beam: <span style={{ color: c.line }} className="font-semibold">{step === 0 ? 1 : beamWidth}</span>
          </span>
        }
      />
      <p className="text-[11px] text-gray-500 mt-2 px-2">
        BeamDR over the <span style={{ color: c.line }} className="font-semibold">{c.label}</span> index.
        Pruned states (gray) drop out after each hop; only top-{beamWidth} paths by cumulative score survive.
      </p>
    </div>
  );
}
