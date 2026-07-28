#!/usr/bin/env bash
#
# Assert that the committed fixtures are what the generators produce today.
#
# The seed job uploads `seed/d1/seed.sql` and `seed/kv/kv_payloads/` to the
# deployed stores exactly as they are in git. It does not regenerate them, and
# that is deliberate: regenerating on a push would let a merge publish rendered
# HTML that was never reviewed as a diff. The cost of that choice was silent —
# editing a Markdown file without running the generators republished the
# previous version and nothing failed.
#
# So this runs the generators and throws the output away. The only thing it
# keeps is the answer to "did anything change?", which turns a forgotten step
# into a red run instead of a stale page.
#
# No credentials and no network: `kv:generate` reads the *local* D1, which is
# why this belongs in `verify` rather than in `publish`.
#
# Note it regenerates in place, so on a dev machine it also reports Markdown you
# have edited but not yet regenerated. That is the same message, arriving early.

set -euo pipefail

# D1 first, and KV from D1: `generate-kv-json.ts` queries the seeded `content`
# table to decide which Posts to render, so against an empty database it
# silently produces nothing. See ADR 0001.
#
# The schema is the only step that objects to already existing — the runner has
# no database at all, a developer's has one already.
echo "==> Seeding the local D1 so the generators have something to read"
pnpm exec wrangler d1 execute poschuler --file ./seed/d1/schema.sql --local >/dev/null 2>&1 ||
	echo "    (schema already applied)"

echo "==> Regenerating"
pnpm run d1:generate >/dev/null
pnpm exec wrangler d1 execute poschuler --file ./seed/d1/seed.sql --local >/dev/null
pnpm run kv:generate >/dev/null

TRACKED=(seed/d1/seed.sql seed/kv/kv_payloads)

# `git status --porcelain`, not `git diff`: a Post whose payload has never been
# generated is an *untracked* file, and `git diff` does not see those. That is
# the one case this check exists for, so it must not be the one it misses.
DRIFT="$(git status --porcelain -- "${TRACKED[@]}")"

if [[ -n "${DRIFT}" ]]; then
	echo >&2
	echo "error: the committed fixtures are not what the generators produce." >&2
	echo >&2
	echo "${DRIFT}" >&2
	echo >&2
	echo "Run 'pnpm run d1:seed:local && pnpm run kv:seed:local' and commit the result." >&2
	echo "Until then, a push to main would upload the previous version of this content." >&2
	exit 1
fi

echo "==> The committed fixtures are up to date"
