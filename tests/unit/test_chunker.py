from latentgraphrag.graph.chunker import TokenChunker


def test_basic_chunking_produces_chunks():
    text = "alpha beta gamma " * 200
    chunker = TokenChunker(chunk_size=64, chunk_overlap=8)
    chunks = chunker.split(text, doc_id="doc-1")
    assert len(chunks) >= 2
    for c in chunks:
        assert c.doc_id == "doc-1"
        assert c.hash_id.startswith("chunk-")
        assert c.text


def test_overlap_must_be_smaller_than_size():
    import pytest

    with pytest.raises(ValueError):
        TokenChunker(chunk_size=64, chunk_overlap=64)


def test_split_many_assigns_unique_doc_ids():
    chunker = TokenChunker(chunk_size=32, chunk_overlap=4)
    chunks = chunker.split_many(["alpha " * 100, "beta " * 100])
    doc_ids = {c.doc_id for c in chunks}
    assert len(doc_ids) == 2
