import MethodPage from "@/components/Docs/MethodPage";
import MemoryOnlyDemo from "@/components/Docs/demos/MemoryOnlyDemo";

export const metadata = {
  title: "Memory-Only · LatentGraphRAG",
  description: "Iterative dense retrieval over verbalized relational memories.",
};

const CODE = `rag.retrieve(
    queries=["..."],
    corpus="memory_only",
    search="full_expansion",
    branching=3,
    max_hops=4,
    k=10,
)`;

export default function Page() {
  return (
    <MethodPage
      pathname="/docs/corpus/memory-only"
      title="Memory-Only"
      lead={
        <>
          Single tree over the <strong>relational-memory index</strong>. Each retrieved
          memory carries provenance back to its source document. Best on
          width-oriented FanOutQA (<span className="font-mono">31.45</span> R@5),
          where many small facts assemble into one answer.
        </>
      }
      code={CODE}
      demo={<MemoryOnlyDemo />}
      parameters={[
        { name: "corpus", type: '"memory_only"', description: "Search only the relational-memory index." },
        { name: "search", type: "SearchStrategy", default: '"full_expansion"', description: "Single-view strategies only." },
        { name: "branching", type: 'int | "adaptive"', default: "3", description: "Top-b memories per hop." },
        { name: "max_hops", type: "int", default: "4", description: "Maximum retrieval depth." },
      ]}
    >
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Projection to documents
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        Memory paths are projected back to source documents at the end. Each
        <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">RelationalMemory</code>{" "}
        carries a <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">doc_id</code>;{" "}
        the projection takes the max score per source document.
      </p>
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        When to use
      </h2>
      <ul className="list-disc list-outside ml-6 my-4 space-y-1.5 text-gray-700">
        <li>Width-oriented tasks where many distinct facts contribute (FanOutQA-style).</li>
        <li>Diagnostic: comparing memory-only vs document-only isolates how useful the extracted relations are.</li>
        <li>You want a smaller search space than the full chunk index.</li>
      </ul>
    </MethodPage>
  );
}
