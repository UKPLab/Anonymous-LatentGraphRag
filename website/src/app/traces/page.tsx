import type { Metadata } from "next";
import TopNav from "@/components/Docs/TopNav";
import TracesOverview from "@/components/Traces/TracesOverview";

export const metadata: Metadata = {
  title: "Trajectories — LatentGraphRAG",
  description:
    "The trajectories behind the paper's reader and agent tables: starting evidence, every search with what it returned, the final answer and its grade, for all MuSiQue and FanOutQA samples.",
};

export default function TracesPage() {
  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <TracesOverview />
    </div>
  );
}
