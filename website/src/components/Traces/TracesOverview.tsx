"use client";

/**
 * Overview of the released agent runs. Every number shown is the paper's
 * (lgrPaper.ts, the submitted version); the trace payload is only consulted to decide
 * which cells open trajectories. Runs are matched to table rows by the paper's own
 * row label, which the exporter writes into the manifest.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText, Info } from "lucide-react";
import { table4ReadOnly, table5React, frozenConfig, type Cell } from "@/data/lgrPaper";
import { loadRuns, type DatasetKey, type RunMeta } from "@/lib/traces";
import ViewSwitch from "./ViewSwitch";

const CARD = "rounded-xl border border-gray-200 bg-white overflow-hidden";
const TH =
  "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500";
const TD = "px-3 py-2 text-sm text-gray-800 whitespace-nowrap";

/** Column groups as printed; BrowseComp+ has numbers but no released traces. */
const BENCH: { dataset: DatasetKey | null; label: string }[] = [
  { dataset: "musique", label: "MuSiQue" },
  { dataset: "fanoutqa", label: "FanOutQA" },
  { dataset: null, label: "BC+ (pool)" },
];

function CellText({ cell }: { cell: Cell }) {
  return (
    <span
      className={`${cell.best ? "font-semibold" : ""} ${cell.second ? "underline" : ""} ${
        cell.sig ? "text-emerald-700" : ""
      }`}
    >
      {cell.value}
      {cell.dagger && <sup>†</sup>}
      {cell.star && <sup>∗</sup>}
    </span>
  );
}

function TraceCell({
  run,
  cell,
}: {
  run: RunMeta | undefined;
  cell: Cell;
}) {
  if (!run) return <CellText cell={cell} />;
  return (
    <Link
      href={`/traces/results/?ds=${run.dataset}&run=${run.run_id}`}
      className="group inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 hover:underline"
      title="Open the trajectories behind this cell"
    >
      <CellText cell={cell} />
      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
    </Link>
  );
}

