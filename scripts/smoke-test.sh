#!/usr/bin/env bash
#
# Cold start check: serve the built Worker with no secrets and no `.dev.vars`,
# and assert the site still answers.
#
# This exists because of a real outage. A module read `process.env` while it was
# being evaluated and threw on a missing value, which took down every route on
# the site to protect a theme preference. Nothing caught it before deploy: the
# machine it was written on had a `.dev.vars` with the value in it, so it only
# failed where no one was looking.
#
# So the point is not that the pages render — it is that they render with
# nothing configured. Run it after `pnpm build`.
#
# "Nothing configured" means no vars and no secrets. It does not mean no data:
# D1 and KV are seeded first, from the fixtures committed to this repo, because
# empty stores are not a state production is ever in. A 404 from an empty KV
# would say nothing about the code and would fail every run.

set -euo pipefail

PORT="${PORT:-4173}"
BASE="http://localhost:${PORT}"

# Derived, not hardcoded: a Slug never changes once published, but which Posts
# exist does.
#
# Two lists, because two questions. `/` shows the newest Posts whatever they
# belong to, so it is asked about all of them. The Post probed by URL has to be
# one with **no Container**: the `blog:` key space holds every
# Post body, a Part of a Series included — the prefix says what kind of payload
# it is, not which URL serves it — but a Part answers 301 at `/blog/<slug>` and
# `/blog` collapses its whole Series into one row. Both checks below would fail
# on correct code. Picking the first payload alphabetically works today only
# because the one loose Post happens to sort first; the next Part published
# under a slug starting `a`–`h` would break CI and point at nothing.
#
# Which slugs are Parts is read from the Series manifests, the same place the
# generators read the arc from (ADR 0007).
# Each line is `<series>\t<part>`, so the pair that probes a Part below can be
# taken whole — a Part read from one manifest and a Series read from another
# would produce a URL that correctly answers 404.
mapfile -t SERIES_PARTS < <(
	node --input-type=module -e '
		import { readdir, readFile } from "node:fs/promises";

		const directory = "seed/kv/kv_payloads/series";

		for (const file of await readdir(directory).catch(() => [])) {
			const { attributes } = JSON.parse(await readFile(`${directory}/${file}`, "utf-8"));
			const series = file.replace(/\.[^.]+\.json$/, "");

			for (const section of attributes.sections ?? []) {
				for (const part of section.parts ?? []) console.log(`${series}\t${part}`);
			}
		}
	'
)

mapfile -t PART_SLUGS < <(
	if [[ "${#SERIES_PARTS[@]}" -gt 0 ]]; then printf '%s\n' "${SERIES_PARTS[@]}" | cut -f2; fi
)

mapfile -t POST_SLUGS < <(
	find seed/kv/kv_payloads/blog -name '*.en.json' -exec basename {} .en.json \; | sort
)

mapfile -t LOOSE_POST_SLUGS < <(
	printf '%s\n' "${POST_SLUGS[@]}" |
		{ if [[ "${#PART_SLUGS[@]}" -gt 0 ]]; then grep -vxF "$(printf '%s\n' "${PART_SLUGS[@]}")"; else cat; fi; }
)

if [[ "${#LOOSE_POST_SLUGS[@]}" -eq 0 ]]; then
	echo "error: no payload under seed/kv/kv_payloads/blog for a Post outside a Series." >&2
	exit 1
fi

POST_SLUG="${LOOSE_POST_SLUGS[0]}"

ROUTES=(/ /blog /bookmarks /resume /robots.txt /sitemap.xml "/blog/${POST_SLUG}")

# A Tag page, probed with a Tag some Post actually carries — read from the Post
# payloads, which is the only place that guarantees it. A hardcoded Tag would
# answer 404 the day it left the front matter, and this route answers 404 *by
# design* for a Tag no Post carries: the failure would look like the feature.
#
# The Post is carried alongside the Tag, so the content check below can assert
# that this Post is on that page rather than trusting a 200 over an empty list.
# One line, `<slug>\t<tag>`, as the Series pair above.
IFS=$'\t' read -r TAG_POST_SLUG TAG < <(
	node --input-type=module -e '
		import { readdir, readFile } from "node:fs/promises";

		const directory = "seed/kv/kv_payloads/blog";

		for (const file of (await readdir(directory).catch(() => [])).sort()) {
			const { attributes } = JSON.parse(await readFile(`${directory}/${file}`, "utf-8"));
			const [tag] = attributes.tags ?? [];

			if (tag) {
				console.log(`${file.replace(/\.[^.]+\.json$/, "")}\t${tag}`);
				break;
			}
		}
	'
) || true

