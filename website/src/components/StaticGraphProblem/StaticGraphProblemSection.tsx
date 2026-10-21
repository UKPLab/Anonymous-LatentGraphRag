"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

// Shared node positions for both panels
const NODES = [
  { id: "einstein", label: "Einstein", x: 145, y: 105 },
  { id: "ulm",     label: "Ulm",      x: 60,  y: 42  },
  { id: "germany", label: "Germany",  x: 230, y: 42  },
  { id: "physics", label: "Physics",  x: 52,  y: 168 },
  { id: "nobel",   label: "Nobel",    x: 238, y: 168 },
];

// Edges that exist in both panels (green / solid)
const BASE_EDGES = [
  { from: "einstein", to: "ulm",     label: "born in"    },
  { from: "ulm",      to: "germany", label: "located in" },
  { from: "einstein", to: "physics", label: "field"      },
];

// The edge that is MISSING in panel 1
const MISSING_EDGE = { from: "einstein", to: "nobel", label: "awarded" };

type Phase = "idle" | "show-graph" | "highlight" | "complete";

function getNode(id: string) {
  return NODES.find((n) => n.id === id)!;
}

function lineCoords(fromId: string, toId: string) {
  const f = getNode(fromId);
  const t = getNode(toId);
  return {
    x1: f.x, y1: f.y,
    x2: t.x, y2: t.y,
    mx: (f.x + t.x) / 2,
    my: (f.y + t.y) / 2,
  };
}

