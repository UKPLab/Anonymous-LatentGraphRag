"""Export LatentGraphRAG evaluation trajectories into a deduplicated, shardable
static-site payload.

Layout produced under OUT:
  runs.json                          manifest + aggregate metrics per run
  traces/<ds>/<run>/index.json       per-sample summary (cheap list view)
  traces/<ds>/<run>/s<k>.json        full slim traces, SHARD samples each
  corpus/<ds>/b<XX>.json             docid -> {t,d,x}, 256 buckets
  gold/<ds>.json                     qid -> {g:[gold ids], e:[evidence ids]}
"""
import json, os, re, glob, hashlib, collections, sys

E = os.environ['LGR_ROOT']
QR = os.environ.get('LGR_QRELS', os.path.join(os.environ['LGR_ROOT'], 'qrels'))
OUT = os.environ.get('LGR_EXPORT_OUT', 'site_export')
SHARD = 100
TRUNC = 2000
READERS = ['qwen3_5_9b', 'qwen3_5_27b', 'qwen3_5_122b', 'gptoss120b']
EXPECT = {'musique': 1000, 'browsecomp': 830, 'fanoutqa': 310}

# condition -> (table, human label). Anything unlisted still gets exported as "other".
LOOP = {
    'no_seed': 'No seed',
    'qwen_seed': '+ Qwen3-Emb seed',
    'reasonmcb_seed': '+ Reason-MCB seed',
    'hipporag_seed': '+ HippoRAG 2 seed',
    'latentgraph_dualtree_seed': '+ LatentGraphRAG (dual-tree)',
    'latentgraph_singleview_seed': '+ LatentGraphRAG (single-view)',
    'doc_only_seed': '+ Document-only seed',
    'memory_only_seed': '+ Memory-only seed',
    'hybrid_seed': '+ Hybrid seed',
}
READ = {
    'closed_book': 'Closed-book (no evidence)',
    'qwen_read': 'Qwen3-Embedding-8B',
    'read_qwen_official': 'Qwen3-Embedding-8B',
    'reasonmcb_read': 'Reason-ModernColBERT',
    'read_reasonmcb_official': 'Reason-ModernColBERT',
    'hipporag_read': 'HippoRAG 2',
    'doc_only_read': 'Document-only',
    'memory_only_read': 'Memory-only',
    'dual_z_read': 'MMR-Tree + Z-Agreement',
    'hybrid_union_read': 'Hybrid union',
    'latentgraph_read': 'LatentGraphRAG',
}
BENCH = {
    'benchmark': 'BrowseComp+ agent (Qwen3-Emb backend)',
    'benchmark_qwen': 'BrowseComp+ agent (Qwen3-Emb backend)',
    'benchmark_rmcb': 'BrowseComp+ agent (Reason-MCB backend)',
}
XRMCB = {
    'benchmark_rmcb': 'no seed',
    'benchmark_rmcb_dual_z_read': '+ LatentGraphRAG',
    'benchmark_rmcb_hipporag_read': '+ HippoRAG 2',
    'benchmark_rmcb_qwen_read': '+ Qwen3-Emb',
}


def log(*a):
    print(*a, flush=True)


def jl(fp):
    out = []
    for line in open(fp):
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except Exception:
            pass
    return out


# ---------------------------------------------------------------- id resolution
BRACKET = re.compile(r'^\s*\[(\d+)\]\s*')
LEADNUM = re.compile(r'^\s*(\d+)\s*\n')
FRONT = re.compile(r'^---\n.*?\n---\n', re.S)


def strip_front(t):
    return FRONT.sub('', t, count=1)


def h(s):
    return hashlib.md5(s.encode('utf-8', 'ignore')).hexdigest()


DIGITS = re.compile(r'(\d+)\s*$')


