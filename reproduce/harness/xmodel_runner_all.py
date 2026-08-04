#!/usr/bin/env python3
# NOTE: released as run, with one change: the hard-coded cluster workspace path
# was replaced by the LGR_ROOT environment variable. Nothing else was modified.
"""Cross-model seeded ReAct loop, ALL seed variants, gen-only. Skips conditions already generated."""
import json, os, re, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI
import requests as _rq
E = os.environ['LGR_ROOT']
OUT = f'{E}/results_xmodel'; os.makedirs(OUT, exist_ok=True)
BASEURL = os.environ.get('BASEURL'); MODEL = os.environ['MODEL']; TAG = os.environ['MODELTAG']
EMB = os.environ.get('EMB', 'http://localhost:8093')
cl = OpenAI(base_url=BASEURL, api_key='x', timeout=600)
WORKERS = int(os.environ.get('WORKERS', '24')); LIMIT = int(os.environ.get('LIMIT', '0')); MAXHOPS = int(os.environ.get('MAXHOPS', '4'))
DS = os.environ.get('DS', 'musique')
def search(ds, q, k=5):
    for _ in range(3):
        try: return _rq.post(f'{EMB}/search', json={'dataset': ds, 'query': q[:400], 'k': k}, timeout=60).json()['docs']
        except Exception: time.sleep(2)
    return []
def gen(msgs, mt=400, fp=0.4, acc=None):
    for _ in range(3):
        try:
            resp = cl.chat.completions.create(model=MODEL, messages=msgs, max_tokens=mt, temperature=0.0,
                    frequency_penalty=fp, extra_body={'chat_template_kwargs': {'enable_thinking': False}})
            if acc is not None and resp.usage is not None:
                acc['in'] += resp.usage.prompt_tokens or 0; acc['out'] += resp.usage.completion_tokens or 0
            m = resp.choices[0].message
            return (m.content or '').strip() or (getattr(m, 'reasoning_content', '') or '').strip()
        except Exception: time.sleep(3)
    return ''
def astr(a): return '; '.join(a) if isinstance(a, list) else str(a)
def norm(x): return re.sub(r'[^a-z0-9]+', ' ', (x or '').lower()).strip()
def loose(resp, a):
    r = norm(resp); ps = []
    for seg in str(a).split(';'):
        seg = seg.strip()
        if not seg: continue
        if ':' in seg: k, v = seg.split(':', 1); ps.append((norm(k), norm(v)))
        else: ps.append((None, norm(seg)))
    if not ps: return 0.0
    h = sum(1 for k, v in ps if bool(v) and all(t in r for t in v.split()) and (k is None or all(t in r for t in k.split())))
    return h / len(ps)
SYS = ("Use the documents to answer. If a specific fact is missing, output ONLY: SEARCH: <focused query>. "
       "Otherwise end with: Exact Answer: <answer>. Prefer to answer; search only when needed.")
def run(cond, sf):
    outp = f'{OUT}/res_{DS}_{TAG}_{cond}.jsonl'
    if os.path.exists(outp) and sum(1 for _ in open(outp)) > 0:
        print(f'SKIP {TAG}/{DS}/{cond} (exists)', flush=True); return
    rows = [json.loads(l) for l in open(f'{E}/bundles/{DS}/{sf}.jsonl')]; rows = rows[:LIMIT] if LIMIT else rows
    res = []
    def work(o):
        seed = [d['text'] for d in (o.get('seed') or [])[:10]]; gold = astr(o['answer'])
        msgs = [{'role': 'system', 'content': SYS},
                {'role': 'user', 'content': 'Documents:\n' + '\n\n'.join(f'[{i+1}] ' + s for i, s in enumerate(seed)) + f'\n\nQuestion: {o["question"]}'}]
        r = ''; calls = 0; atok = {'in': 0, 'out': 0}; traj = []
        for _ in range(MAXHOPS + 1):
            r = gen(msgs, acc=atok); mm = re.search(r'SEARCH:\s*(.+)', r); step = {'step': len(traj), 'assistant': r}
            if mm and calls < MAXHOPS:
                calls += 1; sq = mm.group(1).strip(); got = search(DS, sq)
                step['action'] = 'search'; step['search_query'] = sq; step['retrieved'] = got
                msgs.append({'role': 'assistant', 'content': r})
                msgs.append({'role': 'user', 'content': 'Search results:\n' + '\n\n'.join(f'[+{i+1}] ' + g for i, g in enumerate(got)) + f'\nNow answer or SEARCH.\nQuestion: {o["question"]}'})
                traj.append(step)
            else:
                step['action'] = 'answer'; traj.append(step); break
        final = re.sub(r'^.*Exact Answer:\s*', '', r, flags=re.S).strip() if 'Exact Answer:' in r else r
        row = {'query_id': o['query_id'], 'question': o['question'], 'gold_answer': gold, 'n_seed_docs': len(seed),
               'seed_docs': [s[:600] for s in seed], 'tool_calls': calls, 'final_answer': final, 'trajectory': traj,
               'agent_tokens_in': atok['in'], 'agent_tokens_out': atok['out'], 'reader': TAG, 'condition': cond}
        if DS == 'fanoutqa': row['loose'] = loose(r, gold)
        return row
    dn = [0]
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        fs = [ex.submit(work, o) for o in rows]
        with open(outp, 'w') as f:
            for ft in as_completed(fs):
                rr = ft.result(); res.append(rr); f.write(json.dumps(rr) + '\n'); f.flush(); dn[0] += 1
                if dn[0] % 200 == 0: print(f'{TAG}/{DS}/{cond}: {dn[0]}/{len(rows)}', flush=True)
    tc = sum(x['tool_calls'] for x in res) / max(1, len(res))
    print(f'GENDONE {TAG}/{DS}/{cond} n={len(res)} tools={tc:.3f}', flush=True)
CONDS = {'no_seed':'seed_closed_book','latentgraph_dualtree_seed':'seed_dual_z_read','hipporag_seed':'seed_hipporag_read',
         'qwen_seed':'seed_qwen_read','latentgraph_singleview_seed':'seed_latentgraph_read','reasonmcb_seed':'seed_reasonmcb_read',
         'doc_only_seed':'seed_doc_only_read','memory_only_seed':'seed_memory_only_read','hybrid_seed':'seed_hybrid_union_read'}
ONLY = os.environ.get('ONLY'); only = set(ONLY.split(',')) if ONLY else None
for c, sf in CONDS.items():
    if not only or c in only: run(c, sf)
print('ALLDONE ' + TAG + ' ' + DS, flush=True)
