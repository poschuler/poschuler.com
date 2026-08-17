#!/usr/bin/env bash
# Ralph cleanup: tear down the worktree + branch left behind by one or more
# finished ralph runs — but ONLY when it is safe to do so.
#
# A ralph run (ralph/ralph.sh) works its whole issue list in ONE worktree at
# .claude/worktrees/ralph-<run>, on branch "ralph/<run>", and opens ONE draft PR
# back to RALPH_BASE_REF. It never cleans up after itself: while that PR is open
# the branch is the only place the work exists, so nothing is removed out from
# under you. This script codifies the two-step cleanup — remove the worktree,
# THEN delete the branch — with guardrails that refuse to discard unmerged or
# uncommitted work.
#
# <run> is the run's UTC timestamp, the same string that names its log folder
# ralph/ralph-logs/<run>/. The run whose summary you just read is the run you
# name here. Those logs live in the main checkout; nothing below touches them.
#
# Safety (each check is skipped only with --force):
#   * a worktree with uncommitted changes is left untouched;
#   * a branch with commits not yet in RALPH_BASE_REF is left untouched.
#
# Usage:
#   ralph/ralph-clean.sh [run ...]    Clean the named run(s).
#   ralph/ralph-clean.sh              Scan & clean every safe ralph/* run.
#   ralph/ralph-clean.sh --dry-run    Report what would happen; change nothing.
#   ralph/ralph-clean.sh --force ...  Override the safety checks (explicit).

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

usage() {
  cat <<'EOF'
Ralph cleanup — safely tear down finished ralph run worktrees + branches.

Usage:
  ralph/ralph-clean.sh [run ...]    Clean the named run(s).
  ralph/ralph-clean.sh              Scan & clean every safe ralph/* run.

  --dry-run   Show what would be removed without touching anything.
  --force     Remove even dirty worktrees / unmerged branches (use with care).

A run is named by its UTC timestamp — the same one that names its log folder
under ralph/ralph-logs/. Refuses by default to delete a worktree with
uncommitted changes or a branch holding commits not yet in RALPH_BASE_REF
(default: dev). Never touches anything outside the "ralph/" branch namespace.
EOF
}

# ── Config ────────────────────────────────────────────────────────────────────
# Only RALPH_BASE_REF is read from the config: it is what "already merged" means.
# The naming is not configurable in ralph.sh either — it hard-codes the branch as
# ralph/<run> and derives the worktree directory from it by swapping the slash —
# so both are spelled out here once, the same way.
CONFIG_FILE="$SCRIPT_DIR/ralph.config.sh"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
fi
RALPH_BASE_REF="${RALPH_BASE_REF:-dev}"
BRANCH_PREFIX="ralph/"
WORKTREE_DIR_PREFIX="${BRANCH_PREFIX//\//-}"   # ralph.sh: .claude/worktrees/${branch//\//-}

# ── Args ─────────────────────────────────────────────────────────────────────
DRY_RUN=0
FORCE=0
RUNS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --force) FORCE=1; shift ;;
    --) shift ;;  # end-of-options separator (pnpm forwards it) — ignore
    -h|--help) usage; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    *) RUNS+=("$1"); shift ;;
  esac
done

# A stable RALPH_BRANCH — set in the config to resume a dependent batch after a
# fail-fast — is only reachable here if it lives in the ralph/ namespace. One
# that doesn't is reported, never touched: this script deletes branches, and it
# does that only where ralph.sh is the one that created them.
if [[ -n "${RALPH_BRANCH:-}" && "${RALPH_BRANCH}" != "$BRANCH_PREFIX"* ]]; then
  echo "ralph-clean: note — the config pins RALPH_BRANCH='$RALPH_BRANCH', outside the '$BRANCH_PREFIX' namespace." >&2
  echo "ralph-clean:        it is left alone; remove that worktree and branch by hand when it is merged." >&2
fi

# ── Discovery: every run that has a ralph worktree and/or a ralph branch ──────
discover_runs() {
  {
    git worktree list --porcelain \
      | sed -n "s#^worktree .*/\.claude/worktrees/${WORKTREE_DIR_PREFIX}\(.*\)\$#\1#p"
    git for-each-ref --format='%(refname:short)' refs/heads \
      | sed -n "s#^${BRANCH_PREFIX}\(.*\)\$#\1#p"
  } | sort -u
}

