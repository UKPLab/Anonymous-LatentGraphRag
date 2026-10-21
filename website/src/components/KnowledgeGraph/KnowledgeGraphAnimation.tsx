"use client";

/**
 * Constructed knowledge as retrievable memories (paper §3.1).
 *
 * The pipeline, left to right: source passages → LLM construction (OpenIE triples from the HippoRAG 2
 * release, propositions from the PropRAG release) → what graph pipelines do with the triples (a topology
 * to traverse) → the turn: LatentGraphRAG keeps the same units as text, in ONE memory index, each with its
 * source link π(m) → one encoder → a dense (latent) memory index.
 *
 * Everything shown is real MuSiQue data: four evidence passages of one question, the HippoRAG 2 release
 * triples and the PropRAG release propositions extracted from them (a selection). The vector positions
 * are a schematic of the latent space, not a projection of real embeddings.
 */

import { useState } from "react";
import { LGR } from "@/components/lgrPalette";
import { c01, ease, locate, PlayButton, startAt, StepChip, usePlayback } from "./usePlayback";

type PassageId = "p1" | "p2" | "p3" | "p4";
type Kind = "tri" | "prop";

const PASSAGES: { id: PassageId; title: string; text: string }[] = [
  { id: "p1", title: "Erik Jensen (American football)", text: "Erik Jensen (born October 11, 1980 in Appleton, Wisconsin) is a former American football tight end of the National Football League." },
  { id: "p2", title: "John C. Petersen", text: "… an American butcher and farmer from Appleton, Wisconsin who served as a member of the Wisconsin State Assembly from Outagamie County." },
  { id: "p3", title: "Pulaski High School", text: "… a public high school in Pulaski, Wisconsin, in Brown County, Wisconsin (school district also serves parts of Shawano, Outagamie and Oconto counties) …" },
  { id: "p4", title: "Jerome Quinn", text: "Born in Green Bay, Wisconsin, Quinn was a realtor and served on the Green Bay Common Council, the Brown County, Wisconsin Board of Supervisors …" },
];

/** HippoRAG 2 release triples, verbatim; the memory is the literal string "head relation tail." */
const TRIPLES: { h: string; r: string; t: string; src: PassageId }[] = [
  { h: "Erik Jensen", r: "was born in", t: "Appleton", src: "p1" },
  { h: "Erik Jensen", r: "is from", t: "Wisconsin", src: "p1" },
  { h: "John C. Petersen", r: "from", t: "Appleton", src: "p2" },
  { h: "John C. Petersen", r: "represented", t: "Outagamie County", src: "p2" },
  { h: "Pulaski High School", r: "located in", t: "Brown County", src: "p3" },
  { h: "Pulaski High School", r: "serves parts of", t: "Outagamie", src: "p3" },
  { h: "Jerome Quinn", r: "born in", t: "Green Bay", src: "p4" },
  { h: "Jerome Quinn", r: "is from", t: "Wisconsin", src: "p4" },
];
const literal = (i: number) => `${TRIPLES[i].h} ${TRIPLES[i].r} ${TRIPLES[i].t}.`;

/** PropRAG release propositions, verbatim. */
const PROPS: { text: string; src: PassageId }[] = [
  { text: "Erik Jensen was born on October 11, 1980, in Appleton, Wisconsin.", src: "p1" },
  { text: "John C. Petersen served as a member of the Wisconsin State Assembly, representing Outagamie County.", src: "p2" },
  { text: "Pulaski High School is situated in Brown County, Wisconsin.", src: "p3" },
  { text: "The school district of Pulaski High School also serves parts of Shawano, Outagamie, and Oconto counties.", src: "p3" },
  { text: "Jerome Quinn was born in Green Bay, Wisconsin.", src: "p4" },
  { text: "Jerome Quinn served on the Brown County Board of Supervisors.", src: "p4" },
];

