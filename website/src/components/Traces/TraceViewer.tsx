"use client";

/**
 * The trajectory viewer.
 *
 * Left: pick a run, then a sample. Right: the full trajectory for that sample —
 * injected seed, every reasoning/observation step with what each search
 * returned, the final answer, and the judge's verdict.
 *
 * Nothing is bundled: the sample list is one fetch per run, the record one
 * fetch per 100-sample shard, and each document one fetch per corpus bucket.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Gavel,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  loadGold,
  loadRuns,
  loadSampleIndex,
  loadSeedRecords,
  loadSeedSets,
  loadShard,
  datasetLabel,
  docRole,
  readerLabel,
  type GoldLabels,
  type RunMeta,
  type SampleSummary,
  type SeedRecord,
  type SeedSetMeta,
  type TraceRecord,
} from "@/lib/traces";
import { TRACE_DATASETS, judgeVariability } from "@/data/paperResults";
import DocChip from "./DocChip";
import ViewSwitch from "./ViewSwitch";

const TABLE_LABEL: Record<string, string> = {
  table2: "Retrieve-then-read (Table 2)",
  table3: "ReAct loop (Table 3)",
  table15: "Cross-reader (Table 15)",
};

function Verdict({ rec }: { rec: TraceRecord }) {
  if (rec.loose !== null && rec.loose !== undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-800">
        loose list-recall {(rec.loose * 100).toFixed(0)}%
      </span>
    );
  }
  if (rec.correct === null) {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
        not judged
      </span>
    );
  }
  return rec.correct ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
      <Check className="w-3 h-3" /> judged correct
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800">
      <X className="w-3 h-3" /> judged incorrect
    </span>
  );
}

export default function TraceViewer() {
  const router = useRouter();
  const params = useSearchParams();
  const ds = params.get("ds") ?? "musique";
  const runId = params.get("run");
  const seedMethod = params.get("seeds");
  const qid = params.get("qid");

  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [seedSets, setSeedSets] = useState<SeedSetMeta[]>([]);
  const [index, setIndex] = useState<SampleSummary[] | null>(null);
  const [seedRecs, setSeedRecs] = useState<SeedRecord[] | null>(null);
  const [rec, setRec] = useState<TraceRecord | null>(null);
  const [gold, setGold] = useState<Record<string, GoldLabels>>({});
  const [filter, setFilter] = useState("");
  const [only, setOnly] = useState<"all" | "correct" | "wrong">("all");
  const [limit, setLimit] = useState(200);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadRuns().then(setRuns).catch(() => {});
    loadSeedSets().then(setSeedSets).catch(() => {});
  }, []);
  useEffect(() => {
    loadGold(ds).then(setGold);
  }, [ds]);

  const run = useMemo(
    () => runs.find((r) => r.run_id === runId && r.dataset === ds),
    [runs, runId, ds],
  );

  const PREFERRED = "qwen3_5_122b__latentgraph_dualtree_seed";

  // Arriving without a run (e.g. via the Trajectories tab) should land on a real
  // trajectory rather than an empty pane.
  useEffect(() => {
    if (runId || seedMethod || runs.length === 0) return;
    const forDs = runs.filter((r) => r.dataset === ds);
    if (forDs.length === 0) return;
    const pick =
      forDs.find((r) => r.run_id === PREFERRED) ??
      forDs.find((r) => r.table === "table3") ??
      forDs[0];
    setParamRef.current({ run: pick.run_id, qid: null });
  }, [runs, ds, runId, seedMethod]);

  // sample list for the selected run, or the released seed set
  useEffect(() => {
    setRec(null);
    setLimit(200);
    if (runId) {
      setSeedRecs(null);
      setIndex(null);
      loadSampleIndex(ds, runId).then(setIndex).catch(() => setIndex([]));
    } else if (seedMethod) {
      setIndex(null);
      loadSeedRecords(ds, seedMethod)
        .then(setSeedRecs)
        .catch(() => setSeedRecs([]));
    }
  }, [ds, runId, seedMethod]);

  const setParamRef = useRef<(p: Record<string, string | null>) => void>(
    () => {},
  );

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(patch).forEach(([k, v]) =>
        v === null ? next.delete(k) : next.set(k, v),
      );
      router.replace(`/traces/results/?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );
  setParamRef.current = setParam;

  // load the record for the selected sample
  useEffect(() => {
    if (!runId || !qid || !index) return;
    const row = index.find((r) => r.qid === qid);
    if (!row) return;
    setBusy(true);
    loadShard(ds, runId, row.s)
      .then((shard) => setRec(shard.find((x) => x.qid === qid) ?? null))
      .catch(() => setRec(null))
      .finally(() => setBusy(false));
  }, [ds, runId, qid, index]);

  // ...and the first sample of that run, so the trajectory pane is never blank
  useEffect(() => {
    if (qid || !index || index.length === 0) return;
    setParamRef.current({ qid: index[0].qid });
  }, [index, qid]);

  const filtered = useMemo(() => {
    const rows: SampleSummary[] =
      index ??
      (seedRecs ?? []).map((s) => ({
        qid: s.qid,
        c: null,
        t: null,
        q: s.q ?? "",
        s: 0,
      }));
    const f = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (f && !r.q.toLowerCase().includes(f) && !r.qid.includes(f))
        return false;
      if (only === "correct" && r.c !== true) return false;
      if (only === "wrong" && r.c !== false) return false;
      return true;
    });
  }, [index, seedRecs, filter, only]);

  const seedRec = useMemo(
    () => (seedRecs && qid ? seedRecs.find((s) => s.qid === qid) : undefined),
    [seedRecs, qid],
  );

  const runsByTable = useMemo(() => {
    const g: Record<string, RunMeta[]> = {};
    runs
      .filter((r) => r.dataset === ds)
      .forEach((r) => {
        (g[r.table] ??= []).push(r);
      });
    Object.values(g).forEach((l) => l.sort((a, b) => a.label.localeCompare(b.label)));
    return g;
  }, [runs, ds]);

  const goldFor = qid ? gold[qid] : undefined;

  return (
    <main className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/traces"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> All results
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-900 font-medium">
          {datasetLabel(ds)}
        </span>
        {run && (
          <>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-900">
              {readerLabel(run.reader)} · {run.label}
            </span>
          </>
        )}
        {seedMethod && (
          <>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-900">
              released seed set · {seedMethod}
            </span>
          </>
        )}
      </div>

      {/* dataset stays the outer choice and carries over from the overview */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TRACE_DATASETS.map((d) => (
          <button
            key={d.key}
            onClick={() =>
              setParam({ ds: d.key, run: null, seeds: null, qid: null })
            }
            className={`px-3 py-1.5 rounded-md text-sm border transition ${
              ds === d.key
                ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <ViewSwitch view="traces" dataset={ds} />
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-6">
        {/* ------------------------------------------------------- left rail */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Run
            </div>
            <div className="max-h-[22rem] overflow-y-auto p-2 space-y-3">
              {Object.entries(runsByTable).map(([table, list]) => (
                <div key={table}>
                  <div className="px-1 pb-1 text-[11px] font-semibold text-gray-400">
                    {TABLE_LABEL[table] ?? table}
                  </div>
                  <div className="space-y-0.5">
                    {list.map((r) => (
                      <button
                        key={r.run_id}
                        onClick={() =>
                          setParam({ run: r.run_id, seeds: null, qid: null })
                        }
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
                          r.run_id === runId
                            ? "bg-blue-50 text-blue-800 font-semibold"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <div className="truncate">{r.label}</div>
                        <div className="text-[10px] text-gray-400">
                          {readerLabel(r.reader)} · {r.n} samples
                          {r.unjudged && " · unscored"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {seedSets.filter((s) => s.dataset === ds && s.n_with_seed > 0)
                .length > 0 && (
                <div>
                  <div className="px-1 pb-1 text-[11px] font-semibold text-gray-400">
                    Released seed sets (Table 2)
                  </div>
                  <div className="space-y-0.5">
                    {seedSets
                      .filter((s) => s.dataset === ds && s.n_with_seed > 0)
                      .map((s) => (
                        <button
                          key={s.method}
                          onClick={() =>
                            setParam({ seeds: s.method, run: null, qid: null })
                          }
                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
                            s.method === seedMethod
                              ? "bg-blue-50 text-blue-800 font-semibold"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <div className="truncate">{s.method}</div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {(index || seedRecs) && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Samples
                </span>
                <span className="text-[11px] text-gray-400">
                  {filtered.length} of {(index ?? seedRecs ?? []).length}
                </span>
              </div>
              <div className="p-2 space-y-2 border-b border-gray-100">
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by question or id…"
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {index && (
                  <div className="flex gap-1">
                    {(["all", "correct", "wrong"] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => setOnly(k)}
                        className={`px-2 py-1 text-[11px] rounded border transition ${
                          only === k
                            ? "border-blue-400 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="max-h-[32rem] overflow-y-auto">
                {filtered.slice(0, limit).map((r) => (
                  <button
                    key={r.qid}
                    onClick={() => setParam({ qid: r.qid })}
                    className={`w-full text-left px-3 py-2 border-b border-gray-50 last:border-0 transition ${
                      r.qid === qid ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {r.c === true && (
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                      )}
                      {r.c === false && (
                        <X className="w-3 h-3 text-rose-500 shrink-0" />
                      )}
                      <code className="text-[10px] text-gray-400 shrink-0">
                        {r.qid}
                      </code>
                      {r.t !== null && r.t !== undefined && (
                        <span className="ml-auto text-[10px] text-gray-400 shrink-0">
                          {r.t} tools
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-700 line-clamp-2 mt-0.5">
                      {r.q}
                    </div>
                  </button>
                ))}
                {filtered.length > limit && (
                  <button
                    onClick={() => setLimit((l) => l + 400)}
                    className="w-full py-2 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    Show {Math.min(400, filtered.length - limit)} more
                  </button>
                )}
                {filtered.length === 0 && (
                  <p className="px-3 py-4 text-xs text-gray-400">
                    No samples match.
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* ----------------------------------------------------- trajectory */}
        <section>
          {run && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400">
                  Run accuracy
                </div>
                <div className="font-semibold text-gray-900">
                  {run.acc === null ? "–" : `${run.acc.toFixed(1)}%`}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {run.metric === "loose_list_recall"
                      ? "loose list-recall"
                      : "LLM-judged"}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400">
                  Mean tool calls
                </div>
                <div className="font-semibold text-gray-900">
                  {run.mean_tools === null ? "–" : run.mean_tools.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400">
                  Samples
                </div>
                <div className="font-semibold text-gray-900">{run.n}</div>
              </div>
              {run.judge_passes && run.judge_passes > 1 && (
                <div className="text-xs text-gray-500 self-end">
                  This run was judged {run.judge_passes}× (spread{" "}
                  {run.acc_spread}pt). The per-sample verdicts below come from
                  one pass; the paper reports the {judgeVariability.passes}-pass
                  mean.
                </div>
              )}
            </div>
          )}

          {!qid && (
            <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Pick a run and a sample to see its trajectory.
            </div>
          )}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading trajectory…
            </div>
          )}

          {/* released seed set: seed only, no trajectory exists */}
          {seedRec && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                  Question
                </div>
                <p className="text-gray-900">{seedRec.q}</p>
                {seedRec.gold_answer && (
                  <p className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Gold answer:</span>{" "}
                    {seedRec.gold_answer}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Retrieval seed — top {seedRec.seed.length}
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  This is the entire released record for a retrieve-then-read
                  row: the ranked documents handed to the reader. The generated
                  answers were not retained in these runs.
                </p>
                <div className="space-y-1.5">
                  {seedRec.seed.map((did, i) => (
                    <DocChip
                      key={`${did}-${i}`}
                      dataset={ds}
                      docid={did}
                      rank={i + 1}
                      role={docRole(did, goldFor)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {rec && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                      Question
                    </div>
                    <p className="text-gray-900">{rec.q}</p>
                  </div>
                  <Verdict rec={rec} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                  {rec.gold_answer && (
                    <span>
                      <span className="font-medium text-gray-700">Gold:</span>{" "}
                      {rec.gold_answer}
                    </span>
                  )}
                  {rec.tools !== null && <span>{rec.tools} tool calls</span>}
                  {rec.tok_in !== null && (
                    <span>
                      {rec.tok_in?.toLocaleString()} in /{" "}
                      {rec.tok_out?.toLocaleString()} out tokens
                    </span>
                  )}
                </div>
              </div>

              {rec.seed.length > 0 && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    Injected seed — top {rec.seed.length}
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Placed in the first user turn before the agent acts. It does
                    not count as a tool call.
                  </p>
                  <div className="space-y-1.5">
                    {rec.seed.map((did, i) => (
                      <DocChip
                        key={`${did}-${i}`}
                        dataset={ds}
                        docid={did}
                        rank={i + 1}
                        role={docRole(did, goldFor)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {rec.traj.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Agent trajectory — {rec.traj.length}{" "}
                    {rec.traj.length === 1 ? "step" : "steps"}
                  </h3>
                  {rec.traj.map((st, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-gray-200 overflow-hidden"
                    >
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">
                          step {st.i ?? i}
                        </span>
                        {st.act && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            {st.act}
                          </span>
                        )}
                      </div>

                      {st.txt && (
                        <div className="px-4 py-3">
                          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                            Reasoning / action
                          </div>
                          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-700">
                            {st.txt}
                          </pre>
                        </div>
                      )}

                      {(st.calls ?? (st.q || st.ret.length ? [{ q: st.q, ret: st.ret }] : [])).map(
                        (c, ci) => (
                          <div key={ci}>
                            {c.q && (
                              <div className="px-4 py-2 bg-blue-50/40 border-t border-blue-100 flex items-start gap-2">
                                <Search className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-blue-700">
                                    Search query
                                    {st.calls && st.calls.length > 1
                                      ? ` ${ci + 1} of ${st.calls.length}`
                                      : ""}
                                  </div>
                                  <p className="text-xs text-blue-900 font-mono">
                                    {c.q}
                                  </p>
                                </div>
                              </div>
                            )}

                            {c.ret.length > 0 && (
                              <div className="px-4 py-3 border-t border-gray-100">
                                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                                  Observation — top {c.ret.length} returned
                                </div>
                                <div className="space-y-1.5">
                                  {c.ret.map((did, k) => (
                                    <DocChip
                                      key={`${did}-${k}`}
                                      dataset={ds}
                                      docid={did}
                                      rank={k + 1}
                                      role={docRole(did, goldFor)}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                      )}

                      {st.err && (
                        <div className="px-4 py-2 border-t border-rose-100 bg-rose-50/60 text-xs text-rose-800 font-mono">
                          {st.err}
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
                <div className="text-[11px] uppercase tracking-wide text-emerald-700 mb-1">
                  Final answer
                </div>
                <p className="text-emerald-950 whitespace-pre-wrap break-words">
                  {rec.answer || (
                    <span className="italic text-emerald-800/60">
                      the model produced no answer
                    </span>
                  )}
                </p>
              </div>

              <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-4">
                <div className="text-[11px] uppercase tracking-wide text-violet-700 mb-1 flex items-center gap-1.5">
                  <Gavel className="w-3.5 h-3.5" />
                  Judge
                </div>
                {rec.loose !== null && rec.loose !== undefined ? (
                  <p className="text-violet-950 text-sm">
                    Scored by loose list-recall, not by a model:{" "}
                    <strong>{(rec.loose * 100).toFixed(1)}%</strong> of the gold
                    list recovered.
                  </p>
                ) : rec.correct === null ? (
                  <p className="text-violet-950/70 text-sm italic">
                    This run was never judged, so no verdict is available. It is
                    not counted as incorrect.
                  </p>
                ) : (
                  <p className="text-violet-950 text-sm">
                    Qwen3.5-27B judged this answer{" "}
                    <strong>{rec.correct ? "correct" : "incorrect"}</strong>
                    {rec.judge ? ` — “${rec.judge}”` : ""}.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
