"use client";

import { motion } from "framer-motion";
import { useAutoPlay } from "../useAutoPlay";
import DemoControls from "./DemoControls";

/**
 * Reciprocal Rank Fusion: two ranked lists (doc view, memory view) collapse into one
 * fused list by summing 1/(k + rank) contributions from each side.
 */
const DOC_LIST = [
  { id: "d3", label: "doc-3" },
  { id: "d1", label: "doc-1" },
  { id: "d5", label: "doc-5" },
  { id: "d2", label: "doc-2" },
];
const MEM_LIST_PROJECTED = [
  { id: "d1", label: "doc-1" },
  { id: "d3", label: "doc-3" },
  { id: "d7", label: "doc-7" },
  { id: "d5", label: "doc-5" },
];
const RRF_K = 60;

function fuse(): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  DOC_LIST.forEach((d, i) => scores.set(d.id, (scores.get(d.id) ?? 0) + 1 / (RRF_K + i + 1)));
  MEM_LIST_PROJECTED.forEach((d, i) => scores.set(d.id, (scores.get(d.id) ?? 0) + 1 / (RRF_K + i + 1)));
  return [...scores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}

export default function RRFFusionDemo() {
  // 3 phases: 0 = show lists, 1 = animate flow, 2 = show fused.
  const { step, paused, toggle, replay } = useAutoPlay({ maxStep: 2, intervalMs: 1500, pauseAtEndMs: 2000 });
  const fused = fuse();

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-3 p-4">
        {/* Doc list */}
        <div>
          <p className="text-[10px] font-semibold text-blue-700 mb-2 text-center">Doc-view ranking</p>
          <ol className="space-y-1.5">
            {DOC_LIST.map((d, i) => (
              <motion.li
                key={d.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 px-2 py-1 bg-blue-50 border border-blue-100 rounded text-[11px]"
              >
                <span className="font-mono text-blue-700 font-semibold w-4">{i + 1}</span>
                <span className="font-mono text-gray-800">{d.label}</span>
              </motion.li>
            ))}
          </ol>
        </div>
        {/* Mem list (projected to docs) */}
        <div>
          <p className="text-[10px] font-semibold text-green-700 mb-2 text-center">Memory-view ranking (projected)</p>
          <ol className="space-y-1.5">
            {MEM_LIST_PROJECTED.map((d, i) => (
              <motion.li
                key={d.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 px-2 py-1 bg-green-50 border border-green-100 rounded text-[11px]"
              >
                <span className="font-mono text-green-700 font-semibold w-4">{i + 1}</span>
                <span className="font-mono text-gray-800">{d.label}</span>
              </motion.li>
            ))}
          </ol>
        </div>
        {/* Fused */}
        <div>
          <p className="text-[10px] font-semibold text-amber-700 mb-2 text-center">Fused (RRF)</p>
          <ol className="space-y-1.5">
            {step >= 1 &&
              fused.slice(0, 4).map((f, i) => {
                const inDoc = DOC_LIST.find((d) => d.id === f.id);
                const inMem = MEM_LIST_PROJECTED.find((d) => d.id === f.id);
                const both = inDoc && inMem;
                return (
                  <motion.li
                    key={f.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.15 }}
                    className={`flex items-center justify-between gap-2 px-2 py-1 rounded border text-[11px] ${
                      both
                        ? "bg-amber-50 border-amber-300"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-amber-700 font-semibold w-4">{i + 1}</span>
                      <span className="font-mono text-gray-800">{f.id}</span>
                    </span>
                    <span className="font-mono text-[9px] text-gray-500">{f.score.toFixed(4)}</span>
                  </motion.li>
                );
              })}
          </ol>
        </div>
      </div>
      <div className="text-center text-[11px] text-gray-600 font-mono mt-1">
        score(d) = Σ <span className="text-blue-600">1/(k + rank<sub>D</sub>(d))</span> + Σ <span className="text-green-600">1/(k + rank<sub>M</sub>(d))</span> &nbsp;&nbsp;(k={RRF_K})
      </div>
      <DemoControls
        paused={paused}
        step={step}
        maxStep={2}
        onPlayPause={toggle}
        onReplay={replay}
        stepLabel={(s) => (s === 0 ? "two rankings" : s === 1 ? "fusing…" : "merged")}
      />
      <p className="text-[11px] text-gray-500 mt-2 px-2">
        Reciprocal Rank Fusion ignores raw scores and uses positions. Documents in both lists get summed contributions and rise to the top.
      </p>
    </div>
  );
}
