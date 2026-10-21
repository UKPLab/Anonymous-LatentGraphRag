"use client";

/**
 * The backbone: one recursion, three views, one clock.
 *
 *   chain  the RDR operator animation: the state is encoded, its embedding scores a fixed index of
 *          documents or memories, the best unit x_k is appended, and the strokes of earlier hops
 *          stay so a small net builds up
 *   tree   the same recursion as a search tree: hop k = level k of the highlighted path; the last
 *          hop ends in the global readout
 *   net    the same lookups as similarity edges over text units: the latent graph of the recursion
 *
 * A master clock drives all three and the encode/retrieve/update row: hop k is the same moment in
 * every view, and everything hop k produces carries HOP[k − 1] (lgrPalette) in every view; the
 * state and query stay indigo. One set of controls (play/pause, hop chips that seek, replay) serves
 * the whole section; the chips double as its legend. No hyperparameter is quoted here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { claim } from "@/components/PaperTables/claims";
import { HOP, LGR } from "@/components/lgrPalette";
import RecursionLogo from "@/components/viz/RecursionLogo";
import RecursionGlyph from "@/components/viz/RecursionGlyph";
import PathTree, { type Phase } from "@/components/viz/PathTree";
import MiniLoop from "@/components/viz/MiniLoop";
import Formula from "@/components/viz/Formula";
import LatentGraphSimilarityPanel from "../Animation/LatentGraphSimilarityPanel";

/** Abstract: "Document-only recursive retrieval with RDR outperforms all evaluated graph pipelines on the three benchmarks; …" */
const DOC_ONLY_CLAIM = claim("doc-only-beats-graph").split(";")[0].replace("with RDR ", "with RDR-8B ") + ".";

/* ------------------------------------------------------------------ the master clock */

type Step = { hop: number; phase: Phase; ms: number };
const STEPS: Step[] = [];
for (let h = 1; h <= 4; h++) {
  STEPS.push({ hop: h, phase: "encode", ms: 1300 });
  STEPS.push({ hop: h, phase: "retrieve", ms: 1900 });
  STEPS.push(h < 4 ? { hop: h, phase: "update", ms: 1500 } : { hop: h, phase: "readout", ms: 3600 });
}
const REC = STEPS.reduce((a, s) => a + s.ms, 0);            // one recursion
const startOf = (hop: number, phase: Phase) => {
  let t = 0;
  for (const s of STEPS) { if (s.hop === hop && s.phase === phase) return t; t += s.ms; }
  return 0;
};
const PHASE_T0: Record<Phase, number> = { encode: 0, retrieve: 1 / 3, update: 2 / 3, readout: 2 / 3 };

const OPS = [
  { name: "Encode", eq: "s = [ι; q; O_s]", note: "the state, as text" },
  { name: "Retrieve", eq: "ℓ_s(x) = cos(f_θ(s), e_x)", note: "against a fixed index" },
  { name: "Update", eq: "s ⊕ x", note: "append the retrieved unit" },
];
const SUBS = "₁₂₃₄";

function useMasterClock(box: React.RefObject<HTMLDivElement | null>) {
  const [total, setTotal] = useState(0);                     // ms since the first recursion started
  const [paused, setPaused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const totalRef = useRef(0);
  totalRef.current = total;
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    // ?bb=<ms> freezes the section at that point of a recursion (screenshot checks)
    const fz = new URLSearchParams(window.location.search).get("bb");
    if (fz) { const id = requestAnimationFrame(() => { setTotal(Number(fz)); setPaused(true); }); return () => cancelAnimationFrame(id); }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => { setReduced(true); setTotal(startOf(4, "readout") + 1800); });
      return () => cancelAnimationFrame(id);
    }
    if (!box.current) return;
    const io = new IntersectionObserver((es) => setOnScreen(es.some((e) => e.isIntersecting)), { threshold: 0.15 });
    io.observe(box.current);
    return () => io.disconnect();
  }, [box]);

  useEffect(() => {
    if (paused || reduced || !onScreen) return;
    let raf = 0;
    const start = performance.now() - totalRef.current;
    const loop = (now: number) => { setTotal(Math.max(0, now - start)); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, reduced, onScreen, epoch]);

  const seek = useCallback((ms: number) => {
    const rec = Math.floor(totalRef.current / REC);
    setTotal(rec * REC + ms);
    totalRef.current = rec * REC + ms;
    setPaused(false);
    setEpoch((e) => e + 1);
  }, []);

  return { total, paused, setPaused, reduced, seek };
}

