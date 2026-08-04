"use client";

import BranchingTree from "@/components/TreeSearch/BranchingTree";
import { useAutoPlay } from "../useAutoPlay";
import DemoControls from "./DemoControls";

/**
 * `corpus="document_only"` — a single tree expanding over the document index.
 * Animates currentHop 0 → maxHops on a loop.
 */
export default function DocumentOnlyDemo({
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
          mode="documents"
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
        Documents-only tree. Each hop extends the context with the previous hop&apos;s pick.
      </p>
    </div>
  );
}
