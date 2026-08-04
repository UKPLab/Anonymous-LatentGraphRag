"use client";

import BranchingTree from "@/components/TreeSearch/BranchingTree";
import { useAutoPlay } from "../useAutoPlay";
import DemoControls from "./DemoControls";

/**
 * `corpus="memory_only"` — a single tree over the verbalized relational memories index.
 */
export default function MemoryOnlyDemo({
  branching = 3,
  maxHops = 4,
}: {
  branching?: number;
  maxHops?: number;
}) {
  const { step, paused, toggle, replay } = useAutoPlay({ maxStep: maxHops });
  return (
    <div className="w-full">
      <div className="aspect-[5/4] w-full">
        <BranchingTree
          mode="memories"
          branchingFactor={branching}
          maxDepth={maxHops}
          currentHop={step}
        />
      </div>
      <DemoControls
        paused={paused}
        step={step}
        maxStep={maxHops}
        onPlayPause={toggle}
        onReplay={replay}
      />
      <p className="text-[11px] text-gray-500 mt-2 px-2">
        Memory-only tree. Memories are verbalized triples; scores project back to source documents at the end.
      </p>
    </div>
  );
}
