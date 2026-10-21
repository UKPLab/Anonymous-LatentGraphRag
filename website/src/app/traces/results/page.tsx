import type { Metadata } from "next";
import { Suspense } from "react";
import TopNav from "@/components/Docs/TopNav";
import TraceViewer from "@/components/Traces/TraceViewer";

export const metadata: Metadata = {
  title: "Trajectory viewer — LatentGraphRAG",
  description:
    "Browse the agent and reader trajectories: injected seed, reasoning and search steps, retrieved documents with gold labels, final answer and grade.",
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
