#!/usr/bin/env python3
# NOTE: released as run, with one change: the hard-coded cluster workspace path
# was replaced by the LGR_ROOT environment variable. Nothing else was modified.
"""Fixed-judge pass over cross-model gen outputs (results_xmodel). Runs on the node where the FIXED judge
(Qwen3.5-122B :8000) is local. MuSiQue/BC+ = binary judge with the fixed model; FanOutQA = precomputed loose.
Writes per-(reader,ds,condition) accuracy so all readers are scored by the SAME judge (clean cross-model)."""
import json, os, re, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI
E = os.environ['LGR_ROOT']
IN = f'{E}/results_xmodel'; OUTS = f'{IN}/judged'; os.makedirs(OUTS, exist_ok=True)
JMODEL = os.environ.get('JMODEL', 'Qwen/Qwen3.5-122B-A10B'); cl = OpenAI(base_url=os.environ.get('JURL', 'http://localhost:8000/v1'), api_key='x', timeout=600)
WORKERS = int(os.environ.get('WORKERS', '32'))
READERS = os.environ.get('READERS', 'qwen3_5_9b,qwen3_5_27b').split(',')
CONDS = ['no_seed', 'latentgraph_dualtree_seed', 'hipporag_seed', 'qwen_seed']
DSS = ['musique', 'browsecomp', 'fanoutqa']
GR = "Judge if [response] matches [correct_answer]. [q]:{q} [r]:{r} [a]:{a}\nFinal line: correct: yes OR correct: no"
def judge(q, r, a):
    for _ in range(3):
        try:
            m = cl.chat.completions.create(model=JMODEL, messages=[{'role': 'user', 'content': GR.format(q=q, r=(r or '')[:5000], a=a)}],
                    max_tokens=400, temperature=0.0, extra_body={'chat_template_kwargs': {'enable_thinking': False}}).choices[0].message
            t = (m.content or '').strip() or (getattr(m, 'reasoning_content', '') or '')
            mm = re.findall(r'correct.{0,3}(yes|no)', t, re.I); return bool(mm) and mm[-1].lower() == 'yes'
        except Exception: time.sleep(2)
    return False
summary = []
for tag in READERS:
    for ds in DSS:
        for c in CONDS:
            p = f'{IN}/res_{ds}_{tag}_{c}.jsonl'
            if not os.path.exists(p): continue
            rows = [json.loads(l) for l in open(p)]
            if ds == 'fanoutqa':
                acc = 100 * sum(x.get('loose', 0) for x in rows) / max(1, len(rows))
            else:
                outp = f'{OUTS}/j_{ds}_{tag}_{c}.jsonl'
                if os.path.exists(outp): res = [json.loads(l) for l in open(outp)]
                else:
                    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
                        futs = {ex.submit(judge, x['question'], x['final_answer'], x['gold_answer']): x for x in rows}
                        res = []
                        with open(outp, 'w') as f:
                            for ft in as_completed(futs):
                                x = futs[ft]; x['correct'] = ft.result(); res.append(x); f.write(json.dumps({'query_id': x['query_id'], 'correct': x['correct']}) + '\n')
                acc = 100 * sum(x['correct'] for x in res) / max(1, len(res))
            tc = sum(x['tool_calls'] for x in rows) / max(1, len(rows))
            s = {'reader': tag, 'ds': ds, 'cond': c, 'n': len(rows), 'acc': round(acc, 2), 'tools': round(tc, 3)}
            summary.append(s); print('JUDGED ' + json.dumps(s), flush=True)
json.dump(summary, open(f'{IN}/xmodel_summary.json', 'w'), indent=2)
print('JUDGE_ALL_DONE', flush=True)