# Loud rather than skipped. Every Post on this site carries Tags — the seed
# generator checks each one against the declared vocabulary — so no pair here
# means either the payloads are stale or Tags have stopped being written, and
# both are worth failing over. Silently dropping the probe is how a gate ends up
# passing while covering nothing.
if [[ -z "${TAG:-}" ]]; then
	echo "error: no Post payload under seed/kv/kv_payloads/blog carries a Tag." >&2
	echo "       Regenerate the payloads, or edit this check on purpose." >&2
	exit 1
fi

ROUTES+=(/tags "/tags/${TAG}")

# The Series namespace, when there is one to probe. All three read a store —
# the landing and a Part read *both*, D1 for the arc and KV for the body — so
# they are the routes most likely to be the ones a missing binding takes down,
# which is the failure this whole script exists for.
if [[ "${#SERIES_PARTS[@]}" -gt 0 ]]; then
	IFS=$'\t' read -r SERIES_SLUG PART_SLUG <<<"${SERIES_PARTS[0]}"

	ROUTES+=(/series "/series/${SERIES_SLUG}" "/series/${SERIES_SLUG}/${PART_SLUG}")
fi

if [[ ! -d build/client ]]; then
	echo "error: no build found. Run 'pnpm build' first." >&2
	exit 1
fi

# A dev machine has a `.dev.vars`, and with it in place this whole script is
# theatre: every value it is supposed to be running without is simply there,
# and a Worker that cannot boot in CI passes here. So the run takes it away and
# gives it back — including the copy `@cloudflare/vite-plugin` leaves inside
# `build/server/`, which the preview reads and which alone is enough to hide
# the failure. That copy is build output; the next build recreates it.
DEV_VARS_STASH=""

if [[ -f .dev.vars ]]; then
	DEV_VARS_STASH=".dev.vars.smoke-stash.$$"
	mv .dev.vars "${DEV_VARS_STASH}"
	echo "==> Set .dev.vars aside for the run (restored when it ends)"
fi

rm -f build/server/.dev.vars

cleanup() {
	if [[ -n "${PREVIEW_PID:-}" ]]; then
		kill "${PREVIEW_PID}" 2>/dev/null || true
	fi

	if [[ -n "${DEV_VARS_STASH}" && -f "${DEV_VARS_STASH}" ]]; then
		mv "${DEV_VARS_STASH}" .dev.vars
	fi
}

trap cleanup EXIT INT TERM

# Both stores are filled from files that are in git, applied locally — no
# network, no Cloudflare credentials, nothing touching the deployed resources.
# `seed.sql` deletes and re-inserts, so running this repeatedly is safe.
#
# The schema is rebuilt rather than applied over, because applying a bare
# `CREATE TABLE` to a database that already exists fails, and ignoring that
# failure — which is what this did — also ignores a database sitting on an older
# shape. A cold start check that passes against a stale store proves nothing.
echo "==> Seeding the local D1 and KV from the committed fixtures"
pnpm run d1:reset:local >/dev/null
pnpm exec wrangler d1 execute poschuler --file ./seed/d1/seed.sql --local >/dev/null
pnpm run kv:upload:local >/dev/null

# Refuse to run against something already listening. Without this the readiness
# probe below is happy to talk to whatever answers on the port — a stale preview
# from an earlier run serving an older build, which passes every check and
# tells you nothing about the code you just changed.
if curl -fsS -o /dev/null --max-time 2 "${BASE}/robots.txt" 2>/dev/null; then
	echo "error: something is already listening on port ${PORT}." >&2
	echo "       Stop it first, or set PORT to a free one." >&2
	exit 1
fi

echo "==> Starting the Worker with no vars and no secrets"
pnpm exec vite preview --port "${PORT}" --strictPort >/tmp/smoke-preview.log 2>&1 &
PREVIEW_PID=$!

