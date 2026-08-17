# Ralph

Ralph drives Claude Code through a list of **GitHub issues** — fresh, headless
`claude -p` sessions that implement each one, review what they built and apply
what the review found. It doesn't *write* issues; it *implements* ones you've
already authored and labelled.

Configuration lives in [`ralph.config.sh`](./ralph.config.sh); the loop is in
[`ralph.sh`](./ralph.sh); what each session is told lives in
[`prompts/`](./prompts), versioned with the repo.

---

## Mental model

- You author issues on **GitHub** (label them `ready-for-agent`), then list the
  numbers you want worked in `ralph.config.sh`.
- Ralph runs the whole list in **one git worktree** on a **fresh per-run branch
  `ralph/<timestamp>`**, forked from `dev`. For each issue it runs a **fresh
  Claude session** (fresh context per issue is the point — it avoids context rot)
  to implement it, then verifies **four** things before moving on — the issue is
  closed, nothing is left unticked in its body, `HEAD` moved, and the worktree is
  clean. A closed issue alone was never proof: closing costs one `gh` call.
- Each issue gets up to **three** fresh sessions, and they do different jobs:

  1. **Implement** — writes the code **test first**, commits it, ticks the
     issue's acceptance criteria and closes it with a per-criterion report.
     Reviews nothing, and cannot: a hook denies the review skills.
  2. **Review** — reads that commit on three axes (standards, spec, tests) and
     **changes no code**; if it commits anyway, the run stops. Its report is a
     comment on the issue, ending in a verdict line that counts what is
     objectively fixable.
  3. **Fix** — runs only when that count is above zero. Applies those findings,
     and only those, then commits. Every finding ends **applied, refused (with a
     citation) or deferred to you**, and the three counts have to add up to what
     the review raised.

  After every commit any of them makes, **the runner itself runs this repo's
  pre-commit checklist** — the one thing in the pipeline that executes anything
  rather than believing a session's account of it. About a minute; a red one
  stops the batch there.

  The reviewer sees the diff, not the implementer's context; the fixer reads the
  report, not the reviewer's context. That isolation is the point — each judges
  work it didn't do. `RALPH_REVIEW=0` stops after step 1; `RALPH_FIX=0` reviews
  without fixing.
- **None of the three invokes a skill.** What each is told lives in
  `prompts/*.md`, in git.
- When the list drains, Ralph pushes and opens **one draft PR back to `dev`**,
  titled after the issues it worked (so it reads well even though the branch is a
  timestamp). Its body carries **every advisory finding the run raised**, gathered
  from the issues that raised them — see below.
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

Write each issue with everything an agent needs: problem, solution, and an
`## Acceptance criteria` section of `- [ ]` lines. Label the ones ready to be
picked up `ready-for-agent`.

