"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface TreeNode {
  id: string;
  label: string;
  depth: number;
  branchIndex: number; // 0, 1, 2 at each level
  x: number;
  y: number;
  parentId: string | null;
  isOnActivePath: boolean;
}

interface Edge {
  from: string;
  to: string;
  isActive: boolean;
}

interface BranchingTreeProps {
  mode?: "documents" | "memories";
  branchingFactor?: number;
  maxDepth?: number;
  /** Current hop (0-4), controls how many levels are expanded. Passed from parent animation. */
  currentHop?: number;
  /** Width of SVG */
  width?: number;
  /** Height of SVG */
  height?: number;
}

const NODE_COLORS = {
  documents: {
    active: "#3b82f6",      // blue-500
    activeGlow: "#93c5fd",  // blue-300
    idle: "#e5e7eb",        // gray-200
    line: "#d1d5db",        // gray-300
    activeLine: "#3b82f6",
  },
  memories: {
    active: "#22c55e",      // green-500
    activeGlow: "#86efac",  // green-300
    idle: "#e5e7eb",
    line: "#d1d5db",
    activeLine: "#22c55e",
  },
};

/**
 * Build a full tree with branching factor b and depth d.
 * Top-to-bottom layout: root at top, leaves at bottom.
 * Returns all nodes and edges.
 */
function buildFullTree(
  b: number,
  depth: number,
  mode: "documents" | "memories",
  width: number,
  height: number,
  activeDepth: number // How deep the active path goes (synced with animation hops)
): { nodes: TreeNode[]; edges: Edge[] } {
  const nodes: TreeNode[] = [];
  const edges: Edge[] = [];
  const prefix = mode === "documents" ? "D" : "M";

  const verticalPadding = 40;
  const horizontalPadding = 20;
  const usableHeight = height - verticalPadding * 2;
  const usableWidth = width - horizontalPadding * 2;
  const levelHeight = usableHeight / depth;

  // The active path: always take the middle branch (index 1) at each level
  const activeBranchIndex = 1;

  // BFS to build tree
  type QueueItem = { id: string; depth: number; parentId: string | null; branchIndex: number; parentX: number; isOnActivePath: boolean };
  const queue: QueueItem[] = [
    { id: "Q", depth: 0, parentId: null, branchIndex: 0, parentX: width / 2, isOnActivePath: true }
  ];

  // Calculate horizontal spread at each level
  // At depth d, we have b^d nodes. Each node at depth d needs space for b^(maxDepth-d) descendants
  const getNodeSpacing = (nodeDepth: number): number => {
    const nodesAtLevel = Math.pow(b, nodeDepth);
    return usableWidth / nodesAtLevel;
  };

  // Track x positions by level for proper spacing
  const levelPositions: Map<number, number[]> = new Map();

  while (queue.length > 0) {
    const item = queue.shift()!;
    const { id, depth: d, parentId, branchIndex, parentX, isOnActivePath } = item;

    // Calculate x position
    let x: number;
    if (d === 0) {
      x = width / 2;
    } else {
      // Get spacing for this level
      const spacing = getNodeSpacing(d);
      // Position based on parent and branch index
      const offset = (branchIndex - (b - 1) / 2) * spacing;
      x = parentX + offset;
    }

    // Calculate y position
    const y = verticalPadding + d * levelHeight;

    // Track position
    if (!levelPositions.has(d)) levelPositions.set(d, []);
    levelPositions.get(d)!.push(x);

    nodes.push({
      id,
      label: id,
      depth: d,
      branchIndex,
      x,
      y,
      parentId,
      isOnActivePath,
    });

    // Add edge from parent
    if (parentId) {
      edges.push({
        from: parentId,
        to: id,
        isActive: isOnActivePath,
      });
    }

    // Add children if not at max depth
    if (d < depth) {
      for (let c = 0; c < b; c++) {
        const childId = d === 0 ? `${prefix}${d + 1}.${c}` : `${id}.${c}`;
        const childIsOnActivePath = isOnActivePath && c === activeBranchIndex;
        queue.push({
          id: childId,
          depth: d + 1,
          parentId: id,
          branchIndex: c,
          parentX: x,
          isOnActivePath: childIsOnActivePath,
        });
      }
    }
  }

  return { nodes, edges };
}

export default function BranchingTree({
  mode = "documents",
  branchingFactor = 3,
  maxDepth = 4,
  currentHop = 0,
  width = 500,
  height = 450,
}: BranchingTreeProps) {
  const colors = NODE_COLORS[mode];

  // Build the full tree structure
  const { nodes, edges } = useMemo(
    () => buildFullTree(branchingFactor, maxDepth, mode, width, height, currentHop),
    [branchingFactor, maxDepth, mode, width, height, currentHop]
  );

  // Determine which nodes/edges are visible based on currentHop
  // currentHop 0 = show root only
  // currentHop 1 = show root + level 1
  // etc.
  const visibleDepth = Math.min(currentHop + 1, maxDepth + 1);

  const nodeRadius = 10;
  const activeNodeRadius = 12;

  return (
    <div className="w-full h-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Edges */}
        {edges.map((edge) => {
          const fromNode = nodes.find((n) => n.id === edge.from);
          const toNode = nodes.find((n) => n.id === edge.to);
          if (!fromNode || !toNode) return null;

          const isVisible = toNode.depth <= visibleDepth - 1;
          if (!isVisible) return null;

          const isActive = edge.isActive && toNode.depth <= currentHop;

          return (
            <motion.line
              key={`${edge.from}-${edge.to}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={isActive ? colors.activeLine : colors.line}
              strokeWidth={isActive ? 2.5 : 1}
              strokeOpacity={isActive ? 1 : 0.4}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: isActive ? 1 : 0.4 }}
              transition={{
                duration: 0.4,
                delay: toNode.depth * 0.1,
              }}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isVisible = node.depth <= visibleDepth - 1;
          if (!isVisible) return null;

          const isActive = node.isOnActivePath && node.depth <= currentHop;
          const isRoot = node.id === "Q";
          const radius = isActive || isRoot ? activeNodeRadius : nodeRadius;

          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.3,
                delay: node.depth * 0.15,
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
            >
              {/* Glow for active nodes */}
              {(isActive || isRoot) && (
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 6}
                  fill={colors.active}
                  opacity={0.2}
                  animate={{
                    r: [radius + 4, radius + 8, radius + 4],
                    opacity: [0.15, 0.25, 0.15],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={isActive || isRoot ? colors.active : colors.idle}
                stroke={isActive || isRoot ? colors.activeGlow : "#d1d5db"}
                strokeWidth={isActive || isRoot ? 2 : 1}
              />

              {/* Label */}
              <text
                x={node.x}
                y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isActive || isRoot ? "#fff" : "#9ca3af"}
                fontSize={isRoot ? 11 : 8}
                fontWeight={isActive || isRoot ? 600 : 400}
                fontFamily="system-ui, sans-serif"
              >
                {isRoot ? "Q" : node.depth}
              </text>
            </motion.g>
          );
        })}

        {/* Context indicator along active path */}
        {currentHop > 0 && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {/* Label showing current context */}
            <motion.text
              x={width - 10}
              y={20}
              textAnchor="end"
              fill={colors.active}
              fontSize={10}
              fontWeight={600}
              fontFamily="system-ui, sans-serif"
            >
              Hop {currentHop} / {maxDepth}
            </motion.text>
          </motion.g>
        )}
      </svg>
    </div>
  );
}
