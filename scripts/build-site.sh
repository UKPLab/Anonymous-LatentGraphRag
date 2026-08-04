#!/usr/bin/env bash
# Build the static site and stage it into docs/, which is what GitHub Pages
# (branch main, folder /docs) publishes and what Anonymous GitHub resolves as its
# page source.
#
# The prefix must match the path the site is served under, because a Next.js
# static export writes absolute asset URLs. Pass it as the first argument:
#
#   Anonymous GitHub:  ./scripts/build-site.sh /w/<anonymised-repo-id>
#   GitHub Pages:      ./scripts/build-site.sh /<repository-name>
#   served at a root:  ./scripts/build-site.sh ""
set -euo pipefail
cd "$(dirname "$0")/.."
PREFIX="${1?usage: $0 <base-path>}"
cd website
NEXT_PUBLIC_BASE_PATH="$PREFIX" npm run build
cd ..
rsync -a --delete website/out/ docs/
echo "docs/ built for base path '${PREFIX}' ($(du -sh docs | cut -f1))"
