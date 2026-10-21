import Link from "next/link";
import PrevNext from "@/components/Docs/PrevNext";
import PipelineDiagram from "@/components/Docs/PipelineDiagram";
import { CodeVariants } from "@/components/Docs/CodeShowcase";
import { INSTALL, QUICKSTART } from "@/components/Docs/snippets";
import ReActDemo from "@/components/Agentic/ReActDemo";
import { frozenConfig } from "@/data/lgrPaper";

export const metadata = {
  title: "LatentGraphRAG · Documentation",
  description:
    "Documentation of the latentgraphrag package: knowledge construction, two recursive trees on Recursive Dense Retrieval, source-level fusion, a seeded ReAct agent and evaluation.",
};

const RDR_SITE = "https://anonymous.4open.science/w/Recursive-Dense-Retrieval";

const h2 =
  "text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200 scroll-mt-20";
const p = "text-gray-700 leading-7 my-4";
const code = "font-mono text-[0.9em] bg-gray-100 text-gray-800 rounded px-1 py-0.5";
const link = "text-blue-600 hover:text-blue-800 underline underline-offset-2";

const CARDS = [
  {
    href: "/docs/installation",
    label: "Install",
    title: "RDR, then this package",
    body: "Python 3.10 or newer; optional extras for the agent and for knowledge construction.",
    tone: "text-blue-600",
  },
  {
    href: "/docs/quickstart",
    label: "Quickstart",
    title: "Inventory, retrieval, agent, grade",
    body: "The whole pipeline in one script, from constructed knowledge to a graded answer.",
    tone: "text-blue-600",
  },
  {
    href: "/docs/indexing",
    label: "Index, save, reuse",
    title: "From a corpus to a saved index",
    body: "Construct triples and propositions, encode once, save, load later, search and seed the agent.",
    tone: "text-indigo-600",
  },
  {
    href: "/docs/retrieval",
    label: "Guide",
    title: "Two trees, one ranking",
    body: "Views, projection and fusion, the paper's configuration and its ablations.",
    tone: "text-green-600",
  },
  {
    href: "/docs/reproduce",
    label: "Reproduce",
    title: "Frozen configuration and parity",
    body: "How the package is checked against the evaluator behind the paper's numbers.",
    tone: "text-purple-600",
  },
];

const FROM_RDR = [
  ["Encoder", "the RDR checkpoint encodes documents, memories and every query state"],
  ["Recursive search", "each query state encodes the question together with the units observed so far"],
  ["Global readout", "one ranking over all states of a tree"],
];

const ADDED = [
  ["Knowledge construction", "triples and propositions as memories, each with the documents it came from", "/docs/construction"],
  ["Memory tree", "RDR's tree with children selected by maximal marginal relevance", "/docs/retrieval#the-memory-tree"],
  ["Projection to sources", "memory scores become document scores", "/docs/retrieval#projection-and-fusion"],
  ["View fusion", "document view and projected memory view become one document ranking", "/docs/retrieval#projection-and-fusion"],
  ["Joint index", "documents and memories in one index, for the ablation", "/docs/retrieval#views"],
  ["Seeded ReAct agent", "the ranking as initial evidence of an agent with a search tool", "/docs/agent"],
  ["Evaluation", "reader, BrowseComp grader, list recall and recall@k", "/docs/evaluation"],
];

