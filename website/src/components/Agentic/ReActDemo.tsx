"use client";

/**
 * Retrieval-first seeding, step by step, on three real questions (one per problem type):
 *
 *   question → LatentGraphRAG retrieval (document tree + memory tree over triples and propositions, projected
 *   to source documents and fused with CombMNZ) → the seed (top ten fused documents) → the agent's own
 *   searches → the final answer and its grade → the same question under the other seeds.
 *
 * Everything shown comes from the released Table 5 runs (`@/data/agentDemo`): seeds, search queries, the five
 * documents each search returned, the "Exact Answer" line and the grade. The model's free-text reasoning is
 * not shown. Memories under a seed passage are a triple and a proposition extracted from that passage; which
 * memories the memory tree visited is not logged, so the demo never claims that.
 *
 * Playback starts when the demo scrolls into view, walks through the steps and moves on to the next example.
 * Tabs pick an example, chips jump to a step (and pause). With prefers-reduced-motion nothing plays: the
 * finished first example is shown.
 */

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { agentDemo, type DemoDoc, type DemoSlide } from "@/data/agentDemo";
import { frozenConfig } from "@/data/lgrPaper";
import { LGR } from "@/components/lgrPalette";

type StepKind = "question" | "trees" | "seed" | "search" | "answer" | "compare";
type Step = { kind: StepKind; label: string; ms: number; search?: number };

function stepsOf(s: DemoSlide): Step[] {
  return [
    { kind: "question", label: "Question", ms: 1800 },
    { kind: "trees", label: "Two trees", ms: 2800 },
    { kind: "seed", label: "Seed", ms: 3600 },
    ...s.searches.map((_, i) => ({ kind: "search" as const, label: s.searches.length > 1 ? `Search ${i + 1}` : "Search", ms: 3200, search: i })),
    { kind: "answer", label: "Answer", ms: 3000 },
    { kind: "compare", label: "Other seeds", ms: 4200 },
  ];
}

const ease = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ small pieces */

function GoldBadge({ fresh = false }: { fresh?: boolean }) {
  return (
    <span
      className="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide"
      style={{ color: LGR.gold, background: "#f0fdf4", boxShadow: `inset 0 0 0 1px ${LGR.gold}55` }}
    >
      {fresh ? "gold · new" : "gold"}
    </span>
  );
}

/** The passage is missing from the same question's documents-only seed: the fusion with memories added it. */
function FusedOnlyBadge() {
  return (
    <span
      className="shrink-0 rounded px-1 py-px text-[9px] font-semibold tracking-wide"
      style={{ color: LGR.fused, background: LGR.fusedSoft, boxShadow: `inset 0 0 0 1px ${LGR.fused}55` }}
      title="This passage is not in the documents-only seed of the same question (run t5__rdr_doc_seed)."
    >
      not in the documents-only seed
    </span>
  );
}

function MemoryLine({ kind, text }: { kind: "triple" | "proposition"; text: string }) {
  const c = kind === "triple" ? LGR.triple : LGR.prop;
  return (
    <div className="flex items-start gap-1.5 text-[11px] leading-4 text-slate-600">
      <span
        className="mt-px shrink-0 rounded px-1 text-[9px] font-semibold uppercase tracking-wide"
        style={{ color: c, background: kind === "triple" ? LGR.tripleSoft : LGR.propSoft }}
      >
        {kind === "triple" ? "triple" : "prop."}
      </span>
      <span className="line-clamp-2">{text}</span>
    </div>
  );
}

