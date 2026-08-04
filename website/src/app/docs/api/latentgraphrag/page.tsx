import PrevNext from "@/components/Docs/PrevNext";
import Link from "next/link";

export const metadata = {
  title: "API · LatentGraphRAG — class reference",
  description: "Constructor, build_graph, save, load, and the main retrieve method.",
};

const PARAMS_INIT = [
  { name: "encoder", type: "str | BaseEncoder | None", default: '"GritHopper-7B"', desc: 'HuggingFace id or a BaseEncoder instance. Strings dispatch through load_encoder. The default is GritHopper-7B.' },
  { name: "openie_llm", type: "str | BaseLLM | None", default: '"gpt-4o-mini"', desc: "LLM used for NER + triple extraction. Pass None to skip OpenIE (document-only mode)." },
  { name: "verbalizer_llm", type: "str | BaseLLM | None", default: '"gpt-4o-mini"', desc: "LLM used to turn each extracted triple into a sentence. Pass None to fall back to a template." },
  { name: "config", type: "LatentGraphRAGConfig | None", default: "None", desc: "Override the default configuration (chunk size, FAISS settings, batch size). See Config below." },
  { name: "chunker", type: "TokenChunker | None", default: "None", desc: "Bring your own chunker. Defaults to TokenChunker(chunk_size=512, chunk_overlap=50)." },
];

const PARAMS_BUILD_GRAPH = [
  { name: "documents", type: "List[str]", default: "—", desc: "The raw document texts to index." },
  { name: "save_dir", type: "str | None", default: "config.save_dir", desc: "Persistence root. All artifacts go here." },
  { name: "doc_ids", type: "List[str] | None", default: "None", desc: "Optional explicit ids per document. Defaults to MD5 hash of document text." },
];

const PARAMS_FROM_DOCS = [
  { name: "documents", type: "List[str]", default: "—", desc: "Raw document texts." },
  { name: "encoder", type: "str | BaseEncoder | None", default: "config.encoder", desc: "Encoder spec; skipped OpenIE means no triple extraction." },
  { name: "save_dir", type: "str | None", default: "config.save_dir", desc: "Persistence root." },
  { name: "config", type: "LatentGraphRAGConfig | None", default: "None", desc: "Optional config override. openie_llm and verbalizer_llm are forced to None." },
];

const ATTRS = [
  { name: "config", type: "LatentGraphRAGConfig", desc: "The active configuration." },
  { name: "save_dir", type: "Path | None", desc: "Set after build_graph or load." },
  { name: "store", type: "GraphStore | None", desc: "The knowledge graph (igraph wrapper). None until build_graph completes." },
  { name: "chunks_index", type: "MemoryIndex | None", desc: "Parquet + FAISS index over chunk embeddings." },
  { name: "memories_index", type: "MemoryIndex | None", desc: "Parquet + FAISS index over relational-memory embeddings. None in document-only mode." },
  { name: "memories", type: "List[RelationalMemory]", desc: "Materialized list of all memories. Populated after build_graph." },
];