for _ in $(seq 60); do
	if curl -fsS -o /dev/null "${BASE}/robots.txt" 2>/dev/null; then
		break
	fi
	if ! kill -0 "${PREVIEW_PID}" 2>/dev/null; then
		echo "error: the Worker exited before serving anything." >&2
		cat /tmp/smoke-preview.log >&2
		exit 1
	fi
	sleep 1
done

failed=0

echo "==> Every route answers"
for route in "${ROUTES[@]}"; do
	status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}${route}")

	if [[ "${status}" == "200" ]]; then
		printf '    ok   %-24s %s\n' "${route}" "${status}"
	else
		printf '    FAIL %-24s %s\n' "${route}" "${status}"
		failed=1
	fi
done

# A 200 holding an empty page would pass everything above. Matching on the Slug
# rather than on a title keeps this free of HTML-escaping guesswork.
#
# One function rather than a fourth copy of the same six lines. Every caller
# below asks the same question — *did this page carry the row the store holds* —
# and the answers were drifting: two of them printed a different failure line for
# the same failure.
expect_mention() {
	local route="$1" needle="$2" body

	# Held in a variable rather than piped into grep: under `pipefail`, grep -q
	# exits on the first match and curl dies of SIGPIPE, failing the pipeline
	# precisely when the check succeeds.
	body=$(curl -s "${BASE}${route}")

	if grep -qF "${needle}" <<<"${body}"; then
		printf '    ok   %-24s mentions %s\n' "${route}" "${needle}"
	else
		printf '    FAIL %-24s does not mention %s\n' "${route}" "${needle}"
		failed=1
	fi
}

echo "==> Those pages carry content, not just a status code"

# These two must name this exact Slug: `/blog` lists every Post, and the Post's
# own page is that Post.
expect_mention /blog "${POST_SLUG}"
expect_mention "/blog/${POST_SLUG}" "${POST_SLUG}"

# The Tag page answers 404 for a Tag no Post carries, so a 200 already says the
# query found something — but not that the row reached the page. The Post the
# Tag was read from is the one that must be listed.
expect_mention "/tags/${TAG}" "${TAG_POST_SLUG}"

# The index, which reads a different query against the same table. A 200 here
# survives an empty list — every entry comes from `content_tag`, and the whole
# page is those entries — so it is asked for the one Tag known to be on it. The
# page's own description names its subjects in prose (`Node.js`), never as
# slugs, so this cannot match on anything but an entry.
expect_mention /tags "${TAG}"

# The home page is asked for any Post, not that one. It carries a short excerpt
# of the most recent Posts, so the Slug that happens to sort first need not be
# on it — and asserting it was there is how this check started failing on a
# working site. What it is for is that the page is not empty, and that survives
# the home page changing how many Posts it shows.
home=$(curl -s "${BASE}/")
named=""

for slug in "${POST_SLUGS[@]}"; do
	if grep -qF "${slug}" <<<"${home}"; then
		named="${slug}"
		break
	fi
done

if [[ -n "${named}" ]]; then
	printf '    ok   %-24s mentions %s\n' "/" "${named}"
else
	printf '    FAIL %-24s names none of the %d Posts\n' "/" "${#POST_SLUGS[@]}"
	failed=1
fi

# The theme toggle is the one thing that legitimately fails without its secret —
# it signs a cookie, and signing with a placeholder is worse than not signing.
# What must not happen is that failure spreading: this is the outage, in a test.
echo "==> A failing theme toggle stays confined to its own endpoint"
curl -s -o /dev/null -X POST "${BASE}/set-theme" \
	-H "Content-Type: application/x-www-form-urlencoded" \
	-d "color-scheme=dark" || true

for route in / /resume; do
	status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}${route}")

	if [[ "${status}" == "200" ]]; then
		printf '    ok   %-24s %s after the failed toggle\n' "${route}" "${status}"
	else
		printf '    FAIL %-24s %s after the failed toggle\n' "${route}" "${status}"
		failed=1
	fi
done

if [[ "${failed}" -ne 0 ]]; then
	echo
	echo "Smoke test failed. Worker log:" >&2
	cat /tmp/smoke-preview.log >&2
	exit 1
fi

echo
echo "Cold start OK."
