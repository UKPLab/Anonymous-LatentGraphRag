"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Github, BookOpen, ListTree } from "lucide-react";

// Author list withheld: this is an anonymous ACL ARR submission under review.

export default function Header() {
  return (
    <header className="flex flex-col items-center justify-center px-4 pt-8 pb-12 relative overflow-hidden bg-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto text-center"
      >
        {/* Venue badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="inline-block mb-6"
        >
          <span className="px-4 py-1.5 bg-gray-50 text-gray-500 rounded-full text-sm font-medium border border-gray-200">
            Anonymous ACL Submission · Under Review
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-gray-900"
        >
          LatentGraphRAG
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-xl md:text-2xl lg:text-3xl text-gray-600 mb-8"
        >
          Overcoming the Missing-Edge Problem in Knowledge Graphs with Recursive Dense Retrieval
        </motion.h2>

        {/* Authors */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-8"
        >
          <div className="text-lg text-gray-700 font-medium">
            Anonymous ACL Submission
          </div>
        </motion.div>

        {/* Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          {/* GitHub */}
          <a
            href="https://anonymous.4open.science/r/Anonymous-LatenGraphRag-57C9"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200"
          >
            <Github className="w-5 h-5 text-gray-700" />
            <span className="font-medium text-gray-700">Anonymous Code</span>
          </a>

          {/* Docs */}
          <Link
            href="/docs"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200"
          >
            <BookOpen className="w-5 h-5 text-blue-700" />
            <span className="font-medium text-blue-700">Docs</span>
          </Link>

          {/* Trajectories */}
          <Link
            href="/traces"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200"
          >
            <ListTree className="w-5 h-5 text-blue-700" />
            <span className="font-medium text-blue-700">Traces</span>
          </Link>

        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-16"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center text-gray-400"
          >
            <span className="text-sm mb-2">Scroll to explore</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </motion.div>
        </motion.div>
      </motion.div>
    </header>
  );
}
