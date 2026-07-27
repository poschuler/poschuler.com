#!/usr/bin/env bash
# Ralph loop: drives Claude Code, one headless invocation per GitHub issue,
# through an ordered list of issue numbers defined in scripts/ralph.config.sh.
#
# What to work and how are configured in scripts/ralph.config.sh — there are no
# positional arguments (and no dependency on the current branch name).
#
# The whole list runs in ONE git worktree on RALPH_BRANCH, forked from
# RALPH_BASE_REF. Each iteration:
#   1. Skips the issue if it is already CLOSED, or (when RALPH_REQUIRE_LABEL is
#      set) if it lacks that label.
#   2. Runs a fresh, non-interactive `claude -p` session to implement it via the
#      implement skill, make one commit, and — if the acceptance criteria hold —
#      CLOSE the issue with a summary comment (and close its PRD if it was the
#      last pending issue of that PRD).
#   3. Re-reads the issue state from GitHub; if it isn't CLOSED, stops instead of
#      guessing why and moving on (fail-fast).
#
# Fresh context per iteration is the point (classic "Ralph Wiggum" pattern) —
# it prevents context rot from one giant multi-issue session. Ralph never merges;
# when the list drains it pushes the branch and opens a *draft* PR back to
# RALPH_BASE_REF for you to review.
#
# Each run gets one timestamped folder next to this script, in the MAIN checkout,
# under scripts/ralph-logs/<run>/ (gitignored): a summary.md plus one log per
# issue. It survives the worktree being torn down and never dirties your tree.
#
# Usage:
#   scripts/ralph.sh [--dry-run] [--max-iterations N]

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

usage() {
  cat <<'EOF'
Ralph loop — drives Claude Code through the GitHub issues listed in
scripts/ralph.config.sh.

Usage:
  scripts/ralph.sh [--dry-run] [--max-iterations N]

  --dry-run           Show the expanded issue list and per-issue gating decisions
                      without invoking claude or creating the worktree.
  --max-iterations N  Stop after N issues are actually run (overrides
                      RALPH_MAX_ITERATIONS). Skipped issues don't count.

What/how to run is configured in scripts/ralph.config.sh
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
RALPH_MODEL="${RALPH_MODEL:-claude-sonnet-5}"
RALPH_REVIEW_MODEL="${RALPH_REVIEW_MODEL:-$RALPH_MODEL}"
RALPH_PERMISSION_MODE="${RALPH_PERMISSION_MODE:-auto}"
RALPH_MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-}"

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

# Skills the prompts drive (see build_prompt / build_review_prompt). They must
# exist in the main checkout, or nothing downstream can resolve them — fail fast.
RALPH_SKILL="implement"
RALPH_REVIEW_SKILL="code-review"
REQUIRED_SKILLS=("$RALPH_SKILL")
[[ "$RALPH_REVIEW" == "1" ]] && REQUIRED_SKILLS+=("$RALPH_REVIEW_SKILL")
for s in "${REQUIRED_SKILLS[@]}"; do
  if [[ ! -f "$REPO_ROOT/.claude/skills/$s/SKILL.md" ]]; then
    echo "ralph: skill '$s' not found at $REPO_ROOT/.claude/skills/$s — cannot run." >&2
    exit 1
  fi
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
issue_state() {
  # CLOSED / OPEN, or empty string if the issue can't be read.
  gh issue view "$1" --json state --jq '.state' 2>/dev/null || true
}

issue_has_label() {
  # True (0) if issue $1 carries label $2.
  local out
  out="$(gh issue view "$1" --json labels --jq "any(.labels[]; .name==\"$2\")" 2>/dev/null || echo false)"
  [[ "$out" == "true" ]]
}

issue_title() {
  gh issue view "$1" --json title --jq '.title' 2>/dev/null || true
}

build_prompt() {
  local n="$1"
  local template
  template="$(cat <<'PROMPT'
/{{SKILL}} issue #{{N}}. When the implementation is done, verify every acceptance
criterion is met; if so, close the issue and leave a comment summarizing the work
and the criteria that were met. If this is the last open issue of its PRD, close
the PRD too with a summary comment.
PROMPT
)"
  template="${template//\{\{SKILL\}\}/$RALPH_SKILL}"
  echo "${template//\{\{N\}\}/$n}"
}

build_review_prompt() {
  local base="$1"
  local template
  template="$(cat <<'PROMPT'
/{{SKILL}} {{BASE}}. Make sure every acceptance criterion of the issue is met, and
if you find any errors you must fix them. Commit your fixes when you are done.
PROMPT
)"
  template="${template//\{\{SKILL\}\}/$RALPH_REVIEW_SKILL}"
  echo "${template//\{\{BASE\}\}/$base}"
}

