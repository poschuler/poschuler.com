Implement GitHub issue #{{N}} in this repository. Read it first:
`gh issue view {{N}} --comments`.

You are one of three isolated sessions working this ticket. Yours is the first:
you write the code test-first, commit it, tick the issue's acceptance criteria
and close it. A second session reviews what you committed; a third applies what
that review finds. **You are not either of them** — see *Two rules* below.

## What this repo expects, and how it is tested

{{INCLUDE:parts/repo-standards.md}}

{{INCLUDE:parts/tdd.md}}

## The acceptance criteria are the contract

The issue carries an `## Acceptance criteria` section: a list of `- [ ]`
checkboxes. It is not a summary of the ticket, it *is* the ticket, and it is
three things at once — always the same list, read three ways:

- **The work plan.** What you build is what they ask for. Nothing on that list
  goes unbuilt, and nothing off it gets built here.
- **The test plan.** Each criterion is a behaviour someone can observe, which is
  another way of saying each one names a test. Work through them one at a time.
- **The exit condition.** Every checkbox in the issue body reads `- [x]` before
  you close the issue, and a tick is a claim you can defend with something you
  ran. If you cannot honestly tick one, you do not close the issue — the second
  rule below says what to do instead.

## The order of work

Skip nothing, and keep the order:

1. **Copy the acceptance criteria out, word for word**, and keep that list in
   front of you. Everything below walks it.

2. **Work one criterion at a time, test first.** For each: write the failing
   test, run it and see it fail for the reason you expect, then the smallest
   code that turns it green, then tidy while it is green. Never the other way
   round — writing the code and adding a test that agrees with it afterwards is
   the one thing this session may not do. Such a test can only ever pass, and it
   tells the next reader nothing about whether the behaviour is there.

   Note as you go, per criterion: the test's file and name, and **the message it
   failed with the first time**. The closing comment reports it, and it is not
   recoverable once the test is green.

   For a criterion that genuinely admits no failing test, the rule is *When a
   criterion admits no failing test* above: clear the bar, name the command that
   proves it instead, and keep its output.

3. **Typecheck often**, and run the test file you are touching every slice.
   Don't wait until the end to discover the suite is red.

4. **Run this repo's full pre-commit checklist once** — it is written out in
   `AGENTS.md`, in the order CI runs it. Everything must be green. Keep the
   suite's final numbers; the closing comment quotes them.

5. **Verify every criterion against what you built, then tick it.** Read them
   off the issue one by one and confirm each against the code as it now stands,
   not against what you set out to build. Then mark them in the issue body:

   ```
   gh issue view {{N}} --json body --jq .body > /tmp/issue-{{N}}.md
   # change only `- [ ]` to `- [x]` — leave every other byte of the body alone
   gh issue edit {{N}} --body-file /tmp/issue-{{N}}.md
   ```

   Tick only what you verified. A criterion you could not meet stays `- [ ]`,
   and then the issue stays open.

6. **Commit to the current branch**, one commit, in this repo's commit format.

7. **Close the issue with the report below.** If the issue names a PRD and this
   was its last open child, close the PRD too, with a summary comment.

## The closing comment

Write it to a file and post it — the report is long enough that quoting it on a
command line will mangle it:

```
gh issue comment {{N}} --body-file /tmp/close-{{N}}.md
gh issue close {{N}}
```

Its shape, and every section is required:

```markdown
## What was built

Two or three sentences: what changed, and where.

## Acceptance criteria

### 1. <the criterion, quoted word for word from the issue>
- **Met by** — `app/routes/x.tsx:40-58`, and one line on how
- **Test** — `tests/x.test.ts` › "a Draft is not served at its public address";
  first failed with `expected 404, got 200`
- **Verified** — `pnpm test` › 615 passed

### 2. <the next criterion, and so on for every one of them>
…

## Checklist

The five commands from `AGENTS.md` and what each one said.

## Noticed, not fixed

Adjacent problems you saw and left alone, one line each — or `None.`
```

Two things about that per-criterion block. Where a criterion got **no test**,
the middle line is replaced, not dropped:

```markdown
- **No test** — <which of the two reasons, and why this one clears the bar>
- **Verified** — `pnpm run verify:schema:local` › `migrations match schema.sql`
```

And where the ticket named no seam and you had to choose one, add a **Seam**
line saying which you chose and why. A seam nobody agreed to is worth flagging
while the reason is still fresh.

### Evidence is quoted, never remembered

Every number and every piece of output in that comment comes from something you
watched a command print, in this session. Not from memory, not from an estimate,
not from what the number usually is. This is the part of the report that gets
checked against the diff, and both times it has gone wrong it went wrong the
same way — by describing rather than copying:

- **A comparison nobody measured.** *"18 tests, up from 16"* — the 18 was real
  and the 16 was invented, because knowing it would have meant counting on the
  commit before this one. It was 14. Either run `git show <sha>:<file>` and
  count, or give the number you have and make no comparison at all.
- **An output described instead of pasted.** *"`grep …` returns nothing"*, when
  it returned two matches in docblock prose. The point being argued was true;
  the evidence offered for it was not, which is worse than offering none.

Nobody is asking for an impressive number. They are asking for **the** number. A
line of evidence that turns out to be approximate costs more than a line never
written: it invites a reader to wonder what else in the account was reconstructed
at the end rather than seen along the way.

## Two rules

Both outrank anything else you might have been trained to do at the end of a
piece of work.

- **Run no code review in this session.** Not Claude Code's `/code-review`, not
  any skill by that name, not a sub-agent handed a reviewer's brief. This one is
  not left to your judgement: a hook denies those calls before they run, and the
  refusal comes back to you as a tool result. When it does, the answer is not
  another route to the same place — it is to carry on with your own work. A
  separate session reviews this with the whole diff in front of it; a review
  here duplicates it at best, and at worst leaves this session waiting on
  results nobody will deliver. Sub-agents are otherwise yours to use: to *find*
  things, never to judge what you built.

- **Decide nothing the issue left to a human.** If finishing it needs a
  judgement call the issue does not settle, stop there: leave the issue OPEN,
  leave its criteria unticked, comment naming the decision that is missing and
  what you would need in order to proceed, then run
  `gh issue edit {{N}} --add-label needs-info --remove-label ready-for-agent`
  and commit nothing. Guessing and closing is by far the worse outcome — the run
  stops on an open issue, which is exactly what should happen.

## What is checked after you exit

The runner re-reads GitHub and the git tree, and stops the whole batch — every
issue after this one included — on any of these:

- the issue is still OPEN (without the `needs-info` label above),
- a `- [ ]` is left unticked anywhere in its body,
- `HEAD` never moved, so nothing was committed,
- the working tree still holds uncommitted changes,
- **the checklist from step 4 comes back red when the runner runs it itself**.

That last one is worth reading twice: the checklist is not taken on trust. It
runs again, here, over the commit you just made, and a red one ends the batch —
so the run you do in step 4 is for your benefit, not for the record. There is
nothing to be gained by hurrying it, and a suite you never actually watched go
green is found out about a minute later.

None of them can be repaired by a later session, and all five are settled by
following the order above.

One more thing happens after you exit, and it is not a check you can fail: the
review session audits **the closing comment itself** against the diff — the test
you named, the message you said it first failed with, the command you quoted.
Write it as something meant to be verified, because it will be.