That checkbox list is the part worth spending time on — it is the work plan, the
test plan and the exit condition at once, and the run stops if the session
closed the issue with any of it unticked. Two things make it tickable: **one
observable behaviour per line** (something a test or a command can answer), and
**no line that needs a decision you haven't made** — a criterion the session
cannot settle is what sends the issue back to you labelled `needs-info`, which
is the right outcome but a slow one.

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
ralph/ralph.sh --dry-run
```

Expands the list and shows, per issue, whether it would be implemented or
skipped (already closed / missing label), then prints **all three prompts fully
rendered** against the first issue — includes spliced in — and the tools banned
in each session. **Creates nothing, calls no Claude.** A missing prompt file, an
include that resolves nowhere and an unresolved `{{…}}` all fail here rather
than halfway through a paid session.

### 4. Run

```bash
ralph/ralph.sh                    # work the whole list
ralph/ralph.sh --max-iterations 2 # cautious: stop after 2 issues actually run
```

Per issue, ralph:

1. Reads the issue from GitHub. **Skips** it if it's already `CLOSED`, or (when
   `RALPH_REQUIRE_LABEL` is set) if it lacks that label.
2. Runs the **implementation session**. Claude implements the issue, makes **one
   commit**, then — if every acceptance criterion holds — **closes the issue**
   with a summary comment (and closes the PRD if it was the last pending child).
   It runs no code review; see *Why no step invokes a skill*.
3. Re-reads the issue state. If it isn't `CLOSED`, ralph **stops the entire run**
   (fail-fast) and leaves the worktree for inspection. One open issue is not an
   error though: one labelled `needs-info` is the session reporting that the
   ticket hid a decision only you can make, and the summary says so
   (`STOPPED (needs a human decision)`) — that is a ticket to rewrite, not a run
   to debug.
4. Runs a **second, isolated session** that code-reviews everything committed
   since the issue started and **posts its report as a comment on the issue**,
   touching no code (skipped when `RALPH_REVIEW=0`). Three things are fail-fast
   here: a session that exits non-zero, one that leaves **no comment**, and one
   whose comment carries **no verdict line** — the report is the whole
   deliverable of this step, and the verdict is what the next one reads. If the
   reviewer commits despite being told not to, ralph records
   `reviewed (report + unasked commit)` with the sha, and carries on.
5. Reads the verdict — before step 3 can post anything that quotes it back — and
   runs a **third, isolated session** only if it counts something fixable
   (skipped when `RALPH_FIX=0`, or when the count is zero, which the run reports
   as *nothing fixable in the review*). The fixer applies those findings, runs
   the repo's checklist and commits; it comments on the issue whether or not it
   committed, and **no comment is fail-fast**. A run that ends
   `fix: nothing committed (read #N)` is not a failure — it is the fixer saying
   it refused the findings, or that it couldn't get the checklist green.
6. Repeats down the list.
7. Pushes the branch and opens **one draft PR into `dev`**.

What each row of the summary can say, in the order a healthy issue passes
through them:

| Row | Meaning |
|---|---|
| `closed` | Step 1 committed and closed the issue |
| `reviewed (RALPH-VERDICT: FIXABLE n ADVISORY m)` | Step 2 reported |
| `fixed (n fixable)` | Step 3 applied the findings and committed |
| `fix: nothing committed (read #N)` | Step 3 ran, committed nothing, said why |
| `STOPPED (needs a human decision)` | The ticket hid a decision; issue left open |
| `INCOMPLETE` / `REVIEW INCOMPLETE` / `FIX INCOMPLETE` | A step didn't leave its evidence — run stops |

---

## The three prompts

What each session is told lives in [`prompts/`](./prompts), one file per step,
versioned with the repo and reviewable in a PR like anything else:

```
ralph/prompts/
├── 1-implement.md      # test-first code, one commit, criteria ticked, issue closed
├── 2-review.md         # three axes, three sub-agents, a report and a verdict
├── 3-fix.md            # applies what the review classed fixable
└── parts/
    ├── tdd.md              # the red → green loop, seams, anti-patterns, and
    │                       # the bar a criterion has to clear to go untested
    ├── smell-baseline.md   # the twelve Fowler smells the review carries
    └── repo-standards.md   # where this repo writes down how code is written
```

Three placeholders are substituted before a session starts:

| Placeholder | Becomes |
| ----------- | ------- |
| `{{N}}` | The issue number. |
| `{{BASE}}` | The commit the review diffs against — `HEAD` as it stood before the implementation session. |
| `{{INCLUDE:parts/x.md}}` | That file, spliced in. Paths are relative to the prompt that declares them, and includes may include, so a shared part is written once and pulled into every prompt that needs it. |

Ralph refuses to spend a session on a prompt that still carries an unresolved
`{{…}}`, or that includes a file which isn't there. Pointing a step at a
different file is `RALPH_PROMPT_FILE` and friends in `ralph.config.sh`.

### Why no step invokes a skill

Skills were the obvious way to write this, and they are the wrong one for a run
that nobody watches.

**They move under you.** A skill is installed per user and versioned by its
plugin — three versions of `mattpocock-skills` sit in the local cache right now,
and nothing pins which one Claude Code loads. A plugin update can change how
ralph works with no commit in this repo to explain it. A prompt in git is pinned
to the commit that ran it, so a run from a month ago can be reproduced exactly.

**Their names collide.** `code-review` is a name Claude Code itself owns. A bare
`/code-review` in a headless session resolves to the **native** one, which
launches background agents and returns findings as notifications nobody is there
to deliver. On 16 Aug 2026 that ended a run with the work finished and green,
**uncommitted**, the issue still open, and ralph correctly reporting `INCOMPLETE`
(#51). With no slash commands in the prompts, there is nothing left to collide.

**They are written for someone who can answer.** The `code-review` skill says to
ask the user for the fixed point if they didn't give one, and to ask where the
spec is. Here the fixed point is `{{BASE}}` and the spec is the issue — both
given, neither askable.

What the plugin's skills got right travels anyway: `parts/smell-baseline.md` is
its twelve-smell catalogue copied as it stands (MIT, © 2026 Matt Pocock), and
`parts/tdd.md` is its TDD loop with the seam rule rewritten for a session with
no human to agree seams with. What was dropped is the last line of `implement` —
*"Once done, use /code-review to review the work"* — which is the whole reason
the review is its own step here.

As a belt, `RALPH_DISALLOWED_TOOLS` bans `ScheduleWakeup` in all three sessions:
waiting for a notification is a dead end when there is nobody to deliver one.

### The hook that enforces it

Dropping the slash commands removed the collision; it did not remove the *pull*.
A session trained to review its own work at the end will look for a way, and
"please don't" in a prompt is not a mechanism. So the ban has one now —
[`hooks/no-code-review.sh`](./hooks/no-code-review.sh), a `PreToolUse` hook
wired in through `--settings`, which loads **in addition to** this repo's own
settings. Nothing about your interactive sessions changes: the ban exists only
for the length of a headless one.

It refuses three routes and leaves the rest alone:

| Route | What happens |
| ----- | ------------ |
| `Skill` — `code-review`, `security-review`, `simplify`, `ultrareview`, with or without a plugin prefix | Denied in **all three** steps. Step 2 has its own review protocol and a verdict line to produce; the native skill produces neither. |
| `SlashCommand` — the same names typed as `/code-review` | Denied in all three steps. |
| `Agent` / `Task` whose brief reads as *"review this diff"* | Denied in steps 1 and 3 — a review under another name is still the review step 2 does. **Allowed in step 2**, where sub-agents are the whole method. |

Sub-agents stay available everywhere for what they're good at: *finding* things.
The rule is on the brief, not on the tool, so the implementer keeps `Explore`
and loses only the second opinion it was never meant to convene.

A denial comes back to the model as a tool result carrying a reason written for
it — what was blocked, why, and what to do instead — because a session that
stops dead is no better than one that reviews. Every refusal is appended to
`ralph-logs/<run>/hooks.log`, so "did it try?" is a question with an answer.

`RALPH_BLOCK_CODE_REVIEW=0` lifts all of it and goes back to trusting the
prompts. The hook needs `jq`.

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
  server; this fast-forwards it. It comes **first** on purpose: `ralph:clean`
  measures "already merged" against your *local* `dev`, so a PR you merged on
  GitHub still reads as unmerged until you pull, and the branch is spared.
- `pnpm run ralph:clean` — does the two-step teardown for you, in order: releases
  the worktree ralph created, then deletes the branch. It refuses a worktree with
  uncommitted changes and a branch holding commits not yet in `dev` — `--force`
  overrides both, `--dry-run` shows what it would do.
- `git remote prune origin` — removes the dangling `origin/ralph-…` ref after the
  remote branch is deleted.

With no arguments `ralph:clean` scans and cleans every safe `ralph/*` run. To
name one, pass its **run timestamp** — the same string that names its log folder
under `ralph/ralph-logs/`, so the run whose `summary.md` you just read is the one
you name:

```bash
pnpm run ralph:clean -- --dry-run 20260816T173706Z
```

It only ever touches the `ralph/` branch namespace. A stable `RALPH_BRANCH` you
pinned outside it (to resume a batch) is reported and left for you to remove by
hand — deleting branches it didn't create isn't its job. The logs are never
touched either.

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
ralph/ralph-logs/<run-timestamp>/
├── summary.md              # run header (branch, issues) + issue → status → commit table
├── issue-50.log            # full Claude output for issue #50 (implementation)
├── issue-50-review.log     # …its review session
├── issue-50-fix.log        # …its fix session, when the verdict called for one
├── issue-50-checklist.log  # …the runner's own checklist runs over its commits
├── issue-51.log            # …one set per issue actually run
├── hooks.log               # every code review the hook refused, and in which step
└── hook-settings.json      # the --settings the run wired the hook in with
```

Every invocation is its own folder, so each run's result is a self-contained
summary. The logs are the transcripts; the **conclusions** live on the issue —
the review's report and the fixer's account of what it applied and refused.

---

## Configuration reference (`ralph.config.sh`)

| Variable                | Default             | Meaning                                                          |
| ----------------------- | ------------------- | ---------------------------------------------------------------- |
| `RALPH_ISSUES`          | —                   | Ordered issue numbers/ranges (`50 "51-53" 55`). Order = priority. **Required.** |
| `RALPH_BRANCH`          | *(empty)*           | Branch (and worktree). Empty → fresh `ralph/<timestamp>` per run; set = stable branch to resume a batch. |
| `RALPH_BASE_REF`        | `dev`               | Branch the run branch forks from, and the PR target.             |
| `RALPH_REQUIRE_LABEL`   | `ready-for-agent`   | Only work issues with this label (`""` = no gate).               |
| `RALPH_OPEN_PR`         | `1`                 | Open a draft PR when the list finishes.                          |
| `RALPH_MODEL`           | `claude-sonnet-5`   | Model for the implementation session.                            |
| `RALPH_REVIEW`          | `1`                 | Run the isolated code-review session after each closed issue. `0` = implement only. |
| `RALPH_FIX`             | `1`                 | Run the fix session when the review's verdict counts something fixable. Needs `RALPH_REVIEW=1`. |
| `RALPH_REVIEW_MODEL`    | *(= `RALPH_MODEL`)* | Model for the review session, when you want it to differ.        |
| `RALPH_FIX_MODEL`       | *(= `RALPH_MODEL`)* | Model for the fix session.                                       |
| `RALPH_PERMISSION_MODE` | `auto`              | `claude -p` permission mode.                                     |
| `RALPH_DISALLOWED_TOOLS`| `ScheduleWakeup`    | Space-separated tools banned in **every** session (`""` = none). |
| `RALPH_BLOCK_CODE_REVIEW` | `1`               | Enforce "no code review in this session" with a `PreToolUse` hook instead of trusting the prompt. Needs `jq`. `0` = prompts only. |
| `RALPH_VERIFY`          | `1`                 | Run the pre-commit checklist after every commit a session makes, instead of believing it ran green. `0` = take their word. |
| `RALPH_CHECKLIST`       | the five in `AGENTS.md` | What that checklist is — one command line per entry, in order, each retried once before it counts as red. |
| `RALPH_PROMPT_FILE`     | `ralph/prompts/1-implement.md` | What the implementation session is told. A relative path is read from the repo root. |
| `RALPH_REVIEW_PROMPT_FILE` | `ralph/prompts/2-review.md` | What the review session is told.                     |
| `RALPH_FIX_PROMPT_FILE` | `ralph/prompts/3-fix.md` | What the fix session is told.                               |
| `RALPH_MAX_ITERATIONS`  | *(empty)*           | Cap issues actually run per invocation. `--max-iterations` wins. |

Command-line flags: `--dry-run`, `--max-iterations N`, `-h`/`--help`.

---

## Gotchas

- **Issues live on GitHub, not in files.** Ralph reads state and labels via `gh`;
  the "done" signal is the issue being **closed**, not a status line in a file.
- **The acceptance criteria are the contract, and they are checkboxes.** Every
  issue here carries an `## Acceptance criteria` section of `- [ ]` lines, and
  the implementer is told to treat that list as three things at once: the work
  plan, the test plan, and the exit condition. It ticks each one only against
  something it ran, and the run **stops** if it closed the issue with any box
  left unticked — anywhere in the body, not only under that heading. So write
  criteria that can be ticked: one observable behaviour per line, no line that
  needs a judgement call to answer. All three sessions check against them.
- **A `- [ ]` anywhere in the body is a criterion.** The guard doesn't work out
  which list a box belongs to, because a rule that has to would be read two ways
  by two readers. A checkbox in an issue is something to be earned.
- **Evidence in the closing comment is quoted, not remembered.** The numbers and
  outputs the implementer reports are checked against the diff by the Tests axis,
  and the first run of two issues turned up an inaccuracy in each: a test count
  compared against a figure nobody had measured, and a `grep` described as
  returning nothing when it returned two matches in prose. Both arguments were
  sound and both pieces of evidence were not, which is worse than offering none —
  it makes a reader wonder what else was reconstructed at the end.
- **TDD is asked for explicitly, and it is paid for in the closing comment.**
  The implementer works one criterion at a time — failing test, watch it fail
  for the right reason, smallest code that passes, tidy while green — and its
  closing comment names, per criterion, the test and *the message it failed with
  the first time*. A criterion with no test has to say which of two reasons
  applies, and quote the command it was verified with instead. That report is
  the only durable evidence the loop happened: one commit leaves no trace of
  red → green, so the comment carries what the diff cannot.
- **The review's verdict lives on the issue, not in the log.** The log holds the
  session's whole transcript; the comment on the issue *is* the report, and its
  absence is what the run stops over.
- **The runner runs the checklist; the sessions only claim to.** Every session
  is told to run it and every session says it did, and until it was executed
  here that claim was the only evidence — nothing between a commit and the draft
  PR ever ran a line of it. It costs about a minute per commit. A failing command
  is retried once first: two of them rebuild the local D1 and can fail on nothing
  at all when a session was just using it, and a transient must not end a batch.
- **The reviewer is read-only, and now that is enforced.** A review session that
  commits, dirties the tree, or unticks a checkbox stops the run. The unasked
  commit is the one that matters: it would land inside the range the fix session
  inherits as "the implementation", so the third session would end up applying a
  review to work the reviewer wrote after reviewing.
- **`FIXABLE` means objective, and two things can disqualify a finding from it.**
  If two axes looked at the same change and reached opposite conclusions, it is
  advisory however either of them labelled it — two careful readers disagreeing
  is the definition of not objective. And a finding whose own text says "confirm
  the scope with Paul" has already been judged not objective by the session that
  wrote it. Both rules exist because #54 produced exactly that item: Standards
  read a docblock as a broken rule, Spec read the same change as deliberately
  deferred, and it went out as the sole thing to fix. The fixer refused it,
  correctly and with three citations, having spent a whole session on it.
  Catching the disagreement is the aggregator's job, and only it can — the three
  axes are blind to each other by design.
- **The Tests axis reads the closing comment, not just the diff.** It is the one
  that can tell you the implementer's account of its own work doesn't hold — a
  test named that isn't there, a failure message that test could not have
  produced. That finding is advisory (there is no code defect to fix), but the
  report leads with it, because it bears on how much of the rest to believe.
- **The fixer only touches what the review called fixable** — a requirement
  missing or implemented wrong, a documented rule broken, a criterion left
  untested. Smells and scope creep are marked advisory and left alone on purpose:
  refactoring by judgement, or deleting work someone was asked to do, is not
  something an unattended session should decide. They stay in the report, for you.
- **Refusing a finding costs a citation.** The fixer may reject what the review
  said — a reviewer that cannot be wrong is not worth running — but it has to
  point at the issue's own line, the documented rule, or the file and line where
  the behaviour already lives. Refusing is the cheapest thing that session can
  do, and the counts are what stop "the review was wrong five times" from
  reaching you looking exactly like "this session did nothing".
- **The advisory findings ride to the PR, because that is the only place you can
  act on them.** They are the ones nobody touches by design — smells, scope
  creep, a weak test — and their natural end was a comment on a *closed* issue,
  which is the one place nobody goes back to. A finding like that is only ever
  actionable with the diff in front of you, and there is exactly one moment when
  that is true: reading the draft PR. So the PR body collects them all, each
  linked to the review that raised it.
  Two things follow. Reading them **together** is what a single issue's comment
  cannot give you — one smell across three issues of a batch is not three notes,
  it is a pattern, and probably a line in `AGENTS.md`. And nothing survives the
  merge: what you don't act on there goes back to being findable only on a closed
  issue, so open a ticket for what should outlive the PR and let the rest go on
  purpose. Discarded is not the same as lost.
- **A `ready-for-human` label on a CLOSED issue is a deferred finding.** When
  settling one needs a judgement only you can make, the fixer names the missing
  decision and labels the issue rather than guessing or burying it as a refusal.
  It does not stop the run — the issues after it are unaffected — so
  `gh issue list --label ready-for-human --state closed` is where they wait.
- **A `needs-info` issue is a ticket problem, not a ralph problem.** Rewrite the
  ticket so the decision is already made, then re-run — the run resumes from it.
- **Fail-fast is intentional.** If ralph stops, read the last `.log` and the
  `summary.md` row to see which issue broke. The worktree is left intact;
  fix it, then re-run — closed issues stay skipped and ralph resumes from the
  next open one.
- **PRD auto-close needs the `PRD: #NN` line** in the issue body. Without it,
  ralph closes the issue but never touches a PRD.
