# NOTE: released as run, with one change: the hard-coded cluster workspace path
# was replaced by the LGR_ROOT environment variable. Nothing else was modified.
import json, sys, numpy as np, os, torch
from transformers import AutoTokenizer, AutoModel
ds=sys.argv[1]; OUT=f'${LGR_ROOT}/search_index/{ds}'; os.makedirs(OUT,exist_ok=True)
# load corpus docs (title\ntext) per dataset
def load():
    if ds=='musique':
        c=json.load(open('${LGR_ROOT}/corpora/musique_corpus.json'))
        return [(d.get('title','')+'\n'+d.get('text','')) for d in c]
    if ds=='fanoutqa':
        c=json.load(open('${LGR_ROOT}/corpora/fanoutqa_dev_corpus.json'))
        return [(d.get('title','')+'\n'+d.get('text','')) for d in c]
    # browsecomp: docid->text from decrypted
    d2t={}
    for l in open('${LGR_ROOT}/BrowseCompData/data/browsecomp_plus_decrypted.jsonl'):
        o=json.loads(l)
        for fld in ('gold_docs','negative_docs','evidence_docs'):
            for doc in (o.get(fld) or []):
                if isinstance(doc,dict) and 'docid' in doc: d2t[str(doc['docid'])]=doc.get('text','')
    return list(d2t.values())
docs=load(); print(ds,'docs',len(docs),flush=True)
tok=AutoTokenizer.from_pretrained('Qwen/Qwen3-Embedding-8B'); mdl=AutoModel.from_pretrained('Qwen/Qwen3-Embedding-8B',torch_dtype=torch.float16).cuda().eval()
def emb(texts,bs=32):
    out=[]
    for i in range(0,len(texts),bs):
        b=tok([t[:1500] for t in texts[i:i+bs]],padding=True,truncation=True,max_length=512,return_tensors='pt').to('cuda')
        with torch.no_grad(): h=mdl(**b).last_hidden_state[:,-1]; h=torch.nn.functional.normalize(h,dim=-1)
        out.append(h.cpu().float().numpy())
        if i%3200==0: print(ds,i,'/',len(texts),flush=True)
    return np.concatenate(out)
E=emb(docs); np.save(f'{OUT}/emb.npy',E)
json.dump(docs,open(f'{OUT}/docs.json','w'))
print(ds,'encoded',E.shape,flush=True)
