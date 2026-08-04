import MethodPage from "@/components/Docs/MethodPage";
import DualTreeDemo from "@/components/Docs/demos/DualTreeDemo";
import Link from "next/link";

export const metadata = {
  title: "Dual-Tree · LatentGraphRAG",
  description: "Two parallel trees over documents and memories, then fused.",
};

const CODE = `rag.retrieve(
    queries=["..."],
    corpus="dual_tree",
    search="full_expansion",
    fusion="agreement",       # or "rrf"
    branching_doc=3,
    branching_memory=5,
    max_hops=4,
    gamma=0.0,
    k=10,
)`;

export default function Page() {
  return (
    <MethodPage
      pathname="/docs/corpus/dual-tree"
      title="Dual-Tree"
      lead={
        <>
          Two parallel trees — one over documents (<span className="font-mono">b<sub>D</sub></span>),
          one over memories (<span className="font-mono">b<sub>M</sub></span>). After
          expansion, both views are projected to document-level rankings and{" "}
          <Link href="/docs/fusion/rrf" className="text-blue-600 underline">fused</Link>.
          The strongest MuSiQue R@10 (<span className="font-mono">90.36</span>) comes from this mode.
        </>
      }
      code={CODE}
      demo={<DualTreeDemo />}
      parameters={[
        { name: "corpus", type: '"dual_tree"', description: "Two parallel trees, one per substrate." },
        { name: "search", type: "SearchStrategy", default: '"full_expansion"', description: "Any search — for cross_view_beam, see its own page." },
        { name: "fusion", type: '"rrf" | "agreement"', default: '"rrf"', description: "Required for dual_tree; combines the two rankings." },
        { name: "branching_doc", type: "int", default: "3", description: "Branching factor for the document tree." },
        { name: "branching_memory", type: "int", default: "5", description: "Branching factor for the memory tree — usually higher." },
        { name: "gamma", type: "float", default: "0.0", description: "Only used with agreement fusion (see Fusion → Agreement)." },
      ]}
    >
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Why two trees?
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        Documents and memories surface different signal. Documents preserve context;
        memories preserve relations. Running both views in parallel and fusing means
        the final ranking is robust to either failing on a particular query.
      </p>
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Canonical configurations
      </h2>
      <ul className="list-disc list-outside ml-6 my-4 space-y-1.5 text-gray-700">
        <li><strong>MMR-Tree + Z-Agreement</strong> (best mean R@5 44.65 and R@10 54.26): <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">search=&quot;mmr_tree&quot;, fusion=&quot;z_agreement&quot;, b_D=3, b_M=5</code>.</li>
        <li><strong>Dual RRF, Full Expansion</strong> (best calibration-free fusion): <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">fusion=&quot;rrf&quot;, b_D=3, b_M=5</code>.</li>
        <li><strong>Full Dual-Tree + Agreement</strong> (best MuSiQue R@10): <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">fusion=&quot;agreement&quot;, b_D=3, b_M=5, γ=0</code>.</li>
      </ul>
    </MethodPage>
  );
}
