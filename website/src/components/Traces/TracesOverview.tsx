"use client";

/**
 * Overview of every released run. The aggregate numbers here are the paper's
 * (paperResults.ts); the per-run trace payload is only consulted to decide
 * whether a row is clickable and how many samples it has.
 */

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowRight, Database, FileText, Info } from "lucide-react";
import {
  reactLoop,
  retrieveThenRead,
  judgeVariability,
  TRACE_DATASETS,
  type DatasetKey,
} from "@/data/paperResults";
import {
  loadRuns,
  loadSeedSets,
  datasetLabel,
  type RunMeta,
  type SeedSetMeta,
} from "@/lib/traces";
import ViewSwitch from "./ViewSwitch";

const CARD = "rounded-xl border border-gray-200 bg-white overflow-hidden";
const TH =
  "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500";
const TD = "px-3 py-2 text-sm text-gray-800 whitespace-nowrap";

function num(v: number | null | undefined, digits = 1) {
  return v === null || v === undefined ? "–" : v.toFixed(digits);
}

function TraceLink({
  runs,
  dataset,
  runId,
  children,
}: {
  runs: RunMeta[];
  dataset: DatasetKey;
  runId?: string;
  children: React.ReactNode;
}) {
  const run = runId
    ? runs.find((r) => r.run_id === runId && r.dataset === dataset)
    : undefined;
  if (!run) return <span className="text-gray-400">{children}</span>;
  return (
    <Link
      href={`/traces/results/?ds=${dataset}&run=${runId}`}
      className="group inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 hover:underline"
      title="Open the trajectories for this run"
    >
      {children}
      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
    </Link>
  );
}

