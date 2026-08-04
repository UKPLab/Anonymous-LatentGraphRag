#!/usr/bin/env python3
# NOTE: released as run, with one change: the hard-coded cluster workspace path
# was replaced by the LGR_ROOT environment variable. Nothing else was modified.
import json, os, re, time, threading, glob, sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI
E=os.environ.get('LGR_ROOT', os.path.dirname(os.path.abspath(__file__)))
BUNDLES=f'{E}/bundles'; OUT=f'{E}/results_unified'; os.makedirs(OUT,exist_ok=True)
MODEL='Qwen/Qwen3.5-122B-A10B'; client=OpenAI(base_url='http://localhost:8000/v1',api_key='x',timeout=600)
WORKERS=int(os.environ.get('WORKERS','48')); LIMIT=int(os.environ.get('LIMIT','0'))
DATASETS=os.environ.get('DATASETS','musique,fanoutqa').split(',')
GRADER="""Judge whether the [response] to [question] is correct based on the precise [correct_answer].
[question]: {q}
[response]: {r}
[correct_answer]: {a}
Reply with a final line exactly: correct: yes  OR  correct: no""".strip()
def gen(msgs, mt=256, think=False, fp=0.5):
    for _ in range(3):
        try:
            m=client.chat.completions.create(model=MODEL,messages=msgs,max_tokens=mt,temperature=0.0,
                frequency_penalty=fp,extra_body={'chat_template_kwargs':{'enable_thinking':think}}).choices[0].message
            c=(m.content or '').strip()
            return c or ((getattr(m,'reasoning_content','') or '').strip())
        except Exception: time.sleep(3)
    return ''
def reader_msgs(q, seed):
    sysm=("Use the documents to answer the question. You may briefly justify using the evidence, "
          "then end with a line exactly: 'Exact Answer: <your single best answer>'. If unsure, give your best guess.")
    if not seed: user=f"Question: {q}"
    else:
        docs="\n\n".join(f"[{i+1}] {d.get('text','')}" for i,d in enumerate(seed))
        user=f"Documents:\n{docs}\n\nQuestion: {q}"
    return [{"role":"system","content":sysm},{"role":"user","content":user}]
def judge(q,resp,ans):
    jr=gen([{"role":"user","content":GRADER.format(q=q,r=resp[:6000],a=ans)}],mt=512,think=False,fp=0.0)
    ms=re.findall(r"correct\**:?\s*[\"']?(yes|no)",jr,re.I)
    return bool(ms) and ms[-1].lower()=="yes"
def astr(a): return '; '.join(a) if isinstance(a,list) else str(a)
stages={}; lock=threading.Lock()
def wp(): json.dump({'stages':list(stages.values()),'updated_at':time.time()},open(f'{OUT}/progress.json','w'))
def run_cell(ds,cond,path):
    rows=[json.loads(l) for l in open(path)]
    if LIMIT: rows=rows[:LIMIT]
    key=f'{ds}/{cond}'; total=len(rows); done=[0]; res=[]
    def work(o):
        seed=None if cond=='closed_book' else (o.get('seed') or None)
        resp=gen(reader_msgs(o['question'],seed),mt=400,think=False,fp=0.5)
        return {'query_id':o['query_id'],'correct':judge(o['question'],resp,astr(o['answer'])),'response':resp[-400:]}
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs=[ex.submit(work,o) for o in rows]
        with open(f'{OUT}/res_{ds}_{cond}.jsonl','w') as f:
            for fut in as_completed(futs):
                r=fut.result(); res.append(r); f.write(json.dumps(r)+'\n')
                done[0]+=1
                if done[0]%10==0 or done[0]==total:
                    with lock: stages[key]={'name':f'{ds}/{cond}','n':done[0],'total':total,'unit':'samples','done':1 if done[0]==total else 0}; wp()
    acc=sum(1 for r in res if r['correct'])/max(1,len(res))*100
    print(f'[{key}] n={len(res)} acc={acc:.1f}%',flush=True); return acc
cells=[]
for ds in DATASETS:
    for p in sorted(glob.glob(f'{BUNDLES}/{ds}/seed_*.jsonl')):
        cells.append((ds, os.path.basename(p)[5:-6], p))
for ds,cond,p in cells: stages[f'{ds}/{cond}']={'name':f'{ds}/{cond}','n':0,'total':0,'unit':'samples','done':0}
wp()
summary={}
for ds,cond,p in cells:
    summary.setdefault(ds,{})[cond]=run_cell(ds,cond,p); json.dump(summary,open(f'{OUT}/summary.json','w'),indent=2)
print('DONE',json.dumps(summary),flush=True)
