#!/usr/bin/env bash
set -euo pipefail
BUILD_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BUILD_DIR"
REQUIRED_FILES=("index.js" "app.js" "server.js" "package.json")
for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$f" ]; then echo "Missing: $f"; exit 1; fi
done
REQUIRED_DIRS=("src" "data" "src/public" )
for d in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "$d" ]; then echo "Missing dir: $d"; exit 1; fi
done
echo "Verification passed"
