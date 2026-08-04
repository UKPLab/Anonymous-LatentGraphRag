#!/usr/bin/env python3
# NOTE: released as run, with one change: the hard-coded cluster workspace path
# was replaced by the LGR_ROOT environment variable. Nothing else was modified.
"""Cross-model ReasonMCB-backed ReAct loop, gen-only (fixed judge later). Reader endpoint parameterized.
Live retriever = Reason-ModernColBERT service (:8095). Optional seed injection. Same corpus (search_index/{ds})."""
import json, os, re, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI
import requests as _rq
E = os.environ['LGR_ROOT']
OUT = f'{E}/results_bcfull_xrmcb'; os.makedirs(OUT, exist_ok=True)
BASEURL = os.environ.get('BASEURL'); MODEL = os.environ['MODEL']; TAG = os.environ['MODELTAG']
cl = OpenAI(base_url=BASEURL, api_key='x', timeout=600)
SVC = 'http://localhost:8095'
WORKERS = int(os.environ.get('WORKERS', '16')); LIMIT = int(os.environ.get('LIMIT', '0')); MAXIT = int(os.environ.get('MAXIT', '8'))
DS = os.environ.get('DS', 'musique'); SEED = os.environ.get('SEED', '')
SEEDED = bool(SEED) and SEED != 'closed_book'
ABL = f'benchmark_rmcb_{SEED}' if SEEDED else 'benchmark_rmcb'
def search(q, k=5):
    for _ in range(3):
        try:
            r = _rq.post(f'{SVC}/search2', json={'query': q[:200], 'k': k}, timeout=90).json()
            return [{'docid': str(i), 'snippet': (d or '')[:300]} for i, d in zip(r['ids'], r['docs'])]
        except Exception: time.sleep(2)
    return []
def getdoc(did):
    for _ in range(3):
        try: return _rq.post(f'{SVC}/doc', json={'docid': did}, timeout=30).json()['text'][:1800]
        except Exception: time.sleep(2)
    return '(fetch failed)'
def gen(msgs, mt=500, acc=None):
    for _ in range(3):
        try:
            resp = cl.chat.completions.create(model=MODEL, messages=msgs, max_tokens=mt, temperature=0.0,
                    frequency_penalty=0.3, extra_body={'chat_template_kwargs': {'enable_thinking': False}})
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
    return sum(1 for k, v in ps if bool(v) and all(t in r for t in v.split()) and (k is None or all(t in r for t in k.split()))) / len(ps)
SYS = ("You are a deep research agent. Answer the question by interacting with a local knowledge base. "
       "Actions (one per turn):\n  SEARCH: <query>   -> returns top-5 documents as [docid] snippet\n"
       "  GET: <docid>      -> returns the full document text\n"
       "Search to find candidates, GET the most relevant docids, then finish with:\n  Exact Answer: <your single best answer>\n"
       "Be efficient; answer as soon as you have enough evidence.")
def run():
    outp = f'{OUT}/res_{DS}_{TAG}_{ABL}.jsonl'
    if os.path.exists(outp) and sum(1 for _ in open(outp)) > 0: print(f'SKIP {TAG}/{DS}/{ABL}', flush=True); return
    src = f'{E}/bundles/{DS}/seed_{SEED}.jsonl' if SEEDED else f'{E}/bundles/{DS}/seed_closed_book.jsonl'
    rows = [json.loads(l) for l in open(src)]; rows = rows[:LIMIT] if LIMIT else rows
    res = []
    def work(o):
        gold = astr(o['answer']); seed = [d['text'] for d in (o.get('seed') or [])[:10]] if SEEDED else []
        u = f'Question: {o["question"]}'
        if seed: u = 'Initial documents:\n' + '\n\n'.join(f'[s{i}] ' + s for i, s in enumerate(seed)) + '\n\n' + u
        msgs = [{'role': 'system', 'content': SYS}, {'role': 'user', 'content': u}]
        r = ''; calls = 0; atok = {'in': 0, 'out': 0}; traj = []
        for _ in range(MAXIT):
            r = gen(msgs, acc=atok); ms = re.search(r'SEARCH:\s*(.+)', r); mg = re.search(r'GET:\s*(\S+)', r); step = {'step': len(traj), 'assistant': r}
            if ms and calls < MAXIT:
                calls += 1; q = ms.group(1).strip()[:200]; rr = search(q); step['action'] = 'search'; step['search_query'] = q
                step['retrieved'] = [f'[{d["docid"]}] {d["snippet"]}' for d in rr]
                obs = '\n'.join(f'[{d["docid"]}] {d["snippet"]}' for d in rr) or '(no results)'
                msgs.append({'role': 'assistant', 'content': r}); msgs.append({'role': 'user', 'content': 'Search results:\n' + obs + '\nContinue (SEARCH / GET / Exact Answer).'}); traj.append(step)
            elif mg and calls < MAXIT:
                calls += 1; did = mg.group(1).strip(); t = getdoc(did); step['action'] = 'get'; step['docid'] = did; step['retrieved'] = [f'[{did}] ' + t]
                msgs.append({'role': 'assistant', 'content': r}); msgs.append({'role': 'user', 'content': f'Document [{did}]:\n{t}\nContinue (SEARCH / GET / Exact Answer).'}); traj.append(step)
            else: step['action'] = 'answer'; traj.append(step); break
        final = re.sub(r'^.*Exact Answer:\s*', '', r, flags=re.S).strip() if 'Exact Answer:' in r else r
        row = {'query_id': o['query_id'], 'question': o['question'], 'gold_answer': gold, 'n_seed_docs': len(seed),
               'tool_calls': calls, 'final_answer': final, 'trajectory': traj, 'agent_tokens_in': atok['in'], 'reader': TAG, 'condition': ABL}
        if DS == 'fanoutqa': row['loose'] = loose(r, gold)
        return row
    dn = [0]
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        fs = [ex.submit(work, o) for o in rows]
        with open(outp, 'w') as f:
            for ft in as_completed(fs):
                f.write(json.dumps(ft.result()) + '\n'); f.flush(); dn[0] += 1
                if dn[0] % 100 == 0: print(f'{TAG}/{DS}/{ABL}: {dn[0]}/{len(rows)}', flush=True)
    print(f'RMCBDONE {TAG}/{DS}/{ABL} n={len(rows)}', flush=True)
run(); print('RMCB1_DONE', flush=True)
