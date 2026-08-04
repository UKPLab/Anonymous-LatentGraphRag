import MethodPage from "@/components/Docs/MethodPage";
import FullExpansionDemo from "@/components/Docs/demos/FullExpansionDemo";

export const metadata = {
  title: "Full Expansion · LatentGraphRAG",
  description: "Unpruned b-ary tree expansion in the latent graph.",
};

const CODE = `rag.retrieve(
    queries=["..."],
    corpus="document_only",
    search="full_expansion",
    branching=3,          # or "adaptive"
    max_hops=4,
    branching_threshold=0.05,   # only used when branching="adaptive"
    k=10,
)`;

export default function Page() {
  return (
    <MethodPage
      pathname="/docs/search/full-expansion"
      title="Full Expansion"
      lead={
        <>
          At every hop, every state expands into its top-<span className="font-mono">b</span>{" "}
          children. After <span className="font-mono">H</span> hops you have up to{" "}
          <span className="font-mono">b<sup>H</sup></span> paths through the latent graph,
          ranked by cumulative score. The most robust strategy out-of-distribution.
        </>
      }
      code={CODE}
      demo={<FullExpansionDemo />}
      parameters={[
        { name: "search", type: '"full_expansion"', description: "This strategy." },
        { name: "branching", type: 'int | "adaptive"', default: "3", description: 'Top-b per hop. Pass "adaptive" to branch only while the score margin exceeds branching_threshold.' },
        { name: "branching_threshold", type: "float", default: "0.05", description: "Adaptive branching cutoff." },
        { name: "max_hops", type: "int", default: "4", description: "Maximum retrieval depth." },
        { name: "k", type: "int", default: "10", description: "Final number of paths to return." },
      ]}
    >
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Algorithm
      </h2>
      <pre className="text-[12px] font-mono bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto leading-6">{`frontier = [Path()]
all_paths = []
for hop in range(max_hops):
    contexts = [build_context(query, p) for p in frontier]
    ctx_vecs = encoder.encode(contexts, is_query=True)
    scores, idx = index.search(ctx_vecs, k=branching)
    next_frontier = []
    for fi, path in enumerate(frontier):
        for j in pick(scores[fi], idx[fi], branching):
            next_frontier.append(path.with_extension(item_j))
    all_paths.extend(next_frontier)
    frontier = next_frontier

return sorted(all_paths, key=lambda p: p.cumulative_score, reverse=True)[:k]`}</pre>
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Why it&apos;s the robust default
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        Full expansion never prunes a state based on a single hop&apos;s score. In
        out-of-distribution settings (BrowseComp+), early hop scores are poorly
        calibrated; BeamDR may drop the correct path early. Full expansion keeps every
        path alive at the cost of more compute (<span className="font-mono">b<sup>H</sup></span> states).
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        When to use <code className="font-mono">branching=&quot;adaptive&quot;</code>
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        Adaptive branching expands a state only while the score margin between
        consecutive candidates stays within <code className="font-mono text-sm">branching_threshold</code>.
        It self-tunes the fanout: wide on confident hops, narrow on uncertain ones.
        When to reach for it:
      </p>
      <ul className="list-disc list-outside ml-6 my-4 space-y-1.5 text-gray-700">
        <li>
          <strong>Recommended:</strong>{" "}
          <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">corpus=&quot;document_only&quot;, search=&quot;full_expansion&quot;, branching=&quot;adaptive&quot;</code>{" "}
          on out-of-distribution / web-scale corpora (BrowseComp+-style). Encoder
          scores are flat and poorly calibrated there; fixed <span className="font-mono">b=3</span>{" "}
          either over-explores cheap dead ends or under-explores the right neighborhood.
          Adaptive lets the threshold do the work.
        </li>
        <li>
          <strong>Less useful on clean datasets</strong> (MuSiQue-style). Scores are
          calibrated enough that fixed <span className="font-mono">b=3</span> already
          finds the right next step every hop; adaptive adds variance without much gain.
        </li>
        <li>
          <strong>Tuning hint:</strong> start with{" "}
          <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">branching_threshold=0.05</code>.
          Increase (e.g. 0.10) if the search misses obvious neighbors, decrease (0.02)
          if it&apos;s exploring too aggressively.
        </li>
      </ul>
      <p className="text-gray-700 leading-7 my-4">
        On in-distribution / depth-oriented tasks, the integer-branching defaults
        usually win. Both options ship in v0.1 precisely because they fail in opposite
        regimes — pick whichever matches your data&apos;s score calibration.
      </p>
    </MethodPage>
  );
}
