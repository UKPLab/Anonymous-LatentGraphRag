"use client";

import { motion } from "framer-motion";
import { frozenConfig, paperMeta, table1Columns, table13AllViews, table14Projection } from "@/data/lgrPaper";
import PaperTable from "@/components/PaperTables/PaperTable";

/** Appendix ablations: every view and fusion operator (Table 13) and the projection (Table 14). */
export default function AblationResults() {
  return (
    <div className="max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="text-center mb-6">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
          Which Views, Which Fusion, Which Projection?
        </h2>
        <p className="text-gray-600 max-w-3xl mx-auto text-sm leading-relaxed">
          Separate trees fused at the source level against a joint index J that lets documents and memories
          alternate within one path, each fused with {frozenConfig.fusionOperatorsCompared.join(", ")}.
          The reported configuration is D+M with {frozenConfig.viewFusion}; the readout is inherited from RDR, so
          these are aggregation choices, not new update operators.
        </p>
      </motion.div>

      <PaperTable
        firstColumn="View"
        columns={table1Columns.slice(0, 3)}
        groups={table13AllViews.map((g) => ({
          title: g.title,
          rows: g.rows.map((r) => ({
            label: r.view,
            cells: r.cells,
            tone: "reported" in r && r.reported ? "lgr" : "plain",
            strong: "reported" in r && r.reported,
          })),
        }))}
        caption={
          <>
            Table 13 of the paper (appendix). All views and fusion operators of LatentGraphRAG with documents and
            triples at the frozen configuration, R@5 / R@10; best per column in bold. Highlighted: the reported
            fusion.
          </>
        }
      />

      <div className="mt-8 max-w-3xl mx-auto">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Mapping memories to documents</h3>
        <p className="text-xs text-gray-500 mb-3">
          Change in fused R@5 when the {table14Projection.reference} in the projection is replaced, with triples and
          propositions at the frozen configuration. No alternative improves every benchmark.
        </p>
        <PaperTable
          firstColumn="Projection"
          columns={[{ benchmark: `Δ R@5 vs. ${table14Projection.reference}`, metrics: paperMeta.benchmarks }]}
          groups={[{ rows: table14Projection.rows.map((r) => ({ label: r.projection, cells: r.cells })) }]}
          caption={<>Table 14 of the paper (appendix). ∗: the paired interval excludes zero.</>}
        />
      </div>
    </div>
  );
}
