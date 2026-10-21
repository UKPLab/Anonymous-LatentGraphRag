/**
 * Showcase code shared by the docs pages. `#@ Label` marks a step: highlighted and labelled on the page,
 * removed from the copied code (see HighlightedCode). The calls follow the package README.
 */

export const QUICKSTART = `from latentgraphrag import (
    PAPER, LatentGraphRAG, MemoryInventory, propositions, triples,
    BrowseCompGrader, DenseSearchTool, OpenAIChatModel, ReActAgent, Seed)

# 1. constructed knowledge: one memory index, triples + propositions
openie = triples.load_openie("openie.jsonl.gz")       # HippoRAG format
tri = triples.from_openie(openie, source_of=chunk_to_doc)             #@ Triples
records = propositions.load_records("proprag_openie.json")  # PropRAG
pro = propositions.from_records(records, source_of=chunk_to_doc)      #@ Propositions
inventory = MemoryInventory.union(tri, pro)  # provenance merged      #@ Inventory

# 2. two recursive trees on RDR, fused at the source
lgr = LatentGraphRAG("path/to/rdr-checkpoint", config=PAPER)          #@ Model
index = lgr.build(documents, inventory)      # documents: {doc id: text}  #@ Index
result = lgr.search([question], index, k=10)[0]                       #@ Search
result.ranking                               # [(doc id, score), ...]

# 3. a ReAct agent seeded with the ranking, graded as in the paper
llm = OpenAIChatModel(model="Qwen/Qwen3.5-122B-A10B",                 #@ LLM
                      base_url="http://localhost:8000/v1")
agent = ReActAgent(llm, DenseSearchTool(embeddings, texts, ids))      #@ Agent
seed = Seed.from_ranking(result.ids, documents)   # top 10 documents  #@ Seed
trajectory = agent.run(question, seed)                                #@ Agent
verdict = BrowseCompGrader(llm).grade(question, trajectory.output,    #@ Grade
                                      gold_answer)`;

export const INSTALL = `# RDR first: download it from its anonymous repository
pip install -e ./Recursive-Dense-Retrieval                                  #@ RDR
# then this package, with the ReAct agent's dependencies
pip install -e ".[agent]"                                                   #@ Package
# optional: HippoRAG's OpenIE for extracting triples
pip install -e ".[construction]"                                            #@ Extras
# check: the quick start with a fake encoder and a scripted chat model
pytest tests/test_quickstart.py                                             #@ Check`;

/* ---------------------------------------------------------------- /docs/indexing */

export const IDX_CORPUS = `import json

documents = {}                                   # {document id: text}
with open("corpus.jsonl") as f:                                       #@ Corpus
    for line in f:
        record = json.loads(line)
        documents[record["id"]] = record["text"]

# chunked corpus: one entry per chunk, and the document id of each
chunks = {"d1#0": "…", "d1#1": "…", "d2#0": "…"}                      #@ Chunks
groups = ["d1", "d1", "d2"]     # lgr.build(chunks, ..., groups=groups)`;

export const IDX_EXTRACT = `from latentgraphrag import propositions, triples

# triples: HippoRAG's OpenIE (pip install -e ".[construction]")
tri_records = triples.extract_with_hipporag(                          #@ Triples
    documents, llm_name="Qwen/Qwen3-Next-80B-A3B-Instruct",
    llm_base_url="http://localhost:8000/v1", save_dir="openie_cache")

# propositions: PropRAG's own extraction, from a local PropRAG checkout
prop_records = propositions.extract_with_proprag(                     #@ Propositions
    documents, llm_name="Qwen/Qwen3.5-27B",
    llm_base_url="http://localhost:8001/v1", save_dir="proprag_cache",
    proprag_root="path/to/PropRAG")

# each record's idx is the document id it was extracted from
tri = triples.from_openie(tri_records)                                #@ Memories
pro = propositions.from_records(prop_records)                         #@ Memories`;

