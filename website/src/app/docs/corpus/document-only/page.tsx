import MethodPage from "@/components/Docs/MethodPage";
import DocumentOnlyDemo from "@/components/Docs/demos/DocumentOnlyDemo";

export const metadata = {
  title: "Document-Only · LatentGraphRAG",
  description: "Iterative recursive dense retrieval over a single document index.",
};

const CODE = `import latentgraphrag as lgr

rag = lgr.LatentGraphRAG.from_documents(
    documents=[...],
    encoder="GritHopper-7B",
)

results = rag.retrieve(
    queries=["..."],
    corpus="document_only",
    search="full_expansion",
    branching=3,
    max_hops=4,
    k=10,
)`;

export default function Page() {
  return (
    <MethodPage
      pathname="/docs/corpus/document-only"
      title="Document-Only"
      lead={
        <>
          Single tree over the <strong>chunk index</strong>. No graph extraction, no
          memories — just iterative recursive dense retrieval. A strong
          single-modality baseline (Doc-Only Full Tree reaches <span className="font-mono">79.73</span> MuSiQue R@5).
        </>
      }
      code={CODE}
      demo={<DocumentOnlyDemo />}
      parameters={[
        { name: "corpus", type: '"document_only"', description: "Search only the chunk index." },
        { name: "search", type: "SearchStrategy", default: '"full_expansion"', description: "Any single-view search strategy." },
        { name: "branching", type: "int | \"adaptive\"", default: "3", description: "Top-b candidates per hop." },
        { name: "max_hops", type: "int", default: "4", description: "Maximum retrieval depth." },
        { name: "k", type: "int", default: "10", description: "Final number of documents to return." },
      ]}
    >
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        When to use
      </h2>
      <ul className="list-disc list-outside ml-6 my-4 space-y-1.5 text-gray-700">
        <li>You have no extracted knowledge graph yet, or don&apos;t want to build one.</li>
        <li>Quick sanity-check baseline before investing in memory extraction.</li>
        <li>The corpus is small or the task is depth-oriented (sequential reasoning).</li>
      </ul>
      <p className="text-gray-700 leading-7 my-4">
        Document-only retrieval skips OpenIE and verbalization entirely. Use{" "}
        <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">
          LatentGraphRAG.from_documents(...)
        </code>{" "}
        to build a document-only index without ever calling an OpenIE LLM.
      </p>
    </MethodPage>
  );
}
