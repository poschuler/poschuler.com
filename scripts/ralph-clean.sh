#!/usr/bin/env bash
# Ralph cleanup: tear down the worktree + branch for one or more finished ralph
# features — but ONLY when it is safe to do so.
#
# Ralph (scripts/ralph.sh) creates a throwaway worktree at
# .claude/worktrees/ralph-<slug> on branch "<RALPH_BRANCH_PREFIX><slug>" per
# feature, opens a draft PR back to RALPH_BASE_REF, and never cleans up — that
# is left to you so logs survive and nothing is deleted out from under you.
# This script codifies the two-step cleanup (remove the worktree, THEN delete
# the branch) with guardrails so it can never discard unmerged or uncommitted
# work.
#
# Safety (each check is skipped only with --force):
#   * a worktree with uncommitted changes is left untouched;
#   * a branch with commits not yet in RALPH_BASE_REF is left untouched.
#
# Base ref, branch prefix, and the worktree path convention are read from
# scripts/ralph.config.sh so this stays in lockstep with ralph.sh.
#
# Usage:
#   scripts/ralph-clean.sh [slug ...]   Clean the named feature(s).
#   scripts/ralph-clean.sh              Scan & clean every safe ralph/* feature.
#   scripts/ralph-clean.sh --dry-run    Report what would happen; change nothing.
#   scripts/ralph-clean.sh --force ...  Override the safety checks (explicit).

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

usage() {
  cat <<'EOF'
Ralph cleanup — safely tear down finished ralph feature worktrees + branches.

Usage:
  scripts/ralph-clean.sh [slug ...]   Clean the named feature(s).
  scripts/ralph-clean.sh              Scan & clean every safe ralph/* feature.

  --dry-run   Show what would be removed without touching anything.
  --force     Remove even dirty worktrees / unmerged branches (use with care).

Refuses by default to delete a worktree with uncommitted changes or a branch
holding commits not yet in RALPH_BASE_REF (default: dev). Never touches
anything outside the "<RALPH_BRANCH_PREFIX>*" namespace.
EOF
}

# ── Config (shared with ralph.sh) ─────────────────────────────────────────────
CONFIG_FILE="$SCRIPT_DIR/ralph.config.sh"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
fi
RALPH_BASE_REF="${RALPH_BASE_REF:-dev}"
RALPH_BRANCH_PREFIX="${RALPH_BRANCH_PREFIX:-ralph/}"
# ralph.sh fixes the worktree directory name as "ralph-<slug>" (see
# setup_worktree); mirror that here rather than deriving it from the branch
# prefix, which uses a slash.
WORKTREE_DIR_PREFIX="ralph-"

# ── Args ─────────────────────────────────────────────────────────────────────
DRY_RUN=0
FORCE=0
SLUGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    *) SLUGS+=("$1"); shift ;;
  esac
done

# ── Discovery: every slug that has a ralph worktree and/or ralph branch ───────
discover_slugs() {
  {
    git worktree list --porcelain \
      | sed -n "s#^worktree .*/\.claude/worktrees/${WORKTREE_DIR_PREFIX}\(.*\)\$#\1#p"
    git for-each-ref --format='%(refname:short)' refs/heads \
      | sed -n "s#^${RALPH_BRANCH_PREFIX}\(.*\)\$#\1#p"
  } | sort -u
}

# ── Clean one feature ─────────────────────────────────────────────────────────
clean_one() {
  local slug="$1"
  local branch="${RALPH_BRANCH_PREFIX}${slug}"
  local wt="$REPO_ROOT/.claude/worktrees/${WORKTREE_DIR_PREFIX}${slug}"

  local have_wt=0 have_branch=0
  if git worktree list --porcelain | grep -qxF "worktree $wt"; then have_wt=1; fi
  if git show-ref --verify --quiet "refs/heads/$branch"; then have_branch=1; fi

  if [[ "$have_wt" -eq 0 && "$have_branch" -eq 0 ]]; then
    echo "ralph-clean: [$slug] no worktree or branch found — nothing to do."
    return 0
  fi

  # Guard: uncommitted changes in the worktree.
  if [[ "$have_wt" -eq 1 && -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]]; then
    if [[ "$FORCE" -eq 1 ]]; then
      echo "ralph-clean: [$slug] worktree is dirty — removing anyway (--force)."
    else
      echo "ralph-clean: [$slug] SKIP — worktree has uncommitted changes ($wt)." >&2
      echo "ralph-clean: [$slug]   commit/stash there, or re-run with --force." >&2
      return 0
    fi
  fi

  # Guard: branch has commits not yet in the base ref.
  if [[ "$have_branch" -eq 1 ]]; then
    local ahead
    if git rev-parse --verify --quiet "$RALPH_BASE_REF" >/dev/null; then
      ahead="$(git rev-list --count "${RALPH_BASE_REF}..${branch}" 2>/dev/null || echo 0)"
    else
      echo "ralph-clean: [$slug] base ref '$RALPH_BASE_REF' not found — cannot verify merge state." >&2
      [[ "$FORCE" -eq 1 ]] || { echo "ralph-clean: [$slug] SKIP (use --force to override)." >&2; return 0; }
      ahead=0
    fi
    if [[ "$ahead" != "0" ]]; then
      if [[ "$FORCE" -eq 1 ]]; then
        echo "ralph-clean: [$slug] branch has $ahead commit(s) not in $RALPH_BASE_REF — deleting anyway (--force)."
      else
        echo "ralph-clean: [$slug] SKIP — branch '$branch' has $ahead commit(s) not in $RALPH_BASE_REF." >&2
        echo "ralph-clean: [$slug]   merge/close its PR first, or re-run with --force." >&2
        return 0
      fi
    fi
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    [[ "$have_wt" -eq 1 ]] && echo "ralph-clean: [dry-run] [$slug] would remove worktree $wt"
    [[ "$have_branch" -eq 1 ]] && echo "ralph-clean: [dry-run] [$slug] would delete branch $branch"
    return 0
  fi

  if [[ "$have_wt" -eq 1 ]]; then
    if [[ "$FORCE" -eq 1 ]]; then
      git worktree remove --force "$wt"
    else
      git worktree remove "$wt"
    fi
    echo "ralph-clean: [$slug] removed worktree $wt"
  fi
  if [[ "$have_branch" -eq 1 ]]; then
    if [[ "$FORCE" -eq 1 ]]; then
      git branch -D "$branch"
    else
      git branch -d "$branch"
    fi
    echo "ralph-clean: [$slug] deleted branch $branch"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
if [[ "${#SLUGS[@]}" -eq 0 ]]; then
  while IFS= read -r slug; do
    [[ -n "$slug" ]] && SLUGS+=("$slug")
  done < <(discover_slugs)
fi

if [[ "${#SLUGS[@]}" -eq 0 ]]; then
  echo "ralph-clean: no ralph worktrees or branches found — nothing to do."
  exit 0
fi

for slug in "${SLUGS[@]}"; do
  clean_one "$slug"
done

# Drop administrative entries for any worktrees whose directories are gone.
[[ "$DRY_RUN" -eq 1 ]] || git worktree prune
echo "ralph-clean: done."
