#!/usr/bin/env bash
#
# Re-export every view in the workspace as an SVG into `architecture/diagrams/`.
#
# The input is `workspace.json` and not `workspace.dsl`, and the two are not
# interchangeable here. `dynamic-publication` carries no `autolayout` at all:
# its boxes are placed by hand, because nothing in a layout algorithm knows that
# the steps of a publication are numbered, and left to itself it ordered them
# 7, 2, 4, 5, 3, 6, 8 — in the one view whose reason for existing is the order.
# Exporting from the DSL would give that view no positions and render every box
# at the origin. The DSL is what a view *is*; the JSON is where it sits.
#
# The renderer needs a browser and `structurizr/structurizr:latest` has none —
# it answers `Exporting to PNG/SVG is not supported in this build`. The
# `-playwright` tag carries one, at 3.49 GB against 431 MB. It is pinned rather
# than tracking `latest` because rendering is what produces the file, so an
# unpinned renderer is an unpinned output.
#
# Nothing verifies these in CI, and that is a decision rather than an omission.
# The 3.49 GB pull on every run is the price of checking a file only a human
# reads, and `workspace.dsl` — the thing every SVG here is derived from — is
# validated there instead, from the small image. So these can go stale, and the
# way they stop being stale is someone running this — which puts the whole
# weight on a person noticing that the sixteen files changed, and is why the
# date below is pinned.

set -euo pipefail

# Pinned; see above.
IMAGE="structurizr/structurizr:2026.06.28-playwright"

# Every diagram carries the workspace's save timestamp in its footer, and
# Structurizr Lite rewrites that timestamp every time it serves a page. Left
# alone it makes all sixteen files differ after merely *opening* the workspace,
# and with nothing checking them the only signal that a diagram is stale is a
# human reading the diff — a diff that fires every time carries no information.
# Deleting the field is worse than leaving it: absent, the exporter stamps the
# moment the export ran, which is not even stable between two runs.
#
# So it is pinned to a constant, and the constant is the one the file already
# carried. `.gitattributes` keeps this field out of git for the same reason, so
# nothing here contradicts what is committed; it only makes the export as
# deterministic as the JSON behind it already is. The footer date is therefore
# not information — the file's history is where the age of a diagram is written.
PINNED_DATE="2030-01-01T00:00:00Z"

if [[ ! -f architecture/workspace.json ]]; then
	echo "error: run this from the repository root ('pnpm run diagrams')." >&2
	exit 1
fi

if ! command -v jq >/dev/null; then
	echo "error: jq is required, and so is the clean filter that also needs it:" >&2
	echo "        git config filter.structurizr.clean \"jq -S 'del(.lastModifiedDate)'\"" >&2
	exit 1
fi

mkdir -p architecture/diagrams/light architecture/diagrams/dark

# The workspace is never edited in place. The pinned copy is what gets mounted,
# and it lives outside the repository so that a failed run cannot leave a
# rewritten workspace behind.
STAGED="$(mktemp -d)"
trap 'rm -rf "${STAGED}"' EXIT
jq --arg d "${PINNED_DATE}" '.lastModifiedDate = $d' architecture/workspace.json >"${STAGED}/workspace.json"

# A view renamed or deleted in the DSL would otherwise leave its old SVG behind,
# and an orphan is worse than a missing file because it still renders. Both paths
# are written out in full and the glob is narrowed to the one extension this
# script produces — never `rm -rf` on a directory, and never a path assembled
# from a variable.
echo "==> Emptying architecture/diagrams"
rm -f architecture/diagrams/light/*.svg
rm -f architecture/diagrams/dark/*.svg

# Both modes, into separate directories because the exporter names every file
# after its view key and a second run into the same directory would overwrite
# the first. `-mode dark` paints the canvas `#111111` and turns the arrows and
# their labels light; it does not touch the element colours, which is why the
# palette in `styles` has to clear 3:1 against white *and* against `#111111`
# rather than against whichever one it was drawn on.
#
# `-u` is not optional, for the same reason `docker-compose.yml` carries
# `user: "1000:1000"`: without it the SVGs arrive owned by root.
#
# No running Structurizr Lite is required — this renders headlessly from the
# file — and the workspace is mounted read-only, so an export cannot disturb the
# layout it is reading.
for MODE in light dark; do
	echo "==> Exporting every view, ${MODE}"
	docker run --rm -u "$(id -u):$(id -g)" \
		-v "${STAGED}:/ws:ro" \
		-v "${PWD}/architecture/diagrams/${MODE}:/out" \
		"${IMAGE}" \
		export -w /ws/workspace.json -f svg -mode "${MODE}" -o /out
done

# Two files per view per mode: the diagram, and a `<key>-key.svg` legend beside
# it. The legends are kept. The tag vocabulary is load-bearing in this workspace
# — the two tenses are a colour, a Verifier is a hexagon, the source of truth is
# a green folder and a derived store is a cylinder — and a reader who has not
# read the DSL has nowhere else to learn any of that.
echo
echo "==> $(ls architecture/diagrams/light/*.svg architecture/diagrams/dark/*.svg | wc -l) files in architecture/diagrams"
echo "==> These are committed and nothing checks them; commit what changed."
