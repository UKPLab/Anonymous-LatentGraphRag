"use client";

/**
 * RecursionGlyph — the RDR loop as a minimal animation (ported from the Recursive Dense Retrieval
 * site). LatentGraphRAG version: the units are generic (documents or memories) and everything a
 * hop produces is drawn in that hop's colour (HOP in lgrPalette: the similarity strokes, the
 * retrieved unit x_k with its label, and the x_k chip in the state), the same colours the search
 * tree and the similarity net of the backbone section use. The strokes of earlier hops stay
 * faintly so a small net builds up over one recursion; the last hop is scored for the readout
 * instead of being appended.
 *
 * One cycle = Encode → Retrieve → Update. Four cycles are one recursion of depth 4: the state
 * starts as [ι; q] and every turn concatenates the retrieved document onto its context, so the
 * context block grows by one document per turn and visibly becomes one longer text (the new page
 * merges into the block, its border dissolves). After the fourth document the context clears and
 * the next recursion starts, so the animation can run forever. Usable as a hero figure, a loading
 * indicator, or the basis of a logo.
 *
 *   state   [ι][q][ context … ]  — instruction, query, and the observed documents as one text
 *   encoder RDR-8B, f_θ          — the same weights every turn (links to the model card)
 *   z       a short vector strip leaving the encoder
 *   index   a cloud of fixed document points; dashed similarity strokes from z to its
 *           neighbours, the nearest lights up, travels back as a document and is appended
 *
 * The parent drives time: `t` in [0, 1) is the phase within the current cycle and `cycle`
 * counts cycles (cycle % 4 = documents already in the context; it also varies where the query
 * lands). `labels={false}` gives the bare glyph.
 */

import { HOP } from "@/components/lgrPalette";

const W = 560;
const H = 250;

const C = {
  ink: "#0f172a", mute: "#64748b", faint: "#94a3b8", line: "#cbd5e1",
  state: "#4f46e5", stateSoft: "#e0e7ff", instr: "#6d5bd0", instrSoft: "#ede9fe",
  cloud: "#cbd5e1",
};

const c01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/* deterministic point cloud for the index */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const CLOUD = (() => {
  const r = rng(7);
  const pts: [number, number][] = [];
  let guard = 0;
  while (pts.length < 58 && guard++ < 4000) {
    const x = 382 + r() * 160, y = 34 + r() * 182;
    // keep a soft elliptical boundary
    const dx = (x - 462) / 84, dy = (y - 125) / 96;
    if (dx * dx + dy * dy > 1) continue;
    if (pts.some(([px, py]) => Math.hypot(px - x, py - y) < 13)) continue;
    pts.push([x, y]);
  }
  return pts;
})();

/* where the query lands on cycle k (cycles through a few spots inside the cloud) */
const SPOTS: [number, number][] = [[446, 92], [488, 150], [430, 168], [474, 74], [452, 126]];

/* the 7 nearest index points of every landing spot (nearest first) */
const NEAR: number[][] = SPOTS.map((sp) => CLOUD.map((p, i) => ({ i, d: Math.hypot(p[0] - sp[0], p[1] - sp[1]) }))
  .sort((a, b) => a.d - b.d).slice(0, 7).map((x) => x.i));
const spotIdx = (k: number) => ((k % SPOTS.length) + SPOTS.length) % SPOTS.length;

/* geometry */
const STRIP = { x: 12, y: 106, h: 26 };
const CHIP = 22, GAP = 5;
const SEG = 27;                 // width of one document inside the context block
const MAXDOCS = 4;              // depth 4: the context holds up to four documents
const ENC = { x: 226, y: 92, w: 54, h: 54 };
const VEC = { x: 296, y: 119 };
const MODEL_URL = "https://anonymous.4open.science/w/Recursive-Dense-Retrieval/";

function Page({ x, y, fill, stroke, s = 1, opacity = 1 }: { x: number; y: number; fill: string; stroke: string; s?: number; opacity?: number }) {
  const w = 14 * s, h = 18 * s, c = 4.5 * s;
  return (
    <g opacity={opacity} transform={`translate(${x - w / 2} ${y - h / 2})`}>
      <path d={`M0,0 h${w - c} l${c},${c} v${h - c} h${-w} z`} fill={fill} stroke={stroke} strokeWidth={1.2} strokeLinejoin="round" />
      <path d={`M${w - c},0 v${c} h${c}`} fill="none" stroke={stroke} strokeWidth={1} strokeLinejoin="round" />
      {[0.45, 0.62, 0.79].map((f, i) => (
        <line key={i} x1={2.6 * s} x2={w - (i === 2 ? 5 : 2.6) * s} y1={h * f} y2={h * f} stroke={stroke} strokeWidth={0.9} opacity={0.55} />
      ))}
    </g>
  );
}

