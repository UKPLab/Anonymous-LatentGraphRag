/**
 * PathTree: a compact top-down search tree, one view of the backbone section's recursion.
 *
 * Hop k of the master clock is level k of the tree: the level's states are encoded (pulse),
 * score the index (scan), and in the update every state selects b children, each appending one
 * unit to a copy of its parent's state; the highlighted path appends x_k. Everything hop k
 * produces is drawn in HOP[k − 1]: the path node of level k, the path edge labelled x_k and the
 * level label. The last hop's states only score; its update phase is the global readout, where
 * every state's scores aggregate into one ranked list. Pure function of (hop, phase, p); no
 * trigonometry in the initial frame, so server and client render the same markup.
 */

import { HOP, LGR } from "@/components/lgrPalette";

export type Phase = "encode" | "retrieve" | "update" | "readout";

const W = 380, H = 300;
const LEVELS = 4, B = 3;
const LY = [26, 82, 138, 192];
const X0 = 18, X1 = 368;
const LEAF = (X1 - X0) / 26;
const statesAt = (l: number) => Math.pow(B, l - 1);
const nodeX = (l: number, i: number) => X0 + ((i + 0.5) * (27 / statesAt(l)) - 0.5) * LEAF;
const PATH_I = [0, 1, 4, 13];
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const RANKED = ["₂", "₉", "₁", "₈", "₃"];   // units scored by many states rank high, on the path or off it (x₈, x₉ in the net)

const c01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - x, 2.4);

