"use client";

/**
 * Similarity-driven connections: the latent graph a recursive search forms in the index; the third
 * view of the backbone section's recursion, driven by the section's master clock.
 *
 * Hop k is lookup k: during retrieve the state s_k (instruction, question and the units observed
 * so far) scores text units and its dashed similarity edges appear in HOP[k − 1]; during update
 * the best unit becomes the observed unit x_k (same label and colour as in the chain and the
 * tree). The last hop only scores (its best unit x₄ is not appended); during the readout every
 * hop's edges are shown together: a query-conditioned graph no extraction step constructed.
 *
 * The units are generic text samples and the similarities illustrative. Hover or focus a unit for
 * its scores. Pure function of (hop, phase, p) apart from the hover state.
 */

import { useState } from "react";
import { HOP, LGR } from "@/components/lgrPalette";
import type { Phase } from "@/components/viz/PathTree";

const VW = 960;
const VH = 262;

type Node = { id: string; x: number; y: number };
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const label = (id: string) => (id === "q" ? "q" : "x" + id.slice(1).split("").map((d) => SUB[+d]).join(""));

const Q: Node = { id: "q", x: 70, y: 140 };
const NODES: Node[] = [
  { id: "x1", x: 268, y: 96 }, { id: "x2", x: 482, y: 166 }, { id: "x3", x: 690, y: 102 }, { id: "x4", x: 872, y: 160 },
  { id: "x5", x: 186, y: 30 }, { id: "x6", x: 56, y: 42 }, { id: "x7", x: 128, y: 232 }, { id: "x8", x: 330, y: 232 },
  { id: "x9", x: 404, y: 28 }, { id: "x10", x: 210, y: 182 }, { id: "x11", x: 604, y: 32 }, { id: "x12", x: 556, y: 236 },
  { id: "x13", x: 768, y: 232 }, { id: "x14", x: 820, y: 40 },
];
const byId = (id: string) => (id === "q" ? Q : NODES.find((n) => n.id === id)!);

/** Lookup k = hop k: the anchor is the state's newest observation, `pick` the unit it observes. */
type Lookup = { anchor: string; state: string; scores: [string, number][]; pick: string };
const LOOKUPS: Lookup[] = [
  { anchor: "q", state: "[ι; q]", pick: "x1",
    scores: [["x1", 0.71], ["x5", 0.52], ["x8", 0.41], ["x7", 0.29], ["x6", 0.24]] },
  { anchor: "x1", state: "[ι; q; x₁]", pick: "x2",
    scores: [["x2", 0.68], ["x9", 0.47], ["x8", 0.44], ["x11", 0.39], ["x10", 0.33]] },
  { anchor: "x2", state: "[ι; q; x₁; x₂]", pick: "x3",
    scores: [["x3", 0.64], ["x8", 0.45], ["x9", 0.43], ["x12", 0.31], ["x13", 0.27]] },
  { anchor: "x3", state: "[ι; q; x₁; x₂; x₃]", pick: "x4",     // the leaf: x₄ is scored, not appended
    scores: [["x4", 0.62], ["x9", 0.41], ["x11", 0.4], ["x14", 0.36], ["x13", 0.33]] },
];
const HOP_OF: Record<string, number> = { x1: 0, x2: 1, x3: 2, x4: 3 };

const c01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - x, 2.4);

/** a text sample: a small card with three lines of "text" */
function TextUnit({ x, y, fill, stroke, ink, w = 30, h = 21 }: { x: number; y: number; fill: string; stroke: string; ink: string; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={4.5} fill={fill} stroke={stroke} strokeWidth={1.3} />
      {[0.32, 0.52, 0.72].map((f, i) => (
        <line key={i} x1={x - w / 2 + 5} x2={x + w / 2 - (i === 2 ? 11 : 5)} y1={y - h / 2 + h * f} y2={y - h / 2 + h * f}
          stroke={ink} strokeWidth={1.2} strokeLinecap="round" opacity={0.85} />
      ))}
    </g>
  );
}