/* ------------------------------------------------------------------ the section */

export default function DecompositionFreeSection() {
  const box = useRef<HTMLDivElement | null>(null);
  const { total, paused, setPaused, reduced, seek } = useMasterClock(box);

  const rec = Math.floor(total / REC);
  const el = total - rec * REC;
  const { step, p } = useMemo(() => {
    let acc = 0;
    for (const s of STEPS) {
      if (el < acc + s.ms) return { step: s, p: (el - acc) / s.ms };
      acc += s.ms;
    }
    return { step: STEPS[STEPS.length - 1], p: 0.999 };
  }, [el]);
  const { hop, phase } = step;
  const hc = HOP[hop - 1];
  // the chain glyph keeps its own time base: one cycle per hop, thirds for the phases
  const cycle = rec * 4 + (hop - 1);
  const t = Math.min(0.9999, PHASE_T0[phase] + p / 3);
  const opActive = phase === "encode" ? 0 : phase === "retrieve" ? 1 : 2;

  const caption = (() => {
    const xs = Array.from({ length: hop - 1 }, (_, i) => `x${SUBS[i]}`).join("; ");
    const state = `[ι; q${xs ? "; " + xs : ""}]`;
    switch (phase) {
      case "encode": return `encode the state ${state}, as text.`;
      case "retrieve": return hop < 4
        ? "the state scores the index: similarity strokes in the chain, the scan in the tree and dashed edges in the net."
        : "the last state scores the index; its best unit x₄ is scored, not appended.";
      case "update": return `x${SUBS[hop - 1]} is appended to the state; the tree's path grows to level ${hop + 1}; x${SUBS[hop - 1]} is observed in the net.`;
      default: return "every state's scores aggregate into one ranked list; the net shows every hop's edges at once.";
    }
  })();

  return (
    <section className="border-t border-slate-200 bg-white px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <RecursionLogo size={46} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">The backbone</p>
            <h2 className="text-xl font-semibold leading-snug text-slate-900 md:text-2xl">Recursive Dense Retrieval</h2>
            <p className="text-[13.5px] text-slate-500">
              One operator predicts the next search state over documents or memories (RDR; Anonymous, 2026).
            </p>
          </div>
        </div>
        <p className="mt-3 inline-block rounded-lg border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-[14px] font-medium leading-relaxed text-indigo-900">
          {DOC_ONLY_CLAIM}
        </p>

        <div ref={box} className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          {/* one set of controls for the three views; the hop chips are also the section's legend */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPaused(!paused)} aria-label={paused || reduced ? "Play" : "Pause"} disabled={reduced}
              className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-40">
              {paused || reduced ? (
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.2 1.2 L8.6 5 L2.2 8.8 Z" fill="currentColor" /></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1" width="2.4" height="8" rx="0.6" fill="currentColor" /><rect x="6.1" y="1" width="2.4" height="8" rx="0.6" fill="currentColor" /></svg>
              )}
            </button>
            {HOP.map((hp, i) => {
              const on = hop === i + 1;
              const past = hop > i + 1;
              return (
                <button type="button" key={hp.name} onClick={() => seek(startOf(i + 1, "encode"))} disabled={reduced}
                  title={i < 3 ? `Jump to hop ${i + 1}` : "Jump to the last hop and the readout"}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:cursor-default"
                  style={{ borderColor: on ? hp.c : past ? hp.c + "66" : LGR.line, background: on ? hp.soft : "#fff", color: on || past ? hp.ink : "#94a3b8" }}>
                  <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: hp.c, opacity: on || past ? 1 : 0.45 }} />
                  {i < 3 ? <>hop {i + 1} · <span className="italic">x{SUBS[i]}</span></> : <>hop 4 · readout</>}
                </button>
              );
            })}
            <span className="inline-flex items-center gap-1.5 px-1 text-[11.5px] text-slate-500">
              <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: LGR.state }} />state / query
            </span>
            <button type="button" onClick={() => seek(0)} disabled={reduced}
              className="ml-auto rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40">
              Replay
            </button>
          </div>

          {/* chain (left) and tree (right) */}
          <div className="mt-2 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-center">
            <div className="min-w-0 overflow-x-auto">
              <div className="sm:min-w-[520px]">
                <RecursionGlyph t={t} cycle={cycle} />
              </div>
            </div>
            <div className="mx-auto w-full min-w-0 max-w-[380px] border-slate-100 lg:border-l lg:pl-4">
              <PathTree hop={hop} phase={phase} p={p} />
            </div>
          </div>

          {/* the operator's three steps, highlighted in the current phase */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-2">
            <MiniLoop active={opActive} />
            <ol className="order-3 grid w-full min-w-0 grid-cols-3 gap-1.5 sm:order-none sm:w-auto sm:flex-1 sm:gap-2">
              {OPS.map((st, i) => {
                const on = i === opActive;
                return (
                  <li key={st.name} className={`min-w-0 rounded-lg border px-2 py-1.5 transition-colors duration-200 sm:px-3 ${
                    on ? "border-indigo-300 bg-indigo-50/70" : "border-slate-200 bg-white"}`}>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className={`text-[10.5px] font-semibold uppercase tracking-wide ${on ? "text-indigo-600" : "text-slate-400"}`}>
                        {i + 1} · {i === 2 && phase === "readout" ? "Readout" : st.name}
                      </span>
                      <Formula tex={st.eq} className={`hidden text-[13.5px] sm:inline ${on ? "text-indigo-800" : "text-slate-600"}`} />
                    </div>
                    <div className={`text-[11.5px] ${on ? "text-slate-700" : "text-slate-400"}`}>
                      {i === 2 && phase === "readout" ? "last hop: scored, not appended" : st.note}
                    </div>
                  </li>
                );
              })}
            </ol>
            <span className="ml-auto whitespace-nowrap rounded-md border px-2 py-1 text-[11.5px] font-semibold tabular-nums sm:ml-0"
              style={{ borderColor: hc.c, color: hc.ink, background: hc.soft }}>
              hop {hop} / 4
            </span>
          </div>

          {/* the net: the same lookups as similarity edges over text units */}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
              <h3 className="text-[15px] font-semibold text-slate-900">Similarity-driven connections</h3>
              <p className="text-[12.5px] text-slate-500">
                the same hops as edges over text units; scores are recomputed after every observation, so a
                query-conditioned graph forms in the index. Hover a unit.
              </p>
            </div>
            <LatentGraphSimilarityPanel hop={hop} phase={phase} p={p} />
          </div>

          <p className="mt-1 min-h-[1.5em] text-[12.5px] leading-relaxed text-slate-600">
            <span className="font-semibold" style={{ color: hc.ink }}>
              {phase === "readout" ? "Hop 4 · readout" : `Hop ${hop} · ${phase}`}
            </span>{" · "}
            {caption}
          </p>
        </div>

        <p className="mx-auto mt-5 max-w-3xl text-center text-[14px] leading-relaxed text-slate-700">
          Any text can be observed: documents, and the{" "}
          <span className="font-medium" style={{ color: LGR.triple }}>triples</span> and{" "}
          <span className="font-medium" style={{ color: LGR.prop }}>propositions</span> constructed from
          them. Constructed knowledge therefore composes through the same embedder.
          <span aria-hidden="true" className="ml-1 text-slate-400">↓</span>
        </p>
      </div>
    </section>
  );
}
