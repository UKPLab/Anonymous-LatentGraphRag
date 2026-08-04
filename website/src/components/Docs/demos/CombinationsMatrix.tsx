"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

const DualTreeDemo = dynamic(() => import("./DualTreeDemo"), { ssr: false });
const FullExpansionDemo = dynamic(() => import("./FullExpansionDemo"), { ssr: false });
const BeamDRDemo = dynamic(() => import("./BeamDRDemo"), { ssr: false });
const MMRDemo = dynamic(() => import("./MMRDemo"), { ssr: false });
const CrossViewBeamDemo = dynamic(() => import("./CrossViewBeamDemo"), { ssr: false });
const FusionLab = dynamic(() => import("./FusionLab"), { ssr: false });

const CORPUS = [
  { id: "document_only", label: "Document-Only" },
  { id: "memory_only", label: "Memory-Only" },
  { id: "joint_index", label: "Joint-Index" },
  { id: "dual_tree", label: "Dual-Tree" },
] as const;
type CorpusId = (typeof CORPUS)[number]["id"];

const SEARCH = [
  { id: "full_expansion", label: "Full Expansion", needsDual: false },
  { id: "beamdr", label: "BeamDR", needsDual: false },
  { id: "mmr", label: "MMR", needsDual: false },
  { id: "cross_view_beam", label: "Cross-View Beam", needsDual: true },
] as const;
type SearchId = (typeof SEARCH)[number]["id"];

// Map our corpus axis to the substrate color/legend used inside the search demos.
function corpusToMode(corpus: CorpusId): "documents" | "memories" | "joint" {
  if (corpus === "memory_only") return "memories";
  if (corpus === "joint_index") return "joint";
  // document_only and dual_tree both treat the primary substrate as "documents"
  // (dual_tree shows the side-by-side view via DualTreeDemo).
  return "documents";
}

const FUSION = [
  { id: "none", label: "—", note: "" },
  { id: "rrf", label: "RRF", note: "(dual-tree only)" },
  { id: "agreement", label: "Agreement", note: "(dual-tree only)" },
] as const;
type FusionId = (typeof FUSION)[number]["id"];

/**
 * The interactive combinations explorer at /docs/combinations.
 *
 * Pick a corpus mode, search strategy, and fusion. The matrix shows which combinations
 * are valid and renders the relevant demo for the current selection.
 */
export default function CombinationsMatrix() {
  const [corpus, setCorpus] = useState<CorpusId>("dual_tree");
  const [search, setSearch] = useState<SearchId>("full_expansion");
  const [fusion, setFusion] = useState<FusionId>("agreement");

  const fusionLocked = corpus !== "dual_tree";
  const effectiveFusion = fusionLocked ? "none" : fusion;
  const crossViewMismatch = search === "cross_view_beam" && corpus !== "dual_tree";

  const invalid = crossViewMismatch;
  const callCode = useMemo(() => {
    const parts = [
      `rag.retrieve(`,
      `    queries,`,
      `    corpus="${corpus}",`,
      `    search="${search}",`,
    ];
    if (corpus === "dual_tree" && effectiveFusion !== "none") {
      parts.push(`    fusion="${effectiveFusion}",`);
    }
    if (search === "beamdr" || search === "cross_view_beam") {
      parts.push(`    beam_width=10,`);
    } else {
      parts.push(`    branching=3,`);
    }
    parts.push(`    max_hops=4, k=10,`);
    parts.push(`)`);
    return parts.join("\n");
  }, [corpus, search, effectiveFusion]);

  // What the big box shows. When a fusion is selected on a dual-tree corpus we
  // foreground the fusion calibration illustration (the whole point of fusion);
  // otherwise we show the search-strategy demo.
  const showFusionLab = corpus === "dual_tree" && (effectiveFusion === "agreement" || effectiveFusion === "rrf");

  function SearchDemo() {
    // Cross-view beam is inherently dual; show its specific demo.
    if (search === "cross_view_beam") return <CrossViewBeamDemo />;

    // Dual-tree: two parallel trees over docs + memories, each expanded by the chosen
    // search strategy. The DualTreeDemo currently always shows full expansion; per-tree
    // beam/MMR variants live here as fallbacks.
    if (corpus === "dual_tree") return <DualTreeDemo />;

    // Single-view combinations: dispatch on search strategy and color by corpus.
    const mode = corpusToMode(corpus);
    if (search === "beamdr") return <BeamDRDemo mode={mode} />;
    if (search === "mmr") return <MMRDemo mode={mode} />;
    // search === "full_expansion"
    return <FullExpansionDemo mode={mode} />;
  }

  function BoxContent() {
    if (invalid) {
      return (
        <div className="flex flex-col items-center justify-center text-center px-6 py-16 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 font-semibold mb-2">Invalid combination</p>
          <p className="text-xs text-red-600 font-mono">
            search=&quot;cross_view_beam&quot; requires corpus=&quot;dual_tree&quot;
          </p>
        </div>
      );
    }

    if (showFusionLab) {
      return (
        <div>
          <div className="mb-5 text-center">
            <h3 className="text-base font-bold text-gray-900">
              {effectiveFusion === "agreement" ? "Agreement fusion" : "Reciprocal Rank Fusion"}
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xl mx-auto leading-5">
              {effectiveFusion === "agreement"
                ? "Combine the document and memory rankings into one. Toggle plain additive (s_D + s_M, with a γ ablation) vs. the paper's parameter-free Z-Agreement to see how per-query calibration changes the ranking."
                : "Each view contributes by rank position, not raw score — inherently scale-free. Documents ranked highly by both lists climb the fused ranking."}
            </p>
          </div>
          <FusionLab mode={effectiveFusion as "agreement" | "rrf"} />
        </div>
      );
    }

    return <SearchDemo />;
  }

  return (
    <div className="w-full space-y-5">
      {/* Pickers row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Picker
          label="corpus"
          options={CORPUS.map((c) => ({ id: c.id, label: c.label }))}
          value={corpus}
          onChange={(v) => setCorpus(v as CorpusId)}
        />
        <Picker
          label="search"
          options={SEARCH.map((s) => ({
            id: s.id,
            label: s.label,
            disabled: s.needsDual && corpus !== "dual_tree",
          }))}
          value={search}
          onChange={(v) => setSearch(v as SearchId)}
        />
        <Picker
          label="fusion"
          options={FUSION.map((f) => ({
            id: f.id,
            label: f.label,
            disabled: fusionLocked && f.id !== "none",
          }))}
          value={effectiveFusion}
          onChange={(v) => setFusion(v as FusionId)}
        />
      </div>

      {/* Call code */}
      <div className="rounded-xl border border-gray-200 bg-gray-950 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-800 bg-gray-900 text-xs text-gray-400 font-mono">
          call
        </div>
        <pre className="px-4 py-3 text-gray-100 font-mono text-[12px] leading-6 overflow-x-auto whitespace-pre">
          {callCode}
        </pre>
      </div>

      {/* Bigger box below — the illustration */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 md:p-6 min-h-[420px]">
        <BoxContent />
      </div>
    </div>
  );
}

function Picker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => !o.disabled && onChange(o.id)}
            disabled={o.disabled}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
              o.disabled
                ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                : value === o.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
