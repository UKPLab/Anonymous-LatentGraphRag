/**
 * Static overview of the LatentGraphRAG pipeline for the docs: two recursive trees on RDR,
 * projection of the memory view to source documents, view fusion, and the downstream seed.
 * Each box names the package object that implements the step.
 */

type Box = { title: string; body: string; api?: string; tone: "rdr" | "lgr" | "agent" };

const TONE: Record<Box["tone"], string> = {
  rdr: "border-gray-300 bg-gray-50",
  lgr: "border-blue-300 bg-blue-50/60",
  agent: "border-amber-300 bg-amber-50/60",
};

function Card({ b }: { b: Box }) {
  return (
    <div className={`rounded-lg border px-3 py-2 min-w-0 break-words ${TONE[b.tone]}`}>
      <p className="text-sm font-semibold text-gray-900">{b.title}</p>
      <p className="text-xs text-gray-600 leading-5 mt-0.5">{b.body}</p>
      {b.api ? <p className="text-[11px] font-mono text-gray-500 mt-1">{b.api}</p> : null}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-gray-400 text-lg select-none" aria-hidden>
      ↓
    </div>
  );
}

export default function PipelineDiagram() {
  const documentTree: Box = {
    title: "Document tree D",
    body: "RDR's recursive search over the source documents, read out with RDR's global readout.",
    api: "LatentGraphRAG.search(view=\"D\")",
    tone: "rdr",
  };
  const memoryTree: Box = {
    title: "Memory tree M",
    body: "The same recursive search over triples and propositions; children chosen by MMR.",
    api: "MMRTreeSearch",
    tone: "lgr",
  };
  return (
    <figure className="my-8" aria-label="LatentGraphRAG pipeline">
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <Card b={{ title: "Source documents", body: "Passages or chunks of the corpus.", tone: "rdr" }} />
        <Card
          b={{
            title: "Constructed knowledge",
            body: "Triples and propositions, each linked to the documents it came from (π).",
            api: "MemoryInventory",
            tone: "lgr",
          }}
        />
        <Arrow />
        <Arrow />
        <Card b={documentTree} />
        <Card b={memoryTree} />
        <Arrow />
        <Arrow />
        <Card
          b={{
            title: "Document view",
            body: "A score per document; for a chunked corpus, the maximum over its chunks.",
            api: "result.document_view",
            tone: "rdr",
          }}
        />
        <Card
          b={{
            title: "Projection to sources",
            body: "Each document takes the maximum score of the memories it supplied.",
            api: "project(..., reduce=\"max\")",
            tone: "lgr",
          }}
        />
      </div>
      <Arrow />
      <div className="max-w-md mx-auto">
        <Card
          b={{
            title: "View fusion",
            body: "CombMNZ of the document view and the projected memory view: one document ranking.",
            api: "fuse(..., method=\"combmnz\")",
            tone: "lgr",
          }}
        />
      </div>
      <Arrow />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
        <Card
          b={{
            title: "Retrieve-then-read",
            body: "A fixed reader answers from the top documents.",
            api: "Reader",
            tone: "agent",
          }}
        />
        <Card
          b={{
            title: "Seeded ReAct agent",
            body: "The top documents seed an agent that may search further.",
            api: "ReActAgent, Seed",
            tone: "agent",
          }}
        />
      </div>
      <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 justify-center">
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm border border-gray-300 bg-gray-50 mr-1.5 align-middle" />
          Recursive Dense Retrieval
        </span>
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm border border-blue-300 bg-blue-50 mr-1.5 align-middle" />
          added by this package
        </span>
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm border border-amber-300 bg-amber-50 mr-1.5 align-middle" />
          downstream use (agent and evaluation)
        </span>
      </figcaption>
    </figure>
  );
}
