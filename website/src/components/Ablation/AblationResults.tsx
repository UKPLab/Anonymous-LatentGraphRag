"use client";

import { motion } from "framer-motion";
import { ablationData } from "@/data/performanceData";

export default function AblationResults() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="max-w-5xl mx-auto"
    >
      <div className="text-center mb-8">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
          Ablation: How to Best Combine Documents and Memories?
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto text-sm">
          We ablate how to best combine document and relational-memory indices.
          Document–memory agreement is strongest on MuSiQue R@10.
          Numbers verbatim from the paper&apos;s Table 1.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ablationData.map((entry, idx) => (
          <motion.div
            key={entry.shortName}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className={`relative p-6 rounded-2xl border-2 ${
              entry.isBest
                ? "bg-blue-50 border-blue-300 shadow-lg shadow-blue-100/50"
                : "bg-white border-gray-200"
            }`}
          >
            {entry.isBest && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full shadow-md">
                  Best on MuSiQue
                </span>
              </div>
            )}

            <h3
              className={`text-base font-bold mb-2 ${
                entry.isBest ? "text-blue-700" : "text-gray-900"
              }`}
            >
              {entry.shortName}
            </h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              {entry.description}
            </p>

            <div className="space-y-3">
              {/* MuSiQue R@5 */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-gray-500 font-medium">MuSiQue R@5</span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      entry.isBest ? "text-blue-600" : "text-gray-800"
                    }`}
                  >
                    {entry.musiqueR5.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(entry.musiqueR5 / 90) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 + idx * 0.1 }}
                    className={`h-full rounded-full ${
                      entry.isBest ? "bg-blue-500" : "bg-gray-400"
                    }`}
                  />
                </div>
              </div>

              {/* MuSiQue R@10 */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-gray-500 font-medium">MuSiQue R@10</span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      entry.isBest ? "text-blue-600" : "text-gray-800"
                    }`}
                  >
                    {entry.musiqueR10.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(entry.musiqueR10 / 95) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.4 + idx * 0.1 }}
                    className={`h-full rounded-full ${
                      entry.isBest ? "bg-blue-500" : "bg-gray-400"
                    }`}
                  />
                </div>
              </div>

              {/* FanOutQA R@5 */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-gray-500 font-medium">FanOutQA R@5</span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      entry.isBest ? "text-blue-600" : "text-gray-800"
                    }`}
                  >
                    {entry.fanoutqaR5.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(entry.fanoutqaR5 / 35) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.5 + idx * 0.1 }}
                    className={`h-full rounded-full ${
                      entry.isBest ? "bg-blue-500" : "bg-gray-400"
                    }`}
                  />
                </div>
              </div>

              {/* FanOutQA R@10 */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-gray-500 font-medium">FanOutQA R@10</span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      entry.isBest ? "text-blue-600" : "text-gray-800"
                    }`}
                  >
                    {entry.fanoutqaR10.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(entry.fanoutqaR10 / 45) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.6 + idx * 0.1 }}
                    className={`h-full rounded-full ${
                      entry.isBest ? "bg-blue-500" : "bg-gray-400"
                    }`}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
