"use client";

import { motion } from "framer-motion";
import { frozenConfig, table1, table1Columns, table2Depth, table3Removal } from "@/data/lgrPaper";
import PaperTable, { CellView, type RowGroup } from "@/components/PaperTables/PaperTable";
import { claim } from "@/components/PaperTables/claims";

/** RQ1 + RQ2: Table 1 (retrieval across depth, breadth and web documents) and Table 2 (by hop). */

const GROUPS: RowGroup[] = table1.map((g) => ({
  title: g.title,
  note: g.construction,
  rows: g.rows.map((r) => ({
    label: r.method,
    note: r.citation,
    cells: r.cells,
    tone: r.kind === "lgr" ? "lgr" : "plain",
    strong: r.headline,
  })),
}));

/** "D+M − D [95%]": the Δ header of Table 2 with the interval marker the paper uses in Table 3. */
const DELTA_HEADER = `${table2Depth.columns[7]} ${table3Removal.columns[5].replace(/^Δ\s*/, "")}`;

export default function RetrievalResultsSection() {
  return (
    <div className="max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="text-center mb-6">
        <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-blue-600 mb-2">RQ1 · RQ2</span>
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
          Recursive Retrieval Outperforms Graph Pipelines, and Constructed Knowledge Adds On Top
        </h2>
        <p className="text-gray-600 max-w-3xl mx-auto text-sm leading-relaxed">{claim("doc-only-beats-graph")}</p>
        <p className="text-gray-600 max-w-3xl mx-auto text-sm leading-relaxed mt-2">{claim("mean-r5")}</p>
      </motion.div>

      <PaperTable
        firstColumn="Method"
        columns={table1Columns}
        groups={GROUPS}
        caption={
          <>
            Table 1 of the paper. Retrieval across evidence depth (MuSiQue), breadth (FanOutQA) and heterogeneous
            web documents (BrowseComp+ (pool), the shared corpus subset), R@5 / R@10. All triple-based rows use the
            same triples; LatentGraphRAG stores each triple as one &ldquo;{frozenConfig.tripleVerbalization}&rdquo;
            memory. All RDR rows use one frozen configuration. Best in bold, second underlined.
          </>
        }
      />

      <p className="text-sm text-gray-700 text-center max-w-3xl mx-auto mt-6">{claim("fused-vs-joint")}</p>

      <div className="mt-8 max-w-4xl mx-auto">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Where fusion helps: MuSiQue by hop count</h3>
        <p className="text-xs text-gray-500 mb-3">
          LatentGraphRAG with documents and triples, configuration of Table 1. R@5 of the root state (q0), each
          view (D, M, J) and the fused ranking (D+M).
        </p>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-xs tabular-nums">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {table2Depth.columns.slice(0, 7).map((c) => (
                  <th key={c} className="px-3 py-2 font-semibold text-gray-700 text-center first:text-left">{c}</th>
                ))}
                <th className="px-3 py-2 font-semibold text-gray-700 text-center">{DELTA_HEADER}</th>
              </tr>
            </thead>
            <tbody>
              {table2Depth.rows.map((r) => (
                <tr key={r.hops} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 text-left font-medium text-gray-800">{r.hops}</td>
                  {[r.n, r.q0, r.D, r.M, r.J].map((v, i) => (
                    <td key={i} className="px-3 py-1.5 text-center text-gray-600">{v}</td>
                  ))}
                  <td className="px-3 py-1.5 text-center bg-blue-50/60"><CellView cell={r.DM} /></td>
                  <td className="px-3 py-1.5 text-center">
                    <CellView cell={r.delta} /> <span className="text-gray-400">{r.ci}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500">
            Table 2 of the paper. Brackets: within-group paired intervals; green: interval excludes zero. The
            difference between hop groups is {table2Depth.betweenGroup.value} {table2Depth.betweenGroup.ci}, not
            significant.
          </p>
        </div>
      </div>
    </div>
  );
}