/** Document tree and memory tree, projection and CombMNZ: a schematic, drawn level by level. */
function RetrievalSchematic({ active }: { active: boolean }) {
  // a 1 + 3 + 9 tree; memory nodes alternate triples (squares) and propositions (circles)
  const tree = (cx: number) => {
    const l1 = [-44, 0, 44].map((dx) => cx + dx);
    const l2 = l1.flatMap((x) => [-14, 0, 14].map((dx) => x + dx));
    return { root: cx, l1, l2 };
  };
  const D = tree(96);
  const M = tree(304);
  const Y = [26, 58, 90];
  const pathD = [1, 4]; // highlighted children (level 1 index, level 2 index)
  const pathM = [0, 2];
  const node = (x: number, y: number, kind: "doc" | "triple" | "prop", i: number, level: number, hot: boolean) => {
    const c = kind === "doc" ? LGR.doc : kind === "triple" ? LGR.triple : LGR.prop;
    const delay = active ? 0.15 + level * 0.45 + i * 0.03 : 0;
    const common = {
      initial: { opacity: 0, scale: 0.4 },
      animate: active ? { opacity: 1, scale: 1 } : { opacity: 0.18, scale: 1 },
      transition: { delay, duration: 0.35, ease },
      style: { transformOrigin: `${x}px ${y}px` },
    };
    const r = level === 0 ? 6.5 : level === 1 ? 5 : 3.8;
    return kind === "triple" ? (
      <motion.rect key={`${x}-${y}`} x={x - r} y={y - r} width={2 * r} height={2 * r} rx={1.2}
        fill={hot ? c : "#fff"} stroke={c} strokeWidth={1.3} {...common} />
    ) : (
      <motion.circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={hot || level === 0 ? c : "#fff"} stroke={c} strokeWidth={1.3} {...common} />
    );
  };
  const edges = (t: ReturnType<typeof tree>, color: string, hot: number[]) => (
    <g>
      {t.l1.map((x, i) => (
        <motion.line key={`a${i}`} x1={t.root} y1={Y[0]} x2={x} y2={Y[1]} stroke={i === hot[0] ? color : LGR.faint}
          strokeWidth={i === hot[0] ? 1.6 : 1} initial={{ pathLength: 0 }} animate={{ pathLength: active ? 1 : 0.0001 }}
          transition={{ delay: active ? 0.35 : 0, duration: 0.4 }} />
      ))}
      {t.l2.map((x, j) => (
        <motion.line key={`b${j}`} x1={t.l1[Math.floor(j / 3)]} y1={Y[1]} x2={x} y2={Y[2]}
          stroke={j === hot[1] ? color : LGR.faint} strokeWidth={j === hot[1] ? 1.6 : 1}
          initial={{ pathLength: 0 }} animate={{ pathLength: active ? 1 : 0.0001 }}
          transition={{ delay: active ? 0.8 : 0, duration: 0.4 }} />
      ))}
    </g>
  );
  const memKind = (i: number) => (i % 2 === 0 ? "triple" : "prop") as "triple" | "prop";
  const late = (d: number) => ({ initial: { opacity: 0 }, animate: { opacity: active ? 1 : 0.15 }, transition: { delay: active ? d : 0, duration: 0.4 } });
  return (
    <svg viewBox="0 0 400 176" className="w-full h-auto" role="img"
      aria-label="Document tree and memory tree, projection of memories to their source documents, and CombMNZ fusion into the seed">
      <text x={96} y={10} textAnchor="middle" fontSize={9} fontWeight={600} fill={LGR.doc}>Document tree</text>
      <text x={304} y={10} textAnchor="middle" fontSize={9} fontWeight={600} fill={LGR.triple}>
        Memory tree <tspan fill={LGR.muted} fontWeight={400}>· triples</tspan>
        <tspan fill={LGR.muted} fontWeight={400}> + </tspan><tspan fill={LGR.prop} fontWeight={600}>propositions</tspan>
      </text>
      {edges(D, LGR.doc, pathD)}
      {edges(M, LGR.triple, pathM)}
      {node(D.root, Y[0], "doc", 0, 0, true)}
      {D.l1.map((x, i) => node(x, Y[1], "doc", i, 1, i === pathD[0]))}
      {D.l2.map((x, i) => node(x, Y[2], "doc", i, 2, i === pathD[1]))}
      {node(M.root, Y[0], "doc", 0, 0, true)}
      {M.l1.map((x, i) => node(x, Y[1], memKind(i), i, 1, i === pathM[0]))}
      {M.l2.map((x, i) => node(x, Y[2], memKind(i + 1), i, 2, i === pathM[1]))}

      {/* readouts */}
      <motion.g {...late(1.3)}>
        <rect x={44} y={104} width={104} height={18} rx={5} fill={LGR.docSoft} stroke={`${LGR.doc}55`} />
        <text x={96} y={116} textAnchor="middle" fontSize={8.5} fill={LGR.doc}>readout over documents</text>
        <rect x={244} y={104} width={120} height={18} rx={5} fill={LGR.tripleSoft} stroke={`${LGR.triple}55`} />
        <text x={304} y={116} textAnchor="middle" fontSize={8.5} fill={LGR.triple}>π: memory → its passage</text>
      </motion.g>
      <motion.g {...late(1.7)}>
        <path d="M96 122 C96 140 150 146 166 150" fill="none" stroke={LGR.doc} strokeWidth={1.2} />
        <path d="M304 122 C304 140 250 146 234 150" fill="none" stroke={LGR.triple} strokeWidth={1.2} />
        <rect x={150} y={142} width={100} height={20} rx={10} fill={LGR.fusedSoft} stroke={LGR.fused} />
        <text x={200} y={155} textAnchor="middle" fontSize={9} fontWeight={600} fill={LGR.fused}>
          {frozenConfig.viewFusion} · w {frozenConfig.documentWeight} / {frozenConfig.memoryWeight}
        </text>
        <path d="M250 152 L276 152" stroke={LGR.fused} strokeWidth={1.2} markerEnd="url(#lgr-demo-arrow)" />
        <text x={282} y={155} fontSize={9} fontWeight={600} fill={LGR.ink}>top {frozenConfig.seedSize} = seed</text>
      </motion.g>
      <defs>
        <marker id="lgr-demo-arrow" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill={LGR.fused} />
        </marker>
      </defs>
    </svg>
  );
}