# ── Clean one run ─────────────────────────────────────────────────────────────
clean_run() {
  local run="$1"
  local branch="${BRANCH_PREFIX}${run}"
  local wt="$REPO_ROOT/.claude/worktrees/${WORKTREE_DIR_PREFIX}${run}"

  local have_wt=0 have_branch=0
  if git worktree list --porcelain | grep -qxF "worktree $wt"; then have_wt=1; fi
  if git show-ref --verify --quiet "refs/heads/$branch"; then have_branch=1; fi

  if [[ "$have_wt" -eq 0 && "$have_branch" -eq 0 ]]; then
    echo "ralph-clean: [$run] no worktree or branch found — nothing to do."
    return 0
  fi

  # A worktree whose directory was deleted by hand still shows in git's list; the
  # `git worktree remove` below clears that record, and it has to run — skipping
  # it would leave the branch "used by worktree" and `git branch -d` would fail.
  #
  # Guard: uncommitted changes in the worktree.
  if [[ "$have_wt" -eq 1 && -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]]; then
    if [[ "$FORCE" -eq 1 ]]; then
      echo "ralph-clean: [$run] worktree is dirty — removing anyway (--force)."
    else
      echo "ralph-clean: [$run] SKIP — worktree has uncommitted changes ($wt)." >&2
      echo "ralph-clean: [$run]   commit/stash there, or re-run with --force." >&2
      return 0
    fi
  fi

  # Guard: branch has commits not yet in the base ref. That ref is the LOCAL one,
  # so a PR merged on GitHub still reads as unmerged until you pull.
  if [[ "$have_branch" -eq 1 ]]; then
    local ahead
    if git rev-parse --verify --quiet "$RALPH_BASE_REF" >/dev/null; then
      ahead="$(git rev-list --count "${RALPH_BASE_REF}..${branch}" 2>/dev/null || echo 0)"
    else
      echo "ralph-clean: [$run] base ref '$RALPH_BASE_REF' not found — cannot verify merge state." >&2
      [[ "$FORCE" -eq 1 ]] || { echo "ralph-clean: [$run] SKIP (use --force to override)." >&2; return 0; }
      ahead=0
    fi
    if [[ "$ahead" != "0" ]]; then
      if [[ "$FORCE" -eq 1 ]]; then
        echo "ralph-clean: [$run] branch has $ahead commit(s) not in $RALPH_BASE_REF — deleting anyway (--force)."
      else
        echo "ralph-clean: [$run] SKIP — branch '$branch' has $ahead commit(s) not in $RALPH_BASE_REF." >&2
        echo "ralph-clean: [$run]   already merged the PR? 'git switch $RALPH_BASE_REF && git pull' first." >&2
        echo "ralph-clean: [$run]   otherwise merge/close it, or re-run with --force." >&2
        return 0
      fi
    fi
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    [[ "$have_wt" -eq 1 ]] && echo "ralph-clean: [dry-run] [$run] would remove worktree $wt"
    [[ "$have_branch" -eq 1 ]] && echo "ralph-clean: [dry-run] [$run] would delete branch $branch"
    return 0
  fi

  if [[ "$have_wt" -eq 1 ]]; then
    if [[ "$FORCE" -eq 1 ]]; then
      git worktree remove --force "$wt"
    else
      git worktree remove "$wt"
    fi
    echo "ralph-clean: [$run] removed worktree $wt"
  fi
  if [[ "$have_branch" -eq 1 ]]; then
    if [[ "$FORCE" -eq 1 ]]; then
      git branch -D "$branch"
    else
      git branch -d "$branch"
    fi
    echo "ralph-clean: [$run] deleted branch $branch"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
if [[ "${#RUNS[@]}" -eq 0 ]]; then
  while IFS= read -r run; do
    [[ -n "$run" ]] && RUNS+=("$run")
  done < <(discover_runs)
fi

if [[ "${#RUNS[@]}" -eq 0 ]]; then
  echo "ralph-clean: no ralph worktrees or branches found — nothing to do."
  exit 0
fi

for run in "${RUNS[@]}"; do
  clean_run "$run"
done

# Drop administrative entries for any worktrees whose directories are gone.
[[ "$DRY_RUN" -eq 1 ]] || git worktree prune
echo "ralph-clean: done."
