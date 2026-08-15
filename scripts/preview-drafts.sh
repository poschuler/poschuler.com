#!/usr/bin/env bash
#
# Renders every Draft into the local D1 and KV, so it can be read at its real
# address in `dev` before it is published (Part 3 of the field notes).
#
# The same generators the committed fixtures come from, run with two extra
# parameters — `--include-drafts`, and an output directory under `preview/`
# instead of `seed/d1/` and `seed/kv/`. No tracked file is written: the
# committed fixtures and `check:fixtures` are untouched, and `preview/` is
# gitignored, so there is nothing to revert and nothing that can be committed
# by accident.
#
# Returning to the published state needs only the existing local reset and
# seed commands — this script does not undo itself, because there is nothing
# of its own to undo.

set -euo pipefail

PREVIEW_DIR="preview"

echo "==> Rebuilding the local D1 from schema.sql"
pnpm run d1:reset:local >/dev/null

echo "==> Generating seed.sql with Drafts included, into ${PREVIEW_DIR}/d1"
node ./seed/d1/generate-seed-sql.ts --output-dir "${PREVIEW_DIR}/d1" --include-drafts

echo "==> Applying it to the local D1"
pnpm exec wrangler d1 execute poschuler --file "${PREVIEW_DIR}/d1/seed.sql" --local >/dev/null

echo "==> Generating KV payloads from the local D1, into ${PREVIEW_DIR}/kv"
node ./seed/kv/generate-kv-json.ts --output-dir "${PREVIEW_DIR}/kv"

echo "==> Uploading them to the local KV"
node ./seed/kv/kv-bulk-upload.ts local --output-dir "${PREVIEW_DIR}/kv"

echo
echo "==> Drafts are live in the local stores — read them in 'pnpm run dev'."
echo "==> Return to the published state with:"
echo "        pnpm run d1:reset:local && pnpm run d1:seed:local && pnpm run kv:seed:local"
