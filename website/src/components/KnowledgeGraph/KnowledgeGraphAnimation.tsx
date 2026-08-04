"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

// KG nodes - de-emphasized, just endpoints
const KG_NODES = [
  { id: "einstein", label: "Einstein", x: 60, y: 45 },
  { id: "ulm", label: "Ulm", x: 170, y: 30 },
  { id: "germany", label: "Germany", x: 260, y: 90 },
  { id: "physics", label: "Physics", x: 45, y: 130 },
  { id: "nobel", label: "Nobel", x: 170, y: 150 },
  { id: "1879", label: "1879", x: 120, y: 90 },
];

// KG edges = THE KNOWLEDGE
const KG_EDGES = [
  { id: 0, from: "einstein", to: "ulm", label: "born in", triplet: "(Einstein, born_in, Ulm)", memory: "Einstein was born in Ulm." },
  { id: 1, from: "ulm", to: "germany", label: "located in", triplet: "(Ulm, located_in, Germany)", memory: "Ulm is located in Germany." },
  { id: 2, from: "einstein", to: "physics", label: "field", triplet: "(Einstein, field, Physics)", memory: "Einstein worked in Physics." },
  { id: 3, from: "einstein", to: "nobel", label: "awarded", triplet: "(Einstein, awarded, Nobel)", memory: "Einstein won the Nobel Prize." },
  { id: 4, from: "einstein", to: "1879", label: "born", triplet: "(Einstein, born, 1879)", memory: "Einstein was born in 1879." },
];

type Phase =
  | "idle"
  | "show-graph"
  | "highlight-edges"
  | "edges-detach"
  | "edges-expand"
  | "llm-verbalize"
  | "memories-form"
  | "complete";

