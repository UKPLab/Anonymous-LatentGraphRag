import Header from "@/components/Header/Header";
import TopNav from "@/components/Docs/TopNav";
import SectionNav from "@/components/Landing/SectionNav";
import PerformanceBarChart from "@/components/Charts/PerformanceBarChart";
import StaticGraphProblemSection from "@/components/StaticGraphProblem/StaticGraphProblemSection";
import DecompositionFreeSection from "@/components/DecompositionFree/DecompositionFreeSection";
import KnowledgeGraphAnimation from "@/components/KnowledgeGraph/KnowledgeGraphAnimation";
import UnifiedDualTreeSection from "@/components/DualTree/UnifiedDualTreeSection";
import AgenticRagSection from "@/components/Agentic/AgenticRagSection";
import AblationResults from "@/components/Ablation/AblationResults";
import GroundTruthTripletSection from "@/components/GroundTruth/GroundTruthTripletSection";
import LatentSolutionSection from "@/components/LatentSolution/LatentSolutionSection";
import BibtexSection from "@/components/Citation/BibtexSection";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Persistent sticky chrome shared with the docs site so the whole thing
          feels like one place, not two. */}
      <TopNav />

      {/* Floating left-rail section nav. Fixed-position and only visible at ≥1440px,
          so it sits in the gutter and never narrows the content/animations. */}
      <SectionNav />

      {/* Each row gets an `id` + `scroll-mt-24` so the floating nav can deep-link to it
          without the sticky 56px TopNav covering the heading. The id'd wrappers are
          full-width and add no padding, so section/animation widths are unchanged. */}

      {/* Row 0: Header */}
      <div id="overview" className="scroll-mt-24">
        <Header />
      </div>

      {/* Row 1: Problem motivation — static KGs have missing edges and missing nodes */}
      <div id="problem" className="scroll-mt-24">
        <StaticGraphProblemSection />
      </div>

      {/* Row 2: GRITHopper — state-of-the-art multi-hop dense retriever, tree over documents
                 Now includes the Latent Graph Similarity Panel showing continuous dot-product
                 connections over all documents at each hop */}
      <div id="retrieval" className="scroll-mt-24">
        <DecompositionFreeSection />
      </div>

      {/* Row 3: Incorporating knowledge graphs — verbalize edges as searchable memories */}
      <div id="memories" className="scroll-mt-24">
        <KnowledgeGraphAnimation />
      </div>

      {/* Row 4: Dual tree search + document-memory agreement over both indices */}
      <div id="dual-tree" className="scroll-mt-24">
        <UnifiedDualTreeSection />
      </div>

      {/* Row 5: Results — quantitative comparison against all baselines
                 Placed after the full method explanation so readers understand
                 what each number means */}
      <section id="results" className="scroll-mt-24 py-12 px-4 bg-white">
        <PerformanceBarChart />
      </section>

      {/* Row 5b: Agentic RAG — the downstream efficiency result. Sits right after
                 the retrieval numbers, because it is what those numbers buy. */}
      <section id="agentic" className="scroll-mt-24">
        <AgenticRagSection />
      </section>

      {/* Row 6: Ablation — how to best combine retrieval indices (joint, RRF, agreement) */}
      <section id="ablations" className="scroll-mt-24 py-12 px-4 bg-white">
        <AblationResults />
      </section>

      {/* Row 7: How Latent Graph RAG resolves the static-KG limitations —
                 placed here so the reader already understands documents + memories together */}
      <div id="solution" className="scroll-mt-24">
        <LatentSolutionSection />
      </div>

      {/* Row 8: Upper-bound analysis — why documents help even with perfect oracle triplets.
                 Serves as empirical proof for the claims made in LatentSolutionSection */}
      <div id="upper-bound" className="scroll-mt-24">
        <GroundTruthTripletSection />
      </div>

      {/* Row 9: BibTeX */}
      <section id="citation" className="scroll-mt-24 py-12 px-4 bg-gray-50">
        <BibtexSection />
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 bg-gray-100 border-t border-gray-200">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-600 mb-2">
            LatentGraphRAG: Overcoming the Missing-Edge Problem in Knowledge Graphs with Recursive Dense Retrieval
          </p>
          <p className="text-xs text-gray-500">
            Anonymous ACL submission — author information withheld for review
          </p>
        </div>
      </footer>
    </main>
  );
}
