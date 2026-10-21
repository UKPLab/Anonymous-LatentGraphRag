"use client";

import { figure1, frozenConfig, type Figure1Point } from "@/data/lgrPaper";

/**
 * Figure 1 of the paper: answer quality against agent search calls per question, one point per
 * seed. As in the paper, the x-axis is broken before "No seed", which searches about twice as
 * often as every seeded agent. All coordinates and intervals come from `figure1`.
 */

const W = 640;
const H = 340;
const M = { top: 22, right: 18, bottom: 46, left: 50 };
const BREAK_GAP = 26; // horizontal room for the axis break marks
const RIGHT_W = 70; // width of the segment that holds the unseeded point

const COLORS: Record<Figure1Point["role"], string> = {
  lgr: "#f97316",
  rdr: "#2563eb",
  graph: "#6b7280",
  none: "#374151",
};

function niceTicks(lo: number, hi: number, target = 5): number[] {
  const raw = (hi - lo) / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

function Marker({ p, x, y }: { p: Figure1Point; x: number; y: number }) {
  const c = COLORS[p.role];
  const r = p.role === "lgr" ? 8 : 5.5;
  switch (p.marker) {
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.45;
        return `${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`;
      }).join(" ");
      return <polygon points={pts} fill={c} stroke="white" strokeWidth={1} />;
    }
    case "cross":
      return (
        <g stroke={c} strokeWidth={2.6} strokeLinecap="round">
          <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} />
          <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} />
        </g>
      );
    case "square":
      return <rect x={x - r * 0.85} y={y - r * 0.85} width={r * 1.7} height={r * 1.7} fill={c} />;
    case "diamond":
      return <polygon points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} fill={c} />;
    case "triangle-up":
      return <polygon points={`${x},${y - r} ${x + r},${y + r * 0.8} ${x - r},${y + r * 0.8}`} fill={c} />;
    case "triangle-down":
      return <polygon points={`${x},${y + r} ${x + r},${y - r * 0.8} ${x - r},${y - r * 0.8}`} fill={c} />;
    default:
      return <circle cx={x} cy={y} r={r} fill="white" stroke={c} strokeWidth={2} />;
  }
}

