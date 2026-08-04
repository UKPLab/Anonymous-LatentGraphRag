import PrevNext from "@/components/Docs/PrevNext";

export const metadata = {
  title: "API · Encoders — LatentGraphRAG",
  description: "BaseEncoder ABC and the four bundled encoder backends.",
};

const ENCODERS = [
  {
    name: "GritHopperEncoder",
    import: "from latentgraphrag.encoders.grithopper import GritHopperEncoder",
    extra: "pip install latentgraphrag[gritlm]",
    desc: "The default encoder. Wraps `gritlm.GritLM` with multi-hop query / document instructions. Outputs L2-normalized float32.",
    defaultsTo: '"GritHopper-7B"',
    badge: "default",
  },
  {
    name: "OpenAIEncoder",
    import: "from latentgraphrag.encoders.openai import OpenAIEncoder",
    extra: "pip install latentgraphrag[openai]",
    desc: "Calls the OpenAI embeddings API (or any compatible endpoint via base_url). Defaults to text-embedding-3-large.",
    defaultsTo: '"text-embedding-3-large"',
    badge: "API",
  },
  {
    name: "NVEmbedV2Encoder",
    import: "from latentgraphrag.encoders.nvembed import NVEmbedV2Encoder",
    extra: "pip install latentgraphrag[nvembed]",
    desc: "NV-Embed-v2 as the encoder. Uses HuggingFace transformers; supports bfloat16 / float16 inference.",
    defaultsTo: '"nvidia/NV-Embed-v2"',
    badge: "baseline",
  },
];

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
        Encoders
      </h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-6">
        A tiny ABC plus four bundled backends. Encoders are pluggable — anything
        implementing the
        <code className="font-mono"> BaseEncoder</code> interface composes with every
        corpus mode, search strategy, and fusion method.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        <code className="font-mono">BaseEncoder</code>
      </h2>
      <CodeBlock>{`from abc import ABC, abstractmethod
from typing import List, Optional
import numpy as np

class BaseEncoder(ABC):
    dim: int
    normalize: bool = True

    @abstractmethod
    def encode(
        self,
        texts: List[str],
        *,
        instruction: Optional[str] = None,
        is_query: bool = False,
    ) -> np.ndarray:
        """Return an (N, dim) float32 array. L2-normalized if self.normalize."""

    def encode_one(self, text: str, *, instruction=None, is_query=False) -> np.ndarray:
        return self.encode([text], instruction=instruction, is_query=is_query)[0]`}</CodeBlock>
      <p className="text-gray-700 leading-7 my-4">
        Every encoder receives an optional <code className="font-mono text-sm">instruction</code>{" "}
        and an <code className="font-mono text-sm">is_query</code> flag so encoders that
        distinguish query vs. document roles (GritHopper, NV-Embed) can pick the right
        prompt. SBERT-style encoders ignore <code className="font-mono text-sm">is_query</code>.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        <code className="font-mono">load_encoder(spec)</code>
      </h2>
      <CodeBlock>{`from latentgraphrag.encoders import load_encoder

# Strings dispatch through this factory.
load_encoder("GritHopper-7B")           # -> GritHopperEncoder
load_encoder("text-embedding-3-large")         # -> OpenAIEncoder
load_encoder("nvidia/NV-Embed-v2")             # -> NVEmbedV2Encoder
load_encoder("hash")                           # -> HashEncoder (deterministic, for tests)
load_encoder("some/unknown-model")             # -> ValueError (implement BaseEncoder for custom)`}</CodeBlock>
      <p className="text-gray-700 leading-7 my-4">
        Dispatch is purely string-based. If you pass an
        already-constructed <code className="font-mono text-sm">BaseEncoder</code> it&apos;s
        returned unchanged.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Bundled encoders
      </h2>
      <div className="space-y-5">
        {ENCODERS.map((e) => (
          <div key={e.name} className="rounded-xl border border-gray-200 p-5 bg-white not-prose">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 font-mono text-base">{e.name}</h3>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {e.badge}
              </span>
            </div>
            <p className="text-sm text-gray-700 mb-3">{e.desc}</p>
            <div className="rounded-md bg-gray-950 px-3 py-2 mb-2">
              <code className="text-xs text-gray-100 font-mono whitespace-pre">{e.import}</code>
            </div>
            <div className="rounded-md bg-gray-100 px-3 py-2 mb-2">
              <code className="text-xs text-gray-700 font-mono whitespace-pre">{e.extra}</code>
            </div>
            <p className="text-[11px] text-gray-500">
              Default model: <code className="font-mono">{e.defaultsTo}</code>
            </p>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        Writing a custom multi-hop encoder
      </h2>
      <p className="text-gray-700 leading-7 my-4">
        LatentGraphRAG retrieval depends on <strong>multi-hop dense retrieval</strong>:
        at every hop the encoder receives the question concatenated with previously
        retrieved evidence. A custom encoder needs to handle that growing context
        well — that usually means a model trained for it, with explicit query /
        document role conditioning. Plain similarity encoders without role awareness
        tend to underperform here.
      </p>
      <CodeBlock>{`import numpy as np
from latentgraphrag.encoders.base import BaseEncoder

class MyMultiHopEncoder(BaseEncoder):
    dim = 768
    normalize = True

    def __init__(self, my_model):
        self._model = my_model

    def encode(self, texts, *, instruction=None, is_query=False):
        # Apply role-aware conditioning here — e.g. different instructions for
        # is_query=True vs is_query=False, or a context-aware adapter.
        vecs = self._model.encode(texts, is_query=is_query).astype(np.float32)
        return self._l2_normalize(vecs) if self.normalize else vecs

# Plug into the pipeline:
import latentgraphrag as lgr
rag = lgr.LatentGraphRAG(encoder=MyMultiHopEncoder(my_model), openie_llm="gpt-4o-mini")`}</CodeBlock>

      <PrevNext pathname="/docs/api/encoders" />
    </article>
  );
}
