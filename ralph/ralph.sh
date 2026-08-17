#!/usr/bin/env bash
# Ralph loop: drives Claude Code, one headless invocation per GitHub issue,
# through an ordered list of issue numbers defined in ralph/ralph.config.sh.
#
# What to work and how are configured in ralph/ralph.config.sh — there are no
# positional arguments (and no dependency on the current branch name).
#
# The whole list runs in ONE git worktree on RALPH_BRANCH, forked from
# RALPH_BASE_REF. Each iteration:
#   1. Skips the issue if it is already CLOSED, or (when RALPH_REQUIRE_LABEL is
#      set) if it lacks that label.
#   2. Runs a fresh, non-interactive `claude -p` session to implement it test
#      first, make one commit, tick the issue's acceptance criteria and CLOSE it
#      with a per-criterion report (and close its PRD if it was the last pending
#      issue of that PRD). This step reviews nothing — a PreToolUse hook denies
#      the review skills outright, so the ban is enforced and not merely asked
#      for (see ralph/hooks/no-code-review.sh).
#   3. Re-reads GitHub and the tree, and stops (fail-fast) unless all four hold:
#      the issue is CLOSED, no `- [ ]` is left in its body, HEAD moved, and the
#      worktree is clean. Closing an issue is the cheapest of the four to do
#      without having done the work, which is why the other three exist.
#   4. Runs the repo's own pre-commit checklist over that commit — the sessions
#      all claim to have run it, and this is where the claim is checked
#      (RALPH_VERIFY=0 goes back to taking their word).
#   5. Runs a second, independent session that code-reviews that commit on three
#      axes — standards, spec, tests — and posts its report as a comment on the
#      issue, changing no code (RALPH_REVIEW=0 skips it). The report ends in a
#      RALPH-VERDICT line, and a reviewer that commits anyway stops the run.
#   6. If that verdict counts anything FIXABLE, runs a third session that applies
#      those findings — and only those — and commits them (RALPH_FIX=0 skips
#      it). Its commit is checked against the checklist too, its report has to
#      account for every finding (applied + refused + deferred = fixable), and
#      it leaves the tree and the issue as it found them.
#
# What each session is told lives in ralph/prompts/*.md, versioned with the repo.
# No step invokes a skill: a skill is installed per user and can change under a
# plugin update, while a prompt in git is pinned to the commit that ran it.
#
# Fresh context per iteration is the point (classic "Ralph Wiggum" pattern) —
# it prevents context rot from one giant multi-issue session. Ralph never merges;
# when the list drains it pushes the branch and opens a *draft* PR back to
# RALPH_BASE_REF for you to review.
#
# Each run gets one timestamped folder next to this script, in the MAIN checkout,
# under ralph/ralph-logs/<run>/ (gitignored): a summary.md, one log per issue,
# and a hooks.log naming every code review the hook refused. It survives the
# worktree being torn down and never dirties your tree.
#
# Usage:
#   ralph/ralph.sh [--dry-run] [--max-iterations N]

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

usage() {
  cat <<'EOF'
Ralph loop — drives Claude Code through the GitHub issues listed in
ralph/ralph.config.sh.

Usage:
  ralph/ralph.sh [--dry-run] [--max-iterations N]

  --dry-run           Show the expanded issue list and per-issue gating decisions
                      without invoking claude or creating the worktree.
  --max-iterations N  Stop after N issues are actually run (overrides
                      RALPH_MAX_ITERATIONS). Skipped issues don't count.

What/how to run is configured in ralph/ralph.config.sh
(RALPH_ISSUES, RALPH_BRANCH, RALPH_BASE_REF, RALPH_REQUIRE_LABEL, RALPH_MODEL, ...).
EOF
}

# ── Config ───────────────────────────────────────────────────────────────────
CONFIG_FILE="$SCRIPT_DIR/ralph.config.sh"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing config: $CONFIG_FILE" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$CONFIG_FILE"

# One timestamp per invocation — names the run branch, the log dir, and (unless
# overridden) is what makes each run's branch + PR unique.
RUN_TS="$(date -u +%Y%m%dT%H%M%SZ)"
# Empty RALPH_BRANCH → a fresh per-run branch. A set value is a deliberate
# stable branch (e.g. to resume a dependent batch after a fail-fast).
RALPH_BRANCH="${RALPH_BRANCH:-ralph/$RUN_TS}"
RALPH_BASE_REF="${RALPH_BASE_REF:-dev}"
RALPH_REQUIRE_LABEL="${RALPH_REQUIRE_LABEL:-ready-for-agent}"
RALPH_OPEN_PR="${RALPH_OPEN_PR:-1}"
RALPH_REVIEW="${RALPH_REVIEW:-1}"
RALPH_FIX="${RALPH_FIX:-1}"
RALPH_MODEL="${RALPH_MODEL:-claude-sonnet-5}"
RALPH_REVIEW_MODEL="${RALPH_REVIEW_MODEL:-$RALPH_MODEL}"
RALPH_FIX_MODEL="${RALPH_FIX_MODEL:-$RALPH_MODEL}"
RALPH_PERMISSION_MODE="${RALPH_PERMISSION_MODE:-auto}"
RALPH_MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-}"
# Tools no headless session may use, space-separated (empty = no restriction).
# ScheduleWakeup is the default for one reason: waiting for a notification is a
# dead end when there is no one to deliver it, and a session that tries burns
# its turn and exits having done nothing.
RALPH_DISALLOWED_TOOLS="${RALPH_DISALLOWED_TOOLS-ScheduleWakeup}"
# Enforce "no code review in this session" with a PreToolUse hook rather than
# with the prompt alone. Set to 0 to run on the prompt's word only.
RALPH_BLOCK_CODE_REVIEW="${RALPH_BLOCK_CODE_REVIEW:-1}"
# Run the repo's pre-commit checklist after every commit a session makes,
# instead of taking its word that it did. Set to 0 to trust the sessions.
RALPH_VERIFY="${RALPH_VERIFY:-1}"
# What that checklist is. Defaults to the five commands AGENTS.md names, in the
# order CI runs them — cheap checks first, the one needing a build last.
if [[ -z "${RALPH_CHECKLIST+x}" ]]; then
  RALPH_CHECKLIST=(
    "pnpm typecheck"
    "pnpm test"
    "pnpm run verify:schema:local"
    "pnpm run check:fixtures"
    "pnpm run smoke"
  )
