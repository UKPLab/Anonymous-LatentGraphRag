"""The README's quick start, run end to end with a hashed fake encoder and a scripted chat model."""

import hashlib

import numpy as np
import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("rdr")

from latentgraphrag import (PAPER, BrowseCompGrader, DenseSearchTool, LatentGraphRAG, MemoryInventory, ReActAgent,
                            Seed, propositions, triples)
from latentgraphrag.agent import ChatResult

DIM = 32


def _vec(text):
    v = np.random.default_rng(int(hashlib.sha256(text.encode()).hexdigest()[:16], 16)).standard_normal(DIM)
    return (v / np.linalg.norm(v)).astype(np.float32)


class HashEncoder:
    class tokenizer:  # noqa: N801 - mimics a tokenizer attribute
        @staticmethod
        def encode(text, add_special_tokens=False):
            return text.split()

    def encode_queries(self, texts, batch_size=None, show_progress_bar=False):
        return torch.from_numpy(np.stack([_vec(t) for t in texts]))

    encode_documents = encode_queries

    def truncate(self, text, max_tokens):
        return text


class ScriptedLLM:
    """Answers the agent directly; grades every answer as correct."""

    def chat(self, messages, *, max_tokens, temperature, frequency_penalty=0.0):
        if "[correct_answer]" in messages[-1]["content"] or "correct_answer" in messages[-1]["content"]:
            return ChatResult(text="extracted_final_answer: Paris\nreasoning: same\ncorrect: yes\nconfidence: 90%")
        return ChatResult(text="The capital is known.\nExact Answer: Paris")


def test_readme_quickstart_runs(tmp_path):
    documents = {f"d{i}": f"document {i} about topic {i % 7} and place {i % 5}" for i in range(60)}
    records = [{"idx": f"c{i}", "extracted_triples": [[f"entity {i}", "located in", f"place {i % 5}"]]} for i in range(60)]
    chunk_to_doc = {f"c{i}": f"d{i}" for i in range(60)}
    tri = triples.from_openie(records, source_of=chunk_to_doc)
    pro = propositions.from_records([{"idx": f"c{i}", "propositions": [f"Entity {i} is a place."]} for i in range(60)],
                                    source_of=chunk_to_doc)
    inventory = MemoryInventory.union(tri, pro)
    assert inventory.stats()["memories"] == 120

    lgr = LatentGraphRAG(HashEncoder(), config=PAPER, index_device="cpu", inflight=1)
    index = lgr.build(documents, inventory, show_progress_bar=False)
    question = "Which place is entity 3 located in?"
    result = lgr.search([question], index, k=10)[0]
    assert len(result.ranking) == 10 and set(result.ids) <= set(documents)

    path = tmp_path / "lgr_index"
    index.save(str(path))
    reloaded = lgr.load_index(str(path))
    assert reloaded.doc_of == index.doc_of and reloaded.documents.ids == index.documents.ids
    assert reloaded.inventory.to_map() == inventory.to_map() and reloaded.inventory.kinds == inventory.kinds
    for view in ("D+M", "D", "M", "J"):  # saved embeddings are float16, so scores move by rounding only
        a, b = lgr.search([question], reloaded, k=10, view=view)[0], lgr.search([question], index, k=10, view=view)[0]
        assert a.ids == b.ids
        assert [s for _, s in a.ranking] == pytest.approx([s for _, s in b.ranking], abs=2e-3)

    ids = list(documents)
    search_tool = DenseSearchTool(np.stack([_vec(documents[d]) for d in ids]), [documents[d] for d in ids], ids,
                                  query_encoder=_vec)
    llm = ScriptedLLM()
    trajectory = ReActAgent(llm, search_tool).run(question, Seed.from_ranking(result.ids, documents))
    assert trajectory.final_answer.strip() == "Paris" and trajectory.tool_calls == 0
    verdict = BrowseCompGrader(llm).grade(question, trajectory.output, "Paris")
    assert verdict.correct is True