# ── Per-run summary (scripts/ralph-logs/<run>/summary.md, gitignored) ─────────
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

  # The project's skills live in the gitignored .claude/, so a fresh worktree
  # checkout doesn't have them and `/implement` would not resolve when claude
  # runs from inside the worktree. Point the worktree's .claude/skills at the
  # main checkout's. Absolute target + `-sfn` keeps it idempotent on resume and
  # stops it nesting inside an existing link; .claude/ is gitignored so the link
  # never dirties the tree.
  mkdir -p "$wt/.claude"
  ln -sfn "$REPO_ROOT/.claude/skills" "$wt/.claude/skills" >&2
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
RUN_DIR="$REPO_ROOT/scripts/ralph-logs/$RUN_TS"
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
  echo "ralph: [dry-run] done."
  exit 0
fi

WORKDIR="$(setup_worktree)"
cd "$WORKDIR"

# Fail fast if the skill doesn't resolve from inside the worktree (a broken or
# missing symlink) — otherwise claude would run without /$RALPH_SKILL and quietly
# do the wrong thing.
for s in "${REQUIRED_SKILLS[@]}"; do
  if [[ ! -f "$WORKDIR/.claude/skills/$s/SKILL.md" ]]; then
    echo "ralph: skill '$s' does not resolve inside the worktree" >&2
    echo "       ($WORKDIR/.claude/skills/$s) — the symlink is broken. Stopping." >&2
    exit 1
  fi
done

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ralph: worktree at $WORKDIR is dirty — commit/stash/clean it first." >&2
  exit 1
fi

# All preflight checks passed — now create the run's summary (avoids leaving an
# empty summary folder behind when a guard above aborts).
mkdir -p "$RUN_DIR"
init_summary "$summary_file"
echo "ralph: run summary -> $summary_file"

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
  prompt="$(build_prompt "$n")"
  pre_sha="$(git rev-parse HEAD)"   # base for the post-implement review

  # ── Step 1 (isolated): implement the issue ──
  set +e
  claude -p "$prompt" --model "$RALPH_MODEL" --permission-mode "$RALPH_PERMISSION_MODE" </dev/null 2>&1 | tee "$log_file"
  claude_exit="${PIPESTATUS[0]}"
  set -e

  if [[ "$claude_exit" -ne 0 ]]; then
    echo "ralph: #$n — claude exited $claude_exit — stopping. See $log_file"
    record_result "$summary_file" "$n" "FAILED (claude exit $claude_exit)" "-"
    exit 1
  fi

  if [[ "$(issue_state "$n")" != "CLOSED" ]]; then
    echo "ralph: #$n — still OPEN after the session — stopping. Inspect $log_file."
    record_result "$summary_file" "$n" "INCOMPLETE (issue not closed)" "-"
    exit 1
  fi

  commit="$(git rev-parse --short HEAD)"
  echo "ralph: #$n closed ($commit)."
  record_result "$summary_file" "$n" "closed" "$commit"
  PROCESSED_ISSUES+=("$n")

  # ── Step 2 (isolated, fresh context): independent code-review of the work ──
  if [[ "$RALPH_REVIEW" == "1" ]]; then
    review_log="$RUN_DIR/issue-${n}-review.log"
    review_prompt="$(build_review_prompt "$pre_sha")"
    set +e
    claude -p "$review_prompt" --model "$RALPH_REVIEW_MODEL" --permission-mode "$RALPH_PERMISSION_MODE" </dev/null 2>&1 | tee "$review_log"
    review_exit="${PIPESTATUS[0]}"
    set -e

    if [[ "$review_exit" -ne 0 ]]; then
      echo "ralph: #$n — review session exited $review_exit — stopping. See $review_log"
      record_result "$summary_file" "$n" "REVIEW FAILED (exit $review_exit)" "-"
      exit 1
    fi

    review_head="$(git rev-parse --short HEAD)"
    if [[ "$review_head" != "$commit" ]]; then
      echo "ralph: #$n — review committed fixes ($review_head)."
      record_result "$summary_file" "$n" "reviewed (fixes)" "$review_head"
    else
      echo "ralph: #$n — review found nothing to fix."
      record_result "$summary_file" "$n" "reviewed (clean)" "$commit"
    fi
  fi
done

open_pr "$WORKDIR"
cd "$REPO_ROOT"
echo "ralph: done."
