/**
 * RecursionLogo: the recursion glyph reduced to a small mark. A ring with the three stations
 * of the operator (encode, retrieve, update) and the state s in the middle; the ring turns
 * slowly, and stands still under prefers-reduced-motion.
 */

import { LGR } from "@/components/lgrPalette";

export default function RecursionLogo({ size = 44 }: { size?: number }) {
  const c = 24, r = 17;
  // stations at 12, 4 and 8 o'clock (rounded so server and client render identical markup)
  const q = (v: number) => Math.round(v * 100) / 100;
  const st = [0, 1, 2].map((i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    return { x: q(c + Math.cos(a) * r), y: q(c + Math.sin(a) * r) };
  });
  const cols = [LGR.state, LGR.search, LGR.path];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="The recursive operator: encode, retrieve, update"
      className="shrink-0">
      <defs>
        <marker id="lgr-logo-ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={LGR.state} />
        </marker>
      </defs>
      <g className="origin-center animate-[spin_18s_linear_infinite] motion-reduce:animate-none" style={{ transformBox: "fill-box" }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#c7d2fe" strokeWidth={2} />
        {/* one arc in colour, pointing the way the recursion turns */}
        <path d={`M${st[2].x},${st[2].y} A${r},${r} 0 0,1 ${q(c + Math.cos(-Math.PI / 2 - 0.42) * r)},${q(c + Math.sin(-Math.PI / 2 - 0.42) * r)}`}
          fill="none" stroke={LGR.state} strokeWidth={2.4} strokeLinecap="round" markerEnd="url(#lgr-logo-ah)" />
        {st.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4.2} fill={cols[i]} stroke="#fff" strokeWidth={1.4} />
        ))}
      </g>
      <text x={c} y={c + 4.6} textAnchor="middle" fontSize="13" fontStyle="italic" fontWeight={700} fill={LGR.ink}
        fontFamily="Georgia, serif">s</text>
    </svg>
  );
}