/** the memory index, grouped by source passage */
const MEMS: { kind: Kind; i: number; text: string; src: PassageId }[] = (["p1", "p2", "p3", "p4"] as PassageId[]).flatMap((p) => [
  ...TRIPLES.map((t, i) => ({ kind: "tri" as const, i, text: literal(i), src: t.src })).filter((m) => m.src === p),
  ...PROPS.map((q, i) => ({ kind: "prop" as const, i, text: q.text, src: q.src })).filter((m) => m.src === p),
]);

/* ---------------- geometry (viewBox 1180 × 430) ---------------- */
const W = 1180, H = 430;
const PA = { x: 14, w: 172, y: 34, h: 88, gap: 8 };
const passY = (k: number) => PA.y + k * (PA.h + PA.gap);
const LLM = { x: 216, w: 150, h: 104, y: { tri: 62, prop: 246 } };
const GR = { x: 398, y: 40, w: 270, h: 176 };
const PR = { x: 398, y: 250, w: 270, row: 27 };
const IX = { x: 730, y: 40, w: 240, row: 26.6 };
const EN = { x: 998, y: 40, w: 168, h: 50 };
const VS = { x: 998, y: 118, w: 168, h: 272 };

const NODES: Record<string, { x: number; y: number }> = {
  "Erik Jensen": { x: 46, y: 14 }, Appleton: { x: 136, y: 14 }, "John C. Petersen": { x: 222, y: 14 },
  Wisconsin: { x: 46, y: 82 }, "Outagamie County": { x: 222, y: 66 }, Outagamie: { x: 234, y: 120 },
  "Brown County": { x: 110, y: 106 }, "Jerome Quinn": { x: 46, y: 152 }, "Green Bay": { x: 124, y: 152 },
  "Pulaski High School": { x: 206, y: 164 },
};
const nx = (n: string) => GR.x + NODES[n].x;
const ny = (n: string) => GR.y + NODES[n].y + 8;
const pillW = (s: string, f = 8.4) => s.length * f * 0.55 + 12;

/** schematic latent positions: memories of one passage lie close together */
const CENTER: Record<PassageId, [number, number]> = { p1: [1040, 168], p2: [1122, 214], p3: [1052, 300], p4: [1124, 340] };
const pointOf = (j: number): [number, number] => {
  const m = MEMS[j];
  const k = MEMS.filter((x, jj) => x.src === m.src && jj < j).length;
  const a = k * 2.4 + (m.kind === "prop" ? 0.9 : 0);
  const rr = 9 + (k % 2) * 7;
  return [r1(CENTER[m.src][0] + Math.cos(a) * rr), r1(CENTER[m.src][1] + Math.sin(a) * rr)];
};
/** integer hash → [0, 1): identical on server and client (no transcendental functions) */
const rnd = (i: number) => {
  let t = Math.imul(i + 1, 2654435761) >>> 0;
  t ^= t >>> 15; t = Math.imul(t, 2246822507) >>> 0; t ^= t >>> 13;
  return (t >>> 0) / 4294967296;
};
const r1 = (x: number) => Math.round(x * 10) / 10;
const BG = Array.from({ length: 70 }, (_, i) =>
  [r1(VS.x + 10 + rnd(2 * i) * (VS.w - 20)), r1(VS.y + 12 + rnd(2 * i + 1) * (VS.h - 24))] as [number, number]);

