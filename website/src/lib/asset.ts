/**
 * Prefix a public/ asset path with the site's base path.
 *
 * Next.js rewrites `href` on next/link and the URLs it generates for _next/*,
 * but it does NOT rewrite the `src` of next/image when images are unoptimized,
 * which is the case for a static export. Those end up as root-absolute paths and
 * 404 wherever the site is not served from the domain root — a GitHub Pages
 * project site, or an anonymised mirror.
 *
 * Use this for every reference to a file in public/.
 */
import { BASE_PATH } from "./traces";

export function asset(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${p}`;
}
