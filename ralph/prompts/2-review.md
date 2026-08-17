Code-review the work that closed GitHub issue #{{N}}, on three axes:

- **Standards** — does the code follow what this repo documents?
- **Spec** — does the code faithfully implement what the issue asked for?
- **Tests** — is what it added a suite worth keeping, and did it get written the
  way the implementer says it was?

The three axes run as **parallel sub-agents**, so none pollutes another's
context, and you aggregate what they return. You are the second of three
isolated sessions on this ticket: the first wrote the code, the third will apply
what you find. **You change no code and commit nothing** — your entire output is
a comment on the issue. The runner stops the whole run if this session moves
`HEAD`, leaves the worktree dirty, or unticks a checkbox on the issue.

Your job is to read, not to run. Whether the suite passes is the runner's
question and it asks it directly — it runs this repo's full pre-commit checklist
over every commit, and a red one stops the batch before a review is ever spent
on it. So spend your time on what executing the checklist cannot tell anyone:
whether the code says what this repo says it should, whether it does what the
issue asked, and whether the tests would notice if it stopped.

## 1. Pin the diff

The fixed point is `{{BASE}}` — it was `HEAD` before the implementation began,
so it needs no discussion:

```
git rev-parse {{BASE}}
git diff {{BASE}}...HEAD          # three-dot: against the merge-base
git log {{BASE}}..HEAD --oneline
```

If the ref doesn't resolve, or the diff is empty, stop and post that as your
report — with `RALPH-VERDICT: FIXABLE 0 ADVISORY 0` — instead of spending three
sub-agents on nothing. Say plainly in the report that this is what happened: the
runner checks that `HEAD` moved before it starts you, so an empty diff here is a
bug in the runner and should read like one, not like a clean review.

## 2. The spec is the issue, and its comments

`gh issue view {{N}} --comments`. There is no other spec to hunt for, and nobody
to ask: what the issue says is what was asked for.

Two things in there are the implementer's **claims**, not evidence, and both are
yours to test against the diff:

- **The ticked `- [x]` boxes.** Every one of them is ticked — the runner won't
  let an issue close otherwise — so the ticks tell you nothing about whether the
  criteria were met. Read them as "the implementer says this is done".
- **The closing comment**, which reports per criterion what met it, which test
  covers it and the message that test first failed with. That is a detailed,
  checkable account, and checking it is the Tests axis's job.

## 3. What the three axes judge against

{{INCLUDE:parts/repo-standards.md}}

{{INCLUDE:parts/smell-baseline.md}}

{{INCLUDE:parts/tdd.md}}

## 4. Spawn all three sub-agents, in parallel

Each gets the diff command and the commit list. What else, and what to do with
it, is below. **A sub-agent sees only what you paste into its brief** — it
cannot read this prompt, so anything it has to judge against travels in full,
not summarised.

Give the **Standards** sub-agent the list of standards files above and **the
smell baseline pasted in full**. Its brief:

> Report, per file or hunk: (a) every place the diff breaks a documented repo
> standard — cite the file **and the line or heading** the rule lives at; and
> (b) any baseline smell you spot — name it and quote the hunk. Mark each
> finding `HARD` (a documented rule is broken) or `JUDGEMENT` (a smell, or a
> reading a reasonable person could refuse). **A `HARD` finding you cannot point
> at a written rule for is a `JUDGEMENT`** — that label sends someone to change
> code unattended, so it is a citation, not an opinion. A documented repo
> standard overrides the baseline. Skip anything the tooling already enforces.
> Under 700 words; if that forced you to leave findings out, say so in a final
> line and say roughly how many.

Give the **Spec** sub-agent the issue's full text, its acceptance criteria, and
the implementer's closing comment. Its brief:

> Report: (a) acceptance criteria or requirements the issue asked for that are
> missing or only partly done; (b) behaviour in the diff nobody asked for
> (scope creep); (c) requirements that look implemented but whose implementation
> is wrong. Quote the issue's own line for each finding. Every criterion is
> ticked and every one is claimed met in the closing comment — **that is the
> claim you are testing, not evidence you can lean on**. Work from the diff
> outwards: for each criterion, find what in the diff delivers it, and say so
> when nothing does. Mark each `MISSING`, `WRONG` or `EXTRA`. Under 700 words;
> if that forced you to leave findings out, say so in a final line.

Give the **Tests** sub-agent the issue's acceptance criteria, the implementer's
closing comment, and **the three sections above headed *Testing, and where the
tests go*, *Anti-patterns* and *When a criterion admits no failing test*, pasted
in full**. Its brief:

> The implementer was told to work test-first, one acceptance criterion at a
> time, and to report per criterion which test covers it and the message that
> test first failed with. Report: (a) criteria with no test covering them —
> and whether the closing comment justifies that against the bar it was given,
> or is simply silent; (b) tests that match one of the anti-patterns — name
> which one and quote the assertion; (c) anything the closing comment claims
> that the diff does not support: a test named that isn't there, a failure
> message that test could not have produced, a criterion reported as verified by
> a command whose output says otherwise. Mark each `UNTESTED`, `WEAK` or
> `UNSUPPORTED`. Judge the tests in the diff, not the suite around them. Under
> 700 words; if that forced you to leave findings out, say so in a final line.

## 5. Aggregate, classify, post

Present the three reports under `## Standards`, `## Spec` and `## Tests`,
verbatim or lightly cleaned. **Do not merge them or rank one against the
other** — a change can pass one axis and fail another, and keeping them apart is
what stops one from masking the rest.

Then classify every finding into exactly one of two buckets, because the third
session acts on this and on nothing else:

- **FIXABLE** — a `MISSING` or `WRONG` from Spec, a `HARD` from Standards, or an
  `UNTESTED` from Tests. These are objective: the issue asked for something and
  it isn't there, a documented rule is broken, or a criterion nobody excused
  went untested.
- **ADVISORY** — every `JUDGEMENT`, every `EXTRA`, and every `WEAK` or
  `UNSUPPORTED`. Smells are judgement by definition; removing scope creep means
  deleting someone's work; rewriting a test on a judgement of its quality is the
  same kind of act as refactoring, and an `UNSUPPORTED` claim is not a defect in
  the code at all. All of them are for Paul to scope, not for an unattended
  session to act on.

**If Tests returned anything `UNSUPPORTED`, say so in the first line of your
report**, before the sections. It is the one finding that isn't about this diff:
it says the account the implementer gave of its own work doesn't hold, and that
bears on how much of the rest of that account to believe.

Post the whole thing as a comment on the issue — `gh issue comment {{N}}
--body-file <file>` — laid out as:

```
…one line, only if Tests returned an UNSUPPORTED finding…

## Standards
…the sub-agent's report…

## Spec
…the sub-agent's report…

## Tests
…the sub-agent's report…

## To fix
1. …one line per FIXABLE finding, saying what to change and where…

## Advisory — not to be fixed unattended
- …one line per ADVISORY finding…

RALPH-VERDICT: FIXABLE <n> ADVISORY <n>
```

Two things about that last line: it must be the **final line** of the comment,
on its own, exactly in that shape — the runner parses it to decide whether a
third session runs at all. And the comment goes up **even when all three axes
come back clean** (`FIXABLE 0 ADVISORY 0`): it is the only evidence this step
ran, and the run stops when it is missing.
