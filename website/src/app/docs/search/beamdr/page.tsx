import MethodPage from "@/components/Docs/MethodPage";
import BeamDRDemo from "@/components/Docs/demos/BeamDRDemo";

export const metadata = {
  title: "BeamDR · LatentGraphRAG",
  description: "BeamDR-style beam search in the latent graph.",
};

const CODE = `rag.retrieve(
    queries=["..."],
    corpus="document_only",
    search="beamdr",
    beam_width=10,
    branching=3,          # branch_per_state
    max_hops=4,
    k=10,
)`;

export default function Page() {
  return (
    <MethodPage
      pathname="/docs/search/beamdr"
      title="BeamDR"
      lead={
        <>
          BeamDR-style pruning: at every hop, expand each beam state by{" "}
          <span className="font-mono">branch_per_state</span>, then keep only the top-
          <span className="font-mono">B</span> paths by cumulative score. Cheap, fast,
          and competitive when scores are well-calibrated.
        </>
      }
      code={CODE}
      demo={<BeamDRDemo />}
      parameters={[
        { name: "search", type: '"beamdr"', description: "This strategy." },
        { name: "beam_width", type: "int", default: "10", description: "Top-B paths kept after each hop. Typical values: 5, 10, 40." },
        { name: "branching", type: "int", default: "3", description: "Number of children per beam state before pruning (branch_per_state)." },
        { name: "max_hops", type: "int", default: "4", description: "Maximum retrieval depth." },
      ]}
    >
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        When BeamDR shines
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        On clean, in-distribution benchmarks (MuSiQue) BeamDR matches or beats full
        expansion at a fraction of the compute. Document-Only BeamDR (B=5) reaches{" "}
        <span className="font-mono">80.03</span> MuSiQue R@5 vs. <span className="font-mono">79.73</span> for full expansion.
      </p>
      <p className="text-gray-700 leading-7 my-4">
        On out-of-distribution settings (BrowseComp+) BeamDR underperforms full expansion
        — early-hop scores are less reliable, and aggressive pruning kills correct paths.
        Use <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">search=&quot;full_expansion&quot;</code> there.
      </p>
    </MethodPage>
  );
}
