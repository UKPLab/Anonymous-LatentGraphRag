"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

// Documents in the index, deliberately echoing the static-KG example
const DOCS = [
  { id: "D1", label: "Einstein biography",   cos: 0.91, x: 250, y: 210, retrieved: true  },
  { id: "D2", label: "Nobel Prize records",  cos: 0.78, x: 110, y: 200, retrieved: true  }, // overcomes MISSING EDGE
  { id: "D3", label: "Physics fundamentals", cos: 0.82, x: 390, y: 200, retrieved: true  },
  { id: "D4", label: "Ulm city history",     cos: 0.65, x: 60,  y: 150, retrieved: false }, // overcomes MISSING NODE
  { id: "D5", label: "German geography",     cos: 0.23, x: 440, y: 150, retrieved: false },
];

// Context vector position in the SVG
const CTX = { x: 250, y: 58 };

type Phase =
  | "idle"
  | "show-context"
  | "shoot-lines"
  | "show-scores"
  | "highlight-topk"
  | "show-insights"
  | "complete";

function cosToOpacity(cos: number) {
  return 0.15 + cos * 0.85;
}

// Mini broken-edge graph for problem recap
function MiniBrokenEdge() {
  return (
    <svg viewBox="0 0 175 65" className="w-full">
      <line x1={57} y1={35} x2={113} y2={35} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 3" />
      <rect x={72} y={24} width={32} height={14} rx={4} fill="#ef4444" />
      <text x={88} y={34} textAnchor="middle" fill="white" fontSize={6.5} fontWeight={700}>MISS</text>
      {[{ x: 40, y: 35, label: "Einstein" }, { x: 130, y: 35, label: "Nobel" }].map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={14} fill="#f3f4f6" stroke="#d1d5db" strokeWidth={1} />
          <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle" fill="#374151" fontSize={6} fontWeight={600}>{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

// Mini ghost-node graph for problem recap
function MiniGhostNode() {
  const nodes = [
    { x: 40,  y: 35, label: "Einstein", ghost: false },
    { x: 130, y: 35, label: "???",      ghost: true  },
  ];
  return (
    <svg viewBox="0 0 175 65" className="w-full">
      <line x1={54} y1={35} x2={116} y2={35} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 3" />
      {nodes.map((n, i) => (
        <g key={i}>
          <circle
            cx={n.x} cy={n.y} r={14}
            fill={n.ghost ? "#fef2f2" : "#f3f4f6"}
            stroke={n.ghost ? "#ef4444" : "#d1d5db"}
            strokeWidth={n.ghost ? 2 : 1}
            strokeDasharray={n.ghost ? "4 3" : undefined}
          />
          <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle"
            fill={n.ghost ? "#ef4444" : "#374151"} fontSize={6} fontWeight={600}>
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function LatentSolutionSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-8%" });
  const [phase, setPhase]               = useState<Phase>("idle");
  const [linesVisible, setLinesVisible] = useState<boolean[]>(DOCS.map(() => false));
  const [scoresVisible, setScoresVisible] = useState<boolean[]>(DOCS.map(() => false));
  const [animKey, setAnimKey]           = useState(0);

  const resetAnimation = () => {
    setPhase("idle");
    setLinesVisible(DOCS.map(() => false));
    setScoresVisible(DOCS.map(() => false));
    setAnimKey((k) => k + 1);
  };

  useEffect(() => {
    if (!isInView && animKey === 0) return;
    const timers: NodeJS.Timeout[] = [];
    let t = 0;

    timers.push(setTimeout(() => setPhase("show-context"), (t += 300)));
    timers.push(setTimeout(() => setPhase("shoot-lines"),  (t += 700)));
    DOCS.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setLinesVisible((prev) => { const n = [...prev]; n[i] = true; return n; });
      }, t + i * 160));
    });
    t += DOCS.length * 160 + 200;

    timers.push(setTimeout(() => setPhase("show-scores"), (t += 200)));
    DOCS.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setScoresVisible((prev) => { const n = [...prev]; n[i] = true; return n; });
      }, t + i * 120));
    });
    t += DOCS.length * 120 + 300;

    timers.push(setTimeout(() => setPhase("highlight-topk"), (t += 300)));
    timers.push(setTimeout(() => setPhase("show-insights"),  (t += 900)));
    timers.push(setTimeout(() => setPhase("complete"),       (t += 800)));

    return () => timers.forEach(clearTimeout);
  }, [isInView, animKey]);

  const showContext   = phase !== "idle";
  const showLines     = phase !== "idle" && phase !== "show-context";
  const showScores    = ["show-scores", "highlight-topk", "show-insights", "complete"].includes(phase);
  const highlightTopK = ["highlight-topk", "show-insights", "complete"].includes(phase);
  const showInsights  = ["show-insights", "complete"].includes(phase);

  return (
    <section
      ref={containerRef}
      className="py-12 px-4 bg-gradient-to-b from-blue-50/40 to-green-50/20 border-y border-blue-100"
    >
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-green-200">
            <span>✓</span>
            Solution
          </div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
            How LatentGraphRAG Resolves Incompleteness in Knowledge Graphs
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">
            At each hop, LatentGraphRAG performs a full dot-product search over the entire
            index. This is equivalent to computing the strength of every possible connection
            between the current context and every document or memory, all at once. There is
            no fixed graph schema: connections are discovered dynamically from the content.
          </p>
        </motion.div>

        {/* Main layout: problem recap left, latent visualization right */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

          {/* LEFT: Problem recap (2 of 5 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white border-2 border-red-200 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-500 text-sm">⚠️</span>
                <span className="text-xs font-bold text-red-700">Problem 1: Missing Edge</span>
              </div>
              <MiniBrokenEdge />
              <p className="text-[10px] text-red-600 mt-2">
                The &quot;awarded&quot; edge was absent in the graph, so the Nobel Prize query failed.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white border-2 border-red-200 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-500 text-sm">⚠️</span>
                <span className="text-xs font-bold text-red-700">Problem 2: Missing Node</span>
              </div>
              <MiniGhostNode />
              <p className="text-[10px] text-red-600 mt-2">
                The Ulm entity was never extracted into the graph, making birthplace queries impossible.
              </p>
            </motion.div>

            {/* What is in the context vector */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-blue-50 border border-blue-200 rounded-2xl p-4"
            >
              <p className="text-xs font-bold text-blue-700 mb-2">What is in the context vector?</p>
              <ul className="space-y-1.5 text-[10px] text-blue-800">
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-400 mt-0.5 shrink-0">·</span>
                  <span>The original <strong>query</strong></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-400 mt-0.5 shrink-0">·</span>
                  <span>All <strong>retrieved documents</strong> so far (full text, no abstraction loss)</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-400 mt-0.5 shrink-0">·</span>
                  <span><strong>Verbalized KG memories</strong> (additive signal, not replacing documents)</span>
                </li>
              </ul>
              <p className="text-[10px] text-blue-600 mt-2 italic">
                Every entity in any document is always reachable, even if it was never
                extracted as a graph node. Documents cover what memories may miss.
              </p>
            </motion.div>
          </div>

          {/* RIGHT: Latent connection visualization (3 of 5 cols) */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-blue-200 p-4 flex flex-col">
            <h3 className="text-sm font-bold text-blue-700 mb-1 flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
              Latent Graph: Full-Index Dot-Product Search
            </h3>
            <p className="text-[10px] text-gray-500 mb-3">
              Every document is always reachable. Edge strength equals cosine similarity,
              computed fresh from the current context at each hop.
            </p>

            {/* SVG visualization */}
            <div className="flex-1 relative">
              <svg viewBox="0 0 500 280" className="w-full" style={{ minHeight: 220 }}>

                {/* Lines: context to each document */}
                {DOCS.map((doc, i) => {
                  const opacity = cosToOpacity(doc.cos);
                  const strokeW = 1 + doc.cos * 3.5;
                  return (
                    <motion.line
                      key={doc.id}
                      x1={CTX.x} y1={CTX.y}
                      x2={doc.x}  y2={doc.y}
                      stroke={doc.retrieved && highlightTopK ? "#22c55e" : "#3b82f6"}
                      strokeWidth={strokeW}
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: linesVisible[i] ? opacity : 0,
                        stroke: doc.retrieved && highlightTopK ? "#22c55e" : "#3b82f6",
                      }}
                      transition={{ duration: 0.4 }}
                    />
                  );
                })}

                {/* Cosine score badges */}
                {DOCS.map((doc, i) => {
                  const mx = (CTX.x + doc.x) / 2 + (doc.x < CTX.x ? -12 : 12);
                  const my = (CTX.y + doc.y) / 2;
                  const isTop = doc.retrieved && highlightTopK;
                  return (
                    <AnimatePresence key={doc.id}>
                      {scoresVisible[i] && (
                        <motion.g
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <rect
                            x={mx - 22} y={my - 9}
                            width={44} height={18} rx={5}
                            fill={isTop ? "#dcfce7" : "white"}
                            stroke={isTop ? "#22c55e" : "#93c5fd"}
                            strokeWidth={1}
                          />
                          <text
                            x={mx} y={my + 4}
                            textAnchor="middle"
                            fill={isTop ? "#166534" : "#1d4ed8"}
                            fontSize={7} fontWeight={700}
                          >
                            {doc.cos.toFixed(2)}
                          </text>
                        </motion.g>
                      )}
                    </AnimatePresence>
                  );
                })}

                {/* Document nodes */}
                {DOCS.map((doc, i) => {
                  const isTop = doc.retrieved && highlightTopK;
                  return (
                    <motion.g key={doc.id}>
                      {isTop && (
                        <motion.circle
                          cx={doc.x} cy={doc.y} r={22}
                          fill="#22c55e"
                          animate={{ opacity: [0.1, 0.3, 0.1], r: [20, 24, 20] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                        />
                      )}
                      <motion.rect
                        x={doc.x - 46} y={doc.y - 14}
                        width={92} height={28} rx={8}
                        fill={isTop ? "#f0fdf4" : "#f8fafc"}
                        stroke={isTop ? "#22c55e" : "#cbd5e1"}
                        strokeWidth={isTop ? 2 : 1}
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: linesVisible[i] ? 1 : 0, scale: linesVisible[i] ? 1 : 0.7 }}
                        transition={{ duration: 0.35, delay: i * 0.05 }}
                      />
                      <motion.text
                        x={doc.x} y={doc.y - 3}
                        textAnchor="middle"
                        fill={isTop ? "#166534" : "#475569"}
                        fontSize={doc.label.length > 14 ? 5.8 : 6.5}
                        fontWeight={isTop ? 700 : 500}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: linesVisible[i] ? 1 : 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 + 0.1 }}
                      >
                        {doc.label}
                      </motion.text>
                      <motion.text
                        x={doc.x} y={doc.y + 8}
                        textAnchor="middle"
                        fill={isTop ? "#15803d" : "#94a3b8"}
                        fontSize={5.5} fontWeight={600}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: linesVisible[i] ? 1 : 0 }}
                      >
                        {doc.id}
                      </motion.text>
                    </motion.g>
                  );
                })}

                {/* Context vector node */}
                <motion.g>
                  {showContext && (
                    <motion.circle
                      cx={CTX.x} cy={CTX.y} r={30}
                      fill="#3b82f6"
                      animate={{ opacity: [0.08, 0.2, 0.08], r: [28, 34, 28] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                  <motion.circle
                    cx={CTX.x} cy={CTX.y} r={22}
                    fill="#1d4ed8"
                    stroke="#93c5fd" strokeWidth={2}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: showContext ? 1 : 0, scale: showContext ? 1 : 0 }}
                    transition={{ duration: 0.5, type: "spring" }}
                  />
                  <motion.text
                    x={CTX.x} y={CTX.y - 3}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize={7} fontWeight={800}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: showContext ? 1 : 0 }}
                  >
                    Context
                  </motion.text>
                  <motion.text
                    x={CTX.x} y={CTX.y + 8}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#bfdbfe" fontSize={5.5} fontWeight={600}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: showContext ? 1 : 0 }}
                  >
                    Vector Q
                  </motion.text>
                </motion.g>

                {/* "top-k retrieved" legend */}
                <AnimatePresence>
                  {highlightTopK && (
                    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <rect x={340} y={250} width={96} height={18} rx={4} fill="#f0fdf4" stroke="#22c55e" strokeWidth={1} />
                      <circle cx={352} cy={259} r={4} fill="#22c55e" />
                      <text x={362} y={263} fill="#166534" fontSize={7} fontWeight={600}>top-k retrieved</text>
                    </motion.g>
                  )}
                </AnimatePresence>

                <text x={250} y={272} textAnchor="middle" fill="#94a3b8" fontSize={6.5}>
                  All documents scored simultaneously via dot-product
                </text>
              </svg>
            </div>

            {/* Phase label */}
            <div className="text-center mt-2">
              {phase === "idle"          && <span className="text-[10px] text-gray-400">Scroll to animate...</span>}
              {phase === "show-context"  && <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1 }} className="text-[10px] text-blue-500 font-medium">Context vector initialized...</motion.span>}
              {phase === "shoot-lines"   && <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1 }} className="text-[10px] text-blue-500 font-medium">Searching full index...</motion.span>}
              {phase === "show-scores"   && <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1 }} className="text-[10px] text-blue-500 font-medium">Computing cosine similarities...</motion.span>}
              {phase === "highlight-topk" && <span className="text-[10px] text-green-600 font-medium">Top-k selected for next hop</span>}
              {(phase === "show-insights" || phase === "complete") && <span className="text-[10px] text-green-600 font-bold">All limitations resolved ✓</span>}
            </div>

            {phase === "complete" && (
              <motion.div className="flex justify-center mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <button
                  onClick={resetAnimation}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg text-xs flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Replay
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Resolution cards */}
        <AnimatePresence>
          {showInsights && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"
            >
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">✓</div>
                  <div>
                    <p className="text-sm font-bold text-green-800 mb-1">No Missing Edges</p>
                    <p className="text-xs text-green-700 leading-relaxed">
                      Connections are created on the fly from content. &quot;Nobel Prize records&quot;
                      scores <span className="font-mono font-bold">cos = 0.78</span> from the Einstein
                      context even without any &quot;awarded&quot; edge. If a memory triplet is also
                      missing, the document itself still carries the signal.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">✓</div>
                  <div>
                    <p className="text-sm font-bold text-green-800 mb-1">No Missing Nodes</p>
                    <p className="text-xs text-green-700 leading-relaxed">
                      Every indexed document is a first-class node. &quot;Ulm city history&quot;
                      scores <span className="font-mono font-bold">cos = 0.65</span> regardless of
                      whether Ulm was ever extracted as a KG entity. Documents cover all entities
                      that memories may have missed.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Core principle + bridge to KG section */}
        <AnimatePresence>
          {showInsights && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4 text-center max-w-3xl mx-auto"
            >
              <p className="text-sm text-blue-800 leading-relaxed">
                <span className="font-bold">Core principle:</span> A dot-product over the full index
                computes the strength of every possible edge simultaneously. The context vector, not
                a static schema, determines which connections are relevant at each hop.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                This holds even under ideal conditions. The next section shows that documents
                further improve performance even when the knowledge graph is theoretically
                complete with every relevant fact as a gold triplet.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
