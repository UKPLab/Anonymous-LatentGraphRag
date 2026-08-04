import PrevNext from "@/components/Docs/PrevNext";

export const metadata = {
  title: "API · retrieve() — LatentGraphRAG",
  description: "Full reference for LatentGraphRAG.retrieve() and its 14 parameters.",
};

const PARAMS = [
  { name: "queries", type: "List[str]", default: "—", desc: "The input questions, one per query." },
  { name: "corpus", type: '"document_only" | "memory_only" | "joint_index" | "dual_tree"', default: '"document_only"', desc: "Which index(es) to search. See Concepts → Three Orthogonal Axes." },
  { name: "search", type: '"full_expansion" | "beamdr" | "cross_view_beam" | "mmr" | "single_hop"', default: '"full_expansion"', desc: "How to expand candidates at each hop." },
  { name: "fusion", type: '"rrf" | "agreement" | None', default: "None", desc: "Required for dual_tree. Ignored otherwise (validator raises if you try)." },
  { name: "k", type: "int", default: "10", desc: "Final number of documents to return per query." },
  { name: "max_hops", type: "int", default: "4", desc: "Maximum retrieval depth across all search strategies." },
  { name: "branching", type: 'int | "adaptive"', default: "3", desc: 'Top-b per hop in full_expansion/MMR. Pass "adaptive" for score-margin-based branching.' },
  { name: "branching_doc", type: "Optional[int]", default: "None", desc: "Override branching for the document tree in dual_tree mode." },
  { name: "branching_memory", type: "Optional[int]", default: "None", desc: "Override branching for the memory tree in dual_tree mode." },
  { name: "beam_width", type: "Optional[int]", default: "None", desc: "Top-B paths kept after each hop in beamdr / cross_view_beam." },
  { name: "gamma", type: "float", default: "0.0", desc: "Agreement weight. Only used when fusion='agreement'." },
  { name: "rrf_k", type: "int", default: "60", desc: "RRF smoothing constant. Only used when fusion='rrf'." },
  { name: "lambda_mmr", type: "float", default: "0.7", desc: "MMR diversity weight. Only used when search='mmr'." },
  { name: "branching_threshold", type: "float", default: "0.05", desc: 'Adaptive-branching cutoff. Only used when branching="adaptive".' },
];

const VALIDATION_ROWS = [
  { rule: "fusion ∈ {rrf, agreement} requires corpus='dual_tree'", err: "Fusion is only meaningful when corpus='dual_tree' — single-view retrieval has nothing to fuse." },
  { rule: "search='cross_view_beam' requires corpus='dual_tree'", err: "search='cross_view_beam' requires corpus='dual_tree'." },
  { rule: "corpus ∈ {memory_only, joint_index, dual_tree} requires build_graph()", err: "Memory-only / joint / dual modes require a relational memory index. Call build_graph() first (with openie_llm set)." },
  { rule: "corpus value not in {document_only, memory_only, joint_index, dual_tree}", err: "Invalid corpus='...'. Expected one of [...]." },
  { rule: "search value not in {full_expansion, beamdr, cross_view_beam, mmr, single_hop}", err: "Invalid search='...'. Expected one of [...]." },
  { rule: "fusion value not in {rrf, agreement, none, None}", err: "Invalid fusion='...'. Expected rrf/agreement/none/None." },
];