def bucket_of(docid):
    """Which corpus shard a document lives in.

    Deliberately computable from the id alone with no hashing, so the browser
    can derive the file to fetch without shipping a hash implementation or a
    docid -> bucket lookup table. All our ids end in digits ("18639",
    "musique_000059"); the fallback only exists for safety.
    """
    m = DIGITS.search(docid)
    if m:
        return f'{int(m.group(1)) % 256:03d}'
    acc = 2166136261
    for ch in docid:
        acc = ((acc ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return f'{acc % 256:03d}'


def norm(s):
    """Whitespace/case-insensitive form, so differing truncation or re-wrapping
    between retrieval backends still resolves to the same corpus document."""
    return ' '.join(s.split()).lower()


class Resolver:
    """Maps a stored document string back to its corpus id.

    Traces store documents in four shapes, none of them a clean id field:
      "[63071] ---\ntitle: ..."   benchmark agent / rmcb
      "49881\n---\ntitle: ..."    our loop's seed block
      "---\ntitle: ...---\nbody"  plain corpus text
      "Title\nbody"               title-first rendering, no frontmatter
    """

    def __init__(self, dataset):
        self.ds = dataset
        self.by_prefix = {}
        self.by_body = {}
        self.by_norm = {}
        self.text = {}          # docid -> truncated text actually shown
        self.meta = {}          # docid -> (title, date)
        self.valid = set()
        self.positional = dataset in ('musique', 'fanoutqa')
        self.items = {}         # non-document items, id -> text
        self.stats = collections.Counter()
        self._load()

    def _load(self):
        if self.ds == 'browsecomp':
            docs = json.load(open(f'{E}/search_index/browsecomp_full/docs.json'))
            ids = json.load(open(f'{E}/search_index/browsecomp_full/docids.json'))
        elif self.ds == 'musique':
            docs = json.load(open(f'{E}/search_index/musique/docs.json'))
            ids = [f'musique_{i:06d}' for i in range(len(docs))]
        else:
            docs = json.load(open(f'{E}/search_index/fanoutqa/docs.json'))
            ids = [f'fanoutqa_{i:06d}' for i in range(len(docs))]
        log(f'  corpus {self.ds}: {len(docs)} docs')
        for i, t in enumerate(docs):
            did = str(ids[i])
            self.valid.add(did)
            self.by_prefix.setdefault(h(t[:600]), did)
            body = strip_front(t)
            self.by_body.setdefault(h(body[:400]), did)
            self.by_norm.setdefault(h(norm(body)[:300]), did)
            m = re.search(r'^---\ntitle:\s*(.*?)\n', t)
            title = m.group(1).strip() if m else t.split('\n', 1)[0][:200]
            m = re.search(r'\ndate:\s*(.*?)\n', t[:400])
            self.meta[did] = (title, m.group(1).strip() if m else '')
            self.text[did] = t[:TRUNC]
        del docs
        log(f'  maps: prefix={len(self.by_prefix)} body={len(self.by_body)}')

    def _from_num(self, n):
        """Numeric ids appear either as real corpus docids (BrowseComp+) or as
        positional indices into the index order (MuSiQue/FanOutQA)."""
        if n in self.valid:
            return n
        if self.positional:
            cand = f'{self.ds}_{int(n):06d}'
            if cand in self.valid:
                return cand
        return None

    def item_id(self, t):
        """Id for a retrieved item that is not a corpus document.

        Memory-only, HippoRAG and dual-tree seeds contain verbalized triplets
        rather than passages, so they have no docid. They get a content-addressed
        id whose digits let bucket_of() place them like any other item.
        """
        iid = 'm' + str(int(h(norm(t)[:400])[:12], 16))
        self.items[iid] = t[:TRUNC]
        return iid

    def resolve(self, t):
        m = BRACKET.match(t)
        if m:
            did = self._from_num(m.group(1))
            if did:
                self.stats['bracket'] += 1
                return did
        m = LEADNUM.match(t)
        if m:
            did = self._from_num(m.group(1))
            if did:
                self.stats['leadnum'] += 1
                return did
        # strip whatever id prefix was present, then hash
        core = BRACKET.sub('', t)
        core = LEADNUM.sub('', core)
        did = self.by_prefix.get(h(core[:600]))
        if did:
            self.stats['prefix'] += 1
            return did
        body = strip_front(core)
        did = self.by_body.get(h(body[:400]))
        if did:
            self.stats['body'] += 1
            return did
        did = self.by_norm.get(h(norm(body)[:300]))
        if did:
            self.stats['norm'] += 1
            return did
        self.stats['memory_item'] += 1
        return self.item_id(core)


# ---------------------------------------------------------------- gold labels
def load_gold(dataset):
    if dataset == 'browsecomp':
        base = f'{QR}/topics-qrels'
    elif dataset == 'fanoutqa':
        base = f'{QR}/fanoutqa-topics-qrels'
    else:
        return {}
    out = collections.defaultdict(lambda: {'g': [], 'e': []})
    for fn, key in [('qrel_golds.txt', 'g'), ('qrel_evidence.txt', 'e')]:
        p = f'{base}/{fn}'
        if not os.path.exists(p):
            continue
        for line in open(p):
            parts = line.split()
            if len(parts) >= 4:
                out[parts[0]][key].append(parts[2])
    return dict(out)


# ---------------------------------------------------------------- judged join
def load_judged():
    """Correctness for most non-122B runs lives in compact {qid,c} sidecars
    rather than inline in the trace file, so it has to be joined back in.

    Two hazards, both observed in this dataset:
      * degenerate sidecars where every verdict is False (a crashed judge pass)
        would silently render a run as 0% accuracy, so they are dropped;
      * the same run was often judged more than once and the 122B judge is not
        bit-reproducible (1-4% of verdicts flip, ~1 accuracy point). The newest
        pass wins and the spread is recorded so it can be reported rather than
        hidden.
    """
    cands = collections.defaultdict(list)
    for jd in ['results_bcfull_judged', 'results_papernums_judged']:
        for fp in glob.glob(f'{E}/{jd}/*.jsonl'):
            m = re.search(
                r'results_([A-Za-z0-9_]+?)_res_(musique|browsecomp|fanoutqa)_(.+)\.jsonl',
                os.path.basename(fp))
            if not m:
                continue
            src, ds, cond = m.groups()
            reader = 'qwen3_5_122b'
            for r in READERS:
                if cond.startswith(r + '_'):
                    reader, cond = r, cond[len(r) + 1:]
                    break
            # sidecars use either 'qid' or 'q' for the query id
            mapping = {str(x.get('qid', x.get('q'))): bool(x['c'])
                       for x in jl(fp)
                       if ('qid' in x or 'q' in x) and 'c' in x}
            if not mapping:
                continue
            ncorr = sum(mapping.values())
            if ncorr == 0 and len(mapping) > 50:
                log(f'  ! dropping degenerate judge pass (0 correct of '
                    f'{len(mapping)}): {os.path.basename(fp)[:70]}')
                continue
            cands[(ds, reader, cond)].append({
                'map': mapping, 'official': src.startswith('bcfull'),
                'mtime': os.path.getmtime(fp), 'file': os.path.basename(fp),
                'acc': 100 * ncorr / len(mapping),
            })
    out, meta = {}, {}
    for key, lst in cands.items():
        ds = key[0]
        if ds == 'browsecomp' and any(c['official'] for c in lst):
            lst = [c for c in lst if c['official']]
        lst.sort(key=lambda c: (-c['mtime'], c['file']))
        best = lst[0]
        out[key] = best['map']
        meta[key] = {
            'judge_passes': len(lst),
            'acc_spread': round(max(c['acc'] for c in lst)
                                - min(c['acc'] for c in lst), 2),
            'judge_file': best['file'],
        }
    return out, meta


# ---------------------------------------------------------------- run discovery
def discover():
    """Locate the best available file per (dataset, reader, condition).

    Official-corpus BrowseComp+ files (results_bcfull_*) always win over the old
    pooled index; otherwise the more complete file wins.
    """
    found = {}
    for d in sorted(glob.glob(f'{E}/results_*')):
        if not os.path.isdir(d):
            continue
        dn = os.path.basename(d)
        official = dn.startswith('results_bcfull')
        for fp in glob.glob(f'{d}/res_*.jsonl'):
            m = re.match(r'res_(musique|browsecomp|fanoutqa)_(.+)\.jsonl',
                         os.path.basename(fp))
            if not m:
                continue
            ds, cond = m.groups()
            reader = 'qwen3_5_122b'
            for r in READERS:
                if cond.startswith(r + '_'):
                    reader, cond = r, cond[len(r) + 1:]
                    break
            n = sum(1 for _ in open(fp))
            key = (ds, reader, cond)
            old = found.get(key)
            if old:
                if ds == 'browsecomp' and old[2] and not official:
                    continue
                if not (ds == 'browsecomp' and official and not old[2]) and n < old[1]:
                    continue
            found[key] = (fp, n, official)
    return found


def classify(cond, reader):
    if cond in XRMCB and cond != 'benchmark_rmcb':
        return 'table16', XRMCB[cond]
    if cond in BENCH:
        # Only the 122B benchmark rows belong to the main table; the other
        # readers are the cross-reader robustness story.
        table = 'table3' if reader == 'qwen3_5_122b' else 'table15'
        return table, BENCH[cond]
    if cond in READ:
        return 'table2', READ[cond]
    if cond in LOOP:
        return ('table3' if reader == 'qwen3_5_122b' else 'table15'), LOOP[cond]
    return 'other', cond


def export_seeds(ds, res, used):
    """Release the retrieval seeds themselves.

    Serves two purposes: it is the only faithful record of what the
    retrieve-then-read rows actually saw, and it is the artifact needed to
    reproduce the seeded runs without rebuilding any index.
    """
    out = []
    for fp in sorted(glob.glob(f'{E}/bundles/{ds}/seed_*.jsonl')):
        method = os.path.basename(fp)[len('seed_'):-len('.jsonl')]
        rows = jl(fp)
        recs = []
        for r in rows:
            ids = []
            for t in (r.get('seed') or []):
                if isinstance(t, dict):
                    t = t.get('text') or ''
                if isinstance(t, str) and t:
                    did = res.resolve(t)
                    ids.append(did)
                    if did:
                        used.add(did)
            recs.append({'qid': str(r.get('query_id')),
                         'q': r.get('question'),
                         'gold_answer': r.get('answer'),
                         'seed': ids})
        d = f'{OUT}/seeds/{ds}'
        os.makedirs(d, exist_ok=True)
        json.dump(recs, open(f'{d}/{method}.json', 'w'), separators=(',', ':'))
        nz = sum(1 for r in recs if r['seed'])
        out.append({'dataset': ds, 'method': method, 'n': len(recs),
                    'n_with_seed': nz,
                    'mean_seed_docs': round(sum(len(r['seed']) for r in recs)
                                            / max(1, len(recs)), 2)})
        log(f'  seeds {method:24s} n={len(recs):5d} with_seed={nz:5d}')
    return out


# ---------------------------------------------------------------- main
def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    keep_other = os.environ.get('KEEP_OTHER') == '1'
    # GPT-OSS-120B does not reliably emit the benchmark scaffold's text markers
    # (1.6 vs ~5-7 mean tool calls, many empty first turns), so its numbers do
    # not measure retrieval. Excluded from the release by default.
    exclude = {r for r in os.environ.get('EXCLUDE_READERS', 'gptoss120b').split(',') if r}
    os.makedirs(OUT, exist_ok=True)
    found = discover()
    judged, jmeta = load_judged()
    log(f'discovered {len(found)} run files, {len(judged)} judged sidecars')

    by_ds = collections.defaultdict(list)
    for (ds, reader, cond), (fp, n, official) in found.items():
        by_ds[ds].append((reader, cond, fp, n, official))

    manifest = []
    allseeds = []
    for ds in ['browsecomp', 'musique', 'fanoutqa']:
        if only and ds != only:
            continue
        runs = by_ds.get(ds, [])
        if not runs:
            continue
        log(f'=== {ds}: {len(runs)} runs')
        res = Resolver(ds)
        gold = load_gold(ds)
        used = set()

        for reader, cond, fp, n, official in sorted(runs):
            if reader in exclude:
                continue
            table, label = classify(cond, reader)
            if table == 'other' and not keep_other:
                continue
            if table == 'table2':
                # no trajectory and no seed_docs in these files; the seeds are
                # exported from the bundles by export_seeds() instead
                continue
            jmap = judged.get((ds, reader, cond), {})
            jmi = jmeta.get((ds, reader, cond), {})
            run_id = f'{reader}__{cond}'
            rd = f'{OUT}/traces/{ds}/{run_id}'
            os.makedirs(rd, exist_ok=True)
            rows = jl(fp)
            # de-duplicate on query_id, keep first
            seen = {}
            for r in rows:
                seen.setdefault(r.get('query_id'), r)
            rows = list(seen.values())

            index, shard, sk, ncorr, tools = [], [], 0, 0, []
            looses = []
            for i, r in enumerate(rows):
                qid = str(r.get('query_id'))
                seed_ids = []
                for t in (r.get('seed_docs') or []):
                    if isinstance(t, str):
                        did = res.resolve(t)
                        seed_ids.append(did)
                        if did:
                            used.add(did)
                traj = []
                for st in (r.get('trajectory') or []):
                    if not isinstance(st, dict):
                        continue
                    ids = []
                    for t in (st.get('retrieved') or []):
                        if isinstance(t, str):
                            did = res.resolve(t)
                            ids.append(did)
                            if did:
                                used.add(did)
                    traj.append({
                        'i': st.get('step'),
                        'act': st.get('action'),
                        'txt': st.get('assistant'),
                        'q': st.get('search_query'),
                        'ret': ids,
                    })
                loose = r.get('loose')
                if isinstance(loose, (int, float)):
                    # FanOutQA is scored by loose list-recall, not an LLM judge
                    correct = None
                elif 'correct' in r:
                    correct = bool(r.get('correct'))
                elif qid in jmap:
                    correct = bool(jmap[qid])
                else:
                    correct = None      # unjudged: distinct from "wrong"
                tc = r.get('tool_calls')
                if isinstance(tc, int):
                    tools.append(tc)
                if correct:
                    ncorr += 1
                if isinstance(loose, (int, float)):
                    looses.append(float(loose))
                rec = {
                    'qid': qid,
                    'q': r.get('question'),
                    'gold_answer': r.get('gold_answer') or r.get('answer'),
                    'answer': r.get('final_answer'),
                    'correct': correct,
                    'loose': loose if isinstance(loose, (int, float)) else None,
                    'tools': tc,
                    'judge': r.get('judge_output'),
                    'tok_in': r.get('agent_tokens_in'),
                    'tok_out': r.get('agent_tokens_out'),
                    'seed': seed_ids,
                    'traj': traj,
                }
                shard.append(rec)
                index.append({'qid': qid, 'c': correct, 't': tc,
                              'q': (r.get('question') or '')[:180], 's': sk,
                              'l': (round(float(loose), 3)
                                    if isinstance(loose, (int, float)) else None)})
                if len(shard) >= SHARD:
                    json.dump(shard, open(f'{rd}/s{sk}.json', 'w'),
                              separators=(',', ':'))
                    shard, sk = [], sk + 1
            if shard:
                json.dump(shard, open(f'{rd}/s{sk}.json', 'w'),
                          separators=(',', ':'))
                sk += 1
            json.dump(index, open(f'{rd}/index.json', 'w'), separators=(',', ':'))
            nn = len(rows)
            inline = sum(1 for r in rows if 'correct' in r)
            if looses and len(looses) >= 0.9 * max(1, nn):
                acc_source, cov = 'loose', 1.0
            elif inline == nn and nn:
                acc_source, cov = 'inline', 1.0
            elif jmap:
                acc_source = 'sidecar' if not inline else 'mixed'
                cov = round(sum(1 for r in rows
                                if str(r.get('query_id')) in jmap) / max(1, nn), 3)
            else:
                acc_source, cov = 'MISSING', 0.0
            manifest.append({
                'run_id': run_id, 'table': table, 'label': label,
                'acc_source': acc_source, 'judged_coverage': cov,
                'judge_passes': jmi.get('judge_passes'),
                'acc_spread': jmi.get('acc_spread'),
                'dataset': ds, 'reader': reader, 'condition': cond,
                'n': nn, 'expected': EXPECT.get(ds, nn),
                'complete': nn >= 0.9 * EXPECT.get(ds, nn),
                'official_corpus': bool(official) if ds == 'browsecomp' else True,
                # No judgements available means unknown, not zero — never let an
                # unjudged run render as 0% accuracy.
                'metric': 'loose_list_recall' if acc_source == 'loose' else 'llm_judge',
                'acc': (round(100 * sum(looses) / len(looses), 1) if acc_source == 'loose'
                        else round(100 * ncorr / nn, 1)
                        if nn and acc_source != 'MISSING' else None),
                'unjudged': acc_source == 'MISSING',
                'mean_tools': round(sum(tools) / len(tools), 2) if tools else None,
                'shards': sk,
            })
            log(f'  {run_id:52s} {table:8s} n={nn:5d} acc={manifest[-1]["acc"]} '
                f'tools={manifest[-1]["mean_tools"]} shards={sk}')

        seedinfo = export_seeds(ds, res, used)
        allseeds.extend(seedinfo)

        # corpus buckets: only documents actually referenced
        cd = f'{OUT}/corpus/{ds}'
        os.makedirs(cd, exist_ok=True)
        buckets = collections.defaultdict(dict)
        for did in used:
            title, date = res.meta.get(did, ('', ''))
            buckets[bucket_of(did)][did] = {'t': title, 'd': date,
                                            'x': res.text.get(did, '')}
        # non-document items (verbalized memories) live in the same buckets, so
        # the viewer resolves any id through one code path
        nitems = 0
        for iid, text in res.items.items():
            if iid in used:
                buckets[bucket_of(iid)][iid] = {'t': 'Relational memory',
                                                'd': '', 'x': text,
                                                'kind': 'memory'}
                nitems += 1
        for b, obj in buckets.items():
            json.dump(obj, open(f'{cd}/b{b}.json', 'w'), separators=(',', ':'))
        log(f'  non-document items: {nitems}')
        log(f'  corpus: {len(used)} referenced docs in {len(buckets)} buckets')
        log(f'  id resolution: {dict(res.stats)}')

        if gold:
            os.makedirs(f'{OUT}/gold', exist_ok=True)
            json.dump(gold, open(f'{OUT}/gold/{ds}.json', 'w'),
                      separators=(',', ':'))
            log(f'  gold: {len(gold)} queries')
        del res

    mp = f'{OUT}/runs.json'
    prev = json.load(open(mp)) if os.path.exists(mp) else []
    keep = [r for r in prev if r['dataset'] not in {m['dataset'] for m in manifest}]
    json.dump(keep + manifest, open(mp, 'w'), indent=1)
    log(f'wrote {mp}: {len(keep) + len(manifest)} runs')
    sp = f'{OUT}/seeds.json'
    prevs = json.load(open(sp)) if os.path.exists(sp) else []
    keeps = [r for r in prevs
             if r['dataset'] not in {x['dataset'] for x in allseeds}]
    json.dump(keeps + allseeds, open(sp, 'w'), indent=1)
    log(f'wrote {sp}: {len(keeps) + len(allseeds)} seed sets')
    log('EXPORT_DONE')


if __name__ == '__main__':
    main()
