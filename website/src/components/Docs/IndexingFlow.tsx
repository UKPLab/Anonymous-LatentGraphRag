/**
 * The indexing workflow at a glance (/docs/indexing): what happens once per corpus and what happens per
 * question. Each card links to the section of the page that shows the code.
 */

import { LGR } from "@/components/lgrPalette";

type Card = { n: number; title: string; api: string; note: string; color: string; second?: string; href: string };

const ONCE: Card[] = [
  { n: 1, title: "Corpus", api: "{doc id: text}", note: "chunked: groups=", color: LGR.doc, href: "#1-the-corpus" },
  { n: 2, title: "Memories", api: "MemoryInventory", note: "triples + propositions → memories.jsonl", color: LGR.triple, second: LGR.prop, href: "#2-constructed-knowledge" },
  { n: 3, title: "Encode once", api: "lgr.build(...)", note: "RDR checkpoint encodes documents and memories", color: LGR.state, href: "#3-encode-once-and-save" },
  { n: 3, title: "On disk", api: "index.save(path)", note: "embeddings, texts, inventory", color: LGR.muted, href: "#the-saved-index" },
];

const EVERY: Card[] = [
  { n: 4, title: "Load", api: "lgr.load_index(path)", note: "no re-encoding", color: LGR.doc, href: "#4-load-and-search" },
  { n: 4, title: "Search", api: "lgr.search(questions)", note: "two trees → one ranking", color: LGR.fused, href: "#4-load-and-search" },
  { n: 5, title: "Seed", api: "Seed.from_ranking", note: "top 10 documents", color: LGR.fused, href: "#5-seed-the-react-agent" },
  { n: 5, title: "ReAct agent", api: "agent.run(q, seed)", note: "own searches, then the answer", color: LGR.search, href: "#5-seed-the-react-agent" },
];

function Row({ label, cards }: { label: string; cards: Card[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <ol className="grid grid-cols-1 gap-1.5 @xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] @xl:items-stretch">
        {cards.map((c, i) => (
          <li key={c.title} className="contents">
            {i > 0 && (
              <span aria-hidden className="flex items-center justify-center text-slate-300 @xl:px-0.5">
                <span className="@xl:hidden">↓</span>
                <span className="hidden @xl:inline">→</span>
              </span>
            )}
            <a
              href={c.href}
              className="group block min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 no-underline transition hover:border-slate-300 hover:shadow-sm"
              style={{ boxShadow: `inset 0 2px 0 ${c.color}` }}
            >
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-400">{c.n}</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                {c.second && <span className="-ml-1 h-2 w-2 shrink-0 rounded-full" style={{ background: c.second }} />}
                <span className="text-[12.5px] font-semibold text-slate-900">{c.title}</span>
              </span>
              <span className="mt-0.5 block truncate font-mono text-[10.5px] text-slate-600" title={c.api}>{c.api}</span>
              <span className="mt-0.5 block text-[10.5px] leading-4 text-slate-400">{c.note}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function IndexingFlow() {
  return (
    <figure className="@container not-prose my-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4" aria-label="Indexing workflow">
      <div className="space-y-3">
        <Row label="Once per corpus" cards={ONCE} />
        <Row label="Every time you use it" cards={EVERY} />
      </div>
      <figcaption className="mt-2 text-[11px] leading-4 text-slate-500">
        Encoding is the only expensive step. A saved index is loaded without encoding anything again and searched with the same RDR
        checkpoint; the numbers refer to the sections below.
      </figcaption>
    </figure>
  );
}
