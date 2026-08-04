"use client";

import BranchingTree from "@/components/TreeSearch/BranchingTree";
import { useAutoPlay } from "../useAutoPlay";
import DemoControls from "./DemoControls";

/**
 * `corpus="dual_tree"` — two parallel trees, one over documents and one over memories.
 * Memory tree typically has a wider branching factor.
 */
export default function DualTreeDemo({
  branchingDoc = 3,
  branchingMemory = 5,
  maxHops = 4,
}: {
  branchingDoc?: number;
  branchingMemory?: number;
  maxHops?: number;
}) {
  const { step, paused, toggle, replay } = useAutoPlay({ maxStep: maxHops });
  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-semibold text-blue-700 mb-1 text-center">Document Tree (b_D = {branchingDoc})</p>
          <div className="aspect-[3/4]">
            <BranchingTree
              mode="documents"
              branchingFactor={branchingDoc}
              maxDepth={maxHops}
              currentHop={step}
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-green-700 mb-1 text-center">Memory Tree (b_M = {branchingMemory})</p>
          <div className="aspect-[3/4]">
            <BranchingTree
              mode="memories"
              branchingFactor={branchingMemory}
              maxDepth={maxHops}
              currentHop={step}
            />
          </div>
        </div>
      </div>
      <DemoControls
        paused={paused}
        step={step}
        maxStep={maxHops}
        onPlayPause={toggle}
        onReplay={replay}
      />
      <p className="text-[11px] text-gray-500 mt-2 px-2">
        Two independent trees. After expansion, memory paths are projected to source documents and fused.
      </p>
    </div>
  );
}
