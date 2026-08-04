import PrevNext from "@/components/Docs/PrevNext";

export const metadata = {
  title: "API · Evaluation — LatentGraphRAG",
  description: "Recall@K and QA exact-match / F1 metrics.",
};

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="my-5 rounded-xl border border-gray-200 bg-gray-950 overflow-hidden not-prose">
      <div className="px-4 py-2 border-b border-gray-800 bg-gray-900 text-xs text-gray-400 font-mono">
        {title ?? "python"}
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-gray-100 font-mono text-[13px] leading-6 whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

export default function Page() {
  return (
    <article className="prose-docs">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mt-2 mb-2">
        Evaluation
      </h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        Three small functions for the standard retrieval + QA evaluation loop. Use them
        directly on the output of <code className="font-mono">retrieve()</code>.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        <code className="font-mono">recall_at_k(retrieved, gold, k)</code>
      </h2>
      <CodeBlock>{`from latentgraphrag.evaluation import recall_at_k

def recall_at_k(
    retrieved: Sequence[Sequence[str]],
    gold:      Sequence[Iterable[str]],
    k: int,
) -> float:
    """Macro-averaged Recall@K.

    For each query, fraction of gold docs appearing in the top-k retrieved. Then mean
    across queries (queries with empty gold sets are skipped).
    """`}</CodeBlock>
      <p className="text-gray-700 leading-7 my-4">
        The headline retrieval metric. Note that this is{" "}
        <strong>macro-averaged</strong> (per-query, then averaged) — micro-averaging
        would weight queries with many gold docs more.
      </p>
      <CodeBlock title="example">{`from latentgraphrag.evaluation import recall_at_k

retrieved = [
    ["doc-1", "doc-9", "doc-3", "doc-5"],   # query 1
    ["doc-7", "doc-2"],                      # query 2
]
gold = [
    ["doc-1"],            # query 1: 1 gold doc, found at rank 1 -> 1.0
    ["doc-2", "doc-99"],  # query 2: 2 gold docs, 1 in top-5     -> 0.5
]
print(recall_at_k(retrieved, gold, k=5))     # 0.75`}</CodeBlock>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        <code className="font-mono">qa_exact_match(prediction, gold_answers)</code>
      </h2>
      <CodeBlock>{`from latentgraphrag.evaluation import qa_exact_match

def qa_exact_match(prediction: str, gold_answers: Iterable[str]) -> float:
    """1.0 if normalized prediction matches any normalized gold answer, else 0.0.

    Normalization: lowercase, strip punctuation, strip articles (a/an/the), whitespace.
    """`}</CodeBlock>
      <p className="text-gray-700 leading-7 my-4">
        Returns a float (0 or 1) so you can macro-average over queries:
        <code className="font-mono"> mean([qa_exact_match(p, g) for p, g in zip(preds, golds)])</code>.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        <code className="font-mono">qa_f1(prediction, gold_answers)</code>
      </h2>
      <CodeBlock>{`from latentgraphrag.evaluation import qa_f1

def qa_f1(prediction: str, gold_answers: Iterable[str]) -> float:
    """Best token-level F1 across all gold answers.

    Tokenization: whitespace after the SQuAD-style normalization used by EM.
    """`}</CodeBlock>
      <p className="text-gray-700 leading-7 my-4">
        The token-level F1 is computed per gold answer and the maximum is returned.
        This matches the SQuAD evaluation convention.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        End-to-end pattern
      </h2>
      <CodeBlock>{`from latentgraphrag.evaluation import recall_at_k, qa_exact_match, qa_f1

# 1. Retrieve.
results = rag.retrieve(queries, corpus="dual_tree", search="full_expansion",
                       fusion="agreement", k=10)
retrieved = [r.documents for r in results]

# 2. Retrieval metrics.
r5  = recall_at_k(retrieved, gold_docs,  k=5)
r10 = recall_at_k(retrieved, gold_docs,  k=10)

# 3. Optional: end-to-end QA.
predictions = [your_reader(q, r.documents) for q, r in zip(queries, results)]
em = sum(qa_exact_match(p, g) for p, g in zip(predictions, gold_answers)) / len(predictions)
f1 = sum(qa_f1(p, g)         for p, g in zip(predictions, gold_answers)) / len(predictions)

print(f"R@5={r5:.3f}  R@10={r10:.3f}  EM={em:.3f}  F1={f1:.3f}")`}</CodeBlock>

      <PrevNext pathname="/docs/api/evaluation" />
    </article>
  );
}
