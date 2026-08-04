import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";

/**
 * Serving path. Empty for local development and for a site served at a domain
 * root; set it when the site lives in a subdirectory, which is the case for both
 * GitHub Pages project sites and the anonymised mirror:
 *
 *   NEXT_PUBLIC_BASE_PATH=/latentgraphrag npm run build
 *
 * The same variable is read at runtime by src/lib/traces.ts so the trace payload
 * under public/data is fetched from the right prefix. Keep the two in sync by
 * never hardcoding a prefix anywhere else.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Static export so Pagefind can crawl rendered HTML from ./out
  output: "export",
  ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
  images: {
    unoptimized: true,
  },
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Trailing slashes give Pagefind cleaner page URLs.
  trailingSlash: true,
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: "wrap",
          properties: {
            className: ["heading-anchor"],
          },
        },
      ],
      [
        rehypePrettyCode,
        {
          theme: {
            dark: "github-dark",
            light: "github-light",
          },
          keepBackground: false,
        },
      ],
    ],
  },
});

export default withMDX(nextConfig);
