#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/xrpldash_clean_build"
rm -rf "$BUILD_DIR"; mkdir -p "$BUILD_DIR/src" "$BUILD_DIR/data" "$BUILD_DIR"

# wrappers
cat > "$BUILD_DIR/index.js" <<'JS'
const { startServer } = require('./src/index.js');
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  startServer(PORT);
}
module.exports = { startServer };
JS

cat > "$BUILD_DIR/app.js" <<'JS'
module.exports = require('./src/app.js');
JS

cat > "$BUILD_DIR/server.js" <<'JS'
module.exports = require('./src/server.js');
JS

# copy runtime source
rsync -a --delete --exclude '__tests__' "$ROOT_DIR/src/" "$BUILD_DIR/src/"

# copy data artifacts if present
for f in xrpl_accounts_metadata.xml xrpl_js_metadata.json xrpl_amm_summary.json xrpl_api_methods_summary.json xrpl_nft_summary.json xrpl_protocol_summary.json xrp_prices.csv xrp_prices.db; do
  if [ -f "$ROOT_DIR/$f" ]; then
    cp "$ROOT_DIR/$f" "$BUILD_DIR/data/"; fi
done

# copy public assets if present
if [ -d "$ROOT_DIR/src/public" ]; then
  mkdir -p "$BUILD_DIR/src/public"; cp -a "$ROOT_DIR/src/public/." "$BUILD_DIR/src/public/"
fi

# minimal package.json
cat > "$BUILD_DIR/package.json" << 'JSON'
{
  "name": "xrpldash-clean-build",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "verify": "./verify_contents.sh"
  },
  "engines": {"node": ">=18.0.0"},
  "dependencies": {
    "express": "^5.1.0",
    "socket.io": "^4.8.1",
    "sqlite3": "^5.1.7",
    "xrpl": "^4.4.3",
    "axios": "^1.3.0"
  }
}
JSON

# verification script
cat > "$BUILD_DIR/verify_contents.sh" << 'SH'
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
SH
chmod +x "$BUILD_DIR/verify_contents.sh"
echo "xrpldash_clean_build scaffold prepared at: $BUILD_DIR"
