#!/usr/bin/env bash
#
# Assert that the Worker now serving production is the one this run uploaded.
#
#     bash scripts/verify-deployment.sh <expected-version-id>
#
# `wrangler deploy` exiting 0 means the upload was accepted. It does not mean
# the upload became the active deployment — a version can exist without serving
# anything, which is exactly what `wrangler versions upload` does on purpose.
# This closes that gap: it reads back which version is live and at what share of
# traffic, and refuses anything that is not this run's version at 100%.
#
# What it deliberately does NOT do is ask the site whether it works. That was
# the first attempt and it failed on the very first run — with a 403, from a
# healthy site. The zone has Bot Fight Mode on, which challenges automated
# clients from datacentre networks, and a GitHub runner is one. Cloudflare's own
# documentation is explicit that it cannot be worked around: "You cannot bypass
# or skip Bot Fight Mode using WAF custom rules or Page Rules" — it runs outside
# the Ruleset Engine, so Skip, Bypass and Allow have no effect. Detecting the
# challenge and continuing would have been worse than useless: the challenge is
# issued at the edge, before the Worker, so a genuinely broken origin would
# produce the same response as a healthy one. A check that cannot fail is not a
# check.
#
# So the gap this leaves is real and worth naming: nothing here proves the site
# serves. A missing secret or a binding pointing at the wrong resource would
# pass. Catching that needs a request from somewhere Bot Fight Mode does not
# challenge, which means continuous monitoring rather than a step in this run.

set -euo pipefail

EXPECTED="${1:-}"

if [[ -z "${EXPECTED}" ]]; then
	echo "error: pass the version id that 'wrangler deploy' reported." >&2
	exit 1
fi

echo "==> Reading back the active deployment"

STATUS="$(pnpm exec wrangler deployments status)"

echo "${STATUS}"

# `Version(s):  (100%) <uuid>` for a single-version deployment, and one line per
# version when traffic is split. Both are matched, so a gradual rollout that
# somehow got configured shows up as two lines rather than passing on the first.
mapfile -t SERVING < <(grep -oE '\(([0-9]+)%\) [0-9a-f-]{36}' <<<"${STATUS}" || true)

if [[ ${#SERVING[@]} -eq 0 ]]; then
	echo >&2
	echo "error: could not read an active version out of 'wrangler deployments status'." >&2
	echo "       The output format may have changed; the deploy itself may be fine." >&2
	exit 1
fi

if [[ ${#SERVING[@]} -gt 1 ]]; then
	echo >&2
	echo "error: traffic is split across ${#SERVING[@]} versions:" >&2
	printf '       %s\n' "${SERVING[@]}" >&2
	echo "       This workflow only ever deploys one version at 100%." >&2
	exit 1
fi

ACTIVE="${SERVING[0]}"

if [[ "${ACTIVE}" != "(100%) ${EXPECTED}" ]]; then
	echo >&2
	echo "error: the live Worker is not the one this run uploaded." >&2
	echo "       uploaded: ${EXPECTED}" >&2
	echo "       serving:  ${ACTIVE}" >&2
	exit 1
fi

echo
echo "==> ${EXPECTED} is serving 100% of traffic"
