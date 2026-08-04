import MethodPage from "@/components/Docs/MethodPage";
import JointIndexDemo from "@/components/Docs/demos/JointIndexDemo";

export const metadata = {
  title: "Joint-Index · LatentGraphRAG",
  description: "Documents and memories concatenated into one virtual index.",
};

const CODE = `rag.retrieve(
    queries=["..."],
    corpus="joint_index",
    search="full_expansion",
    branching=5,
    max_hops=4,
    k=10,
)`;

export default function Page() {
  return (
    <MethodPage
      pathname="/docs/corpus/joint-index"
      title="Joint-Index"
      lead={
        <>
          Chunks and memories live in <strong>one combined index</strong>. The tree mixes
          documents and memories at any hop — whichever&apos;s a better match for the
          current context. No fusion step needed.
        </>
      }
      code={CODE}
      demo={<JointIndexDemo />}
      parameters={[
        { name: "corpus", type: '"joint_index"', description: "Search the chunk ∪ memory index." },
        { name: "search", type: "SearchStrategy", default: '"full_expansion"', description: '"full_expansion" or "beamdr" recommended.' },
        { name: "branching", type: "int", default: "5", description: "Typically higher than document-only because the index is ~2× larger." },
        { name: "max_hops", type: "int", default: "4", description: "Maximum retrieval depth." },
      ]}
    >
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Compared to dual-tree
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        Joint-index is the &quot;cheaper&quot; cousin of dual-tree: one index, one search,
        no fusion. It works when documents and memories have comparable scores under the
        same encoder. Joint-Index Tree Search reaches <span className="font-mono">76.14</span>{" "}
        MuSiQue R@5 — competitive but not the peak, which dual-tree variants achieve.
      </p>
    </MethodPage>
  );
}
