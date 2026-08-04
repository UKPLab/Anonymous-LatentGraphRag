import PrevNext from "@/components/Docs/PrevNext";
import CombinationsMatrix from "@/components/Docs/demos/CombinationsMatrix";
import Link from "next/link";

export const metadata = {
  title: "Combinations Matrix · LatentGraphRAG",
  description: "Interactive picker for every valid (corpus × search × fusion) configuration.",
};

export default function Page() {
  return (
    <article className="prose-docs">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mt-2 mb-2">
        Combinations
      </h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-8">
        Pick a corpus mode, search strategy, and fusion. The matrix shows which
        configurations are valid (the validator rejects nonsensical ones) and renders the
        relevant animation. Same constraints as the runtime API — see{" "}
        <Link href="/docs/concepts/why-orthogonal" className="text-blue-600 underline">
          Why Orthogonal?
        </Link>{" "}
        for the design rationale.
      </p>

      <div className="not-prose">
        <CombinationsMatrix />
      </div>

      <PrevNext pathname="/docs/combinations" />
    </article>
  );
}
