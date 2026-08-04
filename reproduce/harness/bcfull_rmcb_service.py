#!/usr/bin/env python3
# NOTE: released as run, with one change: the hard-coded cluster workspace path
# was replaced by the LGR_ROOT environment variable. Nothing else was modified.
"""Reason-ModernColBERT late-interaction search service over the SAME search_index/{DS} corpus
that run2c uses (consistency), so the ReasonMCB-backend benchmark loop is comparable to the
Qwen-backend one. Encodes the corpus on-the-fly at startup, serves /search2 (MaxSim) + /doc on 8095."""
import os, json, torch
os.environ.setdefault('HF_HOME', '${LGR_ROOT}/WorldModelHighRecall/.cache/hf')
os.environ.update({'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1', 'HF_HUB_DISABLE_XET': '1'})
from fastapi import FastAPI, Request
import uvicorn
from pylate import models

E = os.environ['LGR_ROOT']
DS = os.environ.get('DS', 'musique'); DEV = 'cuda'; LCAP = 256; DOCCAP = 2200
DOCS = json.load(open(os.environ.get('IDXDIR', f'{E}/search_index/{DS}')+'/docs.json'))
texts = [ (d or '')[:DOCCAP] for d in DOCS ]; N0 = len(texts)
print(f'corpus {DS}: {N0} docs', flush=True)
model = models.ColBERT('lightonai/Reason-ModernColBERT', device=DEV, document_length=LCAP)
demb = []
for i in range(0, N0, 64):
    e = model.encode(texts[i:i+64], batch_size=64, is_query=False, convert_to_tensor=True, show_progress_bar=False)
    e = [e[j] for j in range(e.shape[0])] if isinstance(e, torch.Tensor) else e
    demb.extend([t.detach().to('cpu', torch.float16)[:LCAP] for t in e])
    if (i // 64) % 100 == 0: print(f'encoded {i}/{N0}', flush=True)
N = len(demb); dim = demb[0].shape[-1]; Lmax = min(LCAP, max(int(d.shape[0]) for d in demb))
D = torch.zeros(N, Lmax, dim, dtype=torch.float16, device=DEV); M = torch.zeros(N, Lmax, dtype=torch.bool, device=DEV)
for i, d in enumerate(demb):
    n = min(int(d.shape[0]), Lmax); D[i, :n] = d[:n].to(DEV); M[i, :n] = True
del demb; torch.cuda.empty_cache(); print(f'index ready {N}x{Lmax}x{dim}', flush=True)
app = FastAPI()
@app.get('/health')
def health(): return {'ok': True, 'ds': DS, 'n': N}
@app.post('/search2')
async def search2(req: Request):
    d = await req.json(); k = int(d.get('k', 5))
    qe = model.encode([d['query']], batch_size=1, is_query=True, convert_to_tensor=True)
    Q = (qe[0] if isinstance(qe, torch.Tensor) else qe[0]).to(DEV).half()
    sc = torch.empty(N, device=DEV); CH = 16384
    for s in range(0, N, CH):
        e = min(N, s + CH)
        sim = torch.einsum('qd,nld->qnl', Q, D[s:e]).masked_fill(~M[s:e].unsqueeze(0), -1e4)
        sc[s:e] = sim.max(dim=2).values.sum(dim=0)
    top = torch.topk(sc, min(k, N)); idx = top.indices.tolist()
    return {'ids': idx, 'scores': top.values.tolist(), 'docs': [texts[i][:2000] for i in idx]}
@app.post('/doc')
async def doc(req: Request):
    d = await req.json(); i = int(d['docid']); return {'text': texts[i] if 0 <= i < N else ''}
print('SERVICE READY', flush=True)
uvicorn.run(app, host='0.0.0.0', port=8095, log_level='warning')
