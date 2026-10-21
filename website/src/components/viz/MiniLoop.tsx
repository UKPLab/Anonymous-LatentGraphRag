/**
 * MiniLoop: the recursion circle as a small status glyph (encode → retrieve → update), the active
 * station highlighted. Coordinates are rounded so server and client render identical markup.
 */

import { LGR } from "@/components/lgrPalette";

const NAMES = ["Encode", "Retrieve", "Update"];
// the operator acts on the state: every station is drawn in the state colour; hop colours are reserved for hops
const COLS = [LGR.state, LGR.state, LGR.state];

export default function MiniLoop({ active }: { active: number }) {
  const c = 30, r = 21;
  const q = (v: number) => Math.round(v * 1000) / 1000;
  const pts = [0, 1, 2].map((i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    return { x: q(c + Math.cos(a) * r), y: q(c + Math.sin(a) * r) };
  });
  const arc = (i: number) => {
    const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 3 + 0.36;
    const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / 3 - 0.42;
    return `M${q(c + Math.cos(a0) * r)},${q(c + Math.sin(a0) * r)} A${r},${r} 0 0,1 ${q(c + Math.cos(a1) * r)},${q(c + Math.sin(a1) * r)}`;
  };
  return (
    <svg width={60} height={60} viewBox="0 0 60 60" className="shrink-0" role="img" aria-label={`Recursion: ${NAMES[active]}`}>
      <defs>
        {COLS.map((col, i) => (
          <marker key={i} id={`lgr-mini-ah-${i}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={col} />
          </marker>
        ))}
      </defs>
      <circle cx={c} cy={c} r={r} fill="none" stroke={LGR.line} strokeWidth={1.5} />
      <path d={arc(active)} fill="none" stroke={COLS[active]} strokeWidth={2.2} strokeLinecap="round" markerEnd={`url(#lgr-mini-ah-${active})`} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={i === active ? 6.5 : 4.5} fill={i === active ? COLS[i] : "#f1f5f9"}
            stroke={i === active ? COLS[i] : LGR.faint} strokeWidth={1.2} />
          <text x={p.x} y={p.y + 2.6} textAnchor="middle" fontSize="7" fontWeight={700} fill={i === active ? "#fff" : "#94a3b8"}>{i + 1}</text>
        </g>
      ))}
      <text x={c} y={c + 3.6} textAnchor="middle" fontSize="10" fontStyle="italic" fontWeight={700} fill={LGR.ink} fontFamily="Georgia, serif">s</text>
    </svg>
  );
}