fi

# ── Args ─────────────────────────────────────────────────────────────────────
DRY_RUN=0
MAX_ITERATIONS_OVERRIDE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --max-iterations) MAX_ITERATIONS_OVERRIDE="$2"; shift 2 ;;
    --) shift ;;  # end-of-options separator (pnpm forwards it) — ignore
    -h|--help) usage; exit 0 ;;
    *) echo "Unexpected argument: $1" >&2; usage; exit 1 ;;
  esac
done
MAX_ITERATIONS="${MAX_ITERATIONS_OVERRIDE:-$RALPH_MAX_ITERATIONS}"

if [[ -z "${RALPH_ISSUES+x}" || "${#RALPH_ISSUES[@]}" -eq 0 ]]; then
  echo "RALPH_ISSUES is empty in $CONFIG_FILE — nothing to do." >&2
  exit 1
fi

command -v gh >/dev/null 2>&1 || { echo "ralph: 'gh' not found on PATH — required." >&2; exit 1; }

# ── The prompts ──────────────────────────────────────────────────────────────
# What each session is told lives in ralph/prompts/*.md, versioned with the repo:
# one file per step, editable without touching this runner, and reviewable in a
# PR like anything else. They deliberately invoke no skill. A skill is installed
# per user and versioned by its plugin — three versions of mattpocock-skills sit
# in the cache right now — so a plugin update could change how ralph works with
# no commit here to explain it. A prompt in git is pinned to the commit that ran.
#
# They are read from THIS checkout, not from the worktree: the script and its
# prompts are one unit, and a prompt only just written should work before it is
# committed to the base branch.
PROMPT_DIR="$SCRIPT_DIR/prompts"
: "${RALPH_PROMPT_FILE:=$PROMPT_DIR/1-implement.md}"
: "${RALPH_REVIEW_PROMPT_FILE:=$PROMPT_DIR/2-review.md}"
: "${RALPH_FIX_PROMPT_FILE:=$PROMPT_DIR/3-fix.md}"