export default function RecursionGlyph({ t, cycle = 0, labels = true }: { t: number; cycle?: number; labels?: boolean }) {
  // phases: 0–⅓ encode, ⅓–⅔ retrieve, ⅔–1 update
  const pe = c01(t * 3), pr = c01(t * 3 - 1), pu = c01(t * 3 - 2);
  const spot = SPOTS[((cycle % SPOTS.length) + SPOTS.length) % SPOTS.length];
  // nearest cloud points to the query spot
  const near = NEAR[spotIdx(cycle)].map((i) => ({ i }));
  const hit = CLOUD[near[0].i];

  // context: n documents at the start of this turn; the update appends one (merge) and, after
  // the last turn of the recursion, the context clears so the next cycle starts at [ι; q]
  const n = ((cycle % MAXDOCS) + MAXDOCS) % MAXDOCS;
  const slotX = (k: number) => STRIP.x + 6 + k * (CHIP + GAP);
  const blockX = slotX(2);
  // the last hop of the recursion is a leaf: it is scored for the readout, not appended
  const leaf = n === MAXDOCS - 1;
  const merge = leaf ? 0 : ease(c01((pu - 0.55) / 0.3)); // new page dissolves into the block
  const clear = n === MAXDOCS - 1 ? ease(c01((pu - 0.86) / 0.14)) : 0;
  const count = n + merge;                                // documents in the block (fractional while merging)
  const stripW = 6 + 2 * (CHIP + GAP) + MAXDOCS * SEG + 4;
  const ty = STRIP.y + STRIP.h / 2;

  // encoder pulse and the vector leaving it
  const encOn = pe > 0 && pe < 1;
  const vecIn = ease(c01((pe - 0.55) / 0.45));
  // query point travelling into the cloud
  const fly = ease(c01(pr / 0.35));
  const qx = VEC.x + 26 + (spot[0] - VEC.x - 26) * fly;
  const qy = VEC.y + (spot[1] - VEC.y) * fly;
  const strokes = c01((pr - 0.3) / 0.45);
  const lit = c01((pr - 0.78) / 0.22);
  // the selected point travelling back as a document (lower arc), landing at the block's end
  const back = ease(c01(pu / 0.6));
  const tx = blockX + n * SEG + SEG / 2 - 1;
  const bx = (1 - back) * (1 - back) * hit[0] + 2 * (1 - back) * back * ((hit[0] + tx) / 2) + back * back * tx;
  const by = (1 - back) * (1 - back) * hit[1] + 2 * (1 - back) * back * 236 + back * back * ty;

  const shown = Math.ceil(count - 1e-6);
  const hc = HOP[n];                                      // this hop's colour
  const SUBS = "₁₂₃₄";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label="Recursive dense retrieval loop: encode the state, retrieve the nearest unit from a fixed index of documents or memories, append it to the state and encode again">
      <defs>
        <marker id="rg-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={C.line} />
        </marker>
      </defs>

      {/* ---------- state: [ι][q][context block] ---------- */}
      <rect x={STRIP.x} y={STRIP.y - 6} width={stripW} height={STRIP.h + 12} rx={9} fill="#fff"
        stroke={encOn ? C.state : "#c7d2fe"} strokeWidth={encOn ? 2 : 1.4} />
      <rect x={slotX(0)} y={STRIP.y} width={CHIP} height={STRIP.h} rx={5} fill={C.instrSoft} />
      <text x={slotX(0) + CHIP / 2} y={STRIP.y + 18} textAnchor="middle" fontSize="14" fontWeight={700} fill={C.instr}>ι</text>
      <rect x={slotX(1)} y={STRIP.y} width={CHIP} height={STRIP.h} rx={5} fill={C.stateSoft} />
      <text x={slotX(1) + CHIP / 2} y={STRIP.y + 18} textAnchor="middle" fontSize="14" fontWeight={700} fill={C.state}>q</text>
      {/* empty context: a dashed slot */}
      <rect x={blockX} y={STRIP.y} width={MAXDOCS * SEG - 3} height={STRIP.h} rx={5} fill="none"
        stroke={C.line} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
      {shown > 0 && (
        <g opacity={1 - clear}>
          {/* the observed units, one chip per hop, in that hop's colour */}
          {Array.from({ length: shown }, (_, j) => {
            const x0 = blockX + j * SEG;
            const op = j === n ? merge : 1;
            const fresh = j === n || (j === n - 1 && pe < 0.8);
            return (
              <g key={j} opacity={op}>
                <rect x={x0} y={STRIP.y} width={SEG - 3} height={STRIP.h} rx={5} fill={HOP[j].soft} stroke={HOP[j].c}
                  strokeWidth={fresh ? 1.8 : 1.2} />
                <text x={x0 + (SEG - 3) / 2} y={STRIP.y + 17.5} textAnchor="middle" fontSize="12.5" fontStyle="italic"
                  fontWeight={700} fill={HOP[j].ink}>x{SUBS[j]}</text>
              </g>
            );
          })}
        </g>
      )}
      {/* the label spells out the concatenation: [ι; q] → [ι; q; d₁] → … → [ι; q; d₁; d₂; d₃; d₄] */}
      {labels && (
        <text x={STRIP.x} y={STRIP.y - 14} fontSize="10.5" fill={C.faint} letterSpacing="0.04em">
          {(() => {
            const k = clear > 0.5 ? 0 : n + (merge > 0.5 ? 1 : 0);
            return (
              <>
                {"STATE  [ι; q"}
                {Array.from({ length: k }, (_, i) => (
                  <tspan key={i}>; <tspan fill={HOP[i].ink} fontWeight={700}>x{SUBS[i]}</tspan></tspan>
                ))}
                {"]"}
              </>
            );
          })()}
        </text>
      )}

      {/* ---------- state → encoder ---------- */}
      <line x1={STRIP.x + stripW + 4} y1={ty} x2={ENC.x - 6} y2={ty} stroke={C.line} strokeWidth={1.4} markerEnd="url(#rg-a)" />
      {encOn && (() => {
        const u = c01(pe / 0.5);
        const x = STRIP.x + stripW + 4 + (ENC.x - 10 - STRIP.x - stripW - 4) * u;
        return <circle cx={x} cy={ty} r={3.4} fill={C.state} opacity={1 - c01((pe - 0.45) / 0.1)} />;
      })()}

      {/* ---------- encoder (RDR-8B; the box and its label link to the model card) ---------- */}
      {(() => {
        const enc = (
          <g>
            <rect x={ENC.x} y={ENC.y} width={ENC.w} height={ENC.h} rx={12}
              fill={encOn ? C.stateSoft : "#f8fafc"} stroke={encOn ? C.state : "#94a3b8"} strokeWidth={encOn ? 2.2 : 1.4} />
            {encOn && <rect x={ENC.x - 4} y={ENC.y - 4} width={ENC.w + 8} height={ENC.h + 8} rx={15} fill="none"
              stroke={C.state} strokeWidth={1} opacity={0.35 * Math.sin(pe * Math.PI)} />}
            <text x={ENC.x + ENC.w / 2} y={ENC.y + ENC.h / 2 + 5} textAnchor="middle" fontSize="15" fontStyle="italic"
              fill={encOn ? C.state : C.mute}>f<tspan fontSize="10" dy="3">θ</tspan></text>
            {labels && (
              <text x={ENC.x + ENC.w / 2} y={ENC.y - 9} textAnchor="middle" fontSize="11" fontWeight={600}
                fill={C.state} textDecoration="underline">RDR-8B ↗</text>
            )}
          </g>
        );
        return labels ? (
          <a href={MODEL_URL} target="_blank" rel="noopener noreferrer" style={{ cursor: "pointer" }}>
            <title>RDR (anonymous)</title>
            {enc}
          </a>
        ) : enc;
      })()}
      {labels && <text x={ENC.x + ENC.w / 2} y={ENC.y + ENC.h + 16} textAnchor="middle" fontSize="10" fill={C.faint}>encoder</text>}

      {/* ---------- query embedding ---------- */}
      <g opacity={pr > 0.35 ? 1 - c01((pr - 0.35) / 0.2) : vecIn}>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={VEC.x + i * 5.2 * vecIn} y={VEC.y - 7} width={4.6} height={14} rx={1}
            fill={["#9cc7e6", "#3f8fc9", "#0b5f96", "#6aaed8", "#1f78b4"][i]} />
        ))}
      </g>
      {labels && <text x={VEC.x + 13} y={VEC.y + 24} textAnchor="middle" fontSize="10.5" fill={C.faint}>z</text>}

      {/* ---------- index cloud ---------- */}
      {CLOUD.map(([x, y], i) => {
        // the index is fixed: a retrieved document is copied into the state, its point stays.
        // Highlights fade out during the update so the cloud is back to grey when the cycle ends.
        const isHit = i === near[0].i;
        const isNear = near.some((n) => n.i === i);
        const hl = isHit ? lit * (1 - c01((pu - 0.3) / 0.5)) : 0;
        const nl = isNear ? strokes * (1 - c01(pu / 0.35)) : 0;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={2.6} fill={C.cloud} />
            {nl > 0 && !isHit && <circle cx={x} cy={y} r={2.6} fill={hc.c} opacity={nl * 0.55} />}
            {hl > 0 && <circle cx={x} cy={y} r={2.6 + 2 * hl} fill={hc.c} opacity={hl} />}
          </g>
        );
      })}
      {/* the net so far: strokes of the earlier hops of this recursion stay faintly, linked by the
          path of the query embeddings, so a small net builds up hop by hop */}
      {(() => {
        const kept = n + (pu >= 0.25 ? 1 : 0);
        const fade = 1 - clear;
        return Array.from({ length: kept }, (_, j) => {
          const k = cycle - n + j;
          const sp = SPOTS[spotIdx(k)];
          const nb = NEAR[spotIdx(k)];
          const prev = j > 0 ? SPOTS[spotIdx(k - 1)] : null;
          return (
            <g key={`net${k}`} opacity={fade}>
              {nb.slice(0, 6).map((pi, m) => (
                <line key={pi} x1={sp[0]} y1={sp[1]} x2={CLOUD[pi][0]} y2={CLOUD[pi][1]} stroke={HOP[j].c}
                  strokeWidth={m === 0 ? 1.3 : 0.9} strokeDasharray="2.5 2.5" opacity={m === 0 ? 0.75 : 0.42} />
              ))}
              {prev && <line x1={prev[0]} y1={prev[1]} x2={sp[0]} y2={sp[1]} stroke={C.state} strokeWidth={1} opacity={0.35} />}
              <circle cx={sp[0]} cy={sp[1]} r={3} fill={C.state} opacity={0.5} />
            </g>
          );
        });
      })()}

      {/* similarity strokes of this hop: short dashes from the query to its neighbours */}
      {strokes > 0 && pu < 0.25 && near.map((nb, k) => {
        const [x, y] = CLOUD[nb.i];
        const u = c01(strokes * 1.4 - k * 0.08);
        return (
          <line key={nb.i} x1={spot[0]} y1={spot[1]} x2={spot[0] + (x - spot[0]) * u} y2={spot[1] + (y - spot[1]) * u}
            stroke={hc.c} strokeWidth={k === 0 ? 1.8 : 1.1} strokeDasharray="2.5 2.5"
            opacity={(k === 0 ? 1 : 0.7 - k * 0.06) * (1 - c01(pu / 0.25))} />
        );
      })}
      {/* the retrieved unit of every hop so far: a ring and its label x_k, in the hop's colour */}
      {Array.from({ length: n + (lit > 0.5 ? 1 : 0) }, (_, j) => {
        const k = cycle - n + j;
        const [x, y] = CLOUD[NEAR[spotIdx(k)][0]];
        return (
          <g key={`hit${k}`} opacity={1 - clear}>
            <circle cx={x} cy={y} r={4.6} fill="#fff" stroke={HOP[j].c} strokeWidth={1.8} />
            <circle cx={x} cy={y} r={2.2} fill={HOP[j].c} />
            <text x={x + 7} y={y - 5} fontSize="10.5" fontStyle="italic" fontWeight={700} fill={HOP[j].ink}
              stroke="#fff" strokeWidth={2.5} paintOrder="stroke">x{SUBS[j]}</text>
          </g>
        );
      })}
      {/* the query point */}
      {pr > 0 && pu < 0.3 && (
        <circle cx={qx} cy={qy} r={5} fill={C.state} stroke="#fff" strokeWidth={1.4} opacity={1 - c01(pu / 0.3)} />
      )}
      {labels && <text x={462} y={14} textAnchor="middle" fontSize="10.5" fill={C.faint} letterSpacing="0.06em">FIXED INDEX</text>}
      {labels && <text x={462} y={27} textAnchor="middle" fontSize="9.5" fill={C.faint}>documents or memories</text>}

      {/* ---------- the retrieved document travelling back ---------- */}
      <path d={`M${hit[0]},${hit[1]} Q${(hit[0] + tx) / 2},236 ${tx},${ty + 12}`} fill="none"
        stroke={C.line} strokeWidth={1} strokeDasharray="3 4" opacity={!leaf && pu > 0 && pu < 0.62 ? 0.8 : 0.25} />
      {!leaf && pu > 0 && merge < 1 && <Page x={bx} y={by} fill={hc.soft} stroke={hc.c} s={1} opacity={1 - merge} />}
      {labels && (
        <text x={(hit[0] + tx) / 2} y={248} textAnchor="middle" fontSize="10.5" fill={C.faint}>
          {leaf && pu > 0 ? "last level: scored for the readout · then the next recursion starts" : "append the retrieved unit as text · encode again"}
        </text>
      )}
    </svg>
  );
}
