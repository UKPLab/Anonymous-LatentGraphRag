import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { paperMeta } from "@/data/lgrPaper";
import { claim } from "@/components/PaperTables/claims";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = `${claim("doc-only-beats-graph")} ${claim("agent-search-reduction")}`;

export const metadata: Metadata = {
  title: paperMeta.title,
  description: DESCRIPTION,
  keywords: [
    "LatentGraphRAG",
    "Recursive Dense Retrieval",
    "multi-hop retrieval",
    "graph-based retrieval",
    "triples",
    "propositions",
    "source-level fusion",
    "CombMNZ",
    "MuSiQue",
    "FanOutQA",
    "BrowseComp+",
    "retrieval-first RAG",
    "ReAct",
  ],
  // authors withheld: anonymous ACL ARR submission under review
  openGraph: {
    title: paperMeta.title,
    description: DESCRIPTION,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