export default function DocsHome() {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600 mt-2">
        LatentGraphRAG · latentgraphrag
      </p>
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mt-1 mb-2">
        LatentGraphRAG
      </h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Constructed knowledge, composed at test time. The <code className={code}>latentgraphrag</code>{" "}
        package searches the source documents and the triples and propositions constructed from them with
        two recursive trees on Recursive Dense Retrieval, returns one ranking of source documents, and hands its
        top {frozenConfig.seedSize} to a ReAct agent as initial evidence.
      </p>

      <CodeVariants
        variants={[
          { label: "quick start", code: QUICKSTART },
          { label: "install", code: INSTALL, lang: "bash" },
        ]}
      />
      <p className="text-[12px] text-gray-500 -mt-2 mb-6 leading-5">
        The whole pipeline: constructed knowledge with provenance, two recursive trees fused at the source, a seeded
        ReAct agent and its grade. Below, the same steps on three released questions.
      </p>

      <ReActDemo />
      <p className="text-[12px] text-gray-500 mt-2 mb-8 leading-5">
        Retrieval-first seeding, one problem type per tab: a multi-hop chain answered from the seed alone, a
        missing hop found with one search, and a fan-out list. Seeds, searches and answers are taken from the
        released runs behind Table 5 of the paper.
      </p>

      <h2 id="where-to-go" className={h2}>
        Where to go
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="block rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 p-5 transition"
          >
            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${c.tone}`}>{c.label}</p>
            <p className="font-semibold text-gray-900">{c.title}</p>
            <p className="text-sm text-gray-600 mt-1">{c.body}</p>
          </Link>
        ))}
      </div>

      <h2 id="how-it-works" className={h2}>
        How it works
      </h2>
      <p className={p}>
        LatentGraphRAG is built on Recursive Dense Retrieval (RDR; Anonymous, 2026). It runs RDR&apos;s
        recursive search twice. The <strong>document tree</strong> <em>D</em> searches the source documents;
        the <strong>memory tree</strong> <em>M</em> searches the constructed knowledge, triples rendered as
        sentences and propositions. Every memory keeps a link π to the documents it was extracted from, so
        the memory readout is projected onto documents: a document receives the maximum score of the
        memories it supplied. The two views are then fused with {frozenConfig.viewFusion}, with weight{" "}
        {frozenConfig.documentWeight} for the document view and {frozenConfig.memoryWeight} for the memory
        view, into a single document ranking.
      </p>
      <p className={p}>
        The ranking can be read directly by a fixed reader (retrieve-then-read) or handed to a ReAct agent as
        its initial evidence (retrieval-first seeding). The package includes both, together with the grader
        and the metrics used in the paper.
      </p>

      <PipelineDiagram />

      <h2 id="rdr-and-this-package" className={h2}>
        What comes from RDR, what this package adds
      </h2>
      <p className={p}>
        Both trees use RDR unchanged. LatentGraphRAG depends on the RDR package and does not re-implement it.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">From RDR</p>
          <ul className="space-y-2 text-sm text-gray-700">
            {FROM_RDR.map(([t, b]) => (
              <li key={t}>
                <span className="font-semibold text-gray-900">{t}</span>: {b}
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-600 mt-4">
            Search strategies, readouts and the encoder are documented on the{" "}
            <a href={RDR_SITE} target="_blank" rel="noopener noreferrer" className={link}>
              RDR project page
            </a>
            .
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-3">
            Added by latentgraphrag
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {ADDED.map(([t, b, href]) => (
              <li key={t}>
                <Link href={href} className="font-semibold text-gray-900 hover:text-blue-700">
                  {t}
                </Link>
                : {b}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 id="package-layout" className={h2}>
        Package layout
      </h2>
      <div className="my-6 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-900">Module</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-900">Contents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {[
              ["latentgraphrag.construction", "triples, propositions, chunk_id"],
              ["latentgraphrag.inventory", "MemoryInventory"],
              ["latentgraphrag.config", "LGRConfig, PAPER"],
              ["latentgraphrag.retrieval", "LatentGraphRAG, LGRIndex, LGRResult, MMRTreeSearch, project, fuse, rank"],
              ["latentgraphrag.agent", "ReActAgent, Seed, Trajectory, DenseSearchTool, RankFileFusedSearchTool, OpenAIChatModel"],
              ["latentgraphrag.evaluation", "Reader, BrowseCompGrader, loose_final, recall_at_k, retrieval_metrics"],
            ].map(([m, c]) => (
              <tr key={m}>
                <td className="px-4 py-2 align-top">
                  <code className={code}>{m}</code>
                </td>
                <td className="px-4 py-2 font-mono text-xs leading-6">{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={p}>
        The most used names are re-exported at the top level, e.g.{" "}
        <code className={code}>from latentgraphrag import LatentGraphRAG, MemoryInventory, PAPER</code>. The
        full list is on the <Link href="/docs/api" className={link}>API page</Link>.
      </p>

      <PrevNext pathname="/docs" />
    </>
  );
}