export default function Figure1Chart() {
  const pts = figure1.points;
  const seeded = pts.filter((p) => p.role !== "none");
  const none = pts.find((p) => p.role === "none");

  // x: a main segment for the seeded agents, then a break, then the unseeded agent
  const xLo = Math.min(...seeded.map((p) => p.searchesLo));
  const xHi = Math.max(...seeded.map((p) => p.searchesHi));
  const xPad = (xHi - xLo) * 0.08;
  const mainX0 = M.left;
  const mainX1 = W - M.right - RIGHT_W - BREAK_GAP;
  const sx = (v: number) => mainX0 + ((v - (xLo - xPad)) / (xHi + xPad - (xLo - xPad))) * (mainX1 - mainX0);
  const rightX0 = mainX1 + BREAK_GAP;
  const rightX1 = W - M.right;
  const nLo = none ? none.searchesLo : 0;
  const nHi = none ? none.searchesHi : 1;
  const nPad = (nHi - nLo) * 0.6 || 0.1;
  const sxNone = (v: number) => rightX0 + ((v - (nLo - nPad)) / (nHi + nPad - (nLo - nPad))) * (rightX1 - rightX0);

  // y
  const yLo = Math.min(...pts.map((p) => p.accLo));
  const yHi = Math.max(...pts.map((p) => p.accHi));
  const yPad = (yHi - yLo) * 0.08;
  const y0 = H - M.bottom;
  const y1 = M.top;
  const sy = (v: number) => y0 - ((v - (yLo - yPad)) / (yHi + yPad - (yLo - yPad))) * (y0 - y1);

  const xTicks = niceTicks(xLo - xPad, xHi + xPad, 4);
  const yTicks = niceTicks(yLo - yPad, yHi + yPad, 5);
  const xOf = (p: Figure1Point) => (p.role === "none" ? sxNone(p.searches) : sx(p.searches));
  const xOfV = (p: Figure1Point, v: number) => (p.role === "none" ? sxNone(v) : sx(v));

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`${figure1.yLabel} against ${figure1.xLabel}`}>
        {/* grid + y ticks */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={mainX0} x2={rightX1} y1={sy(t)} y2={sy(t)} stroke="#f1f5f9" />
            <text x={mainX0 - 8} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="#6b7280">{t}</text>
          </g>
        ))}
        {/* x axis, broken */}
        <line x1={mainX0} x2={mainX1} y1={y0} y2={y0} stroke="#9ca3af" />
        <line x1={rightX0} x2={rightX1} y1={y0} y2={y0} stroke="#9ca3af" />
        {[mainX1 + 4, rightX0 - 10].map((bx) => (
          <line key={bx} x1={bx} y1={y0 + 5} x2={bx + 6} y2={y0 - 5} stroke="#9ca3af" />
        ))}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y0 + 4} stroke="#9ca3af" />
            <text x={sx(t)} y={y0 + 16} textAnchor="middle" fontSize={10} fill="#6b7280">{t.toFixed(2)}</text>
          </g>
        ))}
        {none && (
          <text x={sxNone(none.searches)} y={y0 + 16} textAnchor="middle" fontSize={10} fill="#6b7280">
            {none.searches.toFixed(1)}
          </text>
        )}
        <text x={(mainX0 + rightX1) / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#374151">{figure1.xLabel}</text>
        <text x={14} y={(y0 + y1) / 2} textAnchor="middle" fontSize={11} fill="#374151"
          transform={`rotate(-90 14 ${(y0 + y1) / 2})`}>{figure1.yLabel}</text>

        {/* error bars, then markers, then labels */}
        {pts.map((p) => (
          <g key={`e${p.key}`} stroke={COLORS[p.role]} strokeOpacity={0.55} strokeWidth={1.2}>
            <line x1={xOf(p)} x2={xOf(p)} y1={sy(p.accLo)} y2={sy(p.accHi)} />
            <line x1={xOfV(p, p.searchesLo)} x2={xOfV(p, p.searchesHi)} y1={sy(p.acc)} y2={sy(p.acc)} />
          </g>
        ))}
        {pts.map((p) => <Marker key={`m${p.key}`} p={p} x={xOf(p)} y={sy(p.acc)} />)}
        {pts.map((p) => {
          // HippoRAG 2 and G-Reasoner nearly coincide: label both to the left, one above and one below
          const left = p.role === "none" || p.key === "hipporag2" || p.key === "greasoner";
          const dy = p.key === "hipporag2" ? 16 : -8;
          return (
            <text key={`l${p.key}`} x={xOf(p) + (left ? -10 : 10)} y={sy(p.acc) + dy}
              textAnchor={left ? "end" : "start"} fontSize={p.role === "lgr" ? 11.5 : 10}
              fontWeight={p.role === "lgr" || p.role === "rdr" ? 700 : 500} fill={COLORS[p.role]}>
              {p.label}
            </text>
          );
        })}

        {/* annotation, as printed in the figure */}
        <text x={mainX0 + 8} y={y1 + 12} fontSize={11.5} fontWeight={700} fill={COLORS.lgr}>
          {figure1.annotation}
        </text>
      </svg>
      <figcaption className="mt-2 text-[11px] text-gray-500 leading-relaxed text-left">
        Figure 1 of the paper. One ReAct controller, search tool and budget; only the
        top-{frozenConfig.seedSize} initial evidence varies (Table 5). Points average runs and benchmarks
        (final-answer accuracy on MuSiQue and BrowseComp+ (pool), list recall on FanOutQA); bars are
        bootstrap intervals; the x-axis is broken before the unseeded agent. Orange star:
        LatentGraphRAG with documents, triples and propositions. Blue cross: document-only Recursive
        Dense Retrieval, labeled LGR (doc. only). Gray: graph seeds. Open circle: no seed.
      </figcaption>
    </figure>
  );
}
