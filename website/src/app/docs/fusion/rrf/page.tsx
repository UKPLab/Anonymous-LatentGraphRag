import MethodPage from "@/components/Docs/MethodPage";
import RRFFusionDemo from "@/components/Docs/demos/RRFFusionDemo";
import Link from "next/link";

export const metadata = {
  title: "Reciprocal Rank Fusion · LatentGraphRAG",
  description: "Rank-based fusion of two ranked lists (documents + memories).",
};

const CODE = `rag.retrieve(
    queries=["..."],
    corpus="dual_tree",
    search="full_expansion",
    fusion="rrf",
    rrf_k=60,             # standard from Cormack et al. 2009
    branching_doc=3,
    branching_memory=5,
    k=10,
)`;

export default function Page() {
  return (
    <MethodPage
      pathname="/docs/fusion/rrf"
      title="Reciprocal Rank Fusion (RRF)"
      lead={
        <>
          Combines two ranked lists by summing reciprocal-rank contributions:{" "}
          <span className="font-mono">
            score(d) = Σ 1/(k + rank<sub>D</sub>(d)) + Σ 1/(k + rank<sub>M</sub>(d))
          </span>
          . Robust when raw scores from documents and memories are on different scales.
          The strongest fusion that needs no score calibration at all: mean R@10 of{" "}
          <span className="font-mono">51.32</span> across our three benchmarks, behind only
          Z-Agreement&apos;s <span className="font-mono">54.26</span>.
        </>
      }
      code={CODE}
      demo={<RRFFusionDemo />}
      parameters={[
        { name: "fusion", type: '"rrf"', description: "Reciprocal Rank Fusion." },
        { name: "rrf_k", type: "int", default: "60", description: "Smoothing constant — the standard from Cormack, Clarke, and Buettcher (2009)." },
      ]}
    >
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Why RRF over score-summing?
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        Scores from the document view and the memory view live on different scales — the
        memory view tends to produce sharper distributions because verbalized triples
        match query phrasing more tightly. Summing raw scores would let one view dominate.
      </p>
      <p className="text-gray-700 leading-7 my-4">
        RRF sidesteps the calibration question by working in rank space only. Top docs
        in both lists contribute large reciprocal-rank values; their sum surfaces them
        to the top of the fused ranking.
      </p>
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Compared to agreement fusion
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        On MuSiQue (in-distribution, well-calibrated scores), <Link href="/docs/fusion/agreement" className="text-blue-600 underline">agreement fusion</Link> edges out RRF
        on R@10, and it also wins on the mean across all three benchmarks
        (<span className="font-mono">54.26</span> vs <span className="font-mono">51.32</span> R@10).
        RRF stays the safer choice when the two views&apos; scores cannot be assumed
        comparable, because it never looks at a score — only at ranks.
      </p>
    </MethodPage>
  );
}
