"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import VectorCloud from "../Animation/VectorCloud";
import GritHopperBlock from "../Animation/GritHopperBlock";
import ContextBadges from "../Animation/ContextBadges";
import BranchingTree from "../TreeSearch/BranchingTree";
import LatentGraphSimilarityPanel from "../Animation/LatentGraphSimilarityPanel";
import { useAnimationPhase } from "@/hooks/useAnimationPhase";

const HOP_TARGETS = [
  { x: 0.3, y: 0.45 },
  { x: 0.65, y: 0.55 },
  { x: 0.4, y: 0.7 },
  { x: 0.7, y: 0.35 },
];

export default function DecompositionFreeSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { margin: "-5% 0px -5% 0px" });
  const [isPlaying, setIsPlaying] = useState(false);
  const [cloudDimensions, setCloudDimensions] = useState({ width: 500, height: 220 });

  const { currentHop, phase, progress, isComplete, reset } = useAnimationPhase(
    isPlaying,
    4
  );

  useEffect(() => {
    if (cloudRef.current) {
      const rect = cloudRef.current.getBoundingClientRect();
      setCloudDimensions({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    if (isInView && !isPlaying && !isComplete) {
      const timer = setTimeout(() => setIsPlaying(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isInView, isPlaying, isComplete]);

  const visibleDocs = Math.min(currentHop + (phase === "context-updating" && currentHop < 3 ? 1 : 0), 3);

  const handleReplay = () => {
    reset();
    setTimeout(() => setIsPlaying(true), 150);
  };

  const showInputToModel = phase === "processing";
  const showVectorOutput = phase === "vector-traveling" || phase === "cloud-searching";
  const showDocumentReturn = phase === "document-returning" && currentHop < 3;

  const currentTarget = HOP_TARGETS[currentHop % 4];
  const docStartX = currentTarget.x * cloudDimensions.width;
  const docStartY = currentTarget.y * cloudDimensions.height;

  const tensorValues = [
    [0.8, 0.3, 0.9, 0.2, 0.7, 0.5, 0.4, 0.6, 0.85, 0.35, 0.65, 0.45],
    [0.6, 0.7, 0.4, 0.8, 0.3, 0.9, 0.5, 0.2, 0.75, 0.55, 0.25, 0.95],
    [0.4, 0.5, 0.7, 0.6, 0.8, 0.3, 0.9, 0.4, 0.65, 0.85, 0.45, 0.35],
    [0.9, 0.4, 0.5, 0.7, 0.2, 0.8, 0.6, 0.3, 0.55, 0.75, 0.95, 0.25],
  ];
  const currentTensor = tensorValues[currentHop % 4];

  return (
    <section ref={containerRef} className="py-6 px-4 md:px-6 lg:px-8 bg-gray-50/50">
      <div className="max-w-7xl mx-auto">
        {/* Transition from problem */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-4 max-w-3xl mx-auto"
        >
          <p className="text-sm text-gray-600 bg-blue-50 rounded-lg p-3 border border-blue-100">
            <span className="font-semibold text-blue-700">LatentGraphRAG builds on GRITHopper</span>{" "}
            <span className="text-gray-500">(Erker et al., 2026)</span>, the current
            state-of-the-art model for multi-hop dense retrieval, which iteratively refines
            a context-aware query representation without decomposing the question.
          </p>
        </motion.div>

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
            Multi-Hop Dense Retrieval with GRITHopper
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-xs md:text-sm">
            At each hop, GRITHopper jointly encodes the query with all retrieved documents so far
            into a single context-aware dense vector. This vector is used to search the entire
            index via dot-product, retrieving the next most relevant document.
            Over multiple hops, this naturally forms a <em>tree of retrieval paths</em> over
            documents, which LatentGraphRAG then extends to knowledge graph memories as well.
          </p>
        </motion.div>

        {/* Two columns: Animation (left) + Branching Tree (right) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* LEFT: GritHopper Animation */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              Recursive Retrieval Loop
            </h3>

            {/* Row 1: Context + Arrow + GritHopper */}
            <div className="grid grid-cols-[150px_auto_1fr] gap-4 items-start mb-4">
              <div>
                <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mb-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">1</div>
                  <span>{currentHop === 0 ? "Input" : "Expanding Context"}</span>
                </div>
                <ContextBadges currentHop={visibleDocs} isComplete={isComplete} maxDocs={3} />
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center justify-center pt-10">
                <div className="relative h-8">
                  <AnimatePresence>
                    {showInputToModel && (
                      <>
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={`flow-${i}`}
                            initial={{ opacity: 0, x: -15, scale: 1 }}
                            animate={{
                              opacity: [0, 1, 1, 0],
                              x: [-15, 0, 20, 40],
                              scale: [1, 0.7, 0.4, 0.2],
                            }}
                            transition={{
                              duration: 0.7,
                              delay: i * 0.15,
                              repeat: Infinity,
                              repeatDelay: 0.2,
                            }}
                            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-400 rounded-sm"
                          />
                        ))}
                      </>
                    )}
                  </AnimatePresence>
                  <svg className="w-12 h-6 text-blue-400" viewBox="0 0 48 24" fill="none" stroke="currentColor">
                    <path d="M 4 12 L 38 12 M 38 12 L 30 6 M 38 12 L 30 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[10px] text-gray-400 mt-1">encode</span>
              </div>

              {/* GritHopper Block */}
              <div>
                <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mb-2">
                  <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">2</div>
                  Encoding
                </div>
                <GritHopperBlock phase={phase} progress={progress} />

                {/* Tensor visualization */}
                <div className="mt-3 flex flex-col items-center h-[70px]">
                  <div className="flex flex-col items-center min-h-[45px]">
                    <AnimatePresence>
                      {(showVectorOutput || phase === "processing") && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: phase === "processing" ? progress * 0.7 : 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center"
                        >
                          <div className="flex gap-0.5 mb-1">
                            {currentTensor.map((val, i) => (
                              <motion.div
                                key={i}
                                initial={{ scaleY: 0 }}
                                animate={{ scaleY: 1 }}
                                transition={{ delay: i * 0.03 }}
                                className="w-2 rounded-sm"
                                style={{
                                  height: `${12 + val * 16}px`,
                                  backgroundColor: `hsl(${220 + val * 60}, 75%, ${45 + val * 20}%)`,
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-[9px] text-gray-400">Dense Vector</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <motion.div
                    animate={{ opacity: showVectorOutput ? 1 : 0.3 }}
                    className="text-indigo-400"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Row 2: Embedding Space */}
            <div className="relative">
              <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mb-2">
                <div className="w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">3</div>
                Search Embedding Space
              </div>
              <div ref={cloudRef} className="h-[200px] relative">
                <VectorCloud
                  phase={phase}
                  currentHop={currentHop}
                  progress={progress}
                  onDocumentStart={() => {}}
                  entryFromTop={true}
                  entryXPosition={0.65}
                />
                <AnimatePresence>
                  {(phase === "cloud-searching" && progress > 0.6) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-3 right-3 bg-green-500 text-white text-xs px-2.5 py-1 rounded-full font-medium shadow-lg z-20"
                    >
                      D{currentHop + 1} found!
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showDocumentReturn && (
                    <motion.div
                      className="absolute z-20 pointer-events-none"
                      style={{ left: docStartX - 14, top: docStartY - 14 }}
                      initial={{ opacity: 1, scale: 1 }}
                      animate={{
                        opacity: progress < 0.95 ? 1 : 0,
                        scale: progress < 0.95 ? 1 : 0.5,
                        x: progress * (-docStartX - 30),
                        y: progress * (-docStartY - 250),
                      }}
                      transition={{ duration: 0.05, ease: "linear" }}
                    >
                      <motion.div
                        animate={{ rotate: [-8, 8, -8] }}
                        transition={{ duration: 0.2, repeat: Infinity }}
                        className="bg-green-500 rounded-lg p-2 shadow-lg shadow-green-500/40"
                      >
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Hop progress */}
            <div className="mt-4 flex items-center justify-center gap-2">
              {[1, 2, 3, 4].map((hop) => (
                <motion.div
                  key={hop}
                  animate={{
                    backgroundColor: currentHop >= hop - 1
                      ? (currentHop === hop - 1 && !isComplete ? "#3b82f6" : "#22c55e")
                      : "#e5e7eb",
                    scale: currentHop === hop - 1 && !isComplete ? 1.1 : 1,
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ color: currentHop >= hop - 1 ? "#fff" : "#9ca3af" }}
                >
                  {hop}
                </motion.div>
              ))}
              <span className="ml-2 text-xs text-gray-500 font-medium">
                {isComplete ? "Complete!" : `Hop ${currentHop + 1}/4`}
              </span>
              {isComplete && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={handleReplay}
                  className="ml-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg text-xs flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Replay
                </motion.button>
              )}
            </div>
          </div>

          {/* RIGHT: Branching Tree Visualization */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5 flex flex-col">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              Tree Search over Documents
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              At each hop, the model expands <em>b</em> = 2 candidates. The blue path shows
              the expanding context, synchronized with the animation on the left.
            </p>
            <div className="h-[390px]">
              <BranchingTree
                mode="documents"
                branchingFactor={2}
                maxDepth={4}
                currentHop={isComplete ? 4 : currentHop}
              />
            </div>
            {/* Info box */}
            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-blue-800 leading-relaxed">
                <span className="font-bold">One path vs. many paths.</span>{" "}
                The Recursive Retrieval Loop (left) and Similarity-Driven Connections (below)
                each trace a <em>single</em> retrieval chain. We can also expand{" "}
                <em>b</em> = 2 branches at every hop, building a tree search of candidate paths.
              </p>
            </div>
          </div>
        </div>

        {/* Row 3: Latent Graph Similarity Panel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
          <LatentGraphSimilarityPanel
            currentHop={currentHop}
            isComplete={isComplete}
            phase={phase}
          />
        </div>

        {/* Transition: bridge into KG integration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-8 max-w-2xl mx-auto bg-blue-50 border border-blue-200 rounded-2xl p-5"
        >
          <p className="text-sm text-blue-800 font-medium leading-relaxed">
            This tree search works over documents. We can make retrieval even stronger by
            running the same search over a second index: verbalized knowledge from knowledge graphs.
          </p>
          <div className="mt-4 flex flex-col items-center">
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="text-blue-400"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