export default function TracesOverview() {
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [seedSets, setSeedSets] = useState<SeedSetMeta[]>([]);
  const [err, setErr] = useState<string | null>(null);
  // MuSiQue first: it is the depth benchmark the method was designed for
  const [ds, setDs] = useState<DatasetKey>("musique");

  useEffect(() => {
    loadRuns().then(setRuns).catch((e) => setErr(String(e)));
    loadSeedSets().then(setSeedSets).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const samples = runs.reduce((a, r) => a + r.n, 0);
    return { runs: runs.length, samples };
  }, [runs]);

  return (
    <main className="max-w-screen-xl mx-auto px-4 lg:px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Evaluation trajectories
        </h1>
        <p className="mt-3 text-gray-600 max-w-3xl">
          Every run behind the paper, at full sample count — not a sample of
          them. Click any method name to open its trajectories: the injected
          seed with its ranked documents, each reasoning and observation step,
          every search the agent issued with what came back, the final answer
          and the judge&apos;s verdict.
        </p>
        {stats.runs > 0 && (
          <p className="mt-3 text-sm text-gray-500">
            {stats.runs} runs · {stats.samples.toLocaleString()} trajectories ·
            all three benchmarks
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

      {/* dataset selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TRACE_DATASETS.map((d) => (
          <button
            key={d.key}
            onClick={() => setDs(d.key)}
            className={`px-3 py-1.5 rounded-md text-sm border transition ${
              ds === d.key
                ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {d.label}
            <span className="ml-2 text-xs text-gray-400">{d.n}</span>
          </button>
        ))}
      </div>

      {/* Results / Trajectories. Sits under the dataset chips so the dataset stays
          the outer choice and carries over into the viewer. */}
      <div className="mb-6">
        <ViewSwitch view="results" dataset={ds} />
      </div>

      <p className="mb-8 text-xs text-gray-500 flex items-start gap-2 max-w-3xl">
        <Info className="w-4 h-4 mt-px shrink-0" />
        <span>
          Accuracy is LLM-judged for MuSiQue and BrowseComp+ and loose
          list-recall for FanOutQA. The table values are the paper&apos;s, whose
          BrowseComp+ cells are means over {judgeVariability.passes} judge
          passes; the per-sample verdicts in the viewer come from a single pass,
          so their share can differ by up to {judgeVariability.maxSpread} points.
          Differences below one point are within judge variability.
        </span>
      </p>

      {/* ------------------------------------------------ Table 3: ReAct loop */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          ReAct loop — reader Qwen3.5-122B
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          Paper Table 3. The injected seed is excluded from the tool count.
        </p>
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={TH}>Configuration</th>
                  <th className={TH}>Accuracy</th>
                  <th className={TH}>Tool calls</th>
                </tr>
              </thead>
              <tbody>
                {(["ours", "benchmark"] as const).map((block) => (
                  <Fragment key={block}>
                    <tr className="bg-gray-50/60">
                      <td
                        className="px-3 py-1.5 text-xs italic text-gray-500"
                        colSpan={3}
                      >
                        {block === "ours"
                          ? "Our retrieval-first ReAct loop"
                          : "BrowseComp+ ReAct agent (original prompt, no seed)"}
                      </td>
                    </tr>
                    {reactLoop
                      .filter((r) => r.block === block)
                      .map((r) => {
                        const acc =
                          ds === "musique"
                            ? r.musiqueAcc
                            : ds === "browsecomp"
                              ? r.browseCompAcc
                              : r.fanoutqaAcc;
                        const tools =
                          ds === "musique"
                            ? r.musiqueTools
                            : ds === "browsecomp"
                              ? r.browseCompTools
                              : r.fanoutqaTools;
                        return (
                          <tr
                            key={r.config}
                            className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30"
                          >
                            <td className={TD}>
                              <TraceLink runs={runs} dataset={ds} runId={r.runId}>
                                <span
                                  className={r.isBest ? "font-semibold" : ""}
                                >
                                  {r.config}
                                </span>
                              </TraceLink>
                              {r.note && (
                                <span className="ml-2 text-xs text-gray-400">
                                  {r.note}
                                </span>
                              )}
                            </td>
                            <td
                              className={`${TD} ${r.isBest ? "font-semibold" : ""}`}
                            >
                              {num(acc)}
                            </td>
                            <td className={TD}>{num(tools, 2)}</td>
                          </tr>
                        );
                      })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>


      {/* ------------------------------------- Table 2: retrieve-then-read */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Retrieve-then-read — released seeds
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          Paper Table 2. These runs are a single reader call over a fixed
          ranking, so there is no trajectory to show and the result files did not
          retain the generated answers. What we release instead is the{" "}
          <strong>seed itself</strong>: the ranked evidence each row was given,
          per question, which is also what is needed to reproduce the numbers.
        </p>
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={TH}>Retrieval seed</th>
                  <th className={TH}>MuSiQue</th>
                  <th className={TH}>BrowseComp+</th>
                  <th className={TH}>FanOutQA</th>
                </tr>
              </thead>
              <tbody>
                {retrieveThenRead.map((r) => {
                  const set = seedSets.find(
                    (s) => s.dataset === ds && s.method === r.seedMethod,
                  );
                  return (
                    <tr
                      key={r.seed}
                      className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30"
                    >
                      <td className={`${TD} ${r.isBest ? "font-semibold" : ""}`}>
                        {set && set.n_with_seed > 0 ? (
                          <Link
                            href={`/traces/results/?ds=${ds}&seeds=${r.seedMethod}`}
                            className="text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1"
                          >
                            <Database className="w-3 h-3" />
                            {r.seed}
                          </Link>
                        ) : (
                          r.seed
                        )}
                      </td>
                      <td className={`${TD} ${r.isBest ? "font-semibold" : ""}`}>
                        {num(r.musique)}
                      </td>
                      <td className={`${TD} ${r.isBest ? "font-semibold" : ""}`}>
                        {num(r.browseComp)}
                      </td>
                      <td className={`${TD} ${r.isBest ? "font-semibold" : ""}`}>
                        {num(r.fanoutqa)}
                      </td>
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
            Documents are stored once and referenced by corpus id, so a
            document that appears in many trajectories is downloaded once.
          </li>
          <li>
            Retrieved documents are marked{" "}
            <span className="text-amber-700 font-medium">gold</span> or{" "}
            <span className="text-sky-700 font-medium">evidence</span>;
            everything else is a distractor. BrowseComp+ and FanOutQA use the
            benchmarks&apos; official qrels; MuSiQue has no qrels, so its gold
            documents come from the supporting-paragraph annotations and it has
            no separate evidence tier.
          </li>
          <li>
            Every released run is scored. Where a score is genuinely unavailable
            the table shows <strong>–</strong> rather than a number, and those
            samples carry no verdict instead of being counted as wrong.
          </li>
        </ul>
      </section>
    </main>
  );
}
