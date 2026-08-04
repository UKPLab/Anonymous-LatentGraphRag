import Link from "next/link";
import PrevNext from "@/components/Docs/PrevNext";

export const metadata = {
  title: "LatentGraphRAG · Documentation",
  description: "Get started with LatentGraphRAG — production-grade recursive dense retrieval over documents and relational memories.",
};

export default function DocsHome() {
  return (
    <article className="prose-docs">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mt-2 mb-2">
        LatentGraphRAG
      </h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-8">
        Recursive dense retrieval over documents and verbalized relational memories — a
        unified, decomposition-free framework for multi-hop retrieval.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
        <Link
          href="/docs/installation"
          className="block rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 p-5 transition"
        >
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-2">
            Install
          </p>
          <p className="font-semibold text-gray-900">Get the package on your machine</p>
          <p className="text-sm text-gray-600 mt-1">
            <code className="font-mono text-gray-500">pip install latentgraphrag</code>
          </p>
        </Link>
        <Link
          href="/docs/quickstart"
          className="block rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 p-5 transition"
        >
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-2">
            Quickstart
          </p>
          <p className="font-semibold text-gray-900">
            Build a graph, retrieve, evaluate
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Five documents, one Python file, three minutes.
          </p>
        </Link>
        <Link
          href="/docs/concepts/overview"
          className="block rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 p-5 transition"
        >
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wider mb-2">
            Concepts
          </p>
          <p className="font-semibold text-gray-900">The three orthogonal axes</p>
          <p className="text-sm text-gray-600 mt-1">
            How <em>corpus</em>, <em>search</em>, and <em>fusion</em> factor independently.
          </p>
        </Link>
        <Link
          href="/docs/tutorial/01-install"
          className="block rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 p-5 transition"
        >
          <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider mb-2">
            Tutorial
          </p>
          <p className="font-semibold text-gray-900">End-to-end walkthrough</p>
          <p className="text-sm text-gray-600 mt-1">
            Build, encode, search, and evaluate on a tiny MuSiQue subset.
          </p>
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Why LatentGraphRAG?
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        Knowledge-graph-based RAG systems traditionally <strong>traverse</strong> an
        extracted graph at query time, propagating across fixed edges. LatentGraphRAG
        takes a different view: it treats every graph-derived edge as a <em>relational
        memory</em> — a verbalized natural-language sentence — and retrieves those
        memories with the same iterative recursive dense retrieval used for documents.
      </p>
      <p className="text-gray-700 leading-7 my-4">
        The benefit is unification: the same retrieval primitive handles documents,
        memories, joint indices, and dual trees. Search strategies and fusion methods
        compose orthogonally with the corpus choice, giving you a clean matrix of
        configurations to mix and match.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        At a glance
      </h2>
      <ul className="list-disc list-outside ml-6 my-4 space-y-2 text-gray-700">
        <li>
          <strong>Drop-in API</strong> — one class,
          three methods: <code className="font-mono text-sm">build_graph()</code>,{" "}
          <code className="font-mono text-sm">retrieve()</code>,{" "}
          <code className="font-mono text-sm">save()</code> /{" "}
          <code className="font-mono text-sm">load()</code>.
        </li>
        <li>
          <strong>Four corpus modes</strong> × <strong>six search strategies</strong> ×{" "}
          <strong>two fusion methods</strong> — every combination is one keyword away.
        </li>
        <li>
          <strong>FAISS-accelerated</strong> ANN search with CPU and GPU backends; falls
          back to numpy brute-force when FAISS isn&apos;t installed.
        </li>
        <li>
          <strong>Modular encoders</strong> — GritHopper by default; implement{" "}
          <code className="font-mono text-sm">BaseEncoder</code> for a custom
          multi-hop-capable encoder.
        </li>
      </ul>

      <PrevNext pathname="/docs" />
    </article>
  );
}
