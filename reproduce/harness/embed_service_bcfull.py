# NOTE: released as run, with one change: the hard-coded cluster workspace path
# was replaced by the LGR_ROOT environment variable. Nothing else was modified.
import os
_W='${LGR_ROOT}/WorldModelHighRecall/.cache/hf'
os.environ.update({'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','HF_HUB_DISABLE_XET':'1','HF_HUB_ENABLE_HF_TRANSFER':'0','HF_HOME':_W,'HF_HUB_CACHE':_W,'TRANSFORMERS_CACHE':_W,'TMPDIR':'/tmp'})
import json,numpy as np,torch,faiss,threading
from transformers import AutoTokenizer,AutoModel
from fastapi import FastAPI,Request
import uvicorn
E=os.environ.get('LGR_ROOT', os.path.dirname(os.path.abspath(__file__)))
tok=AutoTokenizer.from_pretrained('Qwen/Qwen3-Embedding-8B')
mdl=AutoModel.from_pretrained('Qwen/Qwen3-Embedding-8B',dtype=torch.float16).cuda().eval()
lock=threading.Lock()
IDX={}
for ds in ['musique','fanoutqa','browsecomp']:
    p=os.environ.get('BC_INDEX_DIR') if (ds=='browsecomp' and os.environ.get('BC_INDEX_DIR')) else f'{E}/search_index/{ds}'
    if os.path.isfile(f'{p}/emb.npy'):
        emb=np.load(f'{p}/emb.npy').astype('float32'); docs=json.load(open(f'{p}/docs.json'))
        ix=faiss.IndexFlatIP(emb.shape[1]); ix.add(emb); IDX[ds]=(ix,docs); print(f'faiss {ds}: {emb.shape}',flush=True)
def embed(q):
    with lock:
        b=tok([q[:512]],padding=True,truncation=True,max_length=512,return_tensors='pt').to('cuda')
        with torch.no_grad(): h=mdl(**b).last_hidden_state[:,-1]; h=torch.nn.functional.normalize(h,dim=-1)
        return h.cpu().float().numpy()
app=FastAPI()
@app.get('/health')
def health(): return {'ok':True,'datasets':list(IDX.keys())}
@app.post('/search')
async def search(req:Request):
    d=await req.json(); ix,docs=IDX[d['dataset']]; v=embed(d['query']); D,I=ix.search(v,d.get('k',5))
    return {'docs':[docs[i][:2000] for i in I[0]]}
@app.post('/search2')
async def search2(req:Request):
    d=await req.json(); ix,docs=IDX[d['dataset']]; v=embed(d['query']); D,I=ix.search(v,d.get('k',5))
    return {'ids':[int(i) for i in I[0]],'scores':[float(x) for x in D[0]],'docs':[docs[i][:2000] for i in I[0]]}
print('SERVICE READY',flush=True)
uvicorn.run(app,host='0.0.0.0',port=8093,log_level='warning')
