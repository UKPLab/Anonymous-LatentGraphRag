import type { Metadata } from "next";
import TopNav from "@/components/Docs/TopNav";
import TracesOverview from "@/components/Traces/TracesOverview";

export const metadata: Metadata = {
  title: "Trajectories — LatentGraphRAG",
  description:
    "Every evaluation trajectory behind the paper: ReAct loops, cross-reader and cross-retriever runs, with the retrieved documents and the judge verdict for all samples.",
};

export default function TracesPage() {
  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <TracesOverview />
    </div>
  );
}
