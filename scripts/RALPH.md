# Ralph

Ralph drives Claude Code through a list of **GitHub issues** — one fresh,
headless `claude -p` session per issue, each producing one commit and closing
its issue. It doesn't *write* issues; it *implements* ones you've already
authored and labelled.

Configuration lives in [`ralph.config.sh`](./ralph.config.sh); the loop is in
[`ralph.sh`](./ralph.sh).

---

## Mental model

- You author issues on **GitHub** (label them `ready-for-agent`), then list the
  numbers you want worked in `ralph.config.sh`.
- Ralph runs the whole list in **one git worktree** on a **fresh per-run branch
  `ralph/<timestamp>`**, forked from `dev`. For each issue it runs a **fresh
  Claude session** (fresh context per issue is the point — it avoids context rot)
  to implement it, then verifies the issue was **closed** on GitHub, and moves on.
- When the list drains, Ralph pushes and opens **one draft PR back to `dev`**,
  titled after the issues it worked (so it reads well even though the branch is a
  timestamp).
- **Ralph never merges.** Reviewing and merging is your job — the human gate.

This fits the repo's branching model: `main` = production, `dev` = integration;
work forks from `dev` and PRs back to `dev`; `dev → main` is a release.

---

## One-time setup

Nothing to install — `ralph.sh` uses `git`, `claude`, and `gh`. Make sure
`gh auth status` is logged in and `claude` is on your PATH.

---

## Using ralph, step by step

### 1. Author the issues on GitHub

Write each issue with everything an agent needs: problem, solution, and its
**acceptance criteria** — in this repo those are expressed as the *User Stories*
plus the *Testing Decisions* / *Implementation Decisions* sections. Label the
ones ready to be picked up `ready-for-agent`.

**Optional PRD auto-close.** If an issue belongs to a PRD and you want Ralph to
close that PRD when the last child is done, add a line to the issue body:

```
PRD: #19
```

After closing an issue, the session lists the siblings that declare the same
`PRD: #NN`; if they're all closed, it closes the PRD too. No `PRD:` line → that
step is simply skipped.

### 2. List the issues to work

Edit [`ralph.config.sh`](./ralph.config.sh). Each entry is a single issue or an
**inclusive range** `"A-B"`; array order is priority:

```bash
RALPH_ISSUES=(
  50          # single issue
  "51-53"     # inclusive range → 51, 52, 53
  55
)
# RALPH_BRANCH=""   # empty → a fresh per-run branch ralph/<timestamp>
```

Leave `RALPH_BRANCH` **empty** (the default) and each run gets its own branch
`ralph/<timestamp>` + its own PR — batches never collide. Set a **stable** name
only to **resume a dependent multi-issue batch** after a fail-fast: a re-run then
reuses that worktree, resumes where it stopped, and skips issues already closed.
(For a single issue or independent issues, you never need to — the default is
right.)

### 3. Preview (always do this first)

```bash
scripts/ralph.sh --dry-run
```

Expands the list and shows, per issue, whether it would be implemented or
skipped (already closed / missing label) — **creates nothing, calls no Claude.**

### 4. Run

```bash
scripts/ralph.sh                    # work the whole list
scripts/ralph.sh --max-iterations 2 # cautious: stop after 2 issues actually run
```

Per issue, ralph:

1. Reads the issue from GitHub. **Skips** it if it's already `CLOSED`, or (when
   `RALPH_REQUIRE_LABEL` is set) if it lacks that label.
2. Runs `claude -p "/implement issue #N …"`. Claude implements it, makes
   **one commit**, then — if every acceptance criterion holds — **closes the
   issue** with a summary comment (and closes the PRD if it was the last pending
   child).
3. Re-reads the issue state. If it isn't `CLOSED`, ralph **stops the entire run**
   (fail-fast) and leaves the worktree for inspection.
4. Repeats down the list.
5. Pushes the branch and opens **one draft PR into `dev`**.

---

## Reviewing, merging & deleting (the last mile)

When ralph finishes you have a **draft PR `ralph/<timestamp>` → `dev`**. Here's
how to close it out, two ways. The quickest cleanup afterward is
`pnpm run ralph:clean` (safely removes merged ralph worktrees + branches).

### Option A — GitHub UI (+ VS Code for review)

1. **Review the code.** Read the diff in the PR's *Files changed* tab, or check
   out the branch in VS Code. Switching branches is read-only — it doesn't change
   the PR.
2. **Ready for review.** A draft can't be merged; click **Ready for review**.
3. **Merge.** Click **Merge pull request** (or *Squash and merge*) → **Confirm**.
4. **Delete branch.** Click the **Delete branch** button GitHub shows after
   merging.
