"use client";

import { motion } from "framer-motion";

const BIBTEX = `@article{anonymous2026latentgraphrag,
  title={{LatentGraphRAG}: Overcoming the Missing-Edge Problem
         with Memory-Enriched Recursive Dense Retrieval},
  author={Anonymous ACL Submission},
  year={2026},
  url={#}
}`;

export default function BibtexSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.2 }}
      id="citation"
    >
      <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Citation</h3>
      <div className="max-w-3xl mx-auto">
        <div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
            <span className="text-gray-400 text-sm font-mono">BibTeX</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(BIBTEX);
                const btn = document.getElementById("copy-bibtex-btn");
                if (btn) {
                  btn.textContent = "Copied!";
                  setTimeout(() => {
                    btn.textContent = "Copy";
                  }, 2000);
                }
              }}
              id="copy-bibtex-btn"
              className="px-3 py-1 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Copy
            </button>
          </div>
          <pre className="p-4 text-sm text-gray-300 font-mono overflow-x-auto">
            {BIBTEX}
          </pre>
        </div>
      </div>
    </motion.div>
  );
}
