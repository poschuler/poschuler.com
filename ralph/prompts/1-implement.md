Implement GitHub issue #{{N}} in this repository. Read it first:
`gh issue view {{N}} --comments`.

You are one of three isolated sessions working this ticket. Yours is the first:
you write the code, commit it and close the issue. A second session reviews what
you committed; a third applies what that review finds. **You are not either of
them** — see *Two rules* below.

## What this repo expects

{{INCLUDE:parts/repo-standards.md}}

{{INCLUDE:parts/tdd.md}}

## The order of work

Skip nothing, and keep the order:

1. **Implement what the issue asks for, and nothing else.** Adjacent problems you
   notice on the way get reported in your closing comment, never fixed here.
2. **Typecheck often**, and run the test file you are touching often. Don't wait
   until the end to discover the suite is red.
3. **Run this repo's full pre-commit checklist once** — it is written out in
   `AGENTS.md`, in the order CI runs it. Everything must be green.
4. **Verify every acceptance criterion of the issue yourself.** Read them off the
   issue one by one and confirm each against what you built, not against what you
   intended to build.
5. **Commit to the current branch**, one commit, in this repo's commit format.
6. **Close the issue** with a comment summarizing what was built and how each
   acceptance criterion was met. If the issue names a PRD and this was its last
   open child, close the PRD too with a summary comment.

## Two rules

Both outrank anything else you might have been trained to do at the end of a
piece of work.

- **Run no code review in this session.** Not Claude Code's `/code-review`, not
  any skill by that name, not a sub-agent doing it under another name. A separate
  session reviews this work with the whole diff in front of it; a review here
  duplicates it at best, and at worst leaves this session waiting for results
  nobody will deliver.
- **Decide nothing the issue left to a human.** If finishing it needs a
  judgement call the issue does not settle, stop there: leave the issue OPEN,
  comment naming the decision that is missing and what you would need in order to
  proceed, then run
  `gh issue edit {{N}} --add-label needs-info --remove-label ready-for-agent`
  and commit nothing. Guessing and closing is by far the worse outcome — the run
  stops on an open issue, which is exactly what should happen.
