"use client";

import { useState, useEffect, useRef } from "react";
import { oracleUpperBound } from "@/data/paperResults";
import { motion, useInView, AnimatePresence } from "framer-motion";

// Animation phases
type Phase =
  | "idle"
  | "show-inputs"
  | "show-instruction"
  | "show-llm"
  | "gen-triplet-1"
  | "gen-triplet-2"
  | "gen-triplet-3"
  | "add-to-index"
  | "show-results"
  | "complete";

const QUESTION = "In which city was the scientist born who was awarded the Nobel Prize in 1921?";

const TRIPLETS = [
  "(Nobel Prize, year, 1921)",
  "(Einstein, awarded, Nobel Prize)",
  "(Einstein, born_in, Ulm)",
];

const INPUT_CARDS = [
  { label: "Multi-Hop Question", color: "bg-yellow-50 border-yellow-300 text-yellow-800" },
  { label: "Gold Passage 1",     color: "bg-green-50  border-green-300  text-green-800"  },
  { label: "Gold Passage 2",     color: "bg-green-50  border-green-300  text-green-800"  },
  { label: "Answer",             color: "bg-red-50    border-red-300    text-red-800"    },
];

// Results data (MuSiQue R@5). Scores come from paperResults.oracleUpperBound so
// this section cannot drift from the paper; only the presentation lives here.
const PRESENTATION: Record<string, { label: string; color: string; note: string }> = {
  "HippoRAG 2":                    { label: "HippoRAG 2",                               color: "bg-gray-400",  note: "" },
  "Memory-only":                   { label: "LatentGraphRAG · Memory-Only",             color: "bg-gray-400",  note: "" },
  "Document-only full tree":       { label: "LatentGraphRAG · Document-Only Full Tree", color: "bg-blue-400",  note: "" },
  "Full Dual-Tree + Agreement":    { label: "LatentGraphRAG · Dual-Tree + Agreement",   color: "bg-blue-600",  note: "documents + memories fused" },
  "Memory-only (oracle triplets)": { label: "LatentGraphRAG · Memory-Only (oracle†)",   color: "bg-amber-400", note: "oracle triplets" },
  "Dual-tree (oracle triplets)":   { label: "LatentGraphRAG · Dual-Tree (oracle†)",     color: "bg-green-500", note: "= oracle triplets + documents" },
};

const RESULTS = oracleUpperBound.map((r) => {
  const p = PRESENTATION[r.method];
  return {
    method: p?.label ?? r.method,
    score: r.r5,
    color: p?.color ?? "bg-gray-400",
    group: "oracle" in r && r.oracle ? "gt" : "standard",
    note: p?.note ?? "",
  };
});
const MAX_SCORE = 90;

