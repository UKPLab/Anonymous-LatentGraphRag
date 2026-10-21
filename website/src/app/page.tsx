import Header from "@/components/Header/Header";
import TopNav from "@/components/Docs/TopNav";
import SectionNav from "@/components/Landing/SectionNav";
import StaticGraphProblemSection from "@/components/StaticGraphProblem/StaticGraphProblemSection";
import DecompositionFreeSection from "@/components/DecompositionFree/DecompositionFreeSection";
import KnowledgeGraphAnimation from "@/components/KnowledgeGraph/KnowledgeGraphAnimation";
import UnifiedDualTreeSection from "@/components/DualTree/UnifiedDualTreeSection";
import AgenticRagSection from "@/components/Agentic/AgenticRagSection";
import AblationResults from "@/components/Ablation/AblationResults";
import BibtexSection from "@/components/Citation/BibtexSection";
import RetrievalResultsSection from "@/components/Results/RetrievalResultsSection";
import RemovalSection from "@/components/Results/RemovalSection";
import { paperMeta } from "@/data/lgrPaper";

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

      {/* Row 1: Problem: graph pipelines depend on what extraction kept */}
      <div id="problem" className="scroll-mt-24">
        <StaticGraphProblemSection />
      </div>

      {/* Row 2: Backbone: Recursive Dense Retrieval (encoder, recursive update, readout) */}
      <div id="backbone" className="scroll-mt-24">
        <DecompositionFreeSection />
      </div>

      {/* Row 3: Constructed knowledge: literal triples and propositions with source links */}
      <div id="memories" className="scroll-mt-24">
        <KnowledgeGraphAnimation />
      </div>

      {/* Row 4: Document tree + memory tree, projection to sources, CombMNZ */}
      <div id="fusion" className="scroll-mt-24">
        <UnifiedDualTreeSection />
      </div>

      {/* Row 5: RQ1/RQ2: Table 1 and Table 2 */}
      <section id="results" className="scroll-mt-24 py-12 px-4 bg-white">
        <RetrievalResultsSection />
      </section>

      {/* Row 6: RQ3: Table 3, controlled removal of constructed knowledge */}
      <section id="robustness" className="scroll-mt-24 py-12 px-4 bg-gray-50/50">
        <RemovalSection />
      </section>

      {/* Row 7: RQ4: Tables 4 and 5, readers and a shared ReAct agent */}
      <section id="agents" className="scroll-mt-24">
        <AgenticRagSection />
      </section>

      {/* Row 8: appendix ablations: Table 13 and Table 14 */}
      <section id="ablations" className="scroll-mt-24 py-12 px-4 bg-gray-50/50">
        <AblationResults />
      </section>

      {/* Row 9: BibTeX */}
      <section id="citation" className="scroll-mt-24 py-12 px-4 bg-gray-50">
        <BibtexSection />
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 bg-gray-100 border-t border-gray-200">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-600 mb-2">
            {paperMeta.title}
          </p>
          <p className="text-xs text-gray-500">
            {paperMeta.venue}: author information withheld for review
          </p>
        </div>
      </footer>
    </main>
  );
}
