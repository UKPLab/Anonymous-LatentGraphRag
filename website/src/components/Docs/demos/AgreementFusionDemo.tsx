"use client";

import { useState } from "react";
import { motion } from "framer-motion";

/**
 * Z-agreement fusion demo.
 *
 * Shows:
 *   1. The raw scores from each view (different scales)
 *   2. The z-normalized scores (same scale)
 *   3. The final fused score with a γ slider
 *
 * s_final(d) = ẑ_D(d) + ẑ_M(d) + γ · 𝟙[d ∈ D ∩ M]
 * where ẑ = (s − μ) / σ is computed across all retrieved docs in each view.
 */

// Four retrieved documents for this canned example
const DOCS = ["D₁ (target)", "D₂", "D₃", "D₄"];
const S_D_RAW = [0.61, 0.52, 0.45, 0.39]; // doc-tree scores
const S_M_RAW = [0.031, 0.025, 0.018, 0.012]; // memory-tree scores

function avg(a: number[]) { return a.reduce((s, v) => s + v, 0) / a.length; }
function sdv(a: number[]) {
  const m = avg(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
}
function znorm(a: number[]) {
  const m = avg(a), s = sdv(a);
  return s < 1e-9 ? a.map(() => 0) : a.map((v) => (v - m) / s);
}

const Z_D = znorm(S_D_RAW); // ≈ [+1.33, +0.19, −0.38, −1.14]
const Z_M = znorm(S_M_RAW); // ≈ [+1.34, +0.17, −0.38, −1.13]
const TARGET = 0;            // D₁ is in both views

export default function AgreementFusionDemo() {
  const [gamma, setGamma] = useState(0.0);
  const [showRaw, setShowRaw] = useState(false);

  const fused = Z_D[TARGET] + Z_M[TARGET] + gamma;

  return (
    <div className="w-full p-4 space-y-5">
      {/* Raw vs z toggle */}
      <div className="flex gap-2 text-[10px] font-semibold">
        <button
          onClick={() => setShowRaw(false)}
          className={`px-3 py-1.5 rounded-md border transition ${
            !showRaw
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
        >
          Z-scores (used in fusion)
        </button>
        <button
          onClick={() => setShowRaw(true)}
          className={`px-3 py-1.5 rounded-md border transition ${
            showRaw
              ? "bg-gray-700 text-white border-gray-700"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
        >
          Raw scores
        </button>
      </div>

      {/* Score cards for D₁ */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-[10px] text-blue-700 font-semibold mb-1">
            {showRaw ? "s_D (raw)" : "ẑ_D (z-norm)"}
          </p>
          <p className="font-mono text-blue-800 font-bold text-lg">
            {showRaw ? S_D_RAW[TARGET].toFixed(3) : Z_D[TARGET].toFixed(2)}
          </p>
          {showRaw && (
            <p className="text-[9px] text-blue-500 mt-0.5 font-mono">
              μ={avg(S_D_RAW).toFixed(3)} σ={sdv(S_D_RAW).toFixed(3)}
            </p>
          )}
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-[10px] text-green-700 font-semibold mb-1">
            {showRaw ? "s_M (raw)" : "ẑ_M (z-norm)"}
          </p>
          <p className="font-mono text-green-800 font-bold text-lg">
            {showRaw ? S_M_RAW[TARGET].toFixed(3) : Z_M[TARGET].toFixed(2)}
          </p>
          {showRaw && (
            <p className="text-[9px] text-green-500 mt-0.5 font-mono">
              μ={avg(S_M_RAW).toFixed(3)} σ={sdv(S_M_RAW).toFixed(4)}
            </p>
          )}
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
          <p className="text-[10px] text-purple-700 font-semibold mb-1">γ · 𝟙[in both]</p>
          <p className="font-mono text-purple-800 font-bold text-lg">
            {gamma.toFixed(2)}
          </p>
        </div>
      </div>

      {/* γ slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="gamma-slider" className="text-xs text-gray-700 font-medium">
            agreement weight γ
          </label>
          <span className="font-mono text-xs text-purple-700 font-semibold">{gamma.toFixed(2)}</span>
        </div>
        <input
          id="gamma-slider"
          type="range"
          min={-0.3}
          max={0.9}
          step={0.05}
          value={gamma}
          onChange={(e) => setGamma(parseFloat(e.target.value))}
          className="w-full accent-purple-600"
        />
        <div className="flex justify-between text-[9px] text-gray-400 font-mono mt-1">
          <span>−0.3 (penalize)</span>
          <span>0</span>
          <span>+0.9 (boost)</span>
        </div>
      </div>

      {/* Final score */}
      <motion.div
        animate={{ scale: [1, 1.03, 1] }}
        key={gamma.toFixed(2)}
        transition={{ duration: 0.35 }}
        className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-center"
      >
        <p className="text-[10px] text-amber-700 font-semibold mb-1">
          final fused score — D₁
        </p>
        <p className="font-mono text-amber-900 font-bold text-2xl">{fused.toFixed(2)}</p>
        <p className="text-[10px] text-gray-500 mt-2 font-mono">
          s<sup>z</sup><sub>final</sub>(d) = ẑ_D(d) + ẑ_M(d)
          {gamma !== 0 && ` + ${gamma > 0 ? "+" : ""}${gamma.toFixed(2)} · 𝟙[d ∈ D ∩ M]`}
        </p>
        {gamma === 0 && (
          <p className="text-[9px] text-blue-600 mt-0.5">
            γ = 0 → paper&apos;s canonical Z-Agreement
          </p>
        )}
      </motion.div>

      <p className="text-[11px] text-gray-500 px-1">
        The paper&apos;s Z-Agreement uses γ = 0 (pure z-sum). The γ slider extends
        this with an additive bonus for documents found by both views — useful for
        ablating whether the agreement signal adds further gain. Toggle{" "}
        <em>Raw scores</em> to see the 20× scale difference that makes z-normalisation
        necessary.
      </p>
    </div>
  );
}