# A relative path in the config means "from the repo root", and it has to be
# resolved here: the loop runs after a cd into the worktree, where the same
# relative path points at a different (and possibly older) file.
for _var in RALPH_PROMPT_FILE RALPH_REVIEW_PROMPT_FILE RALPH_FIX_PROMPT_FILE; do
  case "${!_var}" in
    /*) ;;
    *) printf -v "$_var" '%s' "$REPO_ROOT/${!_var}" ;;
  esac
done

# A config from before the prompts moved to disk would silently lose its wording.
for _stale in RALPH_PROMPT RALPH_REVIEW_PROMPT; do
  if [[ -n "${!_stale:-}" ]]; then
    echo "ralph: $_stale is set in $CONFIG_FILE, but prompts now live in files." >&2
    echo "       Move the text into ralph/prompts/*.md and point ${_stale}_FILE at it." >&2
    exit 1
  fi
done

REQUIRED_PROMPTS=("$RALPH_PROMPT_FILE")
[[ "$RALPH_REVIEW" == "1" ]] && REQUIRED_PROMPTS+=("$RALPH_REVIEW_PROMPT_FILE")
[[ "$RALPH_REVIEW" == "1" && "$RALPH_FIX" == "1" ]] && REQUIRED_PROMPTS+=("$RALPH_FIX_PROMPT_FILE")
for f in "${REQUIRED_PROMPTS[@]}"; do
  [[ -f "$f" ]] || { echo "ralph: prompt file not found: $f" >&2; exit 1; }
done

# ── Expand RALPH_ISSUES into an ordered, de-duplicated list of numbers ────────
expand_issues() {
  local spec a b n
  for spec in "${RALPH_ISSUES[@]}"; do
    if [[ "$spec" =~ ^[0-9]+$ ]]; then
      echo "$spec"
    elif [[ "$spec" =~ ^([0-9]+)-([0-9]+)$ ]]; then
      a="${BASH_REMATCH[1]}"; b="${BASH_REMATCH[2]}"
      if (( a > b )); then
        echo "ralph: invalid range '$spec' (start > end) in RALPH_ISSUES." >&2
        exit 1
      fi
      for (( n = a; n <= b; n++ )); do echo "$n"; done
    else
      echo "ralph: invalid RALPH_ISSUES entry '$spec' (expected N or A-B)." >&2
      exit 1
    fi
  done
}

# Command substitution (not process substitution) so an invalid entry's `exit 1`
# in expand_issues actually halts the script instead of being swallowed.
_expanded="$(expand_issues)" || exit 1
ISSUE_NUMBERS=()
declare -A _seen=()
while IFS= read -r _n; do
  [[ -z "$_n" ]] && continue
  if [[ -n "${_seen[$_n]:-}" ]]; then
    echo "ralph: duplicate issue #$_n in list — keeping first, skipping repeat." >&2
    continue
  fi
  _seen[$_n]=1
  ISSUE_NUMBERS+=("$_n")
done <<< "$_expanded"

# ── Issue helpers (query GitHub via gh) ──────────────────────────────────────
# Every read of an issue goes through here, and every one of them retries: the
# API 503s often enough to matter, and a read that fails between two sessions is
# expensive in a way a re-run cannot repair. By that point the issue is CLOSED,
# so a second run skips it — its review is lost, not postponed. Three tries, then
# an empty result the caller has to reckon with.
gh_read() {
  local issue="$1" fields="$2" filter="$3" try out
  for try in 1 2 3; do
    if out="$(gh issue view "$issue" --json "$fields" --jq "$filter" 2>/dev/null)"; then
      printf '%s\n' "$out"
      return 0
    fi
    if [[ "$try" -lt 3 ]]; then sleep 2; fi
  done
  return 1
}

issue_state() {
  # CLOSED / OPEN, or empty string if the issue can't be read.
  gh_read "$1" state '.state' || true
}

issue_has_label() {
  # True (0) if issue $1 carries label $2.
  local out
  out="$(gh_read "$1" labels "any(.labels[]; .name==\"$2\")" || echo false)"
  [[ "$out" == "true" ]]
}

issue_title() {
  gh_read "$1" title '.title' || true
}

# How many `- [ ]` checkboxes issue $1 still carries — or EMPTY when GitHub
# cannot be read, which callers must tell apart from zero.
#
# Every checkbox counts, not only the ones under `## Acceptance criteria`: the
# rule the implementer is given is "nothing in this body is left unticked when
# you close it", and a rule that has to work out which list a box belongs to is
# a rule two readers will read two ways. The body is authored by hand, so if a
# box is there it is there to be earned.
issue_unticked() {
  local body
  body="$(gh_read "$1" body '.body')" || return 1
  grep -cE '^[[:space:]]*[-*][[:space:]]+\[[[:space:]]\]' <<< "$body" || true
}

issue_comment_count() {
  # How many comments issue $1 carries — or EMPTY when GitHub cannot be read,
  # which is not the same thing as zero. The guards below stop the run over a
  # count that failed to grow, so reading a failed read as "0 comments" turns an
  # API outage into "the session left no report" and sends you off to debug a
  # log that is perfectly fine. Callers must check for empty.
  gh_read "$1" comments '.comments | length' || true
}

# The verdict line the review session posted, or empty if it posted none. <from>
# is how many comments the issue carried BEFORE that session ran, so only what it
# actually added is searched.
#
# That window matters in both directions. An OLDER verdict — a previous run, a
# reopened issue — is not this review's, and taking its counts would send the
# fixer after findings nobody made about this commit. A LATER one can't be picked
# up either, which is why the caller reads this before step 3 posts anything that
# might quote it back.
issue_verdict() {
  local issue="$1" from="${2:-0}"
  # Leading and repeated whitespace is tolerated and normalised away — a run is
  # too expensive to abort over an indented line — but the shape is not: two
  # counts, in that order, or no verdict at all.
  gh_read "$issue" comments ".comments[${from}:][].body" |
    grep -oE '^[[:space:]]*RALPH-VERDICT:[[:space:]]+FIXABLE[[:space:]]+[0-9]+[[:space:]]+ADVISORY[[:space:]]+[0-9]+' |
    tail -1 | awk '{print $1, $2, $3, $4, $5}' || true
}

# The fix session's own tally, or empty if it posted none. Same windowing as
# issue_verdict and for the same reason: only what this session added counts.
#
# The reviewer's verdict has always been machine-readable and the fixer's account
# never was, which left the one asymmetry that mattered — the runner knew how
# many findings there were to answer for and had no way to ask whether they were
# answered. Three counts, and their sum has to be the verdict's FIXABLE.
issue_fix_tally() {
  local issue="$1" from="${2:-0}"
  gh_read "$issue" comments ".comments[${from}:][].body" |
    grep -oE '^[[:space:]]*RALPH-FIX:[[:space:]]+APPLIED[[:space:]]+[0-9]+[[:space:]]+REFUSED[[:space:]]+[0-9]+[[:space:]]+DEFERRED[[:space:]]+[0-9]+' |
    tail -1 | awk '{print $1, $2, $3, $4, $5, $6, $7}' || true
}

# Field <n> of a tally line: 3 = APPLIED, 5 = REFUSED, 7 = DEFERRED.
tally_field() {
  [[ -n "$1" ]] || { echo ""; return; }
  awk -v f="$2" '{print $f}' <<< "$1"
}

# The FIXABLE count out of a verdict line ("" when there is no line).
verdict_fixable() {
  [[ -n "$1" ]] || { echo ""; return; }
  awk '{print $3}' <<< "$1"
}

# ── The no-code-review hook ──────────────────────────────────────────────────
# Every prompt here says "run no code review in this session", and saying it was
# never enough: #51 ended with a session taking the native `/code-review`
# anyway, its work green and uncommitted while it waited on a notification
# nobody would deliver. The hook is the half a prompt cannot be — a `deny` that
# arrives as a tool result.
#
# It is wired through `--settings`, which loads *in addition to* the repo's own
# settings, so nothing about your interactive sessions changes: the ban exists
# only for the length of a headless one. The matcher lists the four routes to a
# review; which of them is refused, and in which step, is the hook's own call —
# sub-agents are the review step's whole method and stay open to it.
HOOK_SCRIPT="$SCRIPT_DIR/hooks/no-code-review.sh"
HOOK_SETTINGS=""

setup_hook_settings() {
  [[ "$RALPH_BLOCK_CODE_REVIEW" == "1" ]] || return 0
  if [[ ! -x "$HOOK_SCRIPT" ]]; then
    echo "ralph: $HOOK_SCRIPT is missing or not executable — set RALPH_BLOCK_CODE_REVIEW=0 to run without it." >&2
    exit 1
  fi
  command -v jq >/dev/null 2>&1 || {
    echo "ralph: 'jq' not found on PATH — the no-code-review hook needs it." >&2
    exit 1
  }
  HOOK_SETTINGS="$RUN_DIR/hook-settings.json"
  jq -n --arg cmd "$HOOK_SCRIPT" \
    '{hooks:{PreToolUse:[{matcher:"Skill|SlashCommand|Agent|Task",hooks:[{type:"command",command:$cmd}]}]}}' \
    > "$HOOK_SETTINGS"
}

# One headless session: run_claude <step> <model> <prompt>, where <step> is
# implement | review | fix. All three go through here, so a tool banned for one
# is banned for every one of them, and stdin is closed so a session that asks a
# question dies instead of hanging the run. The step name reaches the hook as an
# env var — it is what tells the hook that a reviewing sub-agent is the job in
# step 2 and a detour in the other two.
run_claude() {
  local step="$1" model="$2" prompt="$3"
  local -a args=(-p "$prompt" --model "$model" --permission-mode "$RALPH_PERMISSION_MODE")
  if [[ -n "$RALPH_DISALLOWED_TOOLS" ]]; then
    # Word-split on purpose: the config holds a space-separated tool list.
    # shellcheck disable=SC2206
    local -a banned=($RALPH_DISALLOWED_TOOLS)
    args+=(--disallowedTools "${banned[@]}")
  fi
  if [[ -n "$HOOK_SETTINGS" ]]; then args+=(--settings "$HOOK_SETTINGS"); fi
  RALPH_STEP="$step" RALPH_HOOK_LOG="$RUN_DIR/hooks.log" claude "${args[@]}" </dev/null
}

# ── The checklist, run by the runner ─────────────────────────────────────────
# run_checklist <label> <log> — the repo's own pre-commit checklist, executed
# here rather than believed.
#
# Every session is told to run it and every session says it did, and until now
# that claim was the only evidence: nothing between the commit and the draft PR
# ever executed a line of it. A session that mis-reads its own green is not
# being dishonest, and the cost of finding out late is what makes this worth a
# minute — in a batch, the issues after this one are implemented *on top* of a
# red commit, and every one of their checklists starts red for a reason that
# isn't theirs. Stopping at the issue that broke it is the whole point.
#
# A failing command is retried once before it counts. Two of these rebuild the
# local D1, and a run of them straight after a session that was using it can
# fail on nothing at all — measured here, once, at rc=1 in under a second, then
# green on the retry. A transient like that must not end a batch.
run_checklist() {
  local label="$1" log="$2" cmd
  printf '\n===== %s =====\n' "$label" >> "$log"
  for cmd in "${RALPH_CHECKLIST[@]}"; do
    printf -- '--- %s ---\n' "$cmd" >> "$log"
    # Through `bash -c` so an entry can be a command *line* — a pipe, an `&&`,
    # a redirection — and not just an argv the caller has to keep quote-free.
    if bash -c "$cmd" >> "$log" 2>&1; then continue; fi
    echo "ralph: [$label] '$cmd' failed — retrying once (local stores can collide)."
    if bash -c "$cmd" >> "$log" 2>&1; then continue; fi
    echo "ralph: [$label] '$cmd' is red." >&2
    return 1
  done
  return 0
}

# verify_commit <issue> <label> — run the checklist over what is committed now,
# and stop the batch if it is red. Called after any session that moved HEAD.
verify_commit() {
  local n="$1" label="$2" log="$RUN_DIR/issue-${n}-checklist.log"
  [[ "$RALPH_VERIFY" == "1" ]] || return 0
  echo "ralph: #$n — running the pre-commit checklist over $label's commit."
  if run_checklist "#$n $label" "$log"; then
    echo "ralph: #$n — checklist green."
    return 0
  fi
  echo "ralph: #$n — the checklist is RED after $label — stopping. See $log"
  echo "       The commit is on the branch: nothing after this issue should be built on it."
  record_result "$summary_file" "$n" "RED (checklist failed after $label)" "$(git rev-parse --short HEAD)"
  exit 1
}

# render_prompt <prompt-file> <issue-number> [base-ref] — reads the file,
# splices in every {{INCLUDE:<path>}} (resolved against ralph/prompts/), fills
# {{N}} and {{BASE}}, and refuses to hand claude anything still carrying a
# placeholder. A shared part lives in one file and is pulled into each prompt
# that needs it, so the smell baseline and the standards map can't drift apart.
render_prompt() {
  local file="$1" issue="$2" base="${3:-}" out inc part pass base_dir
  out="$(cat "$file")"
  # Includes are relative to the prompt that declares them, so a prompt moved
  # elsewhere keeps working as long as its parts travel with it.
  base_dir="$(cd "$(dirname "$file")" && pwd)"

  # Includes may include: resolve until a pass changes nothing. The cap is a
  # cycle breaker — two files that include each other would otherwise spin here.
  for pass in 1 2 3 4 5; do
    [[ "$out" == *'{{INCLUDE:'* ]] || break
    while IFS= read -r inc; do
      [[ -z "$inc" ]] && continue
      part="$base_dir/$inc"
      if [[ ! -f "$part" ]]; then
        echo "ralph: $file includes '$inc', which is not a file under $base_dir." >&2
        exit 1
      fi
      out="${out//\{\{INCLUDE:$inc\}\}/$(cat "$part")}"
    done < <(grep -o '{{INCLUDE:[^}]*}}' <<< "$out" | sed 's/{{INCLUDE://; s/}}//' | sort -u)
  done
  if [[ "$out" == *'{{INCLUDE:'* ]]; then
    echo "ralph: $file still has includes after 5 passes — check for a cycle." >&2
    exit 1
  fi

  out="${out//\{\{N\}\}/$issue}"
  out="${out//\{\{BASE\}\}/$base}"
  if [[ "$out" == *'{{'* ]]; then
    echo "ralph: $file still holds an unresolved placeholder after substitution:" >&2
    grep -o '{{[^}]*}}' <<< "$out" | sort -u | sed 's/^/       /' >&2
    echo "       Only {{N}}, {{BASE}} and {{INCLUDE:<path>}} are substituted." >&2
    exit 1
  fi
  # printf, not echo: a prompt is arbitrary hand-written text, and echo mangles
  # some of it. Backslashes are the live risk — under `shopt -s xpg_echo` echo
  # expands them, so a prompt teaching the model about \n would ship with a real
  # newline instead. printf emits exactly what it is given, whatever the shell's
  # options and whatever the file holds.
  printf '%s\n' "$out"
}

# ── Per-run summary (ralph/ralph-logs/<run>/summary.md, gitignored) ─────────
init_summary() {
  local file="$1"
  { printf '# Ralph run %s\n\n' "$RUN_TS"
    printf -- '- branch: `%s` (base: `%s`)\n' "$RALPH_BRANCH" "$RALPH_BASE_REF"
    printf -- '- issues: %s\n\n' "${ISSUE_NUMBERS[*]/#/#}"
    printf '| when (UTC) | issue | status | commit |\n'
    printf '|---|---|---|---|\n'; } > "$file"
}

record_result() {
  local file="$1" issue="$2" status="$3" commit="$4" ts
  ts="$(date -u +%H:%M:%SZ)"
  printf '| %s | #%s | %s | %s |\n' "$ts" "$issue" "$status" "$commit" >> "$file"
}

# ── Worktree setup (echoes the working directory to use) ──────────────────────
setup_worktree() {
  local branch="$RALPH_BRANCH"
  local wt="$REPO_ROOT/.claude/worktrees/${branch//\//-}"
  if git -C "$REPO_ROOT" worktree list --porcelain | grep -qxF "worktree $wt"; then
    :  # already present — continue where it left off
  elif git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$REPO_ROOT" worktree add "$wt" "$branch" >&2
  else
    git -C "$REPO_ROOT" worktree add -b "$branch" "$wt" "$RALPH_BASE_REF" >&2
  fi

  # Nothing to link in: the prompts are read from this checkout and carry their
  # own includes, so a session inside the worktree needs no skill to resolve.
  echo "$wt"
}

# Build a human-meaningful PR title from the issues in the PR (titles via gh).
pr_title() {
  local -a issues=("$@")
  local first extra
  first="$(issue_title "${issues[0]}")"
  if [[ "${#issues[@]}" -eq 1 ]]; then
    echo "ralph: #${issues[0]} ${first}"
  else
    local nums="#${issues[0]}" i
    for ((i = 1; i < ${#issues[@]}; i++)); do nums+=", #${issues[i]}"; done
    extra=$(( ${#issues[@]} - 1 ))
    echo "ralph: ${nums} — ${first} (+${extra} more)"
  fi
}

pr_body() {
  local -a issues=("$@")
  local body="Autonomous run — issues in this PR:" n
  for n in "${issues[@]}"; do
    body+=$'\n'"- #${n} $(issue_title "$n")"
  done
  body+=$'\n\n'"Draft — review, then merge into \`$RALPH_BASE_REF\`."
  echo "$body"
}

# ── Push + draft PR when the list finishes ───────────────────────────────────
open_pr() {
  local workdir="$1" branch="$RALPH_BRANCH" ahead
  [[ "$RALPH_OPEN_PR" == "1" ]] || return 0
  ahead="$(git -C "$workdir" rev-list --count "${RALPH_BASE_REF}..HEAD" 2>/dev/null || echo 0)"
  if [[ "$ahead" -eq 0 ]]; then
    echo "ralph: no commits ahead of $RALPH_BASE_REF — nothing to PR."
    return 0
  fi

  # Name the PR after the issues actually closed this run; fall back to the
  # configured list (e.g. resuming a stable branch with no new work this run).
  local -a pr_issues=("${PROCESSED_ISSUES[@]}")
  [[ "${#pr_issues[@]}" -eq 0 ]] && pr_issues=("${ISSUE_NUMBERS[@]}")
  local title body
  title="$(pr_title "${pr_issues[@]}")"
  body="$(pr_body "${pr_issues[@]}")"

  set +e
  ( cd "$workdir"
    git push -u origin "$branch" || exit 1
    # Only an OPEN PR counts as "already there". `gh pr view` also returns a
    # merged/closed PR for this branch (e.g. a previous run's, since merged),
    # which would wrongly suppress opening a fresh PR for new work.
    open_num="$(gh pr list --head "$branch" --state open --json number --jq '.[0].number' 2>/dev/null)"
    if [[ -n "$open_num" ]]; then
      echo "ralph: PR #$open_num for '$branch' already open — left as is."
    else
      gh pr create --draft --base "$RALPH_BASE_REF" --head "$branch" \
        --title "$title" --body "$body"
    fi
  )
  local rc=$?
  set -e
  [[ "$rc" -eq 0 ]] || echo "ralph: push/PR step failed (rc=$rc) — branch is intact, open the PR manually." >&2
}

# ── Main ─────────────────────────────────────────────────────────────────────
echo "ralph: branch '$RALPH_BRANCH' (fork from $RALPH_BASE_REF) — issues: ${ISSUE_NUMBERS[*]/#/#}"

# Per-run log folder next to this script (gitignored): summary.md + one log per
# issue; survives the worktree being torn down. Shares RUN_TS with the branch.
RUN_DIR="$REPO_ROOT/ralph/ralph-logs/$RUN_TS"
summary_file="$RUN_DIR/summary.md"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "ralph: [dry-run] would use worktree .claude/worktrees/${RALPH_BRANCH//\//-}, draft PR -> $RALPH_BASE_REF"
  for n in "${ISSUE_NUMBERS[@]}"; do
    state="$(issue_state "$n")"
    if [[ -z "$state" ]]; then
      echo "ralph: [dry-run] #$n — CANNOT READ (missing issue / auth?) — would stop here."
      continue
    fi
    if [[ "$state" == "CLOSED" ]]; then
      echo "ralph: [dry-run] #$n — skip (already CLOSED)"
    elif [[ -n "$RALPH_REQUIRE_LABEL" ]] && ! issue_has_label "$n" "$RALPH_REQUIRE_LABEL"; then
      echo "ralph: [dry-run] #$n — skip (missing label '$RALPH_REQUIRE_LABEL')"
    else
      echo "ralph: [dry-run] #$n — would implement (state=$state)"
    fi
  done
  # The prompts are the other half of what a run does, and a stale placeholder in
  # one only shows up when a session is already being spent — so render them here
  # too, against the first issue in the list.
  # Rendered into a variable, not straight down a pipe: render_prompt refuses a
  # stale placeholder by exiting, and in a pipeline that exit would be a
  # subshell's, leaving a dry-run that reports the problem and still says OK.
  dry_step() {
    local label="$1" model="$2" file="$3" rendered
    rendered="$(render_prompt "$file" "${ISSUE_NUMBERS[0]}" "<implementation base sha>")"
    echo
    echo "ralph: [dry-run] $label prompt — model $model, from ${file#"$REPO_ROOT"/}:"
    sed 's/^/    /' <<< "$rendered"
  }
  dry_step "step 1 (implement)" "$RALPH_MODEL" "$RALPH_PROMPT_FILE"
  if [[ "$RALPH_REVIEW" == "1" ]]; then
    dry_step "step 2 (review)" "$RALPH_REVIEW_MODEL" "$RALPH_REVIEW_PROMPT_FILE"
    if [[ "$RALPH_FIX" == "1" ]]; then
      dry_step "step 3 (fix)" "$RALPH_FIX_MODEL" "$RALPH_FIX_PROMPT_FILE"
      echo
      echo "ralph: [dry-run] step 3 runs only when the review's verdict says FIXABLE > 0."
    fi
  fi
  echo
  echo "ralph: [dry-run] tools banned in every step: ${RALPH_DISALLOWED_TOOLS:-(none)}"
  if [[ "$RALPH_BLOCK_CODE_REVIEW" == "1" ]]; then
    echo "ralph: [dry-run] code review blocked by hook: ${HOOK_SCRIPT#"$REPO_ROOT"/}"
    if [[ ! -x "$HOOK_SCRIPT" ]]; then
      echo "ralph: [dry-run] BUT that hook is missing or not executable — a real run would stop here." >&2
    elif ! command -v jq >/dev/null 2>&1; then
      echo "ralph: [dry-run] BUT 'jq' is not on PATH, and the hook needs it — a real run would stop here." >&2
    fi
  else
    echo "ralph: [dry-run] code review NOT blocked (RALPH_BLOCK_CODE_REVIEW=0) — prompts only."
  fi
  echo "ralph: [dry-run] after step 1 a run stops unless: issue CLOSED, nothing left unticked in its"
  echo "                 body, HEAD moved, and the worktree is clean."
  if [[ "$RALPH_VERIFY" == "1" ]]; then
    echo "ralph: [dry-run] and unless this checklist is green, after every commit:"
    printf '                 %s\n' "${RALPH_CHECKLIST[@]}"
  else
    echo "ralph: [dry-run] the checklist is NOT run (RALPH_VERIFY=0) — the sessions' word stands."
  fi
  echo "ralph: [dry-run] the review session must commit nothing and untick nothing, or the run stops."
  echo "ralph: [dry-run] the fix session must account for every finding (applied + refused + deferred"
  echo "                 = fixable), leave no uncommitted change, and leave the issue closed and ticked."
  echo "ralph: [dry-run] done."
  exit 0
fi

WORKDIR="$(setup_worktree)"
cd "$WORKDIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ralph: worktree at $WORKDIR is dirty — commit/stash/clean it first." >&2
  exit 1
fi

# All preflight checks passed — now create the run's summary (avoids leaving an
# empty summary folder behind when a guard above aborts).
mkdir -p "$RUN_DIR"
init_summary "$summary_file"
setup_hook_settings
echo "ralph: run summary -> $summary_file"
if [[ -n "$HOOK_SETTINGS" ]]; then
  echo "ralph: code review is blocked by hook in every session; refusals -> $RUN_DIR/hooks.log"
else
  echo "ralph: RALPH_BLOCK_CODE_REVIEW=0 — 'no code review' rests on the prompts alone."
fi

GLOBAL_ITER=0
PROCESSED_ISSUES=()   # issues actually implemented + closed this run (names the PR)
for n in "${ISSUE_NUMBERS[@]}"; do
  if [[ -n "$MAX_ITERATIONS" && "$GLOBAL_ITER" -ge "$MAX_ITERATIONS" ]]; then
    echo "ralph: reached max iterations ($MAX_ITERATIONS), stopping."
    break
  fi

  state="$(issue_state "$n")"
  if [[ -z "$state" ]]; then
    echo "ralph: #$n — cannot read from GitHub (missing issue / auth?) — stopping." >&2
    record_result "$summary_file" "$n" "ERROR (unreadable)" "-"
    exit 1
  fi
  if [[ "$state" == "CLOSED" ]]; then
    echo "ralph: #$n — already CLOSED, skipping."
    record_result "$summary_file" "$n" "skipped (already closed)" "-"
    continue
  fi
  if [[ -n "$RALPH_REQUIRE_LABEL" ]] && ! issue_has_label "$n" "$RALPH_REQUIRE_LABEL"; then
    echo "ralph: #$n — missing label '$RALPH_REQUIRE_LABEL', skipping."
    record_result "$summary_file" "$n" "skipped (no '$RALPH_REQUIRE_LABEL' label)" "-"
    continue
  fi

  GLOBAL_ITER=$((GLOBAL_ITER + 1))
  echo "ralph: iteration $GLOBAL_ITER -> issue #$n"

  log_file="$RUN_DIR/issue-${n}.log"
  prompt="$(render_prompt "$RALPH_PROMPT_FILE" "$n")"
  pre_sha="$(git rev-parse HEAD)"   # base for the post-implement review

  # ── Step 1 (isolated): implement the issue, commit it, tick it, close it ──
  set +e
  run_claude implement "$RALPH_MODEL" "$prompt" 2>&1 | tee "$log_file"
  claude_exit="${PIPESTATUS[0]}"
  set -e

  if [[ "$claude_exit" -ne 0 ]]; then
    echo "ralph: #$n — claude exited $claude_exit — stopping. See $log_file"
    record_result "$summary_file" "$n" "FAILED (claude exit $claude_exit)" "-"
    exit 1
  fi

  if [[ "$(issue_state "$n")" != "CLOSED" ]]; then
    # An issue left open carrying 'needs-info' is the session obeying the prompt:
    # the ticket hid a decision only a human can make. Same fail-fast, but the
    # summary says so — this one is a ticket to rewrite, not a run to debug.
    if issue_has_label "$n" "needs-info"; then
      echo "ralph: #$n — left OPEN as needing a human decision — stopping. Read the issue's last comment."
      record_result "$summary_file" "$n" "STOPPED (needs a human decision)" "-"
    else
      echo "ralph: #$n — still OPEN after the session — stopping. Inspect $log_file."
      record_result "$summary_file" "$n" "INCOMPLETE (issue not closed)" "-"
    fi
    exit 1
  fi

  # A closed issue used to be the whole proof that the work happened, and it is
  # the weakest of the four things that should be true by now: closing costs one
  # `gh` call, and a session can make it having committed nothing. So the tree is
  # asked too, and the issue's own checkboxes are asked whether the criteria were
  # met — the implementer ticks them only against something it ran.
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "ralph: #$n — closed, but the worktree still holds uncommitted changes — stopping."
    echo "       The work may be finished and simply not committed: look before you re-run."
    record_result "$summary_file" "$n" "INCOMPLETE (uncommitted changes)" "-"
    exit 1
  fi
  if [[ "$(git rev-parse HEAD)" == "$pre_sha" ]]; then
    echo "ralph: #$n — closed without committing anything (HEAD is still $(git rev-parse --short "$pre_sha")) — stopping."
    echo "       Re-open #$n before re-running: a CLOSED issue is skipped."
    record_result "$summary_file" "$n" "INCOMPLETE (nothing committed)" "-"
    exit 1
  fi
  unticked="$(issue_unticked "$n")"
  if [[ -z "$unticked" ]]; then
    echo "ralph: #$n — cannot read the issue's body from GitHub — stopping."
    record_result "$summary_file" "$n" "ERROR (GitHub unreadable)" "$(git rev-parse --short HEAD)"
    exit 1
  fi
  if [[ "$unticked" -gt 0 ]]; then
    noun="criteria"; [[ "$unticked" -eq 1 ]] && noun="criterion"
    echo "ralph: #$n — closed with $unticked acceptance $noun left unticked — stopping."
    echo "       Read #$n: either the work is short of what was asked, or the session"
    echo "       met it and never said so. Both need you, and neither is the next session's."
    record_result "$summary_file" "$n" "INCOMPLETE ($unticked criteria unticked)" "$(git rev-parse --short HEAD)"
    exit 1
  fi

  verify_commit "$n" "implement"

  commit="$(git rev-parse --short HEAD)"
  echo "ralph: #$n closed ($commit), every acceptance criterion ticked, checklist green."
  record_result "$summary_file" "$n" "closed" "$commit"
  PROCESSED_ISSUES+=("$n")

  # ── Step 2 (isolated, fresh context): independent code-review of the work ──
  # The reviewer reports and does not touch the code: its verdict lands as a
  # comment on the issue, for whoever reads the draft PR. So what proves it ran
  # is a new comment, not a moved HEAD.
  if [[ "$RALPH_REVIEW" == "1" ]]; then
    review_log="$RUN_DIR/issue-${n}-review.log"
    review_prompt="$(render_prompt "$RALPH_REVIEW_PROMPT_FILE" "$n" "$pre_sha")"
    pre_comments="$(issue_comment_count "$n")"
    set +e
    run_claude review "$RALPH_REVIEW_MODEL" "$review_prompt" 2>&1 | tee "$review_log"
    review_exit="${PIPESTATUS[0]}"
    set -e

    if [[ "$review_exit" -ne 0 ]]; then
      echo "ralph: #$n — review session exited $review_exit — stopping. See $review_log"
      record_result "$summary_file" "$n" "REVIEW FAILED (exit $review_exit)" "-"
      exit 1
    fi

    # Two different failures, and they send you to two different places: GitHub
    # being unreadable says nothing about the session, whose report is probably
    # sitting on the issue right now. Note that a re-run will NOT redo this step
    # — the issue is closed by now, so the next run skips it.
    post_comments="$(issue_comment_count "$n")"
    if [[ -z "$pre_comments" || -z "$post_comments" ]]; then
      echo "ralph: #$n — cannot read the issue's comments from GitHub — stopping."
      echo "       The review's report may well be there: read #$n. A re-run skips this"
      echo "       issue (it is CLOSED), so re-review it by hand if the report is missing."
      record_result "$summary_file" "$n" "ERROR (GitHub unreadable)" "$commit"
      exit 1
    fi
    if [[ "$post_comments" -le "$pre_comments" ]]; then
      echo "ralph: #$n — review left no report on the issue — stopping. See $review_log"
      record_result "$summary_file" "$n" "REVIEW INCOMPLETE (no report on #$n)" "-"
      exit 1
    fi

    # Read the verdict now, before step 3 can post a comment quoting it back, and
    # search only the comments this session added — see issue_verdict.
    verdict="$(issue_verdict "$n" "$pre_comments")"
    fixable="$(verdict_fixable "$verdict")"
    if [[ -z "$verdict" ]]; then
      echo "ralph: #$n — the review's report carries no RALPH-VERDICT line — stopping. See $review_log"
      record_result "$summary_file" "$n" "REVIEW INCOMPLETE (no verdict line)" "-"
      exit 1
    fi

    # The reviewer's one prohibition — "you change no code and commit nothing" —
    # used to be the only rule here that was noticed and then waved through. It
    # matters more than it looks: an unasked commit lands inside the range the
    # fix session inherits as "the implementation", so the third session would be
    # applying a review to work the reviewer did after writing it.
    review_head="$(git rev-parse --short HEAD)"
    if [[ "$review_head" != "$commit" ]]; then
      echo "ralph: #$n — the review committed ($review_head) when it was told to commit nothing — stopping."
      echo "       Read that commit: it is inside what step 3 would treat as the implementation."
      record_result "$summary_file" "$n" "REVIEW OVERSTEPPED (unasked commit)" "$review_head"
      exit 1
    fi
    if [[ -n "$(git status --porcelain)" ]]; then
      echo "ralph: #$n — the review left uncommitted changes in the worktree — stopping."
      record_result "$summary_file" "$n" "REVIEW OVERSTEPPED (dirty worktree)" "$commit"
      exit 1
    fi
    # Ticks are the implementer's claim and the review's to dispute in writing,
    # not to edit away: unticking one here would quietly undo the guard that let
    # this issue past step 1.
    review_unticked="$(issue_unticked "$n")"
    if [[ -n "$review_unticked" && "$review_unticked" -gt 0 ]]; then
      noun="criteria"; [[ "$review_unticked" -eq 1 ]] && noun="criterion"
      echo "ralph: #$n — the review unticked $review_unticked acceptance $noun — stopping."
      echo "       Whatever it found belongs in its report, and its report is already on #$n."
      record_result "$summary_file" "$n" "REVIEW OVERSTEPPED (unticked criteria)" "$commit"
      exit 1
    fi
    echo "ralph: #$n — review reported on the issue: $verdict"
    record_result "$summary_file" "$n" "reviewed ($verdict)" "$commit"

    # ── Step 3 (isolated, fresh context): apply what the review found ──
    # Only what the review classed FIXABLE is actionable; a report that is all
    # advisory is a report for Paul, not work for an unattended session. The
    # fixer reports whether or not it commits — that comment is what proves it
    # ran, and it is where a refused finding gets its reason.
    if [[ "$RALPH_FIX" != "1" ]]; then
      :
    elif [[ "$fixable" -eq 0 ]]; then
      echo "ralph: #$n — nothing fixable in the review, skipping the fix session."
    else
      fix_log="$RUN_DIR/issue-${n}-fix.log"
      fix_prompt="$(render_prompt "$RALPH_FIX_PROMPT_FILE" "$n" "$pre_sha")"
      pre_fix_comments="$(issue_comment_count "$n")"
      reviewed_head="$(git rev-parse --short HEAD)"
      set +e
      run_claude fix "$RALPH_FIX_MODEL" "$fix_prompt" 2>&1 | tee "$fix_log"
      fix_exit="${PIPESTATUS[0]}"
      set -e

      if [[ "$fix_exit" -ne 0 ]]; then
        echo "ralph: #$n — fix session exited $fix_exit — stopping. See $fix_log"
        record_result "$summary_file" "$n" "FIX FAILED (exit $fix_exit)" "-"
        exit 1
      fi

      post_fix_comments="$(issue_comment_count "$n")"
      if [[ -z "$pre_fix_comments" || -z "$post_fix_comments" ]]; then
        echo "ralph: #$n — cannot read the issue's comments from GitHub — stopping."
        echo "       Read #$n and 'git log' the branch: the fixes may be committed already."
        record_result "$summary_file" "$n" "ERROR (GitHub unreadable)" "$(git rev-parse --short HEAD)"
        exit 1
      fi
      if [[ "$post_fix_comments" -le "$pre_fix_comments" ]]; then
        echo "ralph: #$n — fix session left no report on the issue — stopping. See $fix_log"
        record_result "$summary_file" "$n" "FIX INCOMPLETE (no report on #$n)" "-"
        exit 1
      fi

      # Every finding has to be accounted for. Refusing all of them is a legal
      # outcome — a reviewer that cannot be wrong is not worth running — but it
      # is also the cheapest thing this session can do, and until the counts were
      # checked "I refused all five" and "I did nothing" reached you as the same
      # line. They still end the same way; they no longer read the same.
      tally="$(issue_fix_tally "$n" "$pre_fix_comments")"
      if [[ -z "$tally" ]]; then
        echo "ralph: #$n — the fix session's report carries no RALPH-FIX line — stopping. See $fix_log"
        record_result "$summary_file" "$n" "FIX INCOMPLETE (no tally line)" "$(git rev-parse --short HEAD)"
        exit 1
      fi
      applied="$(tally_field "$tally" 3)"
      refused="$(tally_field "$tally" 5)"
      deferred="$(tally_field "$tally" 7)"
      if (( applied + refused + deferred != fixable )); then
        echo "ralph: #$n — the fix session accounted for $((applied + refused + deferred)) findings, but the review raised $fixable — stopping."
        echo "       Read its comment on #$n: something in the 'To fix' list went unanswered."
        record_result "$summary_file" "$n" "FIX INCOMPLETE (accounted $((applied + refused + deferred))/$fixable)" "$(git rev-parse --short HEAD)"
        exit 1
      fi

      # The same two things asked of the review session, for the same reasons —
      # except that here the tree matters to the *next* issue: nothing cleans the
      # worktree between iterations, so work left uncommitted by this session
      # becomes the starting state the next implementation inherits.
      if [[ -n "$(git status --porcelain)" ]]; then
        echo "ralph: #$n — the fix session left uncommitted changes in the worktree — stopping."
        echo "       Nothing cleans the tree between issues: left alone, this lands in the next one's commit."
        record_result "$summary_file" "$n" "FIX OVERSTEPPED (uncommitted changes)" "$(git rev-parse --short HEAD)"
        exit 1
      fi
      fix_unticked="$(issue_unticked "$n")"
      if [[ -n "$fix_unticked" && "$fix_unticked" -gt 0 ]]; then
        noun="criteria"; [[ "$fix_unticked" -eq 1 ]] && noun="criterion"
        echo "ralph: #$n — the fix session unticked $fix_unticked acceptance $noun — stopping."
        record_result "$summary_file" "$n" "FIX OVERSTEPPED (unticked criteria)" "$(git rev-parse --short HEAD)"
        exit 1
      fi
      if [[ "$(issue_state "$n")" != "CLOSED" ]]; then
        echo "ralph: #$n — the fix session re-opened the issue — stopping."
        echo "       A re-opened issue is worked again from scratch by the next run; whatever it found belongs in its comment."
        record_result "$summary_file" "$n" "FIX OVERSTEPPED (issue re-opened)" "$(git rev-parse --short HEAD)"
        exit 1
      fi

      # Deferred findings don't stop the run: they are not this batch's problem,
      # and the issues after this one are unaffected. They do have to be findable
      # later, which is what the label is for — the session adds it, and this says
      # so out loud rather than leaving it in a comment on a closed issue.
      tally_text="$applied applied, $refused refused, $deferred deferred"
      if [[ "$deferred" -gt 0 ]]; then
        echo "ralph: #$n — $deferred finding(s) deferred to you: gh issue view $n (labelled ready-for-human)."
      fi

      fix_head="$(git rev-parse --short HEAD)"
      if [[ "$fix_head" != "$reviewed_head" ]]; then
        # The fixer is told not to commit unless the checklist is green. Same
        # claim as the implementer's, checked the same way — and this commit is
        # the last thing to touch the branch before the PR.
        verify_commit "$n" "fix"
        echo "ralph: #$n — fixes committed ($fix_head), checklist green — $tally_text."
        record_result "$summary_file" "$n" "fixed ($tally_text)" "$fix_head"
      else
        echo "ralph: #$n — fix session committed nothing — $tally_text. Read its comment on #$n."
        record_result "$summary_file" "$n" "fix: nothing committed ($tally_text)" "$fix_head"
      fi
    fi
  fi
done

open_pr "$WORKDIR"
cd "$REPO_ROOT"
echo "ralph: done."
