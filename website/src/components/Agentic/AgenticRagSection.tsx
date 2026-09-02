"use client";

/**
 * The downstream story: a retrieval seed makes a fixed ReAct agent both more
 * accurate and markedly cheaper. All numbers come from paperResults.ts.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Gauge, Layers } from "lucide-react";
import {
  reactLoop,
  efficiency,
} from "@/data/paperResults";

const TD = "px-3 py-2 text-sm whitespace-nowrap";
const TH =
  "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// the agent released with BrowseComp+, run under its own prompt with each seed
const releasedAgent = reactLoop.filter((r) => r.block === "benchmark");

export default function AgenticRagSection() {
  // BrowseComp+ is the noisy, web-scale regime — the interesting one for agents.
  const loop = reactLoop.filter((r) => r.block === "ours");
  const toolData = loop.map((r) => ({
    name: r.config.replace(/^\+ /, ""),
    tools: r.browseCompTools,
    acc: r.browseCompAcc,
    best: !!r.isBest,
  }));

  return (
    <section className="py-14 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            Retrieval-first seeding makes agents cheaper
          </h2>
          <p className="mt-3 text-gray-600 max-w-3xl">
            A strong ranking is not only a better retriever — it is a cheaper
            agent. Injecting one LatentGraphRAG ranking as a{" "}
            <strong>one-shot seed</strong> into a fixed ReAct loop raises answer
            accuracy while cutting the searches the agent issues itself by{" "}
            <strong>{efficiency.toolReductionFactor}×</strong> (
            {efficiency.meanToolsNoSeed.toFixed(2)} →{" "}
            {efficiency.meanToolsSeeded.toFixed(2)} calls per question, averaged
            over all three benchmarks). Because every additional tool call is
            another LLM invocation whose growing context must be held in the KV
            cache, this is where retrieval quality turns into serving cost.
          </p>
        </motion.div>

        {/* headline numbers */}
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: Gauge,
              label: "Mean accuracy",
              value: `${efficiency.meanAccNoSeed} → ${efficiency.meanAccSeeded}`,
              sub: "no seed → LatentGraphRAG seed",
            },
            {
              icon: Layers,
              label: "Agent searches",
              value: `${efficiency.meanToolsNoSeed.toFixed(2)} → ${efficiency.meanToolsSeeded.toFixed(2)}`,
              sub: `${efficiency.toolReductionFactor}× fewer, same loop`,
            },
            {
              icon: ArrowRight,
              label: "vs. BrowseComp+ agent",
              value: `${efficiency.benchmarkReductionFactor}× fewer`,
              sub: `${efficiency.benchmarkMeanTools} → ${efficiency.meanToolsSeeded.toFixed(2)} calls`,
            },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-gray-200 p-4 bg-gray-50/60"
            >
              <c.icon className="w-4 h-4 text-blue-500 mb-2" />
              <div className="text-[11px] uppercase tracking-wide text-gray-400">
                {c.label}
              </div>
              <div className="text-lg font-bold text-gray-900">{c.value}</div>
              <div className="text-xs text-gray-500">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* tool calls per seed, BrowseComp+ */}
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-gray-900">
            In-loop searches per question — BrowseComp+, reader Qwen3.5-122B
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            The injected seed itself is not counted as a tool call.
          </p>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={toolData}
                margin={{ top: 18, right: 8, left: 0, bottom: 78 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  angle={-28}
                  textAnchor="end"
                  interval={0}
                  height={70}
                  tickMargin={8}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  domain={[0, 3]}
                  label={{
                    value: "tool calls",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11, fill: "#6b7280" },
                  }}
                />
                <Tooltip
                  formatter={(value: number | undefined, _n, item) =>
                    value === undefined
                      ? ["–", ""]
                      : [
                          `${value.toFixed(2)} calls · ${item?.payload?.acc}% acc`,
                          "",
                        ]
                  }
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="tools" radius={[4, 4, 0, 0]}>
                  {toolData.map((d, i) => (
                    <Cell key={i} fill={d.best ? "#3b82f6" : "#94a3b8"} />
                  ))}
                  <LabelList
                    dataKey="tools"
                    position="top"
                    formatter={(v: unknown) => Number(v).toFixed(2)}
                    style={{ fontSize: 10, fill: "#374151" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* robustness */}
        <div className="mt-12">
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                It is not our scaffold
              </h3>
              <p className="text-xs text-gray-500">
                The agent released with BrowseComp+, its own prompt, given each
                seed. Mean over all three benchmarks.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className={TH}>Seed</th>
                    <th className={TH}>Mean acc</th>
                    <th className={TH}>Mean tools</th>
                  </tr>
                </thead>
                <tbody>
                  {releasedAgent.map((r) => (
                    <tr
                      key={r.config}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className={`${TD} text-gray-800`}>
                        {r.config.replace(/^\+ /, "")}
                      </td>
                      <td
                        className={`${TD} ${r.isBest ? "font-semibold text-gray-900" : "text-gray-500"}`}
                      >
                        {mean([r.musiqueAcc, r.browseCompAcc, r.fanoutqaAcc]).toFixed(1)}
                      </td>
                      <td className={`${TD} text-gray-500`}>
                        {mean([
                          r.musiqueTools,
                          r.browseCompTools,
                          r.fanoutqaTools,
                        ]).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-blue-900">
              Read the actual trajectories
            </h3>
            <p className="text-sm text-blue-800/90 max-w-2xl">
              Every run above is released in full — each reasoning step, each
              search, each retrieved document with its corpus id and gold label,
              and the judge&apos;s verdict, for all samples.
            </p>
          </div>
          <Link
            href="/traces"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition shrink-0"
          >
            Browse trajectories <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
