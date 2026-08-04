import MethodPage from "@/components/Docs/MethodPage";
import CrossViewBeamDemo from "@/components/Docs/demos/CrossViewBeamDemo";

export const metadata = {
  title: "Cross-View Beam · LatentGraphRAG",
  description: "Single beam that queries both the document and memory indices each step.",
};

const CODE = `rag.retrieve(
    queries=["..."],
    corpus="dual_tree",        # required
    search="cross_view_beam",
    beam_width=10,
    branching=3,
    max_hops=4,
    k=10,
)`;

export default function Page() {
  return (
    <MethodPage
      pathname="/docs/search/cross-view-beam"
      title="Cross-View Beam"
      lead={
        <>
          A single beam that queries <strong>both</strong> the document and memory
          indices at every hop. Each beam member is tagged with its substrate; the beam
          can mix freely. The top MuSiQue R@5 (<span className="font-mono">83.21</span>)
          comes from this strategy at B=10.
        </>
      }
      code={CODE}
      demo={<CrossViewBeamDemo />}
      parameters={[
        { name: "search", type: '"cross_view_beam"', description: "This strategy. Requires corpus='dual_tree'." },
        { name: "corpus", type: '"dual_tree"', description: "Mandatory — the strategy is inherently dual." },
        { name: "beam_width", type: "int", default: "10", description: "Top-B paths across both substrates." },
        { name: "branching", type: "int", default: "3", description: "Children per beam state before pruning." },
        { name: "max_hops", type: "int", default: "4", description: "Maximum retrieval depth." },
      ]}
    >
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Why no fusion step?
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        Cross-view beam fuses <em>during</em> search, not after. Since every beam member
        is on a single comparable path-score, there&apos;s a single ranked output already
        when the search ends. A separate fusion would be redundant.
      </p>
      <p className="text-gray-700 leading-7 my-4">
        The validator enforces this — passing{" "}
        <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">fusion=&quot;rrf&quot;</code>{" "}
        with{" "}
        <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">search=&quot;cross_view_beam&quot;</code>{" "}
        silently ignores the fusion argument.
      </p>
    </MethodPage>
  );
}
