import Link from "next/link";
import PrevNext from "@/components/Docs/PrevNext";

export const metadata = {
  title: "Tutorial · LatentGraphRAG",
  description: "Build, encode, search, and evaluate end-to-end on a tiny corpus in five steps.",
};

const STEPS = [
  {
    n: 1,
    title: "Install",
    href: "/docs/tutorial/01-install",
    blurb: "pip install the package and verify the import.",
  },
  {
    n: 2,
    title: "Build a Graph",
    href: "/docs/tutorial/02-build-graph",
    blurb:
      "Run the full pipeline on 5 mini-MuSiQue documents — chunking, OpenIE, verbalization, graph construction. With API or vLLM.",
  },
  {
    n: 3,
    title: "Encode",
    href: "/docs/tutorial/03-encode",
    blurb: "What happens inside the encoder, and how to plug in a custom multi-hop encoder.",
  },
  {
    n: 4,
    title: "Retrieve",
    href: "/docs/tutorial/04-retrieve",
    blurb:
      "Run every (corpus × search × fusion) combination on the same query — with a live combinations matrix.",
  },
  {
    n: 5,
    title: "Evaluate",
    href: "/docs/tutorial/05-evaluate",
    blurb: "Compute Recall@K against gold documents and sweep the configuration grid.",
  },
];

export default function Page() {
  return (
    <article className="prose-docs">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mt-2 mb-2">
        Tutorial
      </h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-8">
        A five-step end-to-end walkthrough. By the end you&apos;ll have a working
        relational-memory graph, embeddings on disk, a side-by-side comparison of every
        retrieval mode, and a Recall@5 number you can plot.
      </p>

      <ol className="not-prose space-y-3 my-8">
        {STEPS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group flex items-start gap-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 p-5 transition"
            >
              <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-sm">
                {s.n}
              </span>
              <span className="flex-1">
                <p className="font-semibold text-gray-900 group-hover:text-blue-700">
                  {s.title}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">{s.blurb}</p>
              </span>
              <span className="self-center text-gray-300 group-hover:text-blue-400">→</span>
            </Link>
          </li>
        ))}
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Before you start
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        You&apos;ll need Python 3.10+, a few minutes, and either an OpenAI-compatible API
        key OR a CUDA-capable machine for self-hosted vLLM. The five-document corpus
        we use fits on a laptop; nothing about the tutorial requires the full
        encoder weights — the steps explain how to plug in lighter alternatives.
      </p>

      <PrevNext pathname="/docs/tutorial" />
    </article>
  );
}
