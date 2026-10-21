"""Export the trajectories behind the paper's agent tables into the static-site payload.

Which runs are exported is fixed below (RUNS), one run per table cell: the read-only
rows of Table 4, the matched ReAct rows of its lower block, and one of the repeated
runs that Table 5 averages. BrowseComp+ is never exported: its authors ask that the
benchmark not appear as plain text online.

Scores are computed exactly as the paper computes them:
  MuSiQue   BrowseComp grader verdict on the final answer (rejudge_bcgrader_final/,
            position-matched to the run file, query ids checked)
  FanOutQA  loose list recall on the answer text (field loose_final)
  searches  in-loop tool calls; the seed is not a call

Layout produced under OUT:
  runs.json                          manifest + per-run metrics
  traces/<ds>/<run>/index.json       per-sample summary (cheap list view)
  traces/<ds>/<run>/s<k>.json        full traces, SHARD samples each
  corpus/<ds>/b<XXX>.json            docid -> {t,d,x}, 256 buckets, referenced docs only
  gold/<ds>.json                     qid -> {g:[gold ids], e:[evidence ids]}

Environment:
  LGR_TRACES_ROOT    run files as copied from the evaluation suite: results_*/,
                     rejudge_bcgrader_final/results_*/ and search_index/<ds>/docs.json
  LGR_MUSIQUE_QA     MuSiQue questions with paragraph annotations (HippoRAG 2 release,
                     reproduce/dataset/musique.json); gold = supporting paragraphs
  LGR_FANOUTQA_GOLD  FanOutQA gold built from the benchmark's qrels ({qid: {g, e}})
  LGR_EXPORT_OUT     output directory (default: website/public/data)
"""
import collections
import hashlib
import json
import os
import re

ROOT = os.environ['LGR_TRACES_ROOT']
OUT = os.environ.get('LGR_EXPORT_OUT', 'website/public/data')
MUSIQUE_QA = os.environ.get('LGR_MUSIQUE_QA')
FANOUTQA_GOLD = os.environ.get('LGR_FANOUTQA_GOLD')
SHARD = 100
TRUNC = 2200            # seeds were shown at 2,200 characters, search results at 2,000
EXPECT = {'musique': 1000, 'fanoutqa': 310}
READER = 'qwen3_5_122b'

REACT = 'results_run2_rdr_force_mt8192_ctx64kfx_std_'
READ = 'results_run2_rdr_readonly_v2_mt8192_ctx64kfx'

# (table, dataset, run directory, condition, label as printed in the paper)
T5 = [('no_seed', 'No seed'), ('hipporag_seed', 'HippoRAG 2'), ('greasoner_seed', 'G-Reasoner'),
      ('hgrag_seed', 'HGRAG'), ('proprag_seed', 'PropRAG'), ('rdr_doc_seed', 'LGR (doc. only)')]
T4 = [('no_seed', 'No evidence'), ('qwen_seed', 'Qwen3-Embedding-8B'), ('hipporag_seed', 'HippoRAG 2'),
      ('greasoner_seed', 'G-Reasoner'), ('hgrag_seed', 'HGRAG'), ('proprag_seed', 'PropRAG'),
      ('rdr_doc_seed', 'LGR (doc. only)')]
LGR = 'LGR (doc. + tri. + prop.)'
RUNS = (
    [('table5', 'musique', REACT + 'p3R_m10', c, l) for c, l in T5]
    + [('table5', 'musique', REACT + 'p3R_m10', 'rdr_lgrp3d1_seed', LGR)]
    + [('table5', 'fanoutqa', REACT + 'p3S_m10', c, l) for c, l in T5]
    + [('table5', 'fanoutqa', REACT + 'p3S_m10', 'rdr_lgrp3_seed', LGR)]
    + [('table4_read', 'musique', READ + '_srvQ2', c, l) for c, l in T4]
    + [('table4_read', 'musique', READ + '_srvQ2', 'rdr_lgrd1_seed', LGR)]
    + [('table4_read', 'fanoutqa', READ, c, l) for c, l in T4]
    + [('table4_read', 'fanoutqa', READ, 'rdr_lgr_seed', LGR)]
    + [('table4_react', 'musique', REACT + 'srvQ2_m10', 'rdr_doc_seed', 'LGR (doc. only)'),
       ('table4_react', 'musique', REACT + 'srvQ2_m10', 'rdr_lgrd1_seed', LGR),
       ('table4_react', 'fanoutqa', REACT + 'm10', 'rdr_doc_seed', 'LGR (doc. only)'),
       ('table4_react', 'fanoutqa', REACT + 'm10', 'rdr_lgr_seed', LGR)]
)
SHORT = {'table5': 't5', 'table4_read': 't4read', 'table4_react': 't4react'}