function SeedRow({ d, i, show }: { d: DemoDoc; i: number; show: boolean }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={show ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
      transition={{ delay: show ? 0.08 * i : 0, duration: 0.3, ease }}
      className={d.notInDocSeed ? "-mx-1 rounded-md px-1" : ""}
      style={d.notInDocSeed ? { background: `${LGR.fusedSoft}` } : undefined}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="w-4 shrink-0 text-right font-mono text-[10px] text-slate-400">{i + 1}</span>
        <span className="min-w-0 truncate text-[12px] leading-5" title={`${d.title}: ${d.snippet}`}>
          <span className={d.gold ? "font-semibold text-slate-900" : "text-slate-600"}>{d.title}</span>
          <span className="text-slate-400"> · {d.snippet}</span>
        </span>
        {d.gold && <GoldBadge />}
      </div>
      {d.notInDocSeed && (
        <div className="ml-6 pb-0.5">
          <FusedOnlyBadge />
        </div>
      )}
    </motion.li>
  );
}

/** The memories of one gold seed passage: a triple and a proposition with π(m) = that passage. */
function MemoryCard({ d, rank, i, show }: { d: DemoDoc; rank: number; i: number; show: boolean }) {
  if (!d.memories) return null;
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      transition={{ delay: show ? 0.5 + 0.18 * i : 0, duration: 0.35, ease }}
      className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-200"
    >
      <div className="space-y-0.5">
        <MemoryLine kind="triple" text={d.memories.triple} />
        <MemoryLine kind="proposition" text={d.memories.proposition} />
      </div>
      <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] text-slate-500">
        <span className="font-mono" style={{ color: LGR.doc }}>π →</span>
        <span className="min-w-0 truncate">
          <span className="font-mono text-slate-400">seed {rank}</span> {d.title}
        </span>
        {d.notInDocSeed && <FusedOnlyBadge />}
      </p>
    </motion.li>
  );
}

function Bubble({ who, children, tone = "plain" }: { who: string; children: ReactNode; tone?: "plain" | "agent" | "tool" | "answer" }) {
  const styles: Record<string, string> = {
    plain: "bg-slate-50 ring-slate-200",
    agent: "bg-white ring-slate-300",
    tool: "bg-sky-50/60 ring-sky-200",
    answer: "bg-white ring-2",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease }}
      className={`rounded-xl px-3 py-2 ring-1 ${styles[tone]}`}
      style={tone === "answer" ? { boxShadow: `inset 0 0 0 2px ${LGR.fused}` } : undefined}
    >
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">{who}</p>
      {children}
    </motion.div>
  );
}

