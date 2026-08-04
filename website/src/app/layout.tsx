import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LatentGraphRAG: Overcoming the Missing-Edge Problem in Knowledge Graphs with Recursive Dense Retrieval",
  description: "LatentGraphRAG retrieves documents and verbalized relational memories as two complementary views through recursive dense retrieval, overcoming the missing-edge problem in knowledge graphs. Best mean Recall on MuSiQue, FanOutQA and BrowseComp+, and 2.7x fewer agent search calls downstream. All evaluation trajectories released.",
  keywords: [
    "LatentGraphRAG",
    "GritHopper",
    "relational memories",
    "latent graph",
    "knowledge graphs",
    "dense retrieval",
    "RAG",
    "MuSiQue",
    "FanOutQA",
    "BrowseComp+",
    "document-memory agreement",
    "recursive dense retrieval",
    "agentic RAG",
    "ReAct",
  ],
  // authors withheld: anonymous ACL ARR submission under review
  openGraph: {
    title: "LatentGraphRAG: Overcoming the Missing-Edge Problem in Knowledge Graphs with Recursive Dense Retrieval",
    description: "Multi-hop retrieval over documents and relational memories. Best mean R@5 (44.65) and R@10 (54.26) across MuSiQue, FanOutQA and BrowseComp+, and 2.7x fewer agent search calls when used as a one-shot seed.",
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