export const IDX_LOAD_KNOWLEDGE = `from latentgraphrag import chunk_id, propositions, triples

# outputs keyed by chunk id, e.g. the HippoRAG 2 / PropRAG releases
chunk_to_doc = {chunk_id(title, text): doc_id                         #@ Ids
                for doc_id, (title, text) in titled_passages.items()}
openie = triples.load_openie("openie_results.json")
tri = triples.from_openie(openie, source_of=chunk_to_doc)             #@ Triples
records = propositions.load_records("proprag_openie.json")
pro = propositions.from_records(records, source_of=chunk_to_doc)      #@ Propositions`;

export const IDX_INVENTORY = `from latentgraphrag import MemoryInventory

inventory = MemoryInventory.union(tri, pro)  # provenance merged      #@ Inventory
inventory.stats()      # counts: memories, triple, proposition, sources
inventory.save_jsonl("memories.jsonl")                                #@ Save
inventory = MemoryInventory.load_jsonl("memories.jsonl")              #@ Load

triples_only = inventory.select("triple")         # or "proposition"`;

export const IDX_MEMORIES_FILE = `{"text": "Erik Jensen was born in Appleton.", "sources": ["musique_008960"], "kind": "triple"}
{"text": "Erik Jensen was born on October 11, 1980, in Appleton, Wisconsin.", "sources": ["musique_008960"], "kind": "proposition"}`;

export const IDX_ENCODE = `from latentgraphrag import PAPER, LatentGraphRAG

lgr = LatentGraphRAG("path/to/rdr-checkpoint", config=PAPER)          #@ Model
index = lgr.build(documents, inventory,                               #@ Index
                  cache_dir="cache/my-corpus")  # chunked: groups=groups
index.save("lgr_index")                                               #@ Save`;

export const IDX_LAYOUT = `lgr_index/
├── lgr_index.json      format, document ids, doc_of, whether memories exist
├── inventory.jsonl     one {"text", "sources", "kind"} record per memory
├── documents/          RDR index over the documents (or chunks)
│   ├── embeddings.npy  float16, one row per entry
│   ├── index.json      ids, groups, n, dim
│   └── texts.jsonl     the texts, one JSON string per line
└── memories/           RDR index over the memory texts, same files`;

export const IDX_REUSE = `from latentgraphrag import PAPER, LatentGraphRAG

lgr = LatentGraphRAG("path/to/rdr-checkpoint", config=PAPER)          #@ Model
index = lgr.load_index("lgr_index")      # nothing is encoded again    #@ Load

results = lgr.search(questions, index, k=10)   # one result per question  #@ Search
result = results[0]
result.ranking        # [(doc id, score), ...], best first
result.ids            # the document ids alone
result.views["D"]     # document view, {doc id: score}
result.views["M"]     # memory view projected to documents

documents_only = lgr.search(questions, index, k=10, view="D")         #@ Search`;

export const IDX_AGENT = `import numpy as np
from latentgraphrag import (
    BrowseCompGrader, DenseSearchTool, OpenAIChatModel, ReActAgent, Seed)

# the agent's own search index: plain embeddings, stored once as .npy
ids = list(documents)
emb = np.load("agent_index/embeddings.npy")   # (N, d), order of ids
tool = DenseSearchTool(emb, [documents[d] for d in ids], ids)         #@ Tool
llm = OpenAIChatModel(model="Qwen/Qwen3.5-122B-A10B",                 #@ LLM
                      base_url="http://localhost:8000/v1")
agent = ReActAgent(llm, tool)                     # at most 10 searches #@ Agent
grader = BrowseCompGrader(llm)                                        #@ Grade

for question, result, gold in zip(questions, results, answers):
    seed = Seed.from_ranking(result.ids, documents)   # top 10        #@ Seed
    trajectory = agent.run(question, seed)                            #@ Agent
    verdict = grader.grade(question, trajectory.output, gold)         #@ Grade
    print(trajectory.tool_calls, trajectory.final_answer, verdict.correct)`;

export const IDX_AGENT_INDEX = `import numpy as np
# sentence-transformers is not a dependency of latentgraphrag
from sentence_transformers import SentenceTransformer

encoder = SentenceTransformer("Qwen/Qwen3-Embedding-8B")
emb = encoder.encode([documents[d] for d in ids], normalize_embeddings=True)
np.save("agent_index/embeddings.npy", emb)`;
