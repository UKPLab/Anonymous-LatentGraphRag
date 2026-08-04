/**
 * Client-side access to the trace payload in public/data.
 *
 * The payload is deliberately many small files rather than one bundle: a run's
 * sample list, a 100-sample shard and a 256th of the corpus are each their own
 * fetch, so opening one trajectory never pulls the whole dataset into memory.
 * Everything is static JSON, which is what lets this work on GitHub Pages and
 * on an anonymised mirror with no server.
 */

/** Set NEXT_PUBLIC_BASE_PATH when the site is served from a subdirectory. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const dataUrl = (p: string) => `${BASE_PATH}/data/${p}`;

export type TableKey = "table3" | "table15" | "table16";

export interface RunMeta {
  run_id: string;
  table: TableKey | string;
  label: string;
  dataset: string;
  reader: string;
  condition: string;
  n: number;
  expected: number;
  complete: boolean;
  official_corpus: boolean;
  acc: number | null;
  mean_tools: number | null;
  shards: number;
  acc_source: "inline" | "sidecar" | "loose" | "mixed" | "MISSING";
  judged_coverage: number;
  judge_passes: number | null;
  acc_spread: number | null;
  metric: "loose_list_recall" | "llm_judge";
  unjudged?: boolean;
}

/** One row of a run's sample list - enough to render the list without shards. */
export interface SampleSummary {
  qid: string;
  /** true / false / null when the sample was never judged */
  c: boolean | null;
  /** tool calls */
  t: number | null;
  /** truncated question */
  q: string;
  /** shard index holding the full record */
  s: number;
  /** FanOutQA loose list-recall */
  l?: number | null;
}

/** One search issued within a step. A step can issue several at once. */
export interface TrajectoryCall {
  q: string | null;
  ret: (string | null)[];
}

export interface TrajectoryStep {
  i: number | null;
  act: string | null;
  /** the assistant's own turn: reasoning plus the action it emitted */
  txt: string | null;
  /** the first search query of the step, when it issued one */
  q: string | null;
  /** every retrieved document id of the step; null entries could not be resolved */
  ret: (string | null)[];
  /** present only when the step issued more than one search, one entry each */
  calls?: TrajectoryCall[];
  /** a generation error recorded for this step */
  err?: string | null;
}

export interface TraceRecord {
  qid: string;
  q: string;
  gold_answer: string | null;
  answer: string | null;
  correct: boolean | null;
  loose: number | null;
  tools: number | null;
  judge: string | null;
  tok_in: number | null;
  tok_out: number | null;
  seed: (string | null)[];
  traj: TrajectoryStep[];
}

export interface CorpusDoc {
  /** title */
  t: string;
  /** date */
  d: string;
  /** the text as it was shown to the model (2,000 chars) */
  x: string;
  /**
   * Absent for corpus documents. "unmatched" is a retrieved item we could not
   * tie to a corpus document — either a verbalized relational memory, which has
   * no document to point at, or an excerpt we failed to match; we show it
   * verbatim rather than guess. "failed" is a fetch the agent itself lost.
   */
  kind?: "unmatched" | "failed";
}

export interface GoldLabels {
  /** gold document ids */
  g: string[];
  /** evidence document ids */
  e: string[];
}

export interface SeedSetMeta {
  dataset: string;
  method: string;
  n: number;
  n_with_seed: number;
  mean_seed_docs: number;
}

export interface SeedRecord {
  qid: string;
  q: string;
  gold_answer: string | null;
  seed: (string | null)[];
}

/* ------------------------------------------------------------------ fetching */

const cache = new Map<string, Promise<unknown>>();

function getJson<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T>;
  const p = fetch(dataUrl(path)).then((r) => {
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json() as Promise<T>;
  });
  cache.set(path, p);
  return p as Promise<T>;
}

export const loadRuns = () => getJson<RunMeta[]>("runs.json");
export const loadSeedSets = () => getJson<SeedSetMeta[]>("seeds.json");

export const loadSeedRecords = (dataset: string, method: string) =>
  getJson<SeedRecord[]>(`seeds/${dataset}/${method}.json`);

export const loadSampleIndex = (dataset: string, runId: string) =>
  getJson<SampleSummary[]>(`traces/${dataset}/${runId}/index.json`);

export const loadShard = (dataset: string, runId: string, shard: number) =>
  getJson<TraceRecord[]>(`traces/${dataset}/${runId}/s${shard}.json`);

export const loadGold = (dataset: string) =>
  getJson<Record<string, GoldLabels>>(`gold/${dataset}.json`).catch(
    () => ({} as Record<string, GoldLabels>),
  );

/**
 * Which corpus shard a document lives in. Must stay identical to bucket_of()
 * in the exporter: derived from the id alone so no lookup table is shipped.
 */
export function bucketOf(docid: string): string {
  const m = /(\d+)\s*$/.exec(docid);
  if (m) return String(Number(m[1]) % 256).padStart(3, "0");
  let acc = 2166136261;
  for (let i = 0; i < docid.length; i++) {
    acc = Math.imul(acc ^ docid.charCodeAt(i), 16777619) >>> 0;
  }
  return String(acc % 256).padStart(3, "0");
}

export const loadCorpusBucket = (dataset: string, bucket: string) =>
  getJson<Record<string, CorpusDoc>>(`corpus/${dataset}/b${bucket}.json`);

/** Fetch one document, pulling only the ~200 KB bucket that contains it. */
export async function loadDoc(
  dataset: string,
  docid: string,
): Promise<CorpusDoc | null> {
  try {
    const bucket = await loadCorpusBucket(dataset, bucketOf(docid));
    return bucket[docid] ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ helpers */

export const READER_LABELS: Record<string, string> = {
  qwen3_5_9b: "Qwen3.5-9B",
  qwen3_5_27b: "Qwen3.5-27B",
  qwen3_5_122b: "Qwen3.5-122B",
};

export const DATASET_LABELS: Record<string, string> = {
  musique: "MuSiQue",
  browsecomp: "BrowseComp+",
  fanoutqa: "FanOutQA",
};

export const readerLabel = (k: string) => READER_LABELS[k] ?? k;
export const datasetLabel = (k: string) => DATASET_LABELS[k] ?? k;

/** How a document relates to the question, for gold / evidence highlighting. */
export type DocRole = "gold" | "evidence" | "other";

export function docRole(
  docid: string | null,
  gold: GoldLabels | undefined,
): DocRole {
  if (!docid || !gold) return "other";
  if (gold.g?.includes(docid)) return "gold";
  if (gold.e?.includes(docid)) return "evidence";
  return "other";
}

/** Score of a run, formatted; "-" when the run was never scored. */
export function formatScore(r: RunMeta): string {
  if (r.acc === null || r.unjudged) return "–";
  return r.acc.toFixed(1);
}

export function formatTools(r: RunMeta): string {
  return r.mean_tools === null ? "–" : r.mean_tools.toFixed(2);
}