export default function PathTree({ hop, phase, p }: { hop: number; phase: Phase; p: number }) {
  const readout = phase === "readout";
  // level l is visible once its parent level has expanded
  const grown = (l: number) => (l <= hop ? 1 : l === hop + 1 && phase === "update" ? ease(c01(p / 0.7)) : 0);
  const ro = readout ? p : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label="The search tree: hop k of the recursion is level k of the highlighted path; the last hop ends in a global readout over every state">
      {LY.map((y, i) => {
        const on = i + 1 === hop;
        return (
          <text key={i} x={W - 2} y={y - 8} textAnchor="end" fontSize="9" fontWeight={on ? 700 : 400}
            fill={on || i + 1 < hop ? HOP[i].ink : "#94a3b8"}>
            level {i + 1}
          </text>
        );
      })}

      {/* edges; the small square is the unit that made the child */}
      {[2, 3, 4].map((l) => {
        const g = grown(l);
        if (g <= 0) return null;
        return Array.from({ length: statesAt(l) }, (_, i) => {
          const pi = Math.floor(i / B);
          const x0 = nodeX(l - 1, pi), y0 = LY[l - 2], x1 = nodeX(l, i), y1 = LY[l - 1];
          const onPath = PATH_I[l - 1] === i && PATH_I[l - 2] === pi;
          const col = HOP[l - 2].c;               // the edge into level l carries x_{l-1}, made in hop l-1
          return (
            <g key={`e${l}-${i}`}>
              <line x1={x0} y1={y0} x2={x0 + (x1 - x0) * g} y2={y0 + (y1 - y0) * g}
                stroke={onPath ? col : "#d5dbe3"} strokeWidth={onPath ? 2.4 : 0.8} />
              {g > 0.7 && (
                <rect x={(x0 + x1) / 2 - 2.4} y={(y0 + y1) / 2 - 2.4} width={4.8} height={4.8} rx={1}
                  fill={onPath ? col : "#fff"} stroke={onPath ? col : "#94a3b8"} strokeWidth={0.6} />
              )}
            </g>
          );
        });
      })}
      {[2, 3, 4].map((l) => grown(l) > 0.9 && (
        <text key={`pl${l}`} x={(nodeX(l - 1, PATH_I[l - 2]) + nodeX(l, PATH_I[l - 1])) / 2 + 8}
          y={(LY[l - 2] + LY[l - 1]) / 2 + 3.5} fontSize="10.5" fontStyle="italic" fontWeight={700} fill={HOP[l - 2].ink}>
          x{SUB[l - 1]}
        </text>
      ))}

      {/* nodes */}
      {[1, 2, 3, 4].map((l) => {
        const g = grown(l);
        if (g <= 0) return null;
        const active = l === hop && !readout;
        const col = HOP[l - 1];
        return Array.from({ length: statesAt(l) }, (_, i) => {
          const onPath = PATH_I[l - 1] === i;
          const x = nodeX(l, i), y = LY[l - 1];
          const r = l === 1 ? 7 : l === 2 ? 5.5 : l === 3 ? 4.2 : 3.4;
          const encoded = l < hop || (l === hop && phase !== "encode") || readout;
          const lit = readout ? 0.45 + 0.55 * Math.abs(Math.sin((ro * 4 + i * 0.37 + l) * Math.PI)) : 1;
          return (
            <g key={`n${l}-${i}`} opacity={g}>
              {active && phase === "encode" && <circle cx={x} cy={y} r={r + 4 * Math.sin(p * Math.PI)} fill={LGR.state} opacity={0.18} />}
              {active && phase === "retrieve" && <circle cx={x} cy={y} r={r + 2 + 7 * p} fill="none" stroke={col.c} strokeWidth={1} opacity={0.8 * (1 - p)} />}
              <circle cx={x} cy={y} r={onPath && l > 1 ? r + 0.8 : r}
                fill={l === 1 ? LGR.state : encoded ? (onPath ? col.c : "#e2e8f0") : "#fff"}
                stroke={l === 1 ? (hop === 1 && !readout ? col.c : LGR.state) : onPath ? col.c : "#94a3b8"}
                strokeWidth={l === 1 && hop === 1 && !readout ? 2 : 0.8} opacity={lit} />
            </g>
          );
        });
      })}
      {/* the leaf's best unit: scored, not appended */}
      {(hop === 4 && (phase === "update" || phase === "readout" || (phase === "retrieve" && p > 0.6))) && (
        <text x={nodeX(4, PATH_I[3]) + 7} y={LY[3] + 14} fontSize="10" fontStyle="italic" fontWeight={700} fill={HOP[3].ink}>
          x₄ scored
        </text>
      )}

      {/* global readout: every state's scores flow into one ranked list */}
      {readout && [1, 2, 3, 4].map((l) => Array.from({ length: statesAt(l) }, (_, i) => {
        const x = nodeX(l, i), y = LY[l - 1];
        const u = c01(ro * 2 - (l - 1) * 0.1);
        const tx = 40 + ((i * 7 + l * 3) % 5) * 70 + 12, ty = 236;
        return <line key={`f${l}-${i}`} x1={x} y1={y} x2={x + (tx - x) * u} y2={y + (ty - y) * u}
          stroke={HOP[3].c} strokeWidth={0.5} opacity={0.45 * (1 - c01((ro - 0.6) / 0.3)) + 0.06} />;
      }))}
      <text x={4} y={228} fontSize="9" fontWeight={readout ? 700 : 400} fill={readout ? HOP[3].ink : "#94a3b8"} letterSpacing="0.06em">
        GLOBAL READOUT
      </text>
      <rect x={4} y={236} width={W - 8} height={40} rx={7} fill={readout ? HOP[3].soft : "#fafafa"}
        stroke={readout ? HOP[3].c : LGR.line} strokeWidth={1} strokeDasharray={readout ? undefined : "4 3"} />
      {RANKED.map((id, k) => {
        const show = readout ? c01((ro - 0.2) * 3) : 0;
        const x = 14 + k * 72;
        return (
          <g key={id} opacity={show}>
            <text x={x} y={252} fontSize="9" fontWeight={600} fill={LGR.muted}>{k + 1}</text>
            <text x={x + 10} y={252} fontSize="10" fontStyle="italic" fill={LGR.ink}>x{id}</text>
            <rect x={x} y={259} width={56} height={5} rx={2.5} fill="#e7e5e4" />
            <rect x={x} y={259} width={(50 - k * 7) * ease(show)} height={5} rx={2.5} fill={HOP[3].c} />
          </g>
        );
      })}
      <text x={4} y={294} fontSize="9" fill="#94a3b8">
        {readout ? "every state scores units; many states → high rank, even off the path" : "hop k of the recursion = level k of the highlighted path"}
      </text>
    </svg>
  );
}