function Dots({ n, max = 10, color }: { n: number; max?: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-label={`${n} searches`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="h-[7px] w-[7px] rounded-full"
          style={{ background: i < n ? color : "transparent", boxShadow: `inset 0 0 0 1px ${i < n ? color : LGR.faint}` }} />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ the demo */

export default function ReActDemo({ startSlide = 0 }: { startSlide?: number }) {
  const [slide, setSlide] = useState(startSlide);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const s = agentDemo[slide];
  const steps = useMemo(() => stepsOf(s), [s]);
  const cur = steps[Math.min(step, steps.length - 1)];
  const at = (k: StepKind) => steps.findIndex((x) => x.kind === k);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setReduced(true);
      setPaused(true);
      setStep(stepsOf(agentDemo[startSlide]).length - 1);
    }
  }, [startSlide]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // advance: through the steps, then on to the next example
  useEffect(() => {
    if (paused || !inView) return;
    const t = window.setTimeout(() => {
      if (step < steps.length - 1) setStep(step + 1);
      else {
        setSlide((x) => (x + 1) % agentDemo.length);
        setStep(0);
      }
    }, cur.ms);
    return () => window.clearTimeout(t);
  }, [step, paused, inView, steps.length, cur.ms]);

  const pick = useCallback((i: number) => {
    setSlide(i);
    setStep(reduced ? stepsOf(agentDemo[i]).length - 1 : 0);
  }, [reduced]);

  const seedShown = step >= at("seed");
  const answerShown = step >= at("answer");
  const compareShown = step >= at("compare");
  const searchesShown = s.searches.filter((_, i) => step >= at("seed") + 1 + i);
  const seedIds = new Set(s.seed.map((d) => d.id));
  const traceHref = `/traces/results/?ds=${s.ds}&run=${s.runId}&qid=${encodeURIComponent(s.qid)}`;
  const lgrRun = s.runs[s.runs.length - 1];

  return (
    <div ref={root} className="@container not-prose rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      {/* example tabs */}
      <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Examples">
        {agentDemo.map((x, i) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={i === slide}
            onClick={() => pick(i)}
            className={`relative overflow-hidden rounded-lg border px-2 py-1.5 text-left transition sm:px-3 sm:py-2 ${
              i === slide ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className="block text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: i === slide ? LGR.state : LGR.muted }}>
              {x.kind}
            </span>
            <span className="block text-[11.5px] font-medium leading-4 text-slate-800 sm:text-[12.5px]">{x.title}</span>
            <span className="mt-0.5 block text-[10px] text-slate-400">{x.dataset}</span>
            {i === slide && !paused && inView && (
              <motion.span key={`${slide}-bar`} className="absolute bottom-0 left-0 h-[2px]" style={{ background: LGR.state }}
                initial={{ width: "0%" }} animate={{ width: `${((step + 1) / steps.length) * 100}%` }} transition={{ duration: 0.4 }} />
            )}
          </button>
        ))}
      </div>

      {/* step rail */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play" : "Pause"}
          className="flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:opacity-90"
          style={{ background: LGR.state }}
        >
          {paused ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.5v9l8-4.5z" /></svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1.5" width="2.5" height="9" rx="0.5" /><rect x="7.5" y="1.5" width="2.5" height="9" rx="0.5" /></svg>
          )}
        </button>
        <button
          onClick={() => { setStep(0); setPaused(false); }}
          aria-label="Replay"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 6a4 4 0 1 0 1-2.65" /><path d="M2 1.5V4h2.5" /></svg>
        </button>
        {steps.map((x, i) => (
          <button
            key={`${x.label}-${i}`}
            onClick={() => { setStep(i); setPaused(true); }}
            className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
              i === step ? "border-indigo-300 bg-indigo-50 text-indigo-700" : i < step ? "border-slate-200 text-slate-600" : "border-slate-200 text-slate-400"
            }`}
          >
            <span className="font-mono text-[10px] opacity-60">{i + 1}</span> {x.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 @4xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* ---------------- retrieval */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">LatentGraphRAG retrieval</p>
          <AnimatePresence mode="wait">
            <motion.div key={s.key + "-q"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }} className="mt-2 rounded-lg bg-white px-3 py-2 ring-1 ring-indigo-200">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: LGR.state }}>
                Question · {s.dataset}
              </p>
              <p className="mt-0.5 text-[13px] leading-5 text-slate-900">{s.question}</p>
              <ol className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10.5px] leading-4 text-slate-500">
                <span className="mr-0.5 font-semibold text-slate-400">needs:</span>
                {s.chain.map((c, i) => (
                  <li key={c} className="flex items-center gap-1">
                    {i > 0 && <span className="text-slate-300">→</span>}
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
            </motion.div>
          </AnimatePresence>

          <div className="mt-2 rounded-lg bg-white px-1 py-1 ring-1 ring-slate-200">
            <div className="mx-auto max-w-[440px]">
              <RetrievalSchematic key={`${s.key}-${step >= at("trees")}`} active={step >= at("trees")} />
            </div>
          </div>

          <div className="mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Memories of the gold seed passages
            </p>
            {seedShown ? (
              <ol className="mt-1 space-y-1" key={s.key + "-mem"}>
                {s.seed
                  .map((d, rank) => ({ d, rank: rank + 1 }))
                  .filter(({ d }) => d.memories)
                  .map(({ d, rank }, i) => <MemoryCard key={d.id} d={d} rank={rank} i={i} show />)}
              </ol>
            ) : (
              <div className="mt-1 rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-[11.5px] text-slate-400">
                Shown with the seed: what the memory index holds for each gold passage.
              </div>
            )}
            <p className="mt-1.5 text-[10.5px] leading-4 text-slate-400">
              A <span style={{ color: LGR.triple }}>triple</span> and a{" "}
              <span style={{ color: LGR.prop }}>proposition</span> extracted from each passage. Both are memories with
              π(m) = that passage, so a memory-tree score reaching them is projected onto it.
            </p>
          </div>
        </div>

        {/* ---------------- agent */}
        <div className="flex flex-col rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            ReAct agent · {frozenConfig.controller} · at most {frozenConfig.agentMaxSearches} searches
          </p>
          <div className="mt-2 flex flex-1 flex-col gap-2">
            <AnimatePresence initial={false}>
              {seedShown && (
                <Bubble key={`${s.key}-in`} who={`user turn · question + seed: top ${frozenConfig.seedSize} fused documents`}>
                  <ol className="space-y-0">
                    {s.seed.map((d, i) => <SeedRow key={d.id} d={d} i={i} show={seedShown} />)}
                  </ol>
                  <p className="mt-1 text-[10.5px] leading-4 text-slate-400">
                    {s.seed.filter((d) => d.gold).length}{" "}
                    {s.ds === "fanoutqa" ? "seed passages come from the question's evidence pages (gold)" : "gold passages in the seed"};{" "}
                    {(() => {
                      const n = s.seed.filter((d) => d.notInDocSeed).length;
                      const g = s.seed.filter((d) => d.notInDocSeed && d.gold).length;
                      return n === 0
                        ? "the documents-only seed of this question holds the same ten passages. "
                        : `${n} ${n === 1 ? "passage is" : "passages are"} not in the documents-only seed of this question (${g} gold). `;
                    })()}
                    The seed is not a search and does not count against the budget.
                  </p>
                </Bubble>
              )}
              {searchesShown.map((q, i) => (
                <div key={`${s.key}-s${i}`} className="flex flex-col gap-2">
                  <Bubble who={`agent · turn ${i + 1}`} tone="agent">
                    <p className="font-mono text-[12px] leading-5 text-slate-900">
                      <span style={{ color: LGR.search }} className="font-semibold">SEARCH:</span> {q.query}
                    </p>
                  </Bubble>
                  <Bubble who={`search tool · ${frozenConfig.agentSearchTool} · ${frozenConfig.textsPerSearch} documents`} tone="tool">
                    <ol className="space-y-0.5">
                      {q.results.map((d, j) => (
                        <motion.li key={d.id + j} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.25 + 0.12 * j, duration: 0.3 }} className="flex items-baseline gap-2 min-w-0">
                          <span className="w-3 shrink-0 font-mono text-[10px] text-slate-400">{j + 1}</span>
                          <span className={`truncate text-[12px] ${d.gold ? "font-semibold text-slate-900" : "text-slate-600"}`} title={d.title}>
                            {d.title}
                          </span>
                          {d.gold && <GoldBadge fresh={!seedIds.has(d.id)} />}
                          {seedIds.has(d.id) && <span className="shrink-0 text-[9.5px] text-slate-400">in seed</span>}
                        </motion.li>
                      ))}
                    </ol>
                  </Bubble>
                </div>
              ))}
              {answerShown && s.searches.length === 0 && (
                <motion.p key={`${s.key}-nosearch`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="px-1 text-[11.5px] italic text-slate-500">
                  No search: the seed already holds the whole chain.
                </motion.p>
              )}
              {answerShown && (
                <Bubble key={`${s.key}-ans`} who={`agent · turn ${s.searches.length + 1} · final answer`} tone="answer">
                  <p className="text-[12.5px] leading-5 text-slate-900">
                    <span className="font-mono font-semibold" style={{ color: LGR.fused }}>Exact Answer:</span> {s.answer}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                    {s.grade.kind === "verdict" ? (
                      <span className={`rounded px-1.5 py-0.5 font-medium ${s.grade.correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        BrowseComp grader: {s.grade.correct ? "correct" : "incorrect"}
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
                        loose list recall {s.grade.recall.toFixed(1)}
                      </span>
                    )}
                    <span className="text-slate-400">gold: {s.goldAnswer}</span>
                  </div>
                </Bubble>
              )}
            </AnimatePresence>
            {!seedShown && (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-400">
                The agent starts once the seed is ready.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- other seeds, same question */}
      <motion.div
        animate={{ opacity: compareShown ? 1 : 0.45 }}
        transition={{ duration: 0.4 }}
        className="mt-3 rounded-xl border border-slate-200 p-3"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            The same question with other seeds
          </p>
          <p className="text-[10.5px] text-slate-400">this question, one released run per condition (Table 5 setup)</p>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 @xl:grid-cols-3">
          {s.runs.map((r) => {
            const mine = r === lgrRun;
            const ok = r.listRecall !== null ? r.listRecall >= 0.999 : r.correct === true;
            return (
              <div key={r.runId}
                className={`rounded-lg px-3 py-2 ${mine ? "ring-2" : "ring-1 ring-slate-200"}`}
                style={mine ? { boxShadow: `inset 0 0 0 2px ${LGR.fused}`, background: LGR.fusedSoft } : undefined}>
                <p className={`text-[11.5px] ${mine ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                  {r.runId.endsWith("no_seed") ? "No seed" : `Seed: ${r.label}`}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <Dots n={r.searches} color={mine ? LGR.fused : LGR.search} />
                  <span className="font-mono text-[11px] text-slate-500">{r.searches} search{r.searches === 1 ? "" : "es"}</span>
                </div>
                <p className={`mt-1 text-[11px] font-medium ${ok ? "text-emerald-700" : "text-rose-600"}`}>
                  {r.listRecall !== null ? `loose list recall ${r.listRecall.toFixed(1)}` : r.correct ? "graded correct" : "graded incorrect"}
                </p>
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 px-1 text-[10.5px] leading-4 text-slate-400">
        <p className="max-w-2xl">
          {s.blurb} Real question, seed, searches and answer from the released runs; the agent&apos;s reasoning text is
          omitted, and &ldquo;needs&rdquo; summarises the gold evidence.
        </p>
        <Link href={traceHref} className="shrink-0 font-medium text-indigo-600 hover:text-indigo-800">
          Full trajectory →
        </Link>
      </div>
    </div>
  );
}