function ParamTable({ rows }: { rows: { name: string; type: string; default?: string; desc: string }[] }) {
  return (
    <div className="my-4 overflow-x-auto not-prose">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 font-semibold text-gray-900 w-44">Name</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-900 w-56">Type</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-900 w-40">Default</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-900">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-gray-100 align-top">
              <td className="px-4 py-2 font-mono text-blue-700 text-xs">{r.name}</td>
              <td className="px-4 py-2 font-mono text-gray-600 text-xs">{r.type}</td>
              <td className="px-4 py-2 font-mono text-gray-500 text-xs">{r.default ?? "—"}</td>
              <td className="px-4 py-2 text-gray-700 text-sm">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="my-5 rounded-xl border border-gray-200 bg-gray-950 overflow-hidden not-prose">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
        <span className="text-xs text-gray-400 font-mono">{title ?? "python"}</span>
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
        <code className="font-mono">LatentGraphRAG</code>
      </h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        The main pipeline class. SentenceTransformers-style: one constructor, a couple
        of stateful methods, and full save/load round-trip support.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Constructor
      </h2>
      <CodeBlock>{`class LatentGraphRAG:
    def __init__(
        self,
        *,
        encoder: Union[str, BaseEncoder, None] = None,
        openie_llm: Union[str, BaseLLM, None] = None,
        verbalizer_llm: Union[str, BaseLLM, None] = None,
        config: Optional[LatentGraphRAGConfig] = None,
        chunker: Optional[TokenChunker] = None,
    ) -> None`}</CodeBlock>
      <ParamTable rows={PARAMS_INIT} />

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Attributes
      </h2>
      <ParamTable rows={ATTRS.map((a) => ({ name: a.name, type: a.type, default: undefined, desc: a.desc }))} />

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        <code className="font-mono">build_graph(...)</code>
      </h2>
      <CodeBlock>{`def build_graph(
    self,
    documents: List[str],
    *,
    save_dir: Optional[str] = None,
    doc_ids: Optional[List[str]] = None,
) -> BuildResult`}</CodeBlock>
      <ParamTable rows={PARAMS_BUILD_GRAPH} />
      <p className="text-gray-700 leading-7 my-4">
        Returns a <code className="font-mono text-sm">BuildResult</code> with
        <code className="font-mono text-sm"> .chunks</code>, <code className="font-mono text-sm">.openie</code>,
        <code className="font-mono text-sm"> .memories</code>, <code className="font-mono text-sm">.store</code>.
        Side effects: writes <code className="font-mono text-sm">graph.picklez</code>,
        <code className="font-mono text-sm"> memories.parquet</code>,
        <code className="font-mono text-sm"> embeddings/chunks.parquet</code>,
        <code className="font-mono text-sm"> embeddings/memories.parquet</code>,
        and <code className="font-mono text-sm">manifest.json</code> to
        <code className="font-mono text-sm"> save_dir</code>.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        <code className="font-mono">from_documents(...)</code> · classmethod
      </h2>
      <CodeBlock>{`@classmethod
def from_documents(
    cls,
    documents: List[str],
    *,
    encoder: Union[str, BaseEncoder, None] = None,
    save_dir: Optional[str] = None,
    config: Optional[LatentGraphRAGConfig] = None,
) -> "LatentGraphRAG"`}</CodeBlock>
      <ParamTable rows={PARAMS_FROM_DOCS} />
      <p className="text-gray-700 leading-7 my-4">
        Convenience constructor for the document-only path. Skips OpenIE and
        verbalization entirely. Useful when you don&apos;t have or don&apos;t want a
        graph.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        <code className="font-mono">retrieve(...)</code>
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        The main retrieval entry point — see the dedicated{" "}
        <Link href="/docs/api/retrieve" className="text-blue-600 underline">
          retrieve() page
        </Link>{" "}
        for the full parameter table (it has 14 parameters across the three orthogonal
        axes).
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        <code className="font-mono">save(...)</code> / <code className="font-mono">load(...)</code>
      </h2>
      <CodeBlock>{`def save(self, save_dir: Optional[str] = None) -> None: ...

@classmethod
def load(
    cls,
    save_dir: str,
    *,
    config: Optional[LatentGraphRAGConfig] = None,
) -> "LatentGraphRAG"`}</CodeBlock>
      <p className="text-gray-700 leading-7 my-4">
        <code className="font-mono text-sm">save()</code> persists the graph, memories
        table, and manifest. Embedding parquets are written incrementally during{" "}
        <code className="font-mono text-sm">build_graph</code> and need not be saved
        again. <code className="font-mono text-sm">load()</code> re-opens an index in a
        fresh process and restores everything, including the manifest&apos;s
        encoder/openie ids.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Configuration
      </h2>
      <CodeBlock>{`from latentgraphrag import LatentGraphRAGConfig

@dataclass
class LatentGraphRAGConfig:
    encoder: str = "GritHopper-7B"
    openie_llm: Optional[str] = "gpt-4o-mini"
    verbalizer_llm: Optional[str] = "gpt-4o-mini"
    chunk_size: int = 512
    chunk_overlap: int = 50
    save_dir: str = "./lgrag_index"
    faiss_index_type: Literal["flat", "hnsw", "auto"] = "auto"
    faiss_device: str = "auto"
    normalize_embeddings: bool = True
    batch_size: int = 32`}</CodeBlock>
      <p className="text-gray-700 leading-7 my-4">
        A small dataclass, intentionally smaller than the legacy 30-field
        <code className="font-mono text-sm"> BaseConfig</code>. Search-time parameters
        live on the <code className="font-mono text-sm">retrieve()</code> call, not on
        the model.
      </p>

      <PrevNext pathname="/docs/api/latentgraphrag" />
    </article>
  );
}
