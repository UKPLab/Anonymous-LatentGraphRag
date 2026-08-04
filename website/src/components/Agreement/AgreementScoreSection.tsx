"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

// ─── sample retrieval results for five documents ────────────────────────────
const DOCS = ["D₁", "D₂", "D₃", "D₄", "D₅"];
// Raw cumulative path scores from each tree (realistic numbers, very different scales)
const S_D_RAW = [0.61, 0.58, 0.52, 0.45, 0.39]; // document tree
const S_M_RAW = [0.031, 0.029, 0.025, 0.018, 0.012]; // memory tree
const GAMMA = 0.0;
const TARGET = 0; // we spotlight D₁ throughout

// ─── z-normalisation helpers ────────────────────────────────────────────────
function avg(a: number[]) {
  return a.reduce((s, v) => s + v, 0) / a.length;
}
function sdv(a: number[]) {
  const m = avg(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
}
function znorm(a: number[]) {
  const m = avg(a), s = sdv(a);
  return s < 1e-9 ? a.map(() => 0) : a.map((v) => (v - m) / s);
}

const MU_D = avg(S_D_RAW); // ≈ 0.510
const SIG_D = sdv(S_D_RAW); // ≈ 0.081
const MU_M = avg(S_M_RAW); // ≈ 0.023
const SIG_M = sdv(S_M_RAW); // ≈ 0.0073
const Z_D = znorm(S_D_RAW); // ≈ [+1.23, +0.86, +0.12, −0.74, −1.48]
const Z_M = znorm(S_M_RAW); // ≈ [+1.13, +0.85, +0.28, −0.71, −1.55]
const S_FINAL = Z_D[TARGET] + Z_M[TARGET] + GAMMA;

// ─── SVG layout constants ────────────────────────────────────────────────────
const W = 280;     // strip width
const H = 58;      // strip height
const PAD = 22;    // horizontal padding
const DOT_Y = 30;  // y of the dots
const AX_Y = 36;   // y of the axis line

// Shared raw x-axis (0 → 0.65) — same for BOTH strips so the scale gap is obvious
const RAW_MIN = 0, RAW_MAX = 0.65;
const Z_MIN = -3, Z_MAX = 3;

function rawX(v: number) {
  return PAD + ((v - RAW_MIN) / (RAW_MAX - RAW_MIN)) * (W - 2 * PAD);
}
function zX(v: number) {
  return PAD + ((v - Z_MIN) / (Z_MAX - Z_MIN)) * (W - 2 * PAD);
}

// Pre-compute pixel positions
const DOC_RAW_PX = S_D_RAW.map(rawX);  // 164 … 245 (nicely spread)
const MEM_RAW_PX = S_M_RAW.map(rawX);  //  24 …  31 (ALL jammed into 8 px!)
const DOC_Z_PX = Z_D.map(zX);           //  77 … 193
const MEM_Z_PX = Z_M.map(zX);           //  73 … 188

// ─── Single distribution strip ──────────────────────────────────────────────
interface StripProps {
  color: "blue" | "green";
  label: string;
  rawPx: number[];
  zPx: number[];
  rawScores: number[];
  zScores: number[];
  mu: number;
  sigma: number;
  normalized: boolean;
}

function Strip({
  color, label, rawPx, zPx, rawScores, zScores, mu, sigma, normalized,
}: StripProps) {
  const c = color === "blue" ? "#3b82f6" : "#22c55e";
  const bg = color === "blue" ? "bg-blue-50" : "bg-green-50";
  const border = color === "blue" ? "border-blue-200" : "border-green-200";
  const tc = color === "blue" ? "text-blue-700" : "text-green-700";

  const positions = normalized ? zPx : rawPx;
  const meanX = normalized ? zX(0) : rawX(mu);
  const sig1X = normalized ? zX(1) : rawX(mu + sigma);
  const sig1mX = normalized ? zX(-1) : rawX(mu - sigma);

  return (
    <div>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${tc}`}>
        {label}
      </p>
      <div className={`${bg} ${border} border rounded-xl px-2 pt-2 pb-1`}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* ±1σ band */}
          <motion.rect
            y={16}
            height={AX_Y - 13}
            fill={c}
            opacity={0.1}
            rx={3}
            animate={{
              x: sig1mX,
              width: Math.max(0, sig1X - sig1mX),
            }}
            transition={{ duration: 0.65, ease: "easeInOut" }}
          />

          {/* axis line */}
          <line
            x1={PAD}
            y1={AX_Y}
            x2={W - PAD}
            y2={AX_Y}
            stroke="#e5e7eb"
            strokeWidth={1.5}
          />

          {/* mean dashed line */}
          <motion.line
            y1={14}
            y2={AX_Y + 4}
            stroke={c}
            strokeWidth={1.5}
            strokeDasharray="3,2"
            opacity={0.75}
            animate={{ x1: meanX, x2: meanX }}
            transition={{ duration: 0.65, ease: "easeInOut" }}
          />

          {/* dots */}
          {rawScores.map((_, i) => (
            <motion.circle
              key={i}
              cy={DOT_Y}
              r={i === TARGET ? 8 : 5.5}
              fill={i === TARGET ? c : c + "88"}
              stroke={i === TARGET ? "white" : "none"}
              strokeWidth={1.5}
              initial={{ cx: rawPx[i] }}
              animate={{ cx: positions[i] }}
              transition={{ duration: 0.7, ease: "easeInOut", delay: i * 0.04 }}
            />
          ))}

          {/* axis tick labels */}
          {normalized ? (
            <>
              <text
                x={PAD}
                y={H - 1}
                textAnchor="middle"
                fontSize={7}
                fill="#94a3b8"
                fontFamily="ui-monospace,monospace"
              >
                −3σ
              </text>
              <text
                x={zX(0)}
                y={H - 1}
                textAnchor="middle"
                fontSize={7}
                fill={c}
                fontFamily="ui-monospace,monospace"
                fontWeight="600"
              >
                0
              </text>
              <text
                x={W - PAD}
                y={H - 1}
                textAnchor="middle"
                fontSize={7}
                fill="#94a3b8"
                fontFamily="ui-monospace,monospace"
              >
                +3σ
              </text>
            </>
          ) : (
            <>
              <text
                x={PAD}
                y={H - 1}
                textAnchor="middle"
                fontSize={7}
                fill="#94a3b8"
                fontFamily="ui-monospace,monospace"
              >
                0
              </text>
              <text
                x={W - PAD}
                y={H - 1}
                textAnchor="middle"
                fontSize={7}
                fill="#94a3b8"
                fontFamily="ui-monospace,monospace"
              >
                0.65
              </text>
            </>
          )}

          {/* score label above D₁ */}
          <AnimatePresence mode="wait">
            {normalized ? (
              <motion.text
                key="z"
                x={positions[TARGET]}
                y={12}
                textAnchor="middle"
                fontSize={8}
                fontWeight="bold"
                fill={c}
                fontFamily="ui-monospace,monospace"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                z={zScores[TARGET].toFixed(2)}
              </motion.text>
            ) : (
              <motion.text
                key="raw"
                x={positions[TARGET]}
                y={12}
                textAnchor="middle"
                fontSize={8}
                fontWeight="bold"
                fill={c}
                fontFamily="ui-monospace,monospace"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {rawScores[TARGET].toFixed(3)}
              </motion.text>
            )}
          </AnimatePresence>
        </svg>
      </div>
    </div>
  );
}

// ─── Main section ────────────────────────────────────────────────────────────
type Phase = "idle" | "raw" | "warning" | "normalize" | "formula";

export default function AgreementScoreSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [phase, setPhase] = useState<Phase>("idle");
  const normalized = phase === "normalize" || phase === "formula";

  useEffect(() => {
    if (!inView) return;
    const t = (ms: number, fn: () => void) => setTimeout(fn, ms);
    const timers = [
      t(300,  () => setPhase("raw")),
      t(1400, () => setPhase("warning")),
      t(2600, () => setPhase("normalize")),
      t(3800, () => setPhase("formula")),
    ];
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <section ref={ref} className="py-12 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
            Document–Memory Agreement Scoring
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm">
            The document tree and memory tree produce scores on{" "}
            <em>different scales</em>. Z-normalization maps each view to the same
            reference frame before combining — giving both views equal voice.
          </p>
        </motion.div>

        {/* Score strips */}
        <AnimatePresence>
          {phase !== "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-3"
            >
              <Strip
                color="blue"
                label="Doc Tree (D₁ highlighted)"
                rawPx={DOC_RAW_PX}
                zPx={DOC_Z_PX}
                rawScores={S_D_RAW}
                zScores={Z_D}
                mu={MU_D}
                sigma={SIG_D}
                normalized={normalized}
              />
              <Strip
                color="green"
                label="Memory Tree (D₁ highlighted)"
                rawPx={MEM_RAW_PX}
                zPx={MEM_Z_PX}
                rawScores={S_M_RAW}
                zScores={Z_M}
                mu={MU_M}
                sigma={SIG_M}
                normalized={normalized}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Caption below strips */}
        <div className="text-center mb-5 min-h-[22px]">
          <AnimatePresence mode="wait">
            {(phase === "raw" || phase === "warning") ? (
              <motion.p
                key="raw-caption"
                className="text-xs text-gray-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Both strips use the same x-axis (0 → 0.65). Memory scores are squashed
                into the leftmost{" "}
                <span className="font-semibold text-amber-600">5%</span> of the strip.
              </motion.p>
            ) : (
              <motion.p
                key="z-caption"
                className="text-xs text-gray-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                After z-normalization both views share the same{" "}
                <span className="font-semibold text-blue-600">−3σ … +3σ</span> axis.
                D₁ ranks high in both.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Scale-mismatch warning */}
        <AnimatePresence>
          {phase === "warning" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center mb-5"
            >
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 2L14.9 14H1.1L8 2Z"
                    fill="#fef3c7"
                    stroke="#d97706"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                  <line x1="8" y1="7" x2="8" y2="10" stroke="#d97706" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="8" cy="12" r="0.7" fill="#d97706" />
                </svg>
                Raw scores can&apos;t be summed directly — 20× scale difference!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Z-normalization formula pill */}
        <AnimatePresence>
          {(phase === "normalize" || phase === "formula") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mb-5"
            >
              <span className="inline-flex items-center gap-2 text-xs font-mono text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5">
                z-normalize:
                <span className="font-semibold text-gray-800">ẑ = (s − μ) / σ</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Combination formula */}
        <AnimatePresence>
          {phase === "formula" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 bg-amber-50 rounded-2xl border border-amber-300 p-5 text-center shadow-sm"
            >
              <h3 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-4">
                Final score for D₁
              </h3>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-100 rounded-lg border border-blue-200">
                  <span className="text-[10px] text-blue-600 font-semibold">ẑ_D =</span>
                  <span className="font-mono text-blue-800 font-bold text-base">
                    {Z_D[TARGET].toFixed(2)}
                  </span>
                </div>
                <span className="text-gray-400 text-lg">+</span>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-green-100 rounded-lg border border-green-200">
                  <span className="text-[10px] text-green-600 font-semibold">ẑ_M =</span>
                  <span className="font-mono text-green-800 font-bold text-base">
                    {Z_M[TARGET].toFixed(2)}
                  </span>
                </div>
                <span className="text-gray-400 text-lg">+</span>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-purple-100 rounded-lg border border-purple-200">
                  <span className="text-[10px] text-purple-600 font-semibold">γ·𝟙 =</span>
                  <span className="font-mono text-purple-800 font-bold text-base">
                    {GAMMA.toFixed(2)}
                  </span>
                </div>
                <span className="text-gray-400 text-lg">=</span>
                <motion.div
                  initial={{ scale: 0.85 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-xl border-2 border-amber-400"
                >
                  <span className="text-xs text-amber-700">s_final</span>
                  <span className="font-mono text-amber-900 font-bold text-xl">
                    {S_FINAL.toFixed(2)}
                  </span>
                </motion.div>
              </div>
              <p className="font-mono text-[10px] text-gray-500 mt-4">
                s_final(d) = ẑ_D(d) + ẑ_M(d) + γ · 𝟙[d ∈ D ∩ M]
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Key insight */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-6 bg-blue-50 rounded-xl border border-blue-200 p-4 text-center max-w-2xl mx-auto"
        >
          <p className="text-sm text-blue-800">
            <span className="font-bold">Why z-scores?</span> Without normalisation, the
            memory tree&apos;s signal (0.012 – 0.031) would be dwarfed by the document
            tree&apos;s scores (0.39 – 0.61). Z-scoring gives each view equal weight in
            the final ranking.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
