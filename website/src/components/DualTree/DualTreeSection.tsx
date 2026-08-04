"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import BranchingTree from "../TreeSearch/BranchingTree";

// Example document results from both trees
const DOC_RESULTS = [
  { id: "D1", title: "Einstein biography", score: 0.92, fromDoc: true, fromMem: true },
  { id: "D2", title: "Ulm city history", score: 0.87, fromDoc: true, fromMem: true },
  { id: "D3", title: "Nobel Prize history", score: 0.81, fromDoc: false, fromMem: true },
  { id: "D4", title: "German geography", score: 0.78, fromDoc: true, fromMem: false },
  { id: "D5", title: "Physics fundamentals", score: 0.74, fromDoc: true, fromMem: true },
];

type Phase = "trees" | "mapping" | "flattening" | "complete";

export default function DualTreeSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-10%" });
  const [phase, setPhase] = useState<Phase>("trees");
  const [treeHop, setTreeHop] = useState(0);
  const [mappingStep, setMappingStep] = useState(0);
  const [flattenStep, setFlattenStep] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const timers: NodeJS.Timeout[] = [];

    // Tree expansion (synced)
    for (let i = 1; i <= 4; i++) {
      timers.push(setTimeout(() => setTreeHop(i), i * 700));
    }

    // After trees complete, show mapping
    timers.push(setTimeout(() => setPhase("mapping"), 4 * 700 + 500));

    // Mapping animation steps
    for (let i = 1; i <= 3; i++) {
      timers.push(setTimeout(() => setMappingStep(i), 4 * 700 + 500 + i * 600));
    }

    // Flattening phase
    timers.push(setTimeout(() => setPhase("flattening"), 4 * 700 + 500 + 3 * 600 + 500));

    // Flatten items one by one
    for (let i = 1; i <= DOC_RESULTS.length; i++) {
      timers.push(setTimeout(() => setFlattenStep(i), 4 * 700 + 500 + 3 * 600 + 500 + i * 300));
    }

    // Complete
    timers.push(setTimeout(() => setPhase("complete"), 4 * 700 + 500 + 3 * 600 + 500 + DOC_RESULTS.length * 300 + 500));

    return () => timers.forEach(clearTimeout);
  }, [isInView]);

  return (
    <section ref={containerRef} className="py-12 px-4 bg-gray-50/50">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
            Dual Tree Search: Documents + Memories
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-sm">
            LatentGraphRAG runs two parallel tree searches — one over documents and one over
            verbalized memory triplets — then maps memory results back to their source documents.
          </p>
        </motion.div>

        {/* Two trees side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left: Document Tree */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl border border-blue-200 p-5"
          >
            <h3 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              Tree Search over Documents
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Branching factor <em>b</em>=3, depth <em>H</em>=4. Blue path = expanding context.
            </p>
            <div className="h-[320px]">
              <BranchingTree
                mode="documents"
                branchingFactor={3}
                maxDepth={4}
                currentHop={treeHop}
                width={450}
                height={320}
              />
            </div>
          </motion.div>

          {/* Right: Memory Tree */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl border border-green-200 p-5"
          >
            <h3 className="text-sm font-bold text-green-700 mb-2 flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              Tree Search over Memories
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Same structure but searches verbalized KG triplets (memories).
            </p>
            <div className="h-[320px]">
              <BranchingTree
                mode="memories"
                branchingFactor={3}
                maxDepth={4}
                currentHop={treeHop}
                width={450}
                height={320}
              />
            </div>
          </motion.div>
        </div>

        {/* Memory-to-Document Mapping Animation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-2xl border border-gray-200 p-6 mb-6"
        >
          <h3 className="text-sm font-bold text-gray-700 mb-4 text-center">
            Memory → Document Mapping
          </h3>

          <div className="flex items-center justify-center gap-8">
            {/* Memory results */}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-green-600 font-medium mb-1 text-center">Memory Results</div>
              {["M₁ (Einstein)", "M₂ (Ulm)", "M₃ (Nobel)"].map((mem, i) => (
                <motion.div
                  key={mem}
                  initial={{ opacity: 0.3 }}
                  animate={{
                    opacity: mappingStep > i || phase === "flattening" || phase === "complete" ? 1 : 0.3,
                    scale: mappingStep === i + 1 ? 1.05 : 1,
                  }}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium ${
                    mappingStep > i || phase === "flattening" || phase === "complete"
                      ? "bg-green-50 border-green-300 text-green-700"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                  }`}
                >
                  {mem}
                </motion.div>
              ))}
            </div>

            {/* Animated arrows */}
            <div className="flex flex-col gap-2 items-center">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{
                    opacity: mappingStep > i || phase === "flattening" || phase === "complete" ? 1 : 0,
                    scaleX: mappingStep > i || phase === "flattening" || phase === "complete" ? 1 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                  className="py-2"
                >
                  <svg width="60" height="24" viewBox="0 0 60 24">
                    <defs>
                      <marker id={`arrowhead-${i}`} markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                        <polygon points="0 0, 6 2, 0 4" fill="#6b7280" />
                      </marker>
                    </defs>
                    <motion.line
                      x1="4"
                      y1="12"
                      x2="50"
                      y2="12"
                      stroke="#6b7280"
                      strokeWidth="2"
                      markerEnd={`url(#arrowhead-${i})`}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: mappingStep > i || phase === "flattening" || phase === "complete" ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </svg>
                </motion.div>
              ))}
            </div>

            {/* Source documents */}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-blue-600 font-medium mb-1 text-center">Source Documents</div>
              {["D₁ (Einstein bio)", "D₂ (Ulm history)", "D₃ (Nobel history)"].map((doc, i) => (
                <motion.div
                  key={doc}
                  initial={{ opacity: 0.3 }}
                  animate={{
                    opacity: mappingStep > i || phase === "flattening" || phase === "complete" ? 1 : 0.3,
                    scale: mappingStep === i + 1 ? 1.05 : 1,
                    backgroundColor: mappingStep === i + 1 ? "#dbeafe" : mappingStep > i || phase === "flattening" || phase === "complete" ? "#eff6ff" : "#f9fafb",
                  }}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium ${
                    mappingStep > i || phase === "flattening" || phase === "complete"
                      ? "border-blue-300 text-blue-700"
                      : "border-gray-200 text-gray-400"
                  }`}
                >
                  {doc}
                </motion.div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Each memory is linked to its source document — memory tree results create a second signal for relevance.
          </p>
        </motion.div>

        {/* Flattening to ranked list */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-2xl border border-gray-200 p-6"
        >
          <h3 className="text-sm font-bold text-gray-700 mb-4 text-center">
            Flattening to a Ranked Document List
          </h3>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-6">
            {/* Two mini tree representations */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center border border-blue-200">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="8" r="4" fill="#3b82f6" />
                    <line x1="20" y1="12" x2="10" y2="22" stroke="#3b82f6" strokeWidth="1.5" />
                    <line x1="20" y1="12" x2="20" y2="22" stroke="#3b82f6" strokeWidth="1.5" />
                    <line x1="20" y1="12" x2="30" y2="22" stroke="#3b82f6" strokeWidth="1.5" />
                    <circle cx="10" cy="24" r="3" fill="#93c5fd" />
                    <circle cx="20" cy="24" r="3" fill="#93c5fd" />
                    <circle cx="30" cy="24" r="3" fill="#93c5fd" />
                    <circle cx="20" cy="34" r="3" fill="#3b82f6" />
                    <line x1="20" y1="27" x2="20" y2="31" stroke="#3b82f6" strokeWidth="1.5" />
                  </svg>
                </div>
                <span className="text-[10px] text-blue-600 font-medium mt-1 block">Doc Tree</span>
              </div>
              <span className="text-gray-400 text-lg">+</span>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center border border-green-200">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="8" r="4" fill="#22c55e" />
                    <line x1="20" y1="12" x2="10" y2="22" stroke="#22c55e" strokeWidth="1.5" />
                    <line x1="20" y1="12" x2="20" y2="22" stroke="#22c55e" strokeWidth="1.5" />
                    <line x1="20" y1="12" x2="30" y2="22" stroke="#22c55e" strokeWidth="1.5" />
                    <circle cx="10" cy="24" r="3" fill="#86efac" />
                    <circle cx="20" cy="24" r="3" fill="#86efac" />
                    <circle cx="30" cy="24" r="3" fill="#86efac" />
                    <circle cx="20" cy="34" r="3" fill="#22c55e" />
                    <line x1="20" y1="27" x2="20" y2="31" stroke="#22c55e" strokeWidth="1.5" />
                  </svg>
                </div>
                <span className="text-[10px] text-green-600 font-medium mt-1 block">Mem Tree</span>
              </div>
            </div>

            {/* Arrow */}
            <motion.div
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <svg width="60" height="24" viewBox="0 0 60 24">
                <path d="M 4 12 L 50 12 M 50 12 L 42 6 M 50 12 L 42 18" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </motion.div>

            {/* Ranked list */}
            <div className="flex flex-col gap-1.5 min-w-[280px]">
              <div className="text-xs text-gray-600 font-medium mb-1">Ranked Document List</div>
              {DOC_RESULTS.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{
                    opacity: flattenStep > i ? 1 : 0.3,
                    x: flattenStep > i ? 0 : -20,
                  }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
                    flattenStep > i
                      ? doc.fromDoc && doc.fromMem
                        ? "bg-purple-50 border-purple-200"
                        : doc.fromDoc
                        ? "bg-blue-50 border-blue-200"
                        : "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <span className="font-mono text-gray-500 w-4">{i + 1}.</span>
                  <span className={`font-medium flex-1 ${flattenStep > i ? "text-gray-700" : "text-gray-400"}`}>
                    {doc.title}
                  </span>
                  <span className={`font-mono text-[10px] ${flattenStep > i ? "text-gray-600" : "text-gray-400"}`}>
                    {doc.score.toFixed(2)}
                  </span>
                  {flattenStep > i && (
                    <div className="flex gap-1">
                      {doc.fromDoc && <span className="w-2 h-2 bg-blue-500 rounded-full" title="From doc tree" />}
                      {doc.fromMem && <span className="w-2 h-2 bg-green-500 rounded-full" title="From memory tree" />}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-gray-500">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Found by doc tree</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Found by memory tree</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-purple-500 rounded-full" />
              <span>Found by both (agreement boost!)</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
