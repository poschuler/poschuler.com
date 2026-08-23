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
requirement of the issue is missing or implemented wrong, a rule this repo
documents is broken, or an acceptance criterion nobody excused went untested.

**Touch nothing under `## Advisory`.** Those are smells and scope creep —
judgement calls, and deleting work someone else was asked to do. They stay in the
report for Paul to scope. Acting on them unattended is the failure mode this
session exists to avoid, not a bonus.

**Leave the issue itself alone.** It is CLOSED, and it stays closed — a re-opened
issue is worked again from scratch by the next run. Its acceptance criteria are
ticked, and they stay ticked even where you are fixing one: the ticks are the
implementer's claim and the review has already disputed them in writing, which is
where a dispute belongs. Your only write to the issue is your comment, plus the
one label in *Deferred* below.

## 3. Every finding ends in exactly one of three places

The review raised a specific number of them, and your report has to account for
all of it — the runner checks the arithmetic. There is no fourth option and no
silent one.

**APPLIED.** You made the change. This is the default and should be the common
case: the review is right more often than it is wrong.

**REFUSED.** The finding is wrong, and you say why **with a citation** — the line
of the issue that contradicts it, the documented rule it breaks, or the file and
line where the behaviour it asks for already lives. A reviewer that cannot be
wrong is not worth running, which is exactly why refusing has to cost the same
kind of evidence the review was held to: "I disagree" is not a refusal, it is a
skipped item wearing a label. If you cannot cite it, apply it.

**DEFERRED.** You are not the one who can settle it. Two cases, and they end the
same way:

- The finding is fair but settling it needs a judgement only Paul can make — two
  readings of the issue are equally defensible, or the fix would decide something
  the ticket never did.
- **You tried and could not land it**: the change you wrote would not go green,
  so you reverted it (see *the order of work* below). The finding stands, the fix
  does not, and a human has to look. An attempt you rolled back is never
  `APPLIED` — nothing was applied — and it is not `REFUSED` either, because you
  never claimed the finding was wrong.

Do not guess, and do not bury either case as a refusal: a refusal on a closed
issue is where a real question goes to not be read. Name what is missing — the
decision, or what broke and where you stopped — and run
`gh issue edit {{N}} --add-label ready-for-human` once, whatever the count.

## 4. What this repo expects, and how it is tested

{{INCLUDE:parts/repo-standards.md}}

{{INCLUDE:parts/tdd.md}}

## 5. The order of work

1. **Fix each accepted item**, smallest change that resolves it. You are
   repairing a ticket, not redesigning it.
2. **Add or adjust tests** where a `MISSING` or `WRONG` finding proves the suite
   didn't cover the behaviour. A fix with no test that would have caught the
   original defect is half a fix. An `UNTESTED` finding is exactly this and
   nothing more: the criterion it names has no test, so write the one that
   covers it. Every test you write here follows the same rules the implementer
   was given, above — failing first, at a seam this repo already tests, against
   behaviour and not implementation. Nobody reviews this session, so a test you
   add is the last version of itself anyone reads before the PR.
3. **Run this repo's full pre-commit checklist** — written out in `AGENTS.md`,
   in the order CI runs it. The runner re-runs it over your commit either way,
   and a red one stops the batch, so there is nothing to be gained by skipping
   ahead here.
4. **Only if it is all green, commit** to the current branch, one commit, in this
   repo's commit format. Anchor the body to the review: the issue number and
   which findings it applies.
5. **Comment on the issue**, in the shape below. Post it **whether or not you
   committed** — it is the evidence this session ran, and the run stops without
   it.

**If the checklist will not go green, do not commit.** Revert what you wrote,
count those findings `DEFERRED`, and say in the comment what you attempted, what
broke and where you stopped. A red commit on top of a green one costs more to
unpick than the finding was worth — and a batch is worse still, because every
issue after this one is built on top of whatever you leave here.

**Leave nothing uncommitted either way.** Whatever you don't commit, revert —
`git status` is clean when you exit, or the run stops. Nothing cleans this
worktree between issues, so a change left lying here is not merely lost: it is
the starting state the next issue's implementation inherits, and it ends up
inside *its* commit, on a ticket that never asked for it.

## 6. The comment

```markdown
## Applied
1. <the finding, quoted from `## To fix`> — what changed, and where.

## Refused
1. <the finding> — why it is wrong, and the citation that backs that: the
   issue's own line, the documented rule, or `path/file.ts:88` where the
   behaviour it asks for already lives.

## Deferred
1. <the finding> — the decision that is missing, and what you would need in
   order to proceed.

## Checklist
The five commands from `AGENTS.md` and what each one said — or, if you did not
commit, what broke and where you stopped.

RALPH-FIX: APPLIED <n> REFUSED <n> DEFERRED <n>
```

Empty sections are dropped, not left with `None.` — but **the last line goes up
every time, exactly in that shape, as the final line of the comment**. The runner
parses it, and the three counts have to add up to the number of findings the
review's `## To fix` list raised. They are what makes "the review was wrong five
times" legible as something other than "this session did nothing".

## 7. One rule

**Run no code review in this session.** The review already happened; your job is
to act on it. Re-reviewing the diff from scratch — with any skill, any sub-agent,
under any name — is how a session ends up waiting on results nobody delivers.
This one is not left to your judgement: a hook denies those calls before they
run, and the refusal reaches you as a tool result. Reading the diff to
understand a finding is not a review; convening a second opinion on it is.
