"use client";

/**
 * RQ4: from retrieval to answers. The ReAct demo (three released questions, step by step), then
 * Table 5 (one shared ReAct controller, only the seed varies) and Table 4 (read-only answers from each
 * method's top-ten texts). Every paper number comes from `@/data/lgrPaper`.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { frozenConfig, table4ReadOnly, table5React } from "@/data/lgrPaper";
import PaperTable from "@/components/PaperTables/PaperTable";
import { claim } from "@/components/PaperTables/claims";
import ReActDemo from "./ReActDemo";

const tone = (kind: string) => (kind === "lgr" ? "lgr" : kind === "rdr" ? "rdr" : "plain") as "lgr" | "rdr" | "plain";

export default function AgenticRagSection() {
  return (
    <section className="py-14 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.5 }} className="text-center mb-6">
          <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-blue-600 mb-2">RQ4</span>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
            Retrieval-First Seeds for Readers and Agents
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-sm leading-relaxed">{claim("agent-search-reduction")}</p>
        </motion.div>

        <div className="mb-10">
          <h3 className="text-sm font-bold text-gray-900 mb-1">From the ranking to an answer, step by step</h3>
          <p className="text-xs text-gray-500 mb-3 max-w-4xl">
            Retrieval-first seeding on three released questions, one per problem type: the two trees build the
            ranking, its top {frozenConfig.seedSize} documents become the agent&apos;s initial evidence, and the
            agent searches only for what the seed does not hold.
          </p>
          <ReActDemo />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {["agent-accuracy", "agent-tokens", "fanout-search"].map((id) => (
            <div key={id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-700 leading-relaxed">
              {claim(id)}
            </div>
          ))}
        </div>

        <h3 className="text-sm font-bold text-gray-900 mb-1">Seeding one shared ReAct agent</h3>
        <p className="text-xs text-gray-500 mb-3 max-w-4xl">
          One controller ({frozenConfig.controller}), one embedding-search tool ({frozenConfig.agentSearchTool}, at
          most {frozenConfig.agentMaxSearches} searches returning {frozenConfig.textsPerSearch} texts each) and one
          budget for every condition; only the top-{frozenConfig.seedSize} initial evidence varies. Search calls
          count the agent&apos;s own searches after seeding.
        </p>
        <PaperTable
          firstColumn="Seed"
          columns={table5React.columns}
          groups={[{ rows: table5React.rows.map((r) => ({ label: r.seed, cells: r.cells, tone: tone(r.kind) })) }]}
          caption={
            <>
              Table 5 of the paper. Acc / List: final-answer accuracy / loose list recall (%), best in bold. Srch:
              searches per question after seeding. Means over paired runs; † one run.
            </>
          }
        />

        <h3 className="text-sm font-bold text-gray-900 mt-10 mb-1">Reading the evidence without further search</h3>
        <p className="text-xs text-gray-500 mb-3 max-w-4xl">
          The same reader ({frozenConfig.reader}) answers from each method&apos;s top-{frozenConfig.seedSize} texts.{" "}
          {claim("read-only-web")}
        </p>
        <PaperTable
          firstColumn="Evidence"
          columns={table4ReadOnly.columns}
          groups={[{ rows: table4ReadOnly.rows.map((r) => ({ label: r.evidence, cells: r.cells, tone: tone(r.kind) })) }]}
          caption={
            <>
              Table 4 of the paper. Acc: final-answer accuracy; List: loose list recall (FanOutQA). Δ: the bottom
              row minus each row; bold green Δ: the paired question-bootstrap interval excludes zero.
            </>
          }
        />
        <div className="mt-4 max-w-2xl">
          <PaperTable
            firstColumn={table4ReadOnly.reactMinusReadOnly.title}
            columns={table4ReadOnly.columns.map((c) => ({ benchmark: c.benchmark, metrics: [c.metrics[0]] }))}
            groups={[{
              rows: table4ReadOnly.reactMinusReadOnly.rows.map((r) => ({
                label: r.evidence,
                cells: [r.musique, r.fanoutqa, r.browsecomp],
              })),
            }]}
            caption={<>Table 4, bottom block: matched ReAct minus read-only answer quality, same evidence.</>}
          />
        </div>

        <div className="mt-10 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-blue-900">Read the trajectories</h3>
            <p className="text-sm text-blue-800/90 max-w-2xl">
              One run per condition is released for MuSiQue and FanOutQA: every reasoning step, search and
              retrieved document, with the final answer and its grade. The tables average repeated runs.
              BrowseComp+ trajectories are not published, because the benchmark asks that its questions and
              answers not appear online in plain text.
            </p>
          </div>
          <Link href="/traces"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition shrink-0">
            Browse trajectories <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
