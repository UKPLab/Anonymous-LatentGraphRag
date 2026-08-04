import MethodPage from "@/components/Docs/MethodPage";
import FusionLab from "@/components/Docs/demos/FusionLab";

export const metadata = {
  title: "Document–Memory Agreement · LatentGraphRAG",
  description: "Parameter-free fusion that standardises each view before summing.",
};

const CODE = `rag.retrieve(
    queries=["..."],
    corpus="dual_tree",
    search="full_expansion",
    fusion="agreement",   # parameter-free Z-Agreement
    branching_doc=3,
    branching_memory=5,
    k=10,
)`;

export default function Page() {
  return (
    <MethodPage
      pathname="/docs/fusion/agreement"
      title="Document–Memory Agreement"
      lead={
        <>
          Per-query z-score normalisation maps both views to zero mean and unit variance
          before summing:{" "}
          <span className="font-mono">
            s<sup>z</sup><sub>final</sub>(d) = ẑ<sub>D</sub>(d) + ẑ<sub>M</sub>(d)
          </span>{" "}
          where{" "}
          <span className="font-mono">ẑ = (s − μ<sub>q</sub>) / σ<sub>q</sub></span>{" "}
          is computed over each view&apos;s retrieved candidates for query <em>q</em>.
          Absent view scores are zero. The sum carries no weight — Z-Agreement is{" "}
          <strong>parameter-free</strong> and still achieves the best MuSiQue R@10 (
          <span className="font-mono">90.36</span>).
        </>
      }
      code={CODE}
      demo={<FusionLab mode="agreement" />}
      parameters={[
        { name: "fusion", type: '"agreement"', description: "Parameter-free Z-Agreement: per-query z-normalise each view, then sum." },
        { name: "branching_doc", type: "int", default: "3", description: "Branching factor of the document tree." },
        { name: "branching_memory", type: "int", default: "5", description: "Branching factor of the (wider) memory tree." },
      ]}
    >
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Why z-normalise?
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        Both trees produce <em>cumulative path scores</em> — products of per-hop cosine
        similarities from the same encoder — so the two views already live in comparable
        ranges (the paper&apos;s diagnostics report a median{" "}
        <span className="font-mono">σ<sub>D</sub>/σ<sub>M</sub> ≈ 1.09</span>). They are not
        on wildly different scales. What does differ, query to query, is each view&apos;s
        spread: one view can be more tightly bunched than the other, which lets the
        wider-spread view dominate a plain sum. Z-scoring each view independently (zero
        mean, unit variance across that view&apos;s retrieved docs) removes that
        spread mismatch, so a document is rewarded for being strong <em>relative to its own
        view&apos;s distribution</em> rather than for the view it happens to come from.
      </p>
      <p className="text-gray-700 leading-7 my-4">
        Memory scores are first projected to document level by taking the max score per
        source document:{" "}
        <span className="font-mono">
          s<sub>M</sub>(d) = max<sub>m: π(m)=d</sub> s<sub>M</sub>(m)
        </span>
        . The z-normalisation is then applied to each view&apos;s projected scores, and the
        two standardised scores are simply summed. There is no weight or bonus term — a
        document ranks highly precisely when both views <em>agree</em> it is above average.
      </p>
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Plain-additive ablation (γ)
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        Z-Agreement is the headline method and is parameter-free. The appendix also reports
        a simpler ablation — a <em>plain additive</em> sum of the raw path scores,{" "}
        <span className="font-mono">
          s<sub>final</sub>(d) = s<sub>D</sub>(d) + s<sub>M</sub>(d)
        </span>{" "}
        — with an optional multiplicative agreement factor on documents found by both views:{" "}
        <span className="font-mono">
          (s<sub>D</sub> + s<sub>M</sub>) · (1 + γ)
        </span>
        . Here γ is a property of the <strong>plain</strong> variant only, never of
        Z-Agreement. Switch the demo to <span className="font-mono">Plain additive</span> to
        expose the γ slider: positive γ boosts intersected docs, negative γ penalises them.
        Across the sweep, parameter-free Z-Agreement still gives the strongest MuSiQue R@10,
        which is why it — not the γ-tuned plain sum — is the default.
      </p>
    </MethodPage>
  );
}
