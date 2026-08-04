import MethodPage from "@/components/Docs/MethodPage";
import MMRDemo from "@/components/Docs/demos/MMRDemo";

export const metadata = {
  title: "MMR · LatentGraphRAG",
  description: "Diversity-aware expansion via Maximal Marginal Relevance.",
};

const CODE = `rag.retrieve(
    queries=["..."],
    corpus="document_only",
    search="mmr",
    branching=3,
    lambda_mmr=0.7,       # λ ∈ [0, 1]; higher = more relevance, less diversity
    max_hops=4,
    k=10,
)`;

export default function Page() {
  return (
    <MethodPage
      pathname="/docs/search/mmr"
      title="MMR"
      lead={
        <>
          Maximal Marginal Relevance at every hop: pick the top-<span className="font-mono">b</span>{" "}
          candidates that maximize
          {" "}<span className="font-mono">λ·sim(c<sub>t</sub>, x) − (1 − λ)·max<sub>y∈retrieved</sub> sim(x, y)</span>.
          Lower <span className="font-mono">λ</span> spreads siblings across the
          semantic space — useful for width-oriented tasks (FanOutQA).
        </>
      }
      code={CODE}
      demo={<MMRDemo />}
      parameters={[
        { name: "search", type: '"mmr"', description: "This strategy." },
        { name: "branching", type: "int", default: "3", description: "Top-b candidates per hop, selected via MMR re-ranking." },
        { name: "lambda_mmr", type: "float", default: "0.7", description: "λ ∈ [0, 1]. At λ=1 reduces to plain top-b. At λ<1 prefers diversity." },
        { name: "max_hops", type: "int", default: "4", description: "Maximum retrieval depth." },
      ]}
    >
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        When MMR helps — and when it doesn&apos;t
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        The optimal retrieval setup is strongly dataset-dependent. The single-modality
        winners in our results are not the same across benchmarks — Memory-Only Full
        Expansion is best on width-oriented FanOutQA (<span className="font-mono">31.45</span> R@5)
        while Document-Only Full Tree is best on web-scale BrowseComp+ (<span className="font-mono">21.18</span>).
        MMR&apos;s fit follows the same axis.
      </p>
      <ul className="list-disc list-outside ml-6 my-4 space-y-1.5 text-gray-700">
        <li>
          <strong>Recommended:</strong>{" "}
          <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">corpus=&quot;memory_only&quot;, search=&quot;mmr&quot;, lambda_mmr=0.5–0.7</code>{" "}
          on width-oriented tasks (FanOutQA-style) where many distinct facts contribute
          to the answer. Memory-only is already strong here; MMR&apos;s diversity bonus
          stacks because the encoder otherwise returns several near-paraphrases of the
          same memory.
        </li>
        <li>
          <strong>Useful diagnostic:</strong> on any task where the top-k returned by
          Full Expansion contains near-duplicate items, swap to MMR with λ ≈ 0.5 and
          see whether Recall@10 improves while Recall@5 stays comparable.
        </li>
        <li>
          <strong>Avoid on depth-oriented tasks</strong> (MuSiQue-style chains of
          reasoning). Sibling diversity is the wrong objective when you want the most
          relevant next fact along a known chain.
        </li>
        <li>
          <strong>Avoid on small/noisy corpora.</strong> When relevant items are
          already sparse, the diversity penalty pushes the search away from them.
        </li>
      </ul>
      <p className="text-gray-700 leading-7 my-4">
        MMR composes with every corpus mode and every fusion method.
      </p>
    </MethodPage>
  );
}