// ─────────────────────────────────────────────────────────
// Panel 1: Missing Edge
// ─────────────────────────────────────────────────────────
function MissingEdgePanel({ phase }: { phase: Phase }) {
  const visible  = phase !== "idle";
  const pulsing  = phase === "highlight" || phase === "complete";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl border-2 border-red-200 p-5 relative overflow-hidden"
    >
      {/* Red corner ribbon */}
      <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl">
        Problem 1
      </div>

      <h3 className="text-sm font-bold text-red-700 mb-1 flex items-center gap-2">
        <span className="text-base">⚠️</span>
        Missing Edge
      </h3>
      <p className="text-[11px] text-gray-500 mb-3">
        The <em>awarded</em> relation between Einstein and Nobel was never encoded in the graph.
        A query about his prize <strong>fails to traverse</strong> this gap.
      </p>

      <svg viewBox="0 0 295 215" className="w-full" style={{ minHeight: 160 }}>
        {/* Present edges */}
        {BASE_EDGES.map((edge, i) => {
          const c = lineCoords(edge.from, edge.to);
          return (
            <motion.g key={i}>
              <motion.line
                x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                stroke="#22c55e" strokeWidth={2}
                initial={{ opacity: 0 }}
                animate={{ opacity: visible ? 0.85 : 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              />
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: visible ? 1 : 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 + 0.2 }}
              >
                <rect
                  x={c.mx - 23} y={c.my - 8}
                  width={46} height={16} rx={4}
                  fill="#dcfce7" stroke="#86efac" strokeWidth={1}
                />
                <text
                  x={c.mx} y={c.my + 4}
                  textAnchor="middle" fill="#166534"
                  fontSize={7} fontWeight={600}
                >
                  {edge.label}
                </text>
              </motion.g>
            </motion.g>
          );
        })}

        {/* ── MISSING EDGE: red dashed ── */}
        {(() => {
          const c = lineCoords(MISSING_EDGE.from, MISSING_EDGE.to);
          return (
            <g>
              {/* Pulsing glow behind the dashed line */}
              {pulsing && (
                <motion.line
                  x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                  stroke="#ef4444" strokeWidth={10}
                  strokeDasharray="10 6"
                  animate={{ opacity: [0.15, 0.45, 0.15] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                />
              )}
              <motion.line
                x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                stroke="#ef4444" strokeWidth={2.5}
                strokeDasharray="7 5"
                initial={{ opacity: 0 }}
                animate={{ opacity: visible ? 1 : 0 }}
                transition={{ duration: 0.5 }}
              />
              {/* "MISSING" badge */}
              <motion.g
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{
                  opacity: visible ? 1 : 0,
                  scale: visible ? 1 : 0.7,
                }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <rect
                  x={c.mx - 26} y={c.my - 11}
                  width={52} height={22} rx={7}
                  fill="#ef4444"
                />
                <text
                  x={c.mx} y={c.my - 1}
                  textAnchor="middle" fill="white"
                  fontSize={6.5} fontWeight={800}
                >
                  MISSING
                </text>
                <text
                  x={c.mx} y={c.my + 7}
                  textAnchor="middle" fill="#fecaca"
                  fontSize={5.5} fontWeight={500}
                >
                  awarded
                </text>
              </motion.g>
            </g>
          );
        })()}

        {/* Nodes */}
        {NODES.map((node) => (
          <motion.g key={node.id}>
            <motion.circle
              cx={node.x} cy={node.y} r={17}
              fill="#f3f4f6" stroke="#d1d5db" strokeWidth={1.5}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0 }}
              transition={{ duration: 0.35 }}
            />
            <motion.text
              x={node.x} y={node.y + 1}
              textAnchor="middle" dominantBaseline="middle"
              fill="#374151" fontSize={node.label.length > 6 ? 6.5 : 7.5}
              fontWeight={600}
              initial={{ opacity: 0 }}
              animate={{ opacity: visible ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {node.label}
            </motion.text>
          </motion.g>
        ))}

        {/* Query failure indicator */}
        <AnimatePresence>
          {pulsing && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <rect x={8} y={193} width={279} height={18} rx={4} fill="#fef2f2" stroke="#fca5a5" strokeWidth={1} />
              <text x={147} y={206} textAnchor="middle" fill="#991b1b" fontSize={7} fontWeight={600}>
                Query: &quot;Did Einstein win Nobel?&quot;: retrieval fails, edge missing
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      <div className="mt-3 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
        <p className="text-[11px] text-red-700 leading-relaxed">
          <strong>Route lost:</strong> a relation that extraction did not keep cannot be
          traversed, even though the source passage still states it.
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Panel 2: Missing Node
// ─────────────────────────────────────────────────────────
const GHOST_ULM = NODES.find((n) => n.id === "ulm")!;

function MissingNodePanel({ phase }: { phase: Phase }) {
  const visible = phase !== "idle";
  const pulsing = phase === "highlight" || phase === "complete";

  const presentEdges = [
    { from: "einstein", to: "physics", label: "field"    },
    { from: "einstein", to: "nobel",   label: "awarded"  },
  ];
  const brokenEdges = [
    { from: "einstein", to: "ulm",     label: "born in"    },
    { from: "ulm",      to: "germany", label: "located in" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="bg-white rounded-2xl border-2 border-red-200 p-5 relative overflow-hidden"
    >
      {/* Red corner ribbon */}
      <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl">
        Problem 2
      </div>

      <h3 className="text-sm font-bold text-red-700 mb-1 flex items-center gap-2">
        <span className="text-base">⚠️</span>
        Missing Node
      </h3>
      <p className="text-[11px] text-gray-500 mb-3">
        The entity <em>Ulm</em> was never extracted into the graph.
        Any query about Einstein&apos;s birthplace hits a <strong>dead end</strong>.
      </p>

      <svg viewBox="0 0 295 215" className="w-full" style={{ minHeight: 160 }}>
        {/* Present edges */}
        {presentEdges.map((edge, i) => {
          const c = lineCoords(edge.from, edge.to);
          return (
            <motion.g key={i}>
              <motion.line
                x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                stroke="#22c55e" strokeWidth={2}
                initial={{ opacity: 0 }}
                animate={{ opacity: visible ? 0.85 : 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              />
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: visible ? 1 : 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 + 0.2 }}
              >
                <rect
                  x={c.mx - 23} y={c.my - 8}
                  width={46} height={16} rx={4}
                  fill="#dcfce7" stroke="#86efac" strokeWidth={1}
                />
                <text
                  x={c.mx} y={c.my + 4}
                  textAnchor="middle" fill="#166534"
                  fontSize={7} fontWeight={600}
                >
                  {edge.label}
                </text>
              </motion.g>
            </motion.g>
          );
        })}

        {/* Broken edges going to/from ghost Ulm */}
        {brokenEdges.map((edge, i) => {
          const c = lineCoords(edge.from, edge.to);
          return (
            <motion.g key={i}>
              {pulsing && (
                <motion.line
                  x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                  stroke="#ef4444" strokeWidth={8}
                  strokeDasharray="9 5"
                  animate={{ opacity: [0.1, 0.38, 0.1] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                />
              )}
              <motion.line
                x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                stroke="#ef4444" strokeWidth={2}
                strokeDasharray="6 4"
                initial={{ opacity: 0 }}
                animate={{ opacity: visible ? 0.9 : 0 }}
                transition={{ duration: 0.4 }}
              />
            </motion.g>
          );
        })}

        {/* Present nodes (all except Ulm) */}
        {NODES.filter((n) => n.id !== "ulm").map((node) => (
          <motion.g key={node.id}>
            <motion.circle
              cx={node.x} cy={node.y} r={17}
              fill="#f3f4f6" stroke="#d1d5db" strokeWidth={1.5}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0 }}
              transition={{ duration: 0.35 }}
            />
            <motion.text
              x={node.x} y={node.y + 1}
              textAnchor="middle" dominantBaseline="middle"
              fill="#374151" fontSize={node.label.length > 6 ? 6.5 : 7.5}
              fontWeight={600}
              initial={{ opacity: 0 }}
              animate={{ opacity: visible ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {node.label}
            </motion.text>
          </motion.g>
        ))}

        {/* Ghost Ulm node */}
        <motion.g>
          {pulsing && (
            <motion.circle
              cx={GHOST_ULM.x} cy={GHOST_ULM.y} r={24}
              fill="#ef4444"
              animate={{ opacity: [0.04, 0.18, 0.04], r: [22, 27, 22] }}
              transition={{ duration: 1.3, repeat: Infinity }}
            />
          )}
          <motion.circle
            cx={GHOST_ULM.x} cy={GHOST_ULM.y} r={17}
            fill="#fef2f2"
            stroke="#ef4444" strokeWidth={2}
            strokeDasharray="5 3"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          />
          <motion.text
            x={GHOST_ULM.x} y={GHOST_ULM.y - 1}
            textAnchor="middle" dominantBaseline="middle"
            fill="#ef4444" fontSize={11} fontWeight={800}
            initial={{ opacity: 0 }}
            animate={{ opacity: visible ? 1 : 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            ?
          </motion.text>
          <motion.text
            x={GHOST_ULM.x} y={GHOST_ULM.y + 9}
            textAnchor="middle" dominantBaseline="middle"
            fill="#fca5a5" fontSize={5} fontWeight={600}
            initial={{ opacity: 0 }}
            animate={{ opacity: visible ? 1 : 0 }}
          >
            Ulm
          </motion.text>
        </motion.g>

        {/* Query failure indicator */}
        <AnimatePresence>
          {pulsing && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <rect x={8} y={193} width={279} height={18} rx={4} fill="#fef2f2" stroke="#fca5a5" strokeWidth={1} />
              <text x={147} y={206} textAnchor="middle" fill="#991b1b" fontSize={7} fontWeight={600}>
                Query: &quot;Where was Einstein born?&quot;: node absent, dead end
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      <div className="mt-3 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
        <p className="text-[11px] text-red-700 leading-relaxed">
          <strong>Subgraph lost:</strong> if an entity was never extracted, every relation
          attached to it disappears from the graph, though not from the documents.
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────
export default function StaticGraphProblemSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView     = useInView(containerRef, { once: true, margin: "-8%" });
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (!isInView) return;
    const t1 = setTimeout(() => setPhase("show-graph"),  300);
    const t2 = setTimeout(() => setPhase("highlight"),  1400);
    const t3 = setTimeout(() => setPhase("complete"),   4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isInView]);

  return (
    <section
      ref={containerRef}
      className="py-12 px-4 bg-gradient-to-b from-red-50/50 to-orange-50/20 border-y border-red-100"
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-red-200">
            <span>⚠️</span>
            Motivation
          </div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
            Graph Pipelines Depend on What Extraction Kept
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">
            Graph-based retrieval constructs facts and their connections{" "}
            <strong className="text-red-600">before a question arrives</strong>, then retrieves
            through that structure. Extraction can miss relations, removing graph routes even when
            the source text retains the evidence.
          </p>
        </motion.div>

        {/* Two-panel grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <MissingEdgePanel phase={phase} />
          <MissingNodePanel phase={phase} />
        </div>

        {/* Bottom callout — bridge to the solution */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 text-center max-w-3xl mx-auto"
        >
          <p className="text-sm text-amber-800 leading-relaxed">
            <span className="font-bold">The other paradigm:</span> recursive dense retrieval{" "}
            <span className="font-semibold text-amber-700">
              conditions each lookup on observed text
            </span>
            , discovering evidence paths as search unfolds. LatentGraphRAG keeps the constructed
            facts, but as evidence for recursive search, linked to the passages they came from.
          </p>
          <p className="text-xs text-amber-600 mt-2">
            ↓ &nbsp;First, the recursive backbone.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