5. **Sync + clean up locally** (see the shared commands below).

### Option B — pure local CLI

Review first (read the diff without switching, or check the branch out):

```bash
git fetch origin
git diff dev...ralph/<timestamp>        # read-only review, stay on dev
# or: git switch ralph/<timestamp>      # check it out to browse, then: git switch dev
```

Then mark ready + merge (GitHub blocks merging a *draft* from the CLI too):

```bash
gh pr ready <PR#>                  # take it out of draft
gh pr merge <PR#> --merge --delete-branch
#   --merge          : a merge commit (use --squash for a single squashed commit)
#   --delete-branch  : deletes BOTH the remote branch and your local branch
```

### Shared cleanup — get local fully consistent

```bash
git switch dev                     # be on dev, not the merged branch
git pull                           # bring the merge into local dev
pnpm run ralph:clean               # remove merged ralph worktrees + branches (safe)
git remote prune origin            # drop stale origin/ralph-… tracking refs
```

**Why each step:**

- `git pull` — your local `dev` doesn't auto-update when you merge on the
  server; this fast-forwards it.
- `git worktree remove …` — releases the worktree ralph created so the branch
  can be deleted.
- `git remote prune origin` — removes the dangling `origin/ralph-…` ref after the
  remote branch is deleted.
- `git branch -d …` — removes the local branch; `-d` refuses unless it's fully
  merged (a safety net); `-D` forces it.

### Deleting branches — quick reference

| Target                       | Command                                     |
| ---------------------------- | ------------------------------------------- |
| Local branch (safe)          | `git branch -d <branch>`                    |
| Local branch (force)         | `git branch -D <branch>`                    |
| Remote branch                | `git push origin --delete <branch>`         |
| Both, at merge time          | `gh pr merge <PR#> --merge --delete-branch` |
| Ralph's worktree             | `git worktree remove <path>`                |
| Stale remote-tracking refs   | `git remote prune origin`                   |

---

## Where to find what happened

Each run gets **one timestamped folder next to the script**, in the main checkout
(it survives the worktree being removed) and **gitignored**:

```
scripts/ralph-logs/<run-timestamp>/
├── summary.md        # run header (branch, issues) + issue → status → commit table
├── issue-50.log      # full Claude output for issue #50
└── issue-51.log      # …one per issue actually run
```

Every invocation is its own folder, so each run's result is a self-contained
summary.

---

## Configuration reference (`ralph.config.sh`)

| Variable                | Default             | Meaning                                                          |
| ----------------------- | ------------------- | ---------------------------------------------------------------- |
| `RALPH_ISSUES`          | —                   | Ordered issue numbers/ranges (`50 "51-53" 55`). Order = priority. **Required.** |
| `RALPH_BRANCH`          | *(empty)*           | Branch (and worktree). Empty → fresh `ralph/<timestamp>` per run; set = stable branch to resume a batch. |
| `RALPH_BASE_REF`        | `dev`               | Branch the run branch forks from, and the PR target.             |
| `RALPH_REQUIRE_LABEL`   | `ready-for-agent`   | Only work issues with this label (`""` = no gate).               |
| `RALPH_OPEN_PR`         | `1`                 | Open a draft PR when the list finishes.                          |
| `RALPH_MODEL`           | `claude-sonnet-5`   | Model for each headless session.                                 |
| `RALPH_PERMISSION_MODE` | `auto`              | `claude -p` permission mode.                                     |
| `RALPH_MAX_ITERATIONS`  | *(empty)*           | Cap issues actually run per invocation. `--max-iterations` wins. |

Command-line flags: `--dry-run`, `--max-iterations N`, `-h`/`--help`.

---

## Gotchas

- **Issues live on GitHub, not in files.** Ralph reads state and labels via `gh`;
  the "done" signal is the issue being **closed**, not a status line in a file.
- **Acceptance criteria are implicit.** Repo issues don't carry a literal
  `## Acceptance criteria` heading; the session reads the issue and infers the
  bar from its *User Stories* and *Testing/Implementation Decisions*. The prompt
  is deliberately short and trusts the `/implement` skill — write those sections
  well so "verify every acceptance criterion is met" has something to check.
- **Fail-fast is intentional.** If ralph stops, read the last `.log` and the
  `ralph-result.md` row to see which issue broke. The worktree is left intact;
  fix it, then re-run — closed issues stay skipped and ralph resumes from the
  next open one.
- **PRD auto-close needs the `PRD: #NN` line** in the issue body. Without it,
  ralph closes the issue but never touches a PRD.
