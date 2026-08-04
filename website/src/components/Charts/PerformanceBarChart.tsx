"use client";

import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { musiqueR5Data, browseCompR5Data, fanoutqaR5Data } from "@/data/performanceData";
import type { BarChartEntry } from "@/data/performanceData";

function getBarColor(entry: BarChartEntry): string {
  if (entry.highlight) return "#3b82f6";
  if (entry.category === "ours") return "#60a5fa";
  if (entry.category === "graph-enhanced") return "#a78bfa";
  return "#94a3b8";
}

interface SingleBarChartProps {
  title: string;
  subtitle: string;
  data: BarChartEntry[];
  yMax: number;
  height?: number;
  compact?: boolean;
}

function SingleBarChart({ title, subtitle, data, yMax, height = 350, compact = false }: SingleBarChartProps) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 ${compact ? "p-3" : "p-4 md:p-5"}`}>
      <div className={compact ? "mb-2" : "mb-3"}>
        <h3 className={`font-bold text-gray-900 ${compact ? "text-sm" : "text-base md:text-lg"}`}>{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 25, right: 10, left: -10, bottom: compact ? 50 : 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="displayName"
              tick={{ fontSize: compact ? 9 : 10, fill: "#4b5563", dy: 26 }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={{ stroke: "#e5e7eb" }}
              angle={-45}
              textAnchor="end"
              interval={0}
              height={compact ? 80 : 110}
            />
            <YAxis
              domain={[0, yMax]}
              tick={{ fontSize: 10, fill: "#6b7280" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={{ stroke: "#e5e7eb" }}
              tickFormatter={(value) => `${value}`}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.98)",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                fontSize: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
              formatter={(value) => {
                const num = Number(value);
                if (value == null || num === 0) return ["N/A", "R@5"];
                return [`${num.toFixed(2)}`, "R@5"];
              }}
              labelFormatter={(label) => label}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={1200}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={getBarColor(entry)} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(value) => {
                  const num = Number(value);
                  if (value == null || num === 0) return "—";
                  return num.toFixed(1);
                }}
                style={{ fontSize: compact ? 9 : 9, fill: "#6b7280", fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — only for MuSiQue (full chart) */}
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#94a3b8" }} />
            <span>Non-structure</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#a78bfa" }} />
            <span>Graph-enhanced</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#3b82f6" }} />
            <span>Ours</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PerformanceBarChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="max-w-7xl mx-auto"
    >
      {/* Intro: results-first framing */}
      <div className="text-center mb-8">
        <p className="text-gray-700 max-w-3xl mx-auto text-base md:text-lg leading-relaxed">
          <span className="font-semibold text-blue-600">LatentGraphRAG</span> achieves a
          new state of the art across three multi-hop retrieval regimes:{" "}
          <strong>MuSiQue</strong> (depth-oriented Wikipedia QA),{" "}
          <strong>BrowseComp+</strong> (noisy web-scale, 100K+ docs), and{" "}
          <strong>FanOutQA</strong> (width-oriented multi-document QA). We demonstrate
          that dense retrieval over verbalized relational memories consistently
          outperforms explicit graph traversal, and that fusing document and memory
          views via document–memory agreement yields complementary signals.
        </p>
        <p className="text-gray-600 max-w-3xl mx-auto text-sm mt-3">
          Recall@5 across three benchmarks. Scroll down to see how the method works
          and why each component contributes.
        </p>
      </div>

      {/* MuSiQue (2/3) + BrowseComp & FanOutQA stacked (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MuSiQue — 2/3 width */}
        <div className="lg:col-span-2">
          <SingleBarChart
            title="MuSiQue"
            subtitle="Recall@5 · Depth-Oriented Wikipedia QA"
            data={musiqueR5Data}
            yMax={90}
            height={400}
          />
        </div>

        {/* Right column: BrowseComp+ and FanOutQA stacked */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <SingleBarChart
            title="BrowseComp+"
            subtitle="Recall@5 · Web-Scale Retrieval"
            data={browseCompR5Data}
            yMax={25}
            height={200}
            compact
          />
          <SingleBarChart
            title="FanOutQA"
            subtitle="Recall@5 · Width-Oriented Multi-Doc QA"
            data={fanoutqaR5Data}
            yMax={35}
            height={220}
            compact
          />
        </div>
      </div>
    </motion.div>
  );
}