export default function GroundTruthTripletSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-8%" });
  const [phase, setPhase] = useState<Phase>("idle");
  const [animKey, setAnimKey] = useState(0);
  const [visibleTriplets, setVisibleTriplets] = useState(0);
  const [indexPulse, setIndexPulse] = useState(false);

  const resetAnimation = () => {
    setPhase("idle");
    setVisibleTriplets(0);
    setIndexPulse(false);
    setAnimKey((k) => k + 1);
  };

  useEffect(() => {
    if (!isInView && animKey === 0) return;

    const timers: NodeJS.Timeout[] = [];
    let t = 0;

    timers.push(setTimeout(() => setPhase("show-inputs"),      (t += 400)));
    timers.push(setTimeout(() => setPhase("show-instruction"), (t += 900)));
    timers.push(setTimeout(() => setPhase("show-llm"),         (t += 700)));

    // Generate triplets one by one
    timers.push(setTimeout(() => { setPhase("gen-triplet-1"); setVisibleTriplets(1); }, (t += 800)));
    timers.push(setTimeout(() => { setPhase("gen-triplet-2"); setVisibleTriplets(2); }, (t += 700)));
    timers.push(setTimeout(() => { setPhase("gen-triplet-3"); setVisibleTriplets(3); }, (t += 700)));

    // Add to index
    timers.push(setTimeout(() => { setPhase("add-to-index"); setIndexPulse(true); }, (t += 600)));

    // Show results table
    timers.push(setTimeout(() => setPhase("show-results"), (t += 900)));
    timers.push(setTimeout(() => setPhase("complete"),     (t += 400)));

    return () => timers.forEach(clearTimeout);
  }, [isInView, animKey]);

  const showInputs      = phase !== "idle";
  const showInstruction = !["idle", "show-inputs"].includes(phase);
  const showLlm         = !["idle", "show-inputs", "show-instruction"].includes(phase);
  const showTriplets    = visibleTriplets > 0;
  const showIndex       = phase === "add-to-index" || phase === "show-results" || phase === "complete";
  const showResults     = phase === "show-results" || phase === "complete";

  return (
    <section ref={containerRef} className="py-12 px-4 bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto">

        {/* Narrative bridge from LatentSolutionSection */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6 max-w-2xl mx-auto bg-blue-50 border border-blue-200 rounded-2xl p-4"
        >
          <p className="text-sm text-blue-800 leading-relaxed">
            <span className="font-semibold">Latent connections resolve the structural limitations.</span>{" "}
            But how much of the gain comes from the documents themselves? The following
            upper-bound experiment answers this directly: we give the model{" "}
            <em>perfect</em> oracle triplets and ask whether documents still add value.
          </p>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-amber-200">
            <span>🔬</span>
            Upper-Bound Analysis
          </div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
            Why Documents Help Even with Perfect Triplets
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">
            We test the theoretical upper bound: what if the knowledge graph were complete,
            containing every relevant fact as a gold triplet? Even then, adding documents
            brings further gains because abstraction loses context that documents preserve.
          </p>
        </motion.div>

        {/* ── Animation: ground-truth triplet generation ── */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mb-8">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 text-center">
            Creating Ground-Truth Triplets from Oracle Evidence
          </p>

          {/* Multi-hop question display */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-5 max-w-xl mx-auto text-center">
            <p className="text-[9px] font-bold text-yellow-600 uppercase tracking-wide mb-1">Multi-Hop Question</p>
            <p className="text-xs text-yellow-800 font-medium italic">&ldquo;{QUESTION}&rdquo;</p>
          </div>

          {/* Process row */}
          <div className="flex flex-wrap items-start justify-center gap-4 lg:gap-6">

            {/* Step 1: Input cards */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[9px] font-bold text-gray-400 uppercase text-center mb-1">Inputs</p>
              {INPUT_CARDS.map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: showInputs ? 1 : 0, x: showInputs ? 0 : -12 }}
                  transition={{ duration: 0.35, delay: i * 0.1 }}
                  className={`px-3 py-1.5 rounded-lg border text-[10px] font-medium whitespace-nowrap ${card.color}`}
                >
                  {card.label}
                </motion.div>
              ))}
            </div>

            {/* Plus */}
            <motion.div
              animate={{ opacity: showInputs ? 1 : 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center text-gray-300 text-2xl font-light self-center pt-4"
            >
              +
            </motion.div>

            {/* Step 2: Instruction */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: showInstruction ? 1 : 0, scale: showInstruction ? 1 : 0.9 }}
              transition={{ duration: 0.4 }}
              className="bg-pink-50 border border-pink-200 rounded-xl p-3 text-[9px] text-pink-800 leading-relaxed max-w-[160px] self-center"
            >
              <p className="font-bold mb-1 text-[10px]">Instruction:</p>
              <p>
                Given a Multi-Hop Question, its Gold evidences and answer, create a coherent
                and complete <strong>Triplet-Chain</strong> answering the multi-hop question.
              </p>
            </motion.div>

            {/* Arrow to LLM */}
            <motion.div
              animate={{ opacity: showLlm ? 1 : 0 }}
              className="flex items-center self-center pt-4"
            >
              <svg className="w-6 h-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </motion.div>

            {/* Step 3: LLM */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: showLlm ? 1 : 0, scale: showLlm ? 1 : 0.7 }}
              transition={{ duration: 0.4, type: "spring" }}
              className="flex flex-col items-center gap-1 self-center pt-4"
            >
              <motion.div
                animate={showLlm ? { scale: [1, 1.06, 1] } : {}}
                transition={{ duration: 1.2, repeat: showTriplets ? Infinity : 0 }}
                className="w-14 h-14 bg-blue-100 border-2 border-blue-300 rounded-2xl flex items-center justify-center text-2xl"
              >
                🤖
              </motion.div>
              <span className="text-[9px] text-gray-500 font-medium">LLM</span>
              <AnimatePresence>
                {showLlm && visibleTriplets < TRIPLETS.length && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-0.5"
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 h-1 bg-blue-400 rounded-full"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Arrow */}
            <motion.div
              animate={{ opacity: showTriplets ? 1 : 0 }}
              className="flex items-center self-center pt-4"
            >
              <svg className="w-6 h-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </motion.div>

            {/* Step 4: Triplet chain */}
            <div className="flex flex-col gap-1.5 self-center">
              <p className="text-[9px] font-bold text-gray-400 uppercase text-center mb-1">Triplet Chain</p>
              {TRIPLETS.map((t, i) => (
                <AnimatePresence key={t}>
                  {visibleTriplets > i && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
                      className="px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-[9px] font-mono font-medium text-amber-800 whitespace-nowrap"
                    >
                      {t}
                    </motion.div>
                  )}
                </AnimatePresence>
              ))}
            </div>

            {/* "add triplets" arrow */}
            <motion.div
              animate={{ opacity: showIndex ? 1 : 0 }}
              className="flex flex-col items-center gap-1 self-center"
            >
              <svg className="w-6 h-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-[8px] text-gray-400 leading-tight text-center">add to<br/>index</span>
            </motion.div>

            {/* Step 5: Index */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: showIndex ? 1 : 0, scale: showIndex ? 1 : 0.8 }}
              transition={{ duration: 0.4, type: "spring" }}
              className="flex flex-col items-center gap-1 self-center"
            >
              <motion.div
                className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3"
                animate={indexPulse ? { borderColor: ["#93c5fd", "#3b82f6", "#93c5fd"] } : {}}
                transition={{ duration: 1, repeat: 3 }}
              >
                {[1, 2, 3, 4, 5].map((row) => (
                  <div key={row} className="flex gap-0.5 mb-0.5">
                    {[1, 2, 3].map((col) => (
                      <motion.div
                        key={col}
                        className={`w-3 h-2 rounded-sm ${row <= 2 ? "bg-blue-300" : row <= 4 ? "bg-amber-300" : "bg-blue-200"}`}
                        initial={{ scale: 0 }}
                        animate={{ scale: showIndex ? 1 : 0 }}
                        transition={{ delay: (row - 1) * 0.05 + (col - 1) * 0.02 }}
                      />
                    ))}
                  </div>
                ))}
              </motion.div>
              <p className="text-[8px] text-gray-500 text-center max-w-[80px] leading-tight">
                Index with <strong className="text-amber-600">Gold Triplets</strong>
              </p>
              <p className="text-[7px] text-blue-500 text-center max-w-[80px] leading-tight">
                Will this solve retrieval?
              </p>
            </motion.div>
          </div>
        </div>

        {/* ── Results table ── */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mb-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <div>
                  <p className="text-sm font-bold text-gray-800">MuSiQue Recall@5</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Ablation study on triplet quality vs. document retrieval
                  </p>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 text-[9px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-blue-600" />
                    <span className="text-gray-600">Memory-Enriched = Triplets + Documents</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-amber-400" />
                    <span className="text-gray-600">† = Oracle ground-truth triplets</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {/* Standard setting label */}
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Standard Setting</p>
                {RESULTS.filter((r) => r.group === "standard").map((row, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-52 shrink-0 text-right">
                      <span className="text-[10px] text-gray-700 font-medium">{row.method}</span>
                      {row.note && (
                        <span className="text-[8px] text-blue-500 ml-1">({row.note})</span>
                      )}
                    </div>
                    <div className="flex-1 relative h-6">
                      <div className="absolute inset-0 bg-gray-100 rounded-full" />
                      <motion.div
                        className={`absolute inset-y-0 left-0 rounded-full flex items-center justify-end pr-2 ${row.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(row.score / MAX_SCORE) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 + 0.2, ease: "easeOut" }}
                      >
                        <span className="text-[9px] font-bold text-white">{row.score}</span>
                      </motion.div>
                    </div>
                  </motion.div>
                ))}

                {/* GT setting */}
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wide mb-2">
                    † Ground-Truth Triplet Setting (oracle upper bound)
                  </p>
                  {RESULTS.filter((r) => r.group === "gt").map((row, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 + 0.5 }}
                      className="flex items-center gap-3 mb-2"
                    >
                      <div className="w-52 shrink-0 text-right">
                        <span className="text-[10px] text-gray-700 font-medium">{row.method}</span>
                        {row.note && (
                          <span className="text-[8px] text-green-500 ml-1">({row.note})</span>
                        )}
                      </div>
                      <div className="flex-1 relative h-6">
                        <div className="absolute inset-0 bg-gray-100 rounded-full" />
                        <motion.div
                          className={`absolute inset-y-0 left-0 rounded-full flex items-center justify-end pr-2 ${row.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${(row.score / MAX_SCORE) * 100}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 + 0.7, ease: "easeOut" }}
                        >
                          <span className="text-[9px] font-bold text-white">{row.score}</span>
                        </motion.div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Key observation callout */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3"
                >
                  <p className="text-xs text-green-800 text-center leading-relaxed">
                    <strong>Key observation:</strong> Even with oracle ground-truth triplets
                    (85.34), adding documents further improves to <strong>86.07</strong>.
                    Abstraction into triplets loses context that documents preserve.
                  </p>
                </motion.div>
              </div>

              {/* Replay button */}
              {phase === "complete" && (
                <motion.div className="flex justify-center mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <button
                    onClick={resetAnimation}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg text-xs flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Replay
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Insight cards */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-amber-700 mb-2">Abstraction loses context</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Condensing a passage into (subject, relation, object) triplets discards
                  the surrounding context. That lost context is exactly what helps
                  disambiguate between entities in distractor documents.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-blue-700 mb-2">Documents bridge the gap</p>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Even with perfect oracle triplets (85.34 R@5), adding documents brings
                  a further gain to 86.07. Full passages provide the contextual richness
                  that triplet chains cannot fully express.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-green-700 mb-2">Memories are additive</p>
                <p className="text-[11px] text-green-800 leading-relaxed">
                  LatentGraphRAG never discards the original documents. If a memory is
                  missing or misleading, the document index provides the fallback path.
                  The two indices complement each other.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