/** word wrap for SVG text at a character budget */
function wrap(s: string, n: number) {
  const out: string[] = []; let cur = "";
  for (const w of s.split(" ")) {
    if ((cur + " " + w).trim().length > n) { out.push(cur.trim()); cur = w; } else cur += " " + w;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* ---------------- timeline ---------------- */
type K = "passages" | "extract" | "turn" | "encode";
type Step = { k: K; i: number; ms: number };
const STEPS: Step[] = [
  { k: "passages", i: 0, ms: 1100 },
  ...[0, 1, 2, 3].map((i) => ({ k: "extract" as const, i, ms: 2700 })),
  { k: "turn", i: 0, ms: 3200 },
  { k: "encode", i: 0, ms: 3400 },
];
const TOTAL = STEPS.reduce((a, s) => a + s.ms, 0);
const sIdx = (k: K, i = 0) => STEPS.findIndex((s) => s.k === k && s.i === i);

/** emission window of each artifact within its passage's extract step */
const WIN = (() => {
  const tri: [number, number][] = [], prop: [number, number][] = [];
  for (const p of ["p1", "p2", "p3", "p4"] as PassageId[]) {
    TRIPLES.forEach((t, i) => { if (t.src === p) { const k = tri.filter((_, j) => TRIPLES[j].src === p).length; tri[i] = [0.22 + k * 0.24, 0.46 + k * 0.24]; } });
    PROPS.forEach((q, i) => { if (q.src === p) { const k = PROPS.slice(0, i).filter((x) => x.src === p).length; prop[i] = [0.32 + k * 0.24, 0.56 + k * 0.24]; } });
  }
  return { tri, prop };
})();
const pIndex = (p: PassageId) => ["p1", "p2", "p3", "p4"].indexOf(p);

type Hover = { kind: "mem"; j: number } | { kind: "passage"; id: PassageId } | null;

export default function KnowledgeGraphAnimation() {
  const { el, playing, done, seek, toggle, replay, box } = usePlayback(TOTAL, "kg");
  const [hover, setHover] = useState<Hover>(null);
  const { si, sp } = locate(STEPS, el);
  const step = STEPS[si];
  const prog = (j: number) => (si > j ? 1 : si === j ? sp : 0);

  /** progress of an artifact's flight (0 before, 1 once landed) */
  const flight = (kind: Kind, i: number) => {
    const src = kind === "tri" ? TRIPLES[i].src : PROPS[i].src;
    const [a, b] = kind === "tri" ? WIN.tri[i] : WIN.prop[i];
    return c01((prog(sIdx("extract", pIndex(src))) - a) / (b - a));
  };
  const turnP = prog(sIdx("turn"));
  const encP = prog(sIdx("encode"));
  const rowShown = (j: number) => c01((turnP - (j / MEMS.length) * 0.75) / 0.12);
  const encoded = (j: number) => c01((encP - (j / MEMS.length) * 0.82) / 0.1);
  const activeP: PassageId | null = step.k === "extract" && !done ? PASSAGES[step.i].id : null;
  const streaming = step.k === "extract" && !done && sp > 0.08 && sp < 0.92;

  const hovSrc: PassageId | null = hover ? (hover.kind === "passage" ? hover.id : MEMS[hover.j].src) : null;
  const memHot = (j: number) => (hover?.kind === "mem" && hover.j === j) || (hover?.kind === "passage" && MEMS[j].src === hover.id);
  const triHot = (i: number) => MEMS.some((m, j) => m.kind === "tri" && m.i === i && memHot(j));
  const propHot = (i: number) => MEMS.some((m, j) => m.kind === "prop" && m.i === i && memHot(j));
  const nodeShown = (n: string) => TRIPLES.some((t, i) => flight("tri", i) >= 1 && (t.h === n || t.t === n));
  const graphDim = turnP > 0 ? 1 - 0.45 * c01(turnP * 3) : 1;

  const narration = (() => {
    switch (step.k) {
      case "passages": return { t: "Four MuSiQue passages · evidence for one question", s: "What is the capital of the county that shares a border with the county whose capital is the birthplace of Erik Jensen?" };
      case "extract": return {
        t: `LLM construction · ${PASSAGES[step.i].title}`,
        s: "OpenIE (HippoRAG 2 release) emits (head, relation, tail) triples; PropRAG (release) emits self-contained propositions. Both come from the same passage.",
      };
      case "turn": return {
        t: "Graph pipelines traverse the topology; LatentGraphRAG keeps the units as text",
        s: "Each triple becomes the literal string “head relation tail.”, propositions keep their text, and every memory keeps its source link π(m) to its passage.",
      };
      default: return {
        t: "One encoder · a dense memory index",
        s: "Every memory becomes a vector in the same latent space as the queries; the memory tree searches it with the same recursive operator as the document tree.",
      };
    }
  })();
  const chips: { label: string; j: number; ks: K[] }[] = [
    { label: "1 · passages", j: sIdx("passages"), ks: ["passages"] },
    { label: "2 · LLM construction", j: sIdx("extract", 0), ks: ["extract"] },
    { label: "3 · units as text", j: sIdx("turn"), ks: ["turn"] },
    { label: "4 · encoded index", j: sIdx("encode"), ks: ["encode"] },
  ];

  return (
    <section className="bg-white px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 text-center">
          <h2 className="mb-2 text-xl font-bold text-gray-900 md:text-2xl lg:text-3xl">
            Constructed Knowledge as Retrievable Memories
          </h2>
          <p className="mx-auto max-w-3xl text-sm text-gray-600">
            Graph pipelines turn LLM-extracted relations into a topology to traverse. LatentGraphRAG keeps the same
            units as text: triples as the literal string &ldquo;head relation tail.&rdquo;, propositions as they are,
            in <span className="font-semibold text-slate-800">one memory index</span> whose entries link back to their
            source passage through <span className="font-mono text-blue-700">π(m)</span>, encoded into a dense index.
          </p>
        </div>

        <div ref={box} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <PlayButton playing={playing} onClick={toggle} />
            {chips.map((c) => {
              const active = c.ks.includes(step.k) && !done;
              return <StepChip key={c.label} label={c.label} state={active ? "active" : done || si > c.j ? "past" : "next"}
                onClick={() => seek(startAt(STEPS, c.j))} />;
            })}
            <button onClick={replay}
              className="ml-auto rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:border-slate-300 hover:bg-slate-50">
              {playing ? "Restart" : "Replay"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[860px]" role="img"
              aria-label="LLM construction of triples and propositions, one memory index, and its dense encoding">
              <defs>
                <marker id="kg-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#cbd5e1" />
                </marker>
                <marker id="kg-ai" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={LGR.state} />
                </marker>
              </defs>

              {/* column labels */}
              {[
                [PA.x, "SOURCE PASSAGES"], [LLM.x, "LLM CONSTRUCTION"], [GR.x, "GRAPH PIPELINES · TOPOLOGY"],
                [IX.x, "LATENTGRAPHRAG · UNITS AS TEXT"], [EN.x, "ENCODED"],
              ].map(([x, l]) => (
                <text key={l as string} x={x as number} y={18} fontSize="9" fill="#94a3b8" letterSpacing="0.08em">{l}</text>
              ))}

              {/* ---------- passages ---------- */}
              {PASSAGES.map((p, k) => {
                const y = passY(k);
                const lit = activeP === p.id || hovSrc === p.id;
                const shown = si > 0 || done ? 1 : 0.3 + 0.7 * c01(sp * 3 - k * 0.4);
                return (
                  <g key={p.id} opacity={shown} onMouseEnter={() => setHover({ kind: "passage", id: p.id })} onMouseLeave={() => setHover(null)}>
                    <rect x={PA.x} y={y} width={PA.w} height={PA.h} rx={7} fill={lit ? "#eff6ff" : "#fff"}
                      stroke={lit ? LGR.doc : "#e2e8f0"} strokeWidth={lit ? 1.4 : 1} />
                    <rect x={PA.x + 7} y={y + 7} width={17} height={12} rx={3} fill="#dbeafe" />
                    <text x={PA.x + 15.5} y={y + 16} textAnchor="middle" fontSize="8" fontWeight={700} fill="#1d4ed8" fontFamily="ui-monospace, monospace">{p.id}</text>
                    <text x={PA.x + 29} y={y + 16.5} fontSize="9.2" fontWeight={600} fill={LGR.ink}>{trunc(p.title, 27)}</text>
                    {wrap(p.text, 37).slice(0, 5).map((ln, i) => (
                      <text key={i} x={PA.x + 8} y={y + 31 + i * 11} fontSize="8" fill="#64748b">{ln}</text>
                    ))}
                  </g>
                );
              })}

              {/* passage → LLM arrows */}
              {PASSAGES.map((p, k) => (["tri", "prop"] as Kind[]).map((kind) => {
                const y0 = passY(k) + PA.h / 2, y1 = LLM.y[kind] + LLM.h / 2;
                const on = activeP === p.id;
                return (
                  <path key={`${p.id}${kind}`} d={`M${PA.x + PA.w},${y0} C${PA.x + PA.w + 18},${y0} ${LLM.x - 18},${y1} ${LLM.x - 2},${y1}`}
                    fill="none" stroke={on ? LGR.doc : "#e2e8f0"} strokeWidth={on ? 1.4 : 0.9} markerEnd={on ? undefined : "url(#kg-a)"} />
                );
              }))}

              {/* ---------- LLM cards ---------- */}
              {(["tri", "prop"] as Kind[]).map((kind) => {
                const y = LLM.y[kind];
                const col = kind === "tri" ? LGR.triple : LGR.prop;
                const soft = kind === "tri" ? LGR.tripleSoft : LGR.propSoft;
                return (
                  <g key={kind}>
                    <rect x={LLM.x} y={y} width={LLM.w} height={LLM.h} rx={9} fill="#fff" stroke={streaming ? col : "#cbd5e1"} strokeWidth={streaming ? 1.6 : 1} />
                    <rect x={LLM.x + 9} y={y + 9} width={26} height={18} rx={4} fill={soft} stroke={col} strokeWidth={0.8} />
                    <text x={LLM.x + 22} y={y + 21.5} textAnchor="middle" fontSize="8" fontWeight={700} fill={col}>LLM</text>
                    <text x={LLM.x + 42} y={y + 17} fontSize="10" fontWeight={600} fill={LGR.ink}>{kind === "tri" ? "OpenIE" : "PropRAG"}</text>
                    <text x={LLM.x + 42} y={y + 28} fontSize="8" fill="#64748b">{kind === "tri" ? "HippoRAG 2 release" : "PropRAG release"}</text>
                    {/* streaming tokens */}
                    {[0, 1, 2, 3].map((r) => {
                      const full = LLM.w - 20 - ((r * 23) % 37);
                      const p = streaming ? c01((sp - 0.1 - r * 0.15) / 0.25) : done || si > 4 ? 1 : 0;
                      return (
                        <g key={r}>
                          <rect x={LLM.x + 10} y={y + 42 + r * 13} width={full} height={6} rx={3} fill="#f1f5f9" />
                          <rect x={LLM.x + 10} y={y + 42 + r * 13} width={full * p} height={6} rx={3} fill={col} opacity={streaming ? 0.55 : 0.18} />
                        </g>
                      );
                    })}
                    <text x={LLM.x + LLM.w / 2} y={y + LLM.h + 13} textAnchor="middle" fontSize="8" fill="#94a3b8">
                      {kind === "tri" ? "emits (head, relation, tail)" : "emits propositions"}
                    </text>
                  </g>
                );
              })}

              {/* ---------- graph (topology) ---------- */}
              <g opacity={graphDim}>
                <rect x={GR.x - 6} y={GR.y - 8} width={GR.w + 12} height={GR.h + 18} rx={8} fill="#fafafa" stroke="#eef2f7" />
                {TRIPLES.map((t, i) => {
                  const f = flight("tri", i);
                  if (f < 1) return null;
                  const hot = triHot(i);
                  const fresh = step.k === "extract" && !done && TRIPLES[i].src === activeP;
                  const mx = (nx(t.h) + nx(t.t)) / 2, my = (ny(t.h) + ny(t.t)) / 2;
                  return (
                    <g key={i}>
                      <line x1={nx(t.h)} y1={ny(t.h)} x2={nx(t.t)} y2={ny(t.t)} stroke={hot || fresh ? LGR.triple : "#94a3b8"} strokeWidth={hot || fresh ? 2 : 1.1} />
                      {(hot || fresh) && (
                        <g>
                          <rect x={mx - pillW(t.r, 7.6) / 2} y={my - 7} width={pillW(t.r, 7.6)} height={13} rx={6.5} fill={LGR.triple} />
                          <text x={mx} y={my + 2.6} textAnchor="middle" fontSize="7.6" fill="#fff">{t.r}</text>
                        </g>
                      )}
                    </g>
                  );
                })}
                {Object.keys(NODES).map((n) => nodeShown(n) && (
                  <g key={n}>
                    <rect x={nx(n) - pillW(n) / 2} y={ny(n) - 8} width={pillW(n)} height={16} rx={8} fill="#fff" stroke="#94a3b8" strokeWidth={0.9} />
                    <text x={nx(n)} y={ny(n) + 3} textAnchor="middle" fontSize="8.4" fill={LGR.ink}>{n}</text>
                  </g>
                ))}
                {flight("tri", 5) >= 1 && (
                  <g>
                    <line x1={nx("Outagamie County") + 6} y1={ny("Outagamie County") + 8} x2={nx("Outagamie") - 2} y2={ny("Outagamie") - 8}
                      stroke={LGR.path} strokeWidth={1.1} strokeDasharray="3 3" />
                    <text x={nx("Outagamie") - 26} y={ny("Outagamie County") + 22} textAnchor="end" fontSize="8" fill="#9a6400">
                      ≠ two strings, two nodes
                    </text>
                  </g>
                )}
                {!nodeShown("Erik Jensen") && (
                  <text x={GR.x + GR.w / 2} y={GR.y + GR.h / 2} textAnchor="middle" fontSize="10" fill="#cbd5e1">the graph forms here</text>
                )}
              </g>
              {/* flying triples */}
              {TRIPLES.map((t, i) => {
                const f = flight("tri", i);
                if (f <= 0 || f >= 1) return null;
                const u = ease(f);
                const x0 = LLM.x + LLM.w, y0 = LLM.y.tri + LLM.h / 2;
                const x1 = (nx(t.h) + nx(t.t)) / 2, y1 = (ny(t.h) + ny(t.t)) / 2;
                const label = `(${t.h}, ${t.r}, ${t.t})`;
                const w = pillW(label, 7.6);
                return (
                  <g key={`fly${i}`} transform={`translate(${x0 + (x1 - x0) * u},${y0 + (y1 - y0) * u})`}>
                    <rect x={-w / 2} y={-7} width={w} height={14} rx={7} fill={LGR.tripleSoft} stroke={LGR.triple} strokeWidth={0.9} />
                    <text x={0} y={2.8} textAnchor="middle" fontSize="7.6" fill="#065f46">{label}</text>
                  </g>
                );
              })}

              {/* ---------- propositions ---------- */}
              <g opacity={graphDim < 1 ? 0.75 + 0.25 * (graphDim - 0.55) / 0.45 : 1}>
                {PROPS.map((q, i) => {
                  const f = flight("prop", i);
                  if (f <= 0) return null;
                  const u = ease(f);
                  const yS = PR.y + i * PR.row;
                  const x0 = LLM.x + LLM.w, y0 = LLM.y.prop + LLM.h / 2;
                  const x = x0 + (PR.x - x0) * u, y = y0 + (yS - y0) * u;
                  const hot = propHot(i);
                  return (
                    <g key={i} opacity={0.4 + 0.6 * u}>
                      <rect x={x} y={y} width={PR.w * (0.35 + 0.65 * u)} height={PR.row - 4} rx={5}
                        fill={hot ? "#ede9fe" : LGR.propSoft} stroke={hot ? LGR.prop : "#ddd6fe"} strokeWidth={hot ? 1.3 : 0.8} />
                      <rect x={x} y={y} width={3} height={PR.row - 4} rx={1.5} fill={LGR.prop} />
                      {u > 0.85 && wrap(q.text, 63).slice(0, 2).map((ln, k) => (
                        <text key={k} x={x + 9} y={y + 9.5 + k * 9.6} fontSize="7.9" fill="#3b0764">{ln}</text>
                      ))}
                    </g>
                  );
                })}
                {flight("prop", 0) <= 0 && (
                  <text x={PR.x + PR.w / 2} y={PR.y + 70} textAnchor="middle" fontSize="10" fill="#cbd5e1">propositions arrive here</text>
                )}
              </g>

              {/* ---------- the turn ---------- */}
              {turnP > 0 && (
                <g opacity={c01(turnP * 4)}>
                  <path d={`M${GR.x + GR.w + 8},${GR.y + GR.h / 2} C${IX.x - 20},${GR.y + GR.h / 2} ${IX.x - 28},${IX.y + 70} ${IX.x - 4},${IX.y + 70}`}
                    fill="none" stroke={LGR.triple} strokeWidth={1.3} markerEnd="url(#kg-a)" />
                  <path d={`M${PR.x + PR.w + 8},${PR.y + 70} C${IX.x - 20},${PR.y + 70} ${IX.x - 28},${IX.y + 270} ${IX.x - 4},${IX.y + 270}`}
                    fill="none" stroke={LGR.prop} strokeWidth={1.3} markerEnd="url(#kg-a)" />
                  <text x={GR.x + GR.w + 10} y={GR.y + GR.h / 2 - 6} fontSize="8" fill="#065f46">as text</text>
                  <text x={PR.x + PR.w + 10} y={PR.y + 64} fontSize="8" fill="#5b21b6">as text</text>
                </g>
              )}

              {/* ---------- one memory index ---------- */}
              <rect x={IX.x - 6} y={IX.y - 8} width={IX.w + 12} height={MEMS.length * IX.row + 12} rx={8}
                fill={turnP > 0 ? "#f8faff" : "#fff"} stroke={turnP > 0 ? "#c7d2fe" : "#e2e8f0"} />
              {turnP <= 0 && (
                <text x={IX.x + IX.w / 2} y={IX.y + 180} textAnchor="middle" fontSize="10" fill="#cbd5e1">one memory index M</text>
              )}
              {MEMS.map((m, j) => {
                const o = rowShown(j);
                if (o <= 0) return null;
                const y = IX.y + j * IX.row;
                const hot = memHot(j);
                const enc = encoded(j);
                const col = m.kind === "tri" ? LGR.triple : LGR.prop;
                return (
                  <g key={j} opacity={o} onMouseEnter={() => setHover({ kind: "mem", j })} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
                    <rect x={IX.x} y={y} width={IX.w} height={IX.row - 4} rx={4} fill={hot ? (m.kind === "tri" ? LGR.tripleSoft : LGR.propSoft) : "#fff"}
                      stroke={hot ? col : enc > 0.5 ? "#c7d2fe" : "#e2e8f0"} strokeWidth={hot ? 1.3 : 0.8} />
                    {m.kind === "tri"
                      ? <rect x={IX.x + 6} y={y + 7.5} width={7} height={7} rx={1.2} fill={col} />
                      : <circle cx={IX.x + 9.5} cy={y + 11} r={3.6} fill={col} />}
                    <text x={IX.x + 18} y={y + 14.2} fontSize="8.3" fill={LGR.ink}>{trunc(m.text, 41)}</text>
                    <rect x={IX.x + IX.w - 24} y={y + 5} width={20} height={12} rx={3} fill="#dbeafe" />
                    <text x={IX.x + IX.w - 14} y={y + 14} textAnchor="middle" fontSize="7.6" fontWeight={700} fill="#1d4ed8" fontFamily="ui-monospace, monospace">{m.src}</text>
                  </g>
                );
              })}

              {/* ---------- encoder + dense index ---------- */}
              <path d={`M${IX.x + IX.w + 8},${IX.y + 20} L${EN.x - 3},${EN.y + EN.h / 2}`} fill="none"
                stroke={encP > 0 ? LGR.state : "#e2e8f0"} strokeWidth={1.2} markerEnd={encP > 0 ? "url(#kg-ai)" : "url(#kg-a)"} />
              <rect x={EN.x} y={EN.y} width={EN.w} height={EN.h} rx={9} fill="#fff"
                stroke={encP > 0 && encP < 1 ? LGR.state : "#cbd5e1"} strokeWidth={encP > 0 && encP < 1 ? 2 : 1} />
              <text x={EN.x + EN.w / 2} y={EN.y + 20} textAnchor="middle" fontSize="10.5" fontWeight={600} fill={LGR.ink}>RDR encoder f<tspan fontSize="8" dy="2">θ</tspan></text>
              <rect x={EN.x + 14} y={EN.y + 30} width={EN.w - 28} height={5} rx={2.5} fill="#f1f5f9" />
              <rect x={EN.x + 14} y={EN.y + 30} width={(EN.w - 28) * encP} height={5} rx={2.5} fill={LGR.state} opacity={encP < 1 ? 1 : 0.3} />
              <text x={EN.x + EN.w / 2} y={EN.y + 46} textAnchor="middle" fontSize="7.6" fill="#94a3b8">same encoder as documents and queries</text>
              <path d={`M${VS.x + VS.w / 2},${EN.y + EN.h + 2} L${VS.x + VS.w / 2},${VS.y - 4}`} stroke={encP > 0 ? LGR.state : "#e2e8f0"} strokeWidth={1.2}
                markerEnd={encP > 0 ? "url(#kg-ai)" : "url(#kg-a)"} />
              <rect x={VS.x} y={VS.y} width={VS.w} height={VS.h} rx={12} fill="#f8faff" stroke="#e0e7ff" />
              {BG.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.3} fill="#c7d2fe" opacity={0.55} />)}
              {MEMS.map((m, j) => {
                const e = encoded(j);
                if (e <= 0) return null;
                const [x, y] = pointOf(j);
                const hot = memHot(j);
                const col = m.kind === "tri" ? LGR.triple : LGR.prop;
                return (
                  <g key={j} onMouseEnter={() => setHover({ kind: "mem", j })} onMouseLeave={() => setHover(null)}>
                    {hot && <circle cx={x} cy={y} r={7.5} fill="none" stroke={col} strokeWidth={1.2} />}
                    {m.kind === "tri"
                      ? <rect x={x - 3.4 * e} y={y - 3.4 * e} width={6.8 * e} height={6.8 * e} rx={1.2} fill={col} opacity={0.9} />
                      : <circle cx={x} cy={y} r={3.6 * e} fill={col} opacity={0.9} />}
                  </g>
                );
              })}
              {encP > 0.95 && (["p1", "p2", "p3", "p4"] as PassageId[]).map((p) => (
                <text key={p} x={CENTER[p][0] + 20} y={CENTER[p][1] - 14} fontSize="7.6" fill="#94a3b8" fontFamily="ui-monospace, monospace">{p}</text>
              ))}
              <text x={VS.x + VS.w / 2} y={VS.y + VS.h + 13} textAnchor="middle" fontSize="8.4" fill="#64748b">dense memory index</text>
              <text x={VS.x + VS.w / 2} y={VS.y + VS.h + 24} textAnchor="middle" fontSize="7.8" fill="#94a3b8">one vector e<tspan fontSize="6.2" dy="2">m</tspan><tspan dy="-2"> per memory</tspan></text>
            </svg>
          </div>

          <div className="mt-2 rounded-md bg-slate-50 px-3 py-2">
            <p className="text-[12.5px] font-semibold text-slate-900">{done ? "One memory index, encoded into a dense index" : narration.t}</p>
            <p className="text-[11.5px] text-slate-500">
              {done ? "Graph pipelines traverse the extracted topology; LatentGraphRAG searches the same units as text in a latent space. Hover a passage, a memory or a point." : narration.s}
            </p>
          </div>
          <p className="mt-1.5 text-[10.5px] text-slate-400">
            Real MuSiQue passages, HippoRAG 2 release triples and PropRAG release propositions (a selection). Vector positions are schematic.
          </p>
        </div>
      </div>
    </section>
  );
}
