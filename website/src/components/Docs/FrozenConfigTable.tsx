import { frozenConfig as fc } from "@/data/lgrPaper";

/**
 * The paper's frozen configuration next to the package setting that reproduces it. Values come from
 * src/data/lgrPaper.ts (checked against the paper), settings name the package's own defaults.
 */

const ROWS: { setting: string; paper: string; api: string }[] = [
  { setting: "Encoder", paper: fc.encoder, api: "LatentGraphRAG(checkpoint)" },
  { setting: "Trees", paper: `${fc.tree} for documents and for memories`, api: "depth=4, branching=3, memory_branching=3" },
  { setting: "Memory children", paper: `maximal marginal relevance, λ = ${fc.memoryTreeMmrWeight}`, api: "memory_mmr=True, mmr_lambda=0.5" },
  { setting: "Observation cap", paper: `${fc.observationTruncationTokens} tokens per observed unit`, api: "observation_max_tokens=512" },
  { setting: "Readout", paper: `K = ${fc.readoutTopK}, τ = ${fc.readoutTemperature} (RDR: τ = ${fc.rdrPublishedTemperature})`, api: "top_k=200, temperature=0.02" },
  { setting: "Projection", paper: `${fc.projection} over the memories a document supplied`, api: 'projection="max"' },
  { setting: "View fusion", paper: `${fc.viewFusion}, weights ${fc.documentWeight} (documents) and ${fc.memoryWeight} (memories)`, api: 'fusion="combmnz", document_weight=1.0, memory_weight=0.5' },
  { setting: "Triples", paper: `"${fc.tripleVerbalization}"`, api: "triples.render" },
  { setting: "Seed", paper: `top ${fc.seedSize} documents`, api: "Seed.from_ranking(ids, texts)" },
  { setting: "Reader and controller", paper: fc.controller, api: "OpenAIChatModel()" },
  { setting: "Agent search tool", paper: `${fc.agentSearchTool}, ${fc.textsPerSearch} texts per search, at most ${fc.agentMaxSearches} searches`, api: "DenseSearchTool, ReActAgent" },
];

export default function FrozenConfigTable() {
  return (
    <div className="my-6 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 font-semibold text-gray-900">Setting</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-900">Paper</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-900">Package (default)</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.setting}>
              <td className="px-4 py-2 border-b border-gray-100 align-top font-medium text-gray-900 whitespace-nowrap">
                {r.setting}
              </td>
              <td className="px-4 py-2 border-b border-gray-100 align-top text-gray-700">{r.paper}</td>
              <td className="px-4 py-2 border-b border-gray-100 align-top">
                <code className="font-mono text-xs text-gray-700">{r.api}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Benchmarks with their corpus sizes (lgrPaper.ts) and the source of their constructed knowledge. */
const BENCHMARKS: { name: string; size: string; triples: string; propositions: string }[] = [
  {
    name: "MuSiQue",
    size: `${fc.corpora.musique.questions} questions, ${fc.corpora.musique.passages} passages`,
    triples: "HippoRAG 2 release OpenIE (triples.load_openie)",
    propositions: "PropRAG release (propositions.load_records)",
  },
  {
    name: "FanOutQA",
    size: `${fc.corpora.fanoutqa.questions} questions, ${fc.corpora.fanoutqa.chunks} chunks`,
    triples: "OpenIE in HippoRAG's format (triples.extract_with_hipporag)",
    propositions: "PropRAG's extraction (propositions.extract_with_proprag)",
  },
  {
    name: "BrowseComp+",
    size: `${fc.corpora.browsecomp.questions} questions; ${fc.corpora.browsecomp.note.replace(/^BrowseComp\+ \(pool\): /, "pool of ")}`,
    triples: "OpenIE in HippoRAG's format (triples.extract_with_hipporag)",
    propositions: "PropRAG's extraction (propositions.extract_with_proprag)",
  },
];

export function BenchmarkTable() {
  return (
    <div className="my-6 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 font-semibold text-gray-900">Benchmark</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-900">Evaluation set</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-900">Triples</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-900">Propositions</th>
          </tr>
        </thead>
        <tbody>
          {BENCHMARKS.map((b) => (
            <tr key={b.name}>
              <td className="px-4 py-2 border-b border-gray-100 align-top font-medium text-gray-900 whitespace-nowrap">
                {b.name}
              </td>
              <td className="px-4 py-2 border-b border-gray-100 align-top text-gray-700">{b.size}</td>
              <td className="px-4 py-2 border-b border-gray-100 align-top text-gray-700">{b.triples}</td>
              <td className="px-4 py-2 border-b border-gray-100 align-top text-gray-700">{b.propositions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