export default function TracesOverview() {
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadRuns().then(setRuns).catch((e) => setErr(String(e)));
  }, []);

  const find = useMemo(
    () => (table: string, dataset: DatasetKey | null, label: string) =>
      dataset
        ? runs.find((r) => r.table === table && r.dataset === dataset && r.label === label)
        : undefined,
    [runs],
  );

  const stats = useMemo(
    () => ({ runs: runs.length, samples: runs.reduce((a, r) => a + r.n, 0) }),
    [runs],
  );

  return (
    <main className="max-w-screen-xl mx-auto px-4 lg:px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Agent trajectories</h1>
        <p className="mt-3 text-gray-600 max-w-3xl">
          The runs behind the paper&apos;s reader and agent tables, at full sample
          count. Click a MuSiQue or FanOutQA cell to open its trajectories: the
          evidence the reader or agent started from, every reasoning step and
          search with what came back, the final answer and its grade.
        </p>
        {stats.runs > 0 && (
          <p className="mt-3 text-sm text-gray-500">
            {stats.runs} runs · {stats.samples.toLocaleString()} trajectories ·
            MuSiQue and FanOutQA
          </p>
        )}
        {err && (
          <p className="mt-3 text-sm text-red-600">
            Could not load the trace index ({err}). The payload lives in
            <code className="mx-1">public/data</code>; run the site from the
            repository root so it is served.
          </p>
        )}
      </header>

      {/* BrowseComp+ asks that its data never appear as plain text online, so its
          traces are withheld here. */}
      <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-900">
          <span className="font-semibold">BrowseComp+ traces are withheld.</span>{" "}
          Its authors ask that the benchmark never appear as plain text online, so
          we do not publish its corpus, questions or trajectories. MuSiQue and
          FanOutQA carry no such request and are shown in full. A gated release for
          BrowseComp+ is in preparation.
        </p>
      </div>

      <div className="mb-6">
        <ViewSwitch view="results" dataset="musique" />
      </div>

      <p className="mb-8 text-xs text-gray-500 flex items-start gap-2 max-w-3xl">
        <Info className="w-4 h-4 mt-px shrink-0" />
        <span>
          Reader and agent: {frozenConfig.controller}. MuSiQue and BrowseComp+
          answers are graded by the official BrowseComp grader on the final answer
          (same model, temperature 0); FanOutQA by loose list recall on the answer
          text. All table values are the paper&apos;s.
        </span>
      </p>

      {/* ------------------------------------------------ Table 5: shared ReAct agent */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Shared ReAct agent — Table 5
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          Controller, prompt, {frozenConfig.agentSearchTool} search tool and budget
          are shared; only the top-ten seed varies. Srch is searches per question
          after seeding. The table reports means over repeated runs; each linked
          cell opens one of those runs.
        </p>
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={TH} rowSpan={2}>
                    Seed
                  </th>
                  {table5React.columns.map((col) => (
                    <th key={col.benchmark} className={`${TH} text-center`} colSpan={2}>
                      {col.benchmark}
                    </th>
                  ))}
                </tr>
                <tr>
                  {table5React.columns.flatMap((col) =>
                    col.metrics.map((m) => (
                      <th key={`${col.benchmark}-${m}`} className={TH}>
                        {m}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {table5React.rows.map((row) => (
                  <tr
                    key={row.seed}
                    className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30"
                  >
                    <td className={`${TD} ${row.kind === "lgr" ? "font-semibold" : ""}`}>
                      {row.seed}
                    </td>
                    {BENCH.map((b, bi) => {
                      const run = find("table5", b.dataset, row.seed);
                      return [
                        <td key={`${bi}a`} className={TD}>
                          <TraceCell run={run} cell={row.cells[2 * bi]} />
                        </td>,
                        <td key={`${bi}s`} className={TD}>
                          <CellText cell={row.cells[2 * bi + 1]} />
                        </td>,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- Table 4: read-only answers */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Read-only answers — Table 4
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          The reader answers from each method&apos;s top-ten evidence alone and
          cannot search. Δ is the LatentGraphRAG row minus each row.
        </p>
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={TH} rowSpan={2}>
                    Evidence
                  </th>
                  {table4ReadOnly.columns.map((col) => (
                    <th key={col.benchmark} className={`${TH} text-center`} colSpan={2}>
                      {col.benchmark}
                    </th>
                  ))}
                </tr>
                <tr>
                  {table4ReadOnly.columns.flatMap((col) =>
                    col.metrics.map((m) => (
                      <th key={`${col.benchmark}-${m}`} className={TH}>
                        {m}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {table4ReadOnly.rows.map((row) => (
                  <tr
                    key={row.evidence}
                    className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30"
                  >
                    <td className={`${TD} ${row.kind === "lgr" ? "font-semibold" : ""}`}>
                      {row.evidence}
                    </td>
                    {BENCH.map((b, bi) => {
                      const run = find("table4_read", b.dataset, row.evidence);
                      return [
                        <td key={`${bi}a`} className={TD}>
                          <TraceCell run={run} cell={row.cells[2 * bi]} />
                        </td>,
                        <td key={`${bi}d`} className={TD}>
                          <CellText cell={row.cells[2 * bi + 1]} />
                        </td>,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <h3 className="mt-6 text-sm font-semibold text-gray-900 mb-1">
          {table4ReadOnly.reactMinusReadOnly.title}
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          The same top-ten evidence given to the standard ReAct agent, which may
          search. Each cell opens the agent&apos;s trajectories.
        </p>
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={TH}>Evidence</th>
                  {BENCH.map((b) => (
                    <th key={b.label} className={TH}>
                      {b.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table4ReadOnly.reactMinusReadOnly.rows.map((row) => {
                  const cells = [row.musique, row.fanoutqa, row.browsecomp];
                  return (
                    <tr
                      key={row.evidence}
                      className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30"
                    >
                      <td className={TD}>{row.evidence}</td>
                      {BENCH.map((b, bi) => (
                        <td key={b.label} className={TD}>
                          <TraceCell
                            run={find("table4_react", b.dataset, row.evidence)}
                            cell={cells[bi]}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          What is in the payload
        </h3>
        <ul className="space-y-1 list-disc pl-5">
          <li>
            Each trajectory keeps the full record: the starting evidence, every
            turn the model produced, every search with the five documents it
            returned, the final answer and its grade.
          </li>
          <li>
            Documents are stored once and referenced by corpus id, so a document
            that appears in many trajectories is downloaded once.
          </li>
          <li>
            Documents are marked{" "}
            <span className="text-amber-700 font-medium">gold</span> or{" "}
            <span className="text-sky-700 font-medium">evidence</span>; everything
            else is a distractor. FanOutQA uses the benchmark&apos;s official
            qrels; MuSiQue has no qrels, so its gold documents are the supporting
            paragraphs of each question and it has no separate evidence tier.
          </li>
        </ul>
      </section>
    </main>
  );
}