export default function KnowledgeGraphAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-10%" });
  const [phase, setPhase] = useState<Phase>("idle");
  const [highlightedEdge, setHighlightedEdge] = useState(-1);
  const [detachedEdges, setDetachedEdges] = useState<number[]>([]);
  const [expandedTriplets, setExpandedTriplets] = useState<number[]>([]);
  const [verbalizedMemories, setVerbalizedMemories] = useState<number[]>([]);
  const [animationKey, setAnimationKey] = useState(0);

  const resetAnimation = () => {
    setPhase("idle");
    setHighlightedEdge(-1);
    setDetachedEdges([]);
    setExpandedTriplets([]);
    setVerbalizedMemories([]);
    setAnimationKey((k) => k + 1);
  };

  useEffect(() => {
    if (!isInView && animationKey === 0) return;

    const timers: NodeJS.Timeout[] = [];
    let t = 0;

    // Phase 1: Show graph
    timers.push(setTimeout(() => setPhase("show-graph"), (t += 300)));

    // Phase 2: Highlight edges one by one
    timers.push(setTimeout(() => setPhase("highlight-edges"), (t += 1000)));
    KG_EDGES.forEach((_, i) => {
      timers.push(setTimeout(() => setHighlightedEdge(i), t + i * 400));
    });
    t += KG_EDGES.length * 400 + 200;

    // Phase 3: Edges detach
    timers.push(setTimeout(() => setPhase("edges-detach"), (t += 300)));
    KG_EDGES.forEach((_, i) => {
      timers.push(setTimeout(() => setDetachedEdges((prev) => [...prev, i]), t + i * 300));
    });
    t += KG_EDGES.length * 300 + 200;

    // Phase 4: Edges expand to triplets
    timers.push(setTimeout(() => setPhase("edges-expand"), (t += 300)));
    KG_EDGES.forEach((_, i) => {
      timers.push(setTimeout(() => setExpandedTriplets((prev) => [...prev, i]), t + i * 250));
    });
    t += KG_EDGES.length * 250 + 300;

    // Phase 5: LLM verbalization
    timers.push(setTimeout(() => setPhase("llm-verbalize"), (t += 200)));

    // Phase 6: Memories form
    timers.push(setTimeout(() => setPhase("memories-form"), (t += 1000)));
    KG_EDGES.forEach((_, i) => {
      timers.push(setTimeout(() => setVerbalizedMemories((prev) => [...prev, i]), t + i * 200));
    });
    t += KG_EDGES.length * 200 + 300;

    // Complete
    timers.push(setTimeout(() => setPhase("complete"), (t += 200)));

    return () => timers.forEach(clearTimeout);
  }, [isInView, animationKey]);

  const getEdgePos = (edge: typeof KG_EDGES[0]) => {
    const from = KG_NODES.find((n) => n.id === edge.from)!;
    const to = KG_NODES.find((n) => n.id === edge.to)!;
    return {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      midX: (from.x + to.x) / 2,
      midY: (from.y + to.y) / 2,
    };
  };

  const isEdgeHighlighted = (i: number) => phase === "highlight-edges" && highlightedEdge >= i;
  const isEdgeDetached = (i: number) => detachedEdges.includes(i);
  const isTripletExpanded = (i: number) => expandedTriplets.includes(i);
  const isMemoryFormed = (i: number) => verbalizedMemories.includes(i);

  return (
    <section ref={containerRef} className="py-12 px-4 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
            How to Incorporate Knowledge Graphs?
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-sm">
            The <span className="font-semibold text-green-600">edges</span> of a knowledge graph
            carry the knowledge: nodes are just endpoints. We extract edges as triplets,
            verbalize them into natural language, and add them to the index as searchable memories.
          </p>
        </motion.div>

        {/* Main animation area */}
        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 items-start min-h-[320px]">

          {/* LEFT: Knowledge Graph — nodes de-emphasized, edges highlighted */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-gray-50 rounded-2xl border border-gray-200 p-4 relative"
          >
            <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              Knowledge Graph
            </h3>
            <p className="text-[10px] text-gray-500 mb-2">
              Nodes are just labels. <span className="font-semibold text-green-600">Edges carry the knowledge.</span>
            </p>

            <svg viewBox="0 0 300 180" className="w-full" style={{ minHeight: 160 }}>
              {/* EDGES — the star of the show */}
              {KG_EDGES.map((edge, i) => {
                const pos = getEdgePos(edge);
                const highlighted = isEdgeHighlighted(i);
                const detached = isEdgeDetached(i);

                return (
                  <motion.g key={edge.id}>
                    {/* Edge line */}
                    <motion.line
                      x1={pos.x1}
                      y1={pos.y1}
                      x2={pos.x2}
                      y2={pos.y2}
                      stroke="#22c55e"
                      initial={{ strokeWidth: 2, opacity: 0 }}
                      animate={{
                        strokeWidth: highlighted && !detached ? 4 : 2,
                        opacity: detached ? 0.15 : phase === "idle" ? 0 : highlighted ? 1 : 0.5,
                      }}
                      transition={{ duration: 0.3 }}
                    />

                    {/* Edge label badge — this is the knowledge! */}
                    {!detached && (
                      <motion.g
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{
                          opacity: phase === "idle" ? 0 : 1,
                          scale: highlighted ? 1.15 : 1,
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        <rect
                          x={pos.midX - 25}
                          y={pos.midY - 8}
                          width={50}
                          height={16}
                          rx={4}
                          fill={highlighted ? "#22c55e" : "#e5e7eb"}
                        />
                        <text
                          x={pos.midX}
                          y={pos.midY + 4}
                          textAnchor="middle"
                          fill={highlighted ? "white" : "#6b7280"}
                          fontSize={7}
                          fontWeight={highlighted ? 700 : 500}
                        >
                          {edge.label}
                        </text>
                      </motion.g>
                    )}

                    {/* Glow effect when highlighted */}
                    {highlighted && !detached && (
                      <motion.line
                        x1={pos.x1}
                        y1={pos.y1}
                        x2={pos.x2}
                        y2={pos.y2}
                        stroke="#86efac"
                        strokeWidth={8}
                        opacity={0.4}
                        animate={{ opacity: [0.2, 0.5, 0.2] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    )}
                  </motion.g>
                );
              })}

              {/* NODES — de-emphasized, just small dots with labels */}
              {KG_NODES.map((node) => (
                <motion.g key={node.id}>
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={12}
                    fill="#d1d5db"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: phase === "idle" ? 0 : 0.6 }}
                    transition={{ duration: 0.3 }}
                  />
                  <text
                    x={node.x}
                    y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#6b7280"
                    fontSize={7}
                    fontWeight={500}
                  >
                    {node.label}
                  </text>
                </motion.g>
              ))}
            </svg>

            {/* Visual indicator: edges are flying out */}
            <AnimatePresence>
              {phase === "edges-detach" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-2 left-2 right-2 text-center"
                >
                  <span className="text-[10px] text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                    Extracting edges...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Floating edge badges that fly to middle column */}
          <div className="hidden lg:block absolute inset-0 pointer-events-none z-20">
            <AnimatePresence>
              {KG_EDGES.map((edge, i) => {
                if (!isEdgeDetached(i) || isTripletExpanded(i)) return null;
                const pos = getEdgePos(edge);

                // Start from KG position, fly to middle column
                const startX = 16 + pos.midX * 0.95;
                const startY = 70 + pos.midY * 0.85;
                const endX = 380;
                const endY = 95 + i * 42;

                return (
                  <motion.div
                    key={`flying-${i}`}
                    className="absolute"
                    initial={{ left: startX, top: startY, scale: 1 }}
                    animate={{ left: endX, top: endY, scale: 1.1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <div className="bg-green-500 text-white text-[9px] px-3 py-1.5 rounded-lg shadow-lg font-medium whitespace-nowrap">
                      {edge.label}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* MIDDLE: Edge → Triplet expansion */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-gray-50 rounded-2xl border border-gray-200 p-4 relative"
          >
            <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              Edge → Triplet
            </h3>
            <p className="text-[10px] text-gray-500 mb-3">
              Each edge expands to a (subject, relation, object) triplet.
            </p>

            <div className="relative h-[200px] overflow-hidden">
              <div className="space-y-2">
                {KG_EDGES.map((edge, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{
                      opacity: isTripletExpanded(i) ? 1 : 0,
                      x: isTripletExpanded(i) ? 0 : -20,
                    }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2"
                  >
                    <div className="bg-green-500 text-white text-[8px] px-2 py-1 rounded font-medium shrink-0">
                      {edge.label}
                    </div>
                    <span className="text-gray-400">→</span>
                    <div className="bg-white border border-amber-200 rounded px-2 py-1 text-[10px] font-mono text-amber-700 flex-1">
                      {edge.triplet}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Waiting state — absolute overlay so it never changes the container height */}
              <AnimatePresence>
                {expandedTriplets.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs"
                  >
                    {phase === "edges-detach" ? (
                      <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}>
                        Receiving edges...
                      </motion.span>
                    ) : (
                      <span>Awaiting edge extraction...</span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* LLM indicator */}
            <AnimatePresence>
              {phase === "llm-verbalize" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-3 left-3 right-3 bg-purple-100 rounded-lg p-2 border border-purple-200 flex items-center gap-2"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"
                  />
                  <span className="text-[10px] text-purple-700 font-medium">LLM verbalizing triplets...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* RIGHT: Verbalized Memories */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="bg-green-50 rounded-2xl border border-green-200 p-4"
          >
            <h3 className="text-sm font-bold text-green-700 mb-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              Verbalized Memories
            </h3>
            <p className="text-[10px] text-gray-500 mb-3">
              Natural language sentences for GritHopper retrieval.
            </p>

            <div className="relative h-[200px] overflow-hidden">
              <div className="space-y-2">
                {KG_EDGES.map((edge, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{
                      opacity: isMemoryFormed(i) ? 1 : 0,
                      scale: isMemoryFormed(i) ? 1 : 0.9,
                      x: isMemoryFormed(i) ? 0 : 20,
                    }}
                    transition={{ duration: 0.3, type: "spring" }}
                    className="bg-white border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800"
                  >
                    {edge.memory}
                  </motion.div>
                ))}
              </div>

              {/* Waiting state — absolute overlay so container height stays fixed */}
              <AnimatePresence>
                {verbalizedMemories.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center text-green-400 text-xs"
                  >
                    {phase === "llm-verbalize" ? (
                      <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}>
                        Processing...
                      </motion.span>
                    ) : (
                      <span>Awaiting verbalization...</span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Progress steps + Replay button */}
        <div className="flex justify-center items-center mt-6 gap-2 flex-wrap">
          {[
            { label: "Graph", phases: ["show-graph"] },
            { label: "Highlight Edges", phases: ["highlight-edges"] },
            { label: "Extract", phases: ["edges-detach", "edges-expand"] },
            { label: "Verbalize", phases: ["llm-verbalize"] },
            { label: "Memories", phases: ["memories-form", "complete"] },
          ].map((step, i, arr) => {
            const isActive = step.phases.includes(phase);
            const isComplete = arr.findIndex((s) => s.phases.includes(phase)) > i;

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
                {i < arr.length - 1 && <span className="text-gray-300 mx-2">→</span>}
              </div>
            );
          })}

          {/* Replay button */}
          {phase === "complete" && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={resetAnimation}
              className="ml-4 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg text-xs flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Replay
            </motion.button>
          )}
        </div>

        {/* Transition text */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-8 bg-blue-50 rounded-xl p-4 max-w-2xl mx-auto"
        >
          <p className="text-sm text-blue-800">
            <span className="font-bold">Two indices, one retrieval system:</span> the document
            index preserves all original context, while the memory index adds structured,
            relation-level signals. Running tree search over both and combining their scores
            is what the next section shows.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
