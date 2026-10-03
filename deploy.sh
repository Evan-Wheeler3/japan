#!/bin/sh
# Publish the game to Cloudflare Pages (https://yoake.pages.dev once a Pages project named yoake exists) and the co-op relay worker.
# Only index.html, src/ and the small _worker.js go public; everything else in this folder stays private.
set -e
cd "$(dirname "$0")"
(cd server/relay && npx -y wrangler@latest deploy)
rm -rf dist && mkdir dist
cp index.html dist/ && cp -R src dist/ && cp server/pages_worker.js dist/_worker.js
npx -y wrangler@latest pages deploy dist --project-name yoake --branch main --commit-dirty=true
rm -rf dist