function ParamTable({ rows }: { rows: { name: string; type: string; default?: string; desc: string }[] }) {
  return (
    <div className="my-4 overflow-x-auto not-prose">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 font-semibold text-gray-900 w-44">Name</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-900 w-64">Type</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-900 w-28">Default</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-900">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-gray-100 align-top">
              <td className="px-4 py-2 font-mono text-blue-700 text-xs">{r.name}</td>
              <td className="px-4 py-2 font-mono text-gray-600 text-[11px]">{r.type}</td>
              <td className="px-4 py-2 font-mono text-gray-500 text-xs">{r.default ?? "—"}</td>
              <td className="px-4 py-2 text-gray-700 text-sm">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="my-5 rounded-xl border border-gray-200 bg-gray-950 overflow-hidden not-prose">
      <div className="px-4 py-2 border-b border-gray-800 bg-gray-900 text-xs text-gray-400 font-mono">
        python
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-gray-100 font-mono text-[13px] leading-6 whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

export default function Page() {
  return (
    <article className="prose-docs">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mt-2 mb-2">
        <code className="font-mono">retrieve()</code>
      </h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        The main retrieval entry point. Dispatches on three orthogonal axes (corpus ×
        search × fusion) and returns <code className="font-mono">List[RetrievalResult]</code>.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Signature
      </h2>
      <CodeBlock>{`def retrieve(
    self,
    queries: List[str],
    *,
    corpus: CorpusMode = "document_only",
    search: SearchStrategy = "full_expansion",
    fusion: Optional[FusionMethod] = None,
    k: int = 10,
    max_hops: int = 4,
    branching: Union[int, str] = 3,
    branching_doc: Optional[int] = None,
    branching_memory: Optional[int] = None,
    beam_width: Optional[int] = None,
    gamma: float = 0.0,
    rrf_k: int = 60,
    lambda_mmr: float = 0.7,
    branching_threshold: float = 0.05,
    verify: bool = False,
) -> List[RetrievalResult]`}</CodeBlock>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Parameters
      </h2>
      <ParamTable rows={PARAMS} />

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Return type
      </h2>
      <CodeBlock>{`@dataclass
class RetrievalResult:
    query: str                              # the input query
    documents: List[str]                    # top-k document ids, sorted by score desc
    scores: List[float]                     # aligned with .documents
    memories: List[str]                     # memory hash_ids surfaced
    paths: List[List[Any]]                  # full per-hop paths (debugging)`}</CodeBlock>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Validation rules
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        All validation runs at call-time. Invalid combinations raise{" "}
        <code className="font-mono text-sm">ValueError</code> with a message that
        names the rule:
      </p>
      <div className="my-4 overflow-x-auto not-prose">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-900 w-1/2">Rule violated</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-900">Error message</th>
            </tr>
          </thead>
          <tbody>
            {VALIDATION_ROWS.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 align-top">
                <td className="px-4 py-2 font-mono text-blue-700 text-xs">{r.rule}</td>
                <td className="px-4 py-2 text-gray-700 text-sm">{r.err}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Canonical configurations
      </h2>
      <CodeBlock>{`# Document-Only Full Tree (b=3, H=4)  — strong document baseline
rag.retrieve(q, corpus="document_only", search="full_expansion",
             branching=3, max_hops=4)

# Memory-Only Full Expansion           — best on FanOutQA
rag.retrieve(q, corpus="memory_only", search="full_expansion",
             branching=3, max_hops=4)

# BeamDR (B=10) over documents
rag.retrieve(q, corpus="document_only", search="beamdr",
             beam_width=10, max_hops=4)

# Joint-Index Tree Search (b=5)
rag.retrieve(q, corpus="joint_index", search="full_expansion",
             branching=5, max_hops=4)

# Dual RRF, Full Expansion             — best calibration-free fusion
rag.retrieve(q, corpus="dual_tree", search="full_expansion",
             fusion="rrf", branching_doc=3, branching_memory=5)

# Full Dual-Tree + Agreement           — best MuSiQue R@10 (90.36)
rag.retrieve(q, corpus="dual_tree", search="full_expansion",
             fusion="agreement", branching_doc=3, branching_memory=5,
             gamma=0.0)

# Cross-View Beam (B=10)               — best MuSiQue R@5 (83.21)
rag.retrieve(q, corpus="dual_tree", search="cross_view_beam",
             beam_width=10, max_hops=4)`}</CodeBlock>

      <PrevNext pathname="/docs/api/retrieve" />
    </article>
  );
}
