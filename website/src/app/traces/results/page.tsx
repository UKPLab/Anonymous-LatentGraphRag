import type { Metadata } from "next";
import { Suspense } from "react";
import TopNav from "@/components/Docs/TopNav";
import TraceViewer from "@/components/Traces/TraceViewer";

export const metadata: Metadata = {
  title: "Trajectory viewer — LatentGraphRAG",
  description:
    "Browse every evaluation trajectory: injected seed, reasoning and observation steps, retrieved documents with gold labels, final answer and judge verdict.",
};

export default function TraceResultsPage() {
  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      {/* useSearchParams needs a Suspense boundary under static export */}
      <Suspense
        fallback={
          <div className="max-w-screen-2xl mx-auto px-4 py-10 text-sm text-gray-500">
            Loading viewer…
          </div>
        }
      >
        <TraceViewer />
      </Suspense>
    </div>
  );
}