export default function LatentGraphSimilarityPanel({ hop, phase, p }: { hop: number; phase: Phase; p: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const h0 = hop - 1;                                           // current lookup index
  const readout = phase === "readout";

  // progress of lookup h's scoring (0..1) and of its observation (0..1)
  const scoreP = (h: number) => (h < h0 || readout ? 1 : h === h0 ? (phase === "retrieve" ? p : phase === "update" ? 1 : 0) : 0);
  const pickP = (h: number) => (h === 3 ? 0 : h < h0 ? 1 : h === h0 && phase === "update" ? p : 0);

  const observed = LOOKUPS.map((l, h) => (pickP(h) > 0.5 ? l.pick : null)).filter(Boolean) as string[];
  const scoresOf = (id: string) =>
    LOOKUPS.flatMap((l, h) => (scoreP(h) > 0.3 ? l.scores.filter(([n]) => n === id).map(([, s]) => ({ h, s })) : []));
  const visible = (id: string) => observed.includes(id) || scoresOf(id).length > 0;
  const multi = (id: string) => LOOKUPS.filter((l, h) => scoreP(h) > 0.3 && l.scores.some(([n]) => n === id)).length;

  // the current state's hull: the question and the units it holds
  const held = ["q", ...LOOKUPS.slice(0, readout ? 3 : h0).map((l) => l.pick)];
  const hovered = hover && hover !== "q" ? byId(hover) : null;
  const hoverScores = hover ? scoresOf(hover) : [];

  return (
    <div>
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="relative min-w-[600px]">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full" role="img"
            aria-label="Similarity edges from the four search states of one recursion form a query-conditioned graph over text units">
            <defs>
              <radialGradient id="lgr-sim-hull" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={LGR.state} stopOpacity="0.07" />
                <stop offset="100%" stopColor={LGR.state} stopOpacity="0.02" />
              </radialGradient>
            </defs>

            {(() => {
              const pts = held.map(byId);
              const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
              const x0 = Math.min(...xs) - 34, x1 = Math.max(...xs) + 34;
              const y0 = Math.min(...ys) - 28, y1 = Math.max(...ys) + 28;
              return (
                <g>
                  <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={Math.min(44, (y1 - y0) / 2)}
                    fill="url(#lgr-sim-hull)" stroke={LGR.state} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.75} />
                  <text x={x0 + 10} y={y0 - 7} fontSize="10.5" fill={LGR.state} fontStyle="italic" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                    {readout ? "every lookup's edges: the net of one recursion" : `s${"₁₂₃₄"[h0]} = ${LOOKUPS[h0].state}`}
                  </text>
                </g>
              );
            })()}

            {/* similarity edges, in the colour of the hop that scored them */}
            {LOOKUPS.map((l, h) => {
              const g = scoreP(h);
              if (g <= 0) return null;
              const a = byId(l.anchor);
              const current = h === h0 && !readout;
              return l.scores.map(([id, s], k) => {
                const n = byId(id);
                const u = ease(c01(g * 1.5 - k * 0.12));
                const picked = l.pick === id && (h < 3 ? pickP(h) > 0.3 : false);
                const hi = hover === id || hover === l.anchor;
                const op = picked ? 1 : current ? 0.45 + s * 0.55 : readout ? 0.3 + 0.55 * s : 0.2 + 0.35 * s;
                return (
                  <line key={`e${h}-${id}`} x1={a.x} y1={a.y} x2={a.x + (n.x - a.x) * u} y2={a.y + (n.y - a.y) * u}
                    stroke={HOP[h].c} strokeWidth={(picked ? 1.4 : current || hi ? 1 : 0.75) * (0.8 + s * 4)}
                    strokeDasharray={picked ? undefined : "4 3.5"} opacity={hi ? 1 : op} strokeLinecap="round" />
                );
              });
            })}

            {/* similarity values on the current lookup's edges */}
            {!readout && phase === "retrieve" && LOOKUPS[h0].scores.map(([id, s], k) => {
              const a = byId(LOOKUPS[h0].anchor), n = byId(id);
              const op = c01(p * 1.6 - 0.35 - k * 0.1);
              const mx = a.x + (n.x - a.x) * 0.55, my = a.y + (n.y - a.y) * 0.55;
              return (
                <g key={`v${id}`} opacity={op}>
                  <rect x={mx - 15} y={my - 8} width={30} height={15} rx={7} fill="#fff" stroke={HOP[h0].c} strokeWidth={0.9} />
                  <text x={mx} y={my + 3.4} textAnchor="middle" fontSize="9" fill={HOP[h0].ink} fontWeight={700}>{s.toFixed(2)}</text>
                </g>
              );
            })}

            {/* text units */}
            {NODES.map((n) => {
              if (!visible(n.id)) return null;
              const hk = HOP_OF[n.id];
              const isObserved = observed.includes(n.id);
              const isLeafBest = n.id === "x4" && scoresOf("x4").length > 0;
              const special = isObserved || isLeafBest;
              const top = !readout && phase === "retrieve" && LOOKUPS[h0].scores[0][0] === n.id && p > 0.6;
              const k = multi(n.id);
              const hi = hover === n.id;
              const w = special ? 36 : 28, hh = special ? 25 : 20;
              const col = special ? HOP[hk] : null;
              return (
                <g key={n.id} tabIndex={0} role="button"
                  aria-label={`text unit ${label(n.id)}${k ? `, scored by ${k} state${k > 1 ? "s" : ""}` : ""}`}
                  onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
                  style={{ cursor: "pointer", outline: "none" }}>
                  {(top || hi) && <rect x={n.x - w / 2 - 6} y={n.y - hh / 2 - 6} width={w + 12} height={hh + 12} rx={8}
                    fill="none" stroke={HOP[hk ?? h0].c} strokeWidth={1.6} strokeDasharray={isObserved ? undefined : "3 2.5"} />}
                  <TextUnit x={n.x} y={n.y} w={w} h={hh}
                    fill={isObserved ? col!.c : isLeafBest ? col!.soft : "#fff"}
                    stroke={col ? col.c : "#a5b4fc"} ink={isObserved ? "#fff" : col ? col.c : "#94a3b8"} />
                  <text x={n.x + w / 2 + 4} y={n.y - hh / 2 + 4} fontSize={special ? 12 : 10.5} fontStyle="italic"
                    fontWeight={special ? 700 : 500} fill={col ? col.ink : hi ? LGR.ink : LGR.muted}
                    stroke="#fff" strokeWidth={3} paintOrder="stroke">
                    {label(n.id)}
                  </text>
                  {isLeafBest && !isObserved && (
                    <text x={n.x} y={n.y + hh / 2 + 13} textAnchor="middle" fontSize="9.5" fontStyle="italic" fill={col!.ink}
                      stroke="#fff" strokeWidth={3} paintOrder="stroke">scored, not appended</text>
                  )}
                  {!special && k > 1 && (
                    <g>
                      <circle cx={n.x - w / 2} cy={n.y - hh / 2} r={7} fill={LGR.state} />
                      <text x={n.x - w / 2} y={n.y - hh / 2 + 3.2} textAnchor="middle" fontSize="8.5" fontWeight={700} fill="#fff">{k}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* the question */}
            <circle cx={Q.x} cy={Q.y} r={16} fill={LGR.state} />
            <text x={Q.x} y={Q.y + 4.5} textAnchor="middle" fontSize="13" fontWeight={700} fill="#fff" fontStyle="italic">q</text>

            {/* the observed unit settling into the state */}
            {!readout && phase === "update" && h0 < 3 && (() => {
              const n = byId(LOOKUPS[h0].pick);
              const u = ease(c01(p / 0.55));
              return <rect x={n.x - 18 - 10 * (1 - u)} y={n.y - 12.5 - 10 * (1 - u)} width={36 + 20 * (1 - u)} height={25 + 20 * (1 - u)}
                rx={6} fill="none" stroke={HOP[h0].c} strokeWidth={2} opacity={1 - u} />;
            })()}
          </svg>

          {hovered && (
            <div className="pointer-events-none absolute z-10 w-[210px] -translate-x-1/2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur"
              style={{ left: `${Math.min(86, Math.max(14, (hovered.x / VW) * 100))}%`, top: `${((hovered.y + (hovered.y > VH / 2 ? -92 : 24)) / VH) * 100}%` }}>
              <div className="font-semibold italic text-slate-900">text unit {label(hovered.id)}</div>
              {observed.includes(hovered.id) && (
                <div className="mt-0.5 text-[10.5px] font-medium" style={{ color: HOP[HOP_OF[hovered.id]].ink }}>observed in hop {HOP_OF[hovered.id] + 1}</div>
              )}
              {hoverScores.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-slate-600">
                  {hoverScores.map(({ h, s }) => (
                    <li key={h} className="flex justify-between gap-3 tabular-nums">
                      <span style={{ color: HOP[h].ink }}>hop {h + 1}{LOOKUPS[h].pick === hovered.id ? (h === 3 ? " · best, leaf" : " · selected") : ""}</span>
                      <span className="font-medium" style={{ color: HOP[h].ink }}>cos {s.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              ) : <div className="mt-1 text-slate-500">not scored yet</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
