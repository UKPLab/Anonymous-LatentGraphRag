"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { docsNav, DocSection } from "@/lib/docsNav";

/**
 * Sidebar with collapsible sections.
 *
 * Sections containing the active page are auto-expanded. Other sections start
 * collapsed, keeping deep groups (Tutorial, API Reference) tucked away until
 * a reader actually wants them.
 */
function sectionContainsPath(section: DocSection, pathname: string): boolean {
  return section.items.some((it) => it.href === pathname);
}

export default function Sidebar() {
  const pathname = usePathname() ?? "";
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // First render uses pathname snapshot to seed which sections start open.
    const out: Record<string, boolean> = {};
    for (const s of docsNav) {
      out[s.title] = sectionContainsPath(s, pathname);
    }
    return out;
  });

  // Auto-open the section that owns the currently active page on navigation.
  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const s of docsNav) {
        if (sectionContainsPath(s, pathname)) {
          next[s.title] = true;
        }
      }
      return next;
    });
  }, [pathname]);

  return (
    <nav aria-label="Documentation sections" className="text-sm text-gray-700">
      {docsNav.map((section) => {
        const isOpen = expanded[section.title];
        const isCurrent = sectionContainsPath(section, pathname);
        return (
          <div key={section.title} className="mb-1">
            <button
              type="button"
              onClick={() =>
                setExpanded((p) => ({ ...p, [section.title]: !p[section.title] }))
              }
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                isCurrent
                  ? "text-blue-700"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
              aria-expanded={isOpen}
            >
              <span>{section.title}</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 2l4 4-4 4" />
              </svg>
            </button>
            {isOpen && (
              <ul className="mt-0.5 mb-3 space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block px-2 py-1.5 rounded-md transition-colors ${
                          isActive
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "hover:bg-gray-100 hover:text-gray-900"
                        }`}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
