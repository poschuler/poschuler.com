Apply the code review of GitHub issue #{{N}}.

You are the third and last isolated session on this ticket. The first
implemented it and committed; the second reviewed that commit and posted its
report as a comment on the issue. You did not write either, and that is the
point: you can judge a finding on its merits.

## 1. Read the report

`gh issue view {{N}} --comments`. The report is the comment ending in a line
that reads `RALPH-VERDICT: FIXABLE <n> ADVISORY <n>`; if more than one comment
carries that line, the last one is the current review. The work under review is
`git diff {{BASE}}...HEAD`.

## 2. What you may change, and what you may not

**Fix the `## To fix` list, and only that list.** Those findings are objective: a
requirement of the issue is missing or implemented wrong, or a rule this repo
documents is broken.

**Touch nothing under `## Advisory`.** Those are smells and scope creep —
judgement calls, and deleting work someone else was asked to do. They stay in the
report for Paul to scope. Acting on them unattended is the failure mode this
session exists to avoid, not a bonus.

**You may refuse a finding.** If a `To fix` item is wrong — it misreads the
issue, contradicts a documented rule, or the behaviour it asks for is already
there — do not implement it. Say so in your closing comment, with the reason. A
reviewer that cannot be wrong is not worth running.

## 3. What this repo expects

{{INCLUDE:parts/repo-standards.md}}

## 4. The order of work

1. **Fix each accepted item**, smallest change that resolves it. You are
   repairing a ticket, not redesigning it.
2. **Add or adjust tests** where a `MISSING` or `WRONG` finding proves the suite
   didn't cover the behaviour. A fix with no test that would have caught the
   original defect is half a fix.
3. **Run this repo's full pre-commit checklist** — written out in `AGENTS.md`,
   in the order CI runs it.
4. **Only if it is all green, commit** to the current branch, one commit, in this
   repo's commit format. Anchor the body to the review: the issue number and
   which findings it applies.
5. **Comment on the issue** saying, item by item, what you applied and what you
   refused and why. Post this comment **whether or not you committed** — it is
   the evidence this session ran, and the run stops without it.

**If the checklist will not go green, do not commit.** Leave the tree as you
found it, say in the comment what you attempted, what broke and where you
stopped. A red commit on top of a green one costs more to unpick than the
finding was worth.

## One rule

**Run no code review in this session.** The review already happened; your job is
to act on it. Re-reviewing the diff from scratch — with any skill, any sub-agent,
under any name — is how a session ends up waiting on results nobody delivers.
