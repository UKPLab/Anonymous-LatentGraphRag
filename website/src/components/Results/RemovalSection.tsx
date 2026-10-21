"use client";

import { motion } from "framer-motion";
import { table3Removal } from "@/data/lgrPaper";
import { CellView } from "@/components/PaperTables/PaperTable";
import { claim } from "@/components/PaperTables/claims";

/** RQ3: Table 3, controlled removal of constructed knowledge (MuSiQue, hop-level R@5). */
export default function RemovalSection() {
  const cols = table3Removal.columns;
  const { triples, propositions } = table3Removal.deletedUnits;
  return (
    <div className="max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="text-center mb-6">
        <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-blue-600 mb-2">RQ3</span>
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
          Less Brittle When Constructed Knowledge Is Missing
        </h2>
        <p className="text-gray-600 max-w-3xl mx-auto text-sm leading-relaxed">{claim("removal-robustness")}</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {["removal-props", "removal-triples"].map((id) => (
          <div key={id} className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-900 leading-relaxed">
            {claim(id)}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 mb-3 max-w-3xl">
        On MuSiQue, every triple or proposition of the gold paragraph that mentions the hop answer is deleted
        ({triples} release triples, {propositions} PropRAG propositions), the same units for every system; the
        documents stay unchanged. Hop-level R@5 on the affected hops, before and after.
      </p>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-xs tabular-nums">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-3 py-2 font-semibold text-gray-700 text-center first:text-left">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table3Removal.groups.map((g, gi) => (
              <Group key={gi} title={g.title} rows={g.rows} n={cols.length} />
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 leading-relaxed">
          Table 3 of the paper. Δ intervals: paired bootstrap over questions. Rand.: change when the same number of
          triples or propositions without the answer is deleted instead; ∗ marks intervals that exclude zero.
        </p>
      </div>
    </div>
  );
}

type Row = (typeof table3Removal.groups)[number]["rows"][number];

function Group({ title, rows, n }: { title: string; rows: Row[]; n: number }) {
  return (
    <>
      {title && (
        <tr className="border-t border-gray-200">
          <td colSpan={n} className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{title}</td>
        </tr>
      )}
      {rows.map((r) => (
        <tr key={r.system + r.deleted} className={`border-t border-gray-100 ${r.kind === "lgr" ? "bg-blue-50/60" : ""}`}>
          <td className="px-3 py-1.5 text-left text-gray-800">{r.system}</td>
          <td className="px-3 py-1.5 text-center text-gray-500">{r.deleted}</td>
          <td className="px-3 py-1.5 text-center text-gray-500">{r.hops}</td>
          <td className="px-3 py-1.5 text-center text-gray-600">{r.before}</td>
          <td className="px-3 py-1.5 text-center text-gray-600">{r.after}</td>
          <td className="px-3 py-1.5 text-center">
            <span className={r.kind === "lgr" ? "font-semibold text-blue-900" : "font-semibold text-gray-800"}>{r.delta}</span>{" "}
            <span className="text-gray-400">{r.ci}</span>
          </td>
          <td className="px-3 py-1.5 text-center text-gray-600"><CellView cell={r.rand} /></td>
        </tr>
      ))}
    </>
  );
}