def log(*a):
    print(*a, flush=True)


def jl(fp):
    with open(fp) as f:
        return [json.loads(line) for line in f if line.strip()]


def h(s):
    return hashlib.md5(s.encode('utf-8', 'ignore')).hexdigest()


def norm(s):
    """Whitespace/case-insensitive form, so re-wrapped or truncated copies of a
    passage still resolve to the same corpus document."""
    return ' '.join(s.split()).lower()


DIGITS = re.compile(r'(\d+)\s*$')


def bucket_of(docid):
    """Corpus shard of a document. Computable from the id alone (the browser does the
    same in lib/traces.ts bucketOf), so no lookup table is shipped."""
    m = DIGITS.search(docid)
    if m:
        return f'{int(m.group(1)) % 256:03d}'
    acc = 2166136261
    for ch in docid:
        acc = ((acc ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return f'{acc % 256:03d}'


class Corpus:
    """The agent's search corpus: positional ids, plus text lookups for seed documents,
    which are stored as rendered text rather than ids."""

    def __init__(self, ds):
        self.ds = ds
        self.docs = json.load(open(f'{ROOT}/search_index/{ds}/docs.json'))
        self.by_prefix, self.by_norm = {}, {}
        for i, t in enumerate(self.docs):
            did = self.id(i)
            self.by_prefix.setdefault(h(t[:600]), did)
            self.by_norm.setdefault(h(norm(t)[:300]), did)
        self.items = {}         # unmatched excerpts, id -> text
        self.stats = collections.Counter()
        log(f'  corpus {ds}: {len(self.docs)} documents')

    def id(self, i):
        return f'{self.ds}_{int(i):06d}'

    def text(self, docid):
        return self.docs[int(DIGITS.search(docid).group(1))]

    def at(self, idx, shown):
        """Id of a search result: the run records the index position; the text it
        recorded is checked against the corpus before the id is trusted."""
        did = self.id(idx)
        if norm(self.docs[idx])[:300] == norm(shown)[:300]:
            self.stats['search_by_index'] += 1
            return did
        self.stats['search_index_mismatch'] += 1
        return self.resolve(shown)

    def resolve(self, t):
        did = self.by_prefix.get(h(t[:600]))
        if did:
            self.stats['by_prefix'] += 1
            return did
        did = self.by_norm.get(h(norm(t)[:300]))
        if did:
            self.stats['by_norm'] += 1
            return did
        # not a corpus passage at this granularity: shown verbatim, never guessed
        self.stats['unmatched'] += 1
        iid = 'u' + str(int(h(norm(t)[:400])[:12], 16))
        self.items[iid] = t[:TRUNC]
        return iid


def scores(ds, d, cond, rows):
    """Per-row quality as the paper scores it, plus the grader's text."""
    if ds == 'fanoutqa':
        return [float(r['loose_final']) for r in rows], [None] * len(rows)
    R = jl(f'{ROOT}/rejudge_bcgrader_final/{d}/res_{ds}_{cond}.jsonl')
    assert len(R) == len(rows) and all(a['query_id'] == b['query_id'] for a, b in zip(R, rows)), \
        f'grader file not aligned with {d}/{cond}'
    return [float(bool(x.get('correct_bc'))) for x in R], [x.get('judge_bc') for x in R]


def musique_gold(corpus):
    """MuSiQue has no qrels; gold = the supporting paragraphs of each question."""
    if not MUSIQUE_QA:
        return {}
    out, miss = {}, 0
    for q in json.load(open(MUSIQUE_QA)):
        g = []
        for p in q['paragraphs']:
            if not p.get('is_supporting'):
                continue
            did = corpus.by_norm.get(h(norm(f"{p['title']}\n{p['paragraph_text']}")[:300]))
            if did:
                g.append(did)
            else:
                miss += 1
        # the release lists one question twice; its second occurrence is keyed <id>#2
        out[q['id'] if q['id'] not in out else f"{q['id']}#2"] = {'g': g, 'e': []}
    log(f'  gold musique: {len(out)} questions, {miss} supporting paragraphs not in the corpus')
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for ds in ('musique', 'fanoutqa'):
        log(f'=== {ds}')
        corpus = Corpus(ds)
        used = set()
        for table, dds, d, cond, label in RUNS:
            if dds != ds:
                continue
            rows = jl(f'{ROOT}/{d}/res_{ds}_{cond}.jsonl')
            assert len(rows) == EXPECT[ds], f'{d}/{cond}: {len(rows)} rows'
            V, judge = scores(ds, d, cond, rows)
            run_id = f'{SHORT[table]}__{cond}'
            rd = f'{OUT}/traces/{ds}/{run_id}'
            os.makedirs(rd, exist_ok=True)
            seen = collections.Counter()
            index, shard, sk = [], [], 0
            for r, v, jt in zip(rows, V, judge):
                qid = str(r['query_id'])
                seen[qid] += 1
                key = qid if seen[qid] == 1 else f'{qid}#{seen[qid]}'   # MuSiQue repeats one question
                seed = [corpus.resolve(t) for t in (r.get('seed_docs') or []) if isinstance(t, str)]
                traj = []
                for st in r.get('trajectory') or []:
                    ret = [corpus.at(i, t) for t, i in zip(st.get('retrieved') or [], st.get('top1000_idx') or [])]
                    step = {'i': int(st['step']) if str(st.get('step', '')).isdigit() else None,
                            'act': st.get('action'), 'txt': st.get('assistant'),
                            'q': st.get('search_query'), 'ret': ret}
                    if st.get('fx'):
                        step['fx'] = st['fx']
                    if st.get('gen_error'):
                        step['err'] = st['gen_error']
                    traj.append(step)
                    used.update(ret)
                used.update(seed)
                loose = v if ds == 'fanoutqa' else None
                correct = None if ds == 'fanoutqa' else bool(v)
                shard.append({'qid': key, 'q': r.get('question'), 'gold_answer': r.get('gold_answer'),
                              'answer': r.get('final_answer'), 'correct': correct, 'loose': loose,
                              'tools': r.get('tool_calls'), 'judge': jt,
                              'tok_in': r.get('agent_tokens_in'), 'tok_out': r.get('agent_tokens_out'),
                              'seed': seed, 'traj': traj})
                index.append({'qid': key, 'c': correct, 't': r.get('tool_calls'),
                              'q': (r.get('question') or '')[:180], 's': sk,
                              'l': round(loose, 3) if loose is not None else None})
                if len(shard) >= SHARD:
                    json.dump(shard, open(f'{rd}/s{sk}.json', 'w'), separators=(',', ':'))
                    shard, sk = [], sk + 1
            if shard:
                json.dump(shard, open(f'{rd}/s{sk}.json', 'w'), separators=(',', ':'))
                sk += 1
            json.dump(index, open(f'{rd}/index.json', 'w'), separators=(',', ':'))
            n = len(rows)
            manifest.append({
                'run_id': run_id, 'table': table, 'label': label, 'dataset': ds, 'reader': READER,
                'condition': cond, 'mode': 'read' if table == 'table4_read' else 'react',
                'n': n, 'expected': EXPECT[ds], 'complete': n == EXPECT[ds], 'official_corpus': True,
                'acc': round(100 * sum(V) / n, 2),
                'mean_tools': round(sum(int(r['tool_calls']) for r in rows) / n, 2),
                'shards': sk,
                'acc_source': 'loose' if ds == 'fanoutqa' else 'inline', 'judged_coverage': 1.0,
                'judge_passes': 1, 'acc_spread': None,
                'metric': 'loose_list_recall' if ds == 'fanoutqa' else 'llm_judge',
                'source_dir': d,
            })
            log(f'  {table:12s} {run_id:26s} acc={manifest[-1]["acc"]:6.2f} '
                f'searches={manifest[-1]["mean_tools"]:.2f} shards={sk}')

        buckets = collections.defaultdict(dict)
        for did in used:
            if did in corpus.items:
                t = corpus.items[did]
                buckets[bucket_of(did)][did] = {'t': t.split('\n', 1)[0][:200], 'd': '', 'x': t,
                                                'kind': 'unmatched'}
                continue
            t = corpus.text(did)
            title = t.split('\n', 1)[0][:200]
            buckets[bucket_of(did)][did] = {'t': title, 'd': '', 'x': t[:TRUNC]}
        os.makedirs(f'{OUT}/corpus/{ds}', exist_ok=True)
        for b, obj in buckets.items():
            json.dump(obj, open(f'{OUT}/corpus/{ds}/b{b}.json', 'w'), separators=(',', ':'))
        log(f'  corpus: {len(used)} referenced items in {len(buckets)} buckets; ids: {dict(corpus.stats)}')

        gold = musique_gold(corpus) if ds == 'musique' else (
            json.load(open(FANOUTQA_GOLD)) if FANOUTQA_GOLD else {})
        if gold:
            os.makedirs(f'{OUT}/gold', exist_ok=True)
            json.dump(gold, open(f'{OUT}/gold/{ds}.json', 'w'), separators=(',', ':'))
    json.dump(manifest, open(f'{OUT}/runs.json', 'w'), indent=1)
    json.dump([], open(f'{OUT}/seeds.json', 'w'))
    log(f'wrote {OUT}/runs.json: {len(manifest)} runs')
    log('EXPORT_DONE')


if __name__ == '__main__':
    main()
