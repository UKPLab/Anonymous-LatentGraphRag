import gzip
import json

from latentgraphrag import MemoryInventory, chunk_id, propositions, triples


def test_triple_rendering_is_literal():
    assert triples.render("Paris", "capital of", "France") == "Paris capital of France."
    assert triples.render("  A ", "b\n\tc", " d.") == "A b c d."
    assert triples.render(" ", "", " ") is None


def test_triples_from_openie_cache(tmp_path):
    recs = [{"idx": "c1", "extracted_triples": [["A", "r", "B"], ["bad"], ["A", "r", "B"]]},
            {"idx": "c2", "extracted_triples": "[['A', 'r', 'B'], ['C', 's', 'D']]"},
            {"idx": "unknown", "extracted_triples": [["X", "y", "Z"]]}]
    path = tmp_path / "openie.jsonl.gz"
    with gzip.open(path, "wt") as f:
        for r in recs:
            f.write(json.dumps(r) + "\n")
    inv = triples.from_openie(triples.load_openie(path), source_of={"c1": "doc1", "c2": "doc2"})
    assert inv.texts == ["A r B.", "C s D."]
    assert inv.sources == [["doc1", "doc2"], ["doc2"]]
    assert set(inv.kinds) == {"triple"}


def test_openie_json_with_docs_key(tmp_path):
    path = tmp_path / "openie.json"
    path.write_text(json.dumps({"docs": [{"idx": "c1", "extracted_triples": [["A", "r", "B"]]}]}))
    assert triples.from_openie(triples.load_openie(path)).to_map() == {"A r B.": ["c1"]}


def test_propositions_from_records():
    recs = [{"idx": "c1", "propositions": [" The tower is in Paris. ", {"text": "It opened in 1889."}, ""]}]
    inv = propositions.from_records(recs)
    assert inv.texts == ["The tower is in Paris.", "It opened in 1889."]
    assert inv.kinds == ["proposition", "proposition"]


def test_union_merges_provenance_in_order(tmp_path):
    t = MemoryInventory.from_map({"A r B.": ["d1"], "C s D.": ["d2"]}, "triple")
    p = MemoryInventory.from_map({"A r B.": ["d3", "d1"], "A claim.": "d2"}, "proposition")
    u = MemoryInventory.union(t, p)
    assert u.to_map() == {"A r B.": ["d1", "d3"], "C s D.": ["d2"], "A claim.": ["d2"]}
    assert u.kinds == ["triple", "triple", "proposition"]
    assert u.stats() == {"memories": 3, "triple": 2, "proposition": 1, "sources": 3}
    for name in ("map.json.gz", "inv.jsonl"):
        path = tmp_path / name
        if name.endswith(".jsonl"):
            u.save_jsonl(path)
            assert MemoryInventory.load_jsonl(path).to_map() == u.to_map()
        else:
            u.save_map(path)
            assert MemoryInventory.load_map(path, "triple").to_map() == u.to_map()


def test_chunk_id_matches_the_openie_caches():
    import hashlib

    assert chunk_id("T", "body") == "chunk-" + hashlib.md5(b"T\nbody").hexdigest()
