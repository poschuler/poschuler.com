Code-review the work that closed GitHub issue #{{N}}, on two axes:

- **Standards** — does the code follow what this repo documents?
- **Spec** — does the code faithfully implement what the issue asked for?

The two axes run as **parallel sub-agents**, so neither pollutes the other's
context, and you aggregate what they return. You are the second of three
isolated sessions on this ticket: the first wrote the code, the third will apply
what you find. **You change no code and commit nothing** — your entire output is
a comment on the issue.

## 1. Pin the diff

The fixed point is `{{BASE}}` — it was `HEAD` before the implementation began,
so it needs no discussion:

```
git rev-parse {{BASE}}
git diff {{BASE}}...HEAD          # three-dot: against the merge-base
git log {{BASE}}..HEAD --oneline
```

If the ref doesn't resolve, or the diff is empty, stop and post that as your
report — with `RALPH-VERDICT: FIXABLE 0 ADVISORY 0` — instead of spending two
sub-agents on nothing.

## 2. The spec is the issue

`gh issue view {{N}} --comments`. There is no other spec to hunt for, and nobody
to ask: what the issue says is what was asked for.

## 3. The standards

{{INCLUDE:parts/repo-standards.md}}

{{INCLUDE:parts/smell-baseline.md}}

## 4. Spawn both sub-agents, in parallel

Give the **Standards** sub-agent: the diff command and the commit list; the list
of standards files above; **the smell baseline pasted in full** — it has no other
access to it. Its brief:

> Report, per file or hunk: (a) every place the diff breaks a documented repo
> standard — cite the file and the rule; and (b) any baseline smell you spot —
> name it and quote the hunk. Mark each finding `HARD` (a documented rule is
> broken) or `JUDGEMENT` (a smell, or a reading a reasonable person could
> refuse). A documented repo standard overrides the baseline. Skip anything the
> tooling already enforces. Under 400 words.

Give the **Spec** sub-agent: the diff command, the commit list, and the issue's
full text. Its brief:

> Report: (a) acceptance criteria or requirements the issue asked for that are
> missing or only partly done; (b) behaviour in the diff nobody asked for
> (scope creep); (c) requirements that look implemented but whose implementation
> is wrong. Quote the issue's own line for each finding. Mark each `MISSING`,
> `WRONG` or `EXTRA`. Under 400 words.

## 5. Aggregate, classify, post

Present both reports under `## Standards` and `## Spec`, verbatim or lightly
cleaned. **Do not merge them or rank one against the other** — a change can pass
one axis and fail the other, and keeping them apart is what stops one from
masking the other.

Then classify every finding into exactly one of two buckets, because the third
session acts on this and on nothing else:

- **FIXABLE** — a `MISSING` or `WRONG` finding from Spec, or a `HARD` finding
  from Standards. These are objective: the issue asked for something and it
  isn't there, or a documented rule is broken.
- **ADVISORY** — every `JUDGEMENT` finding, and every `EXTRA` one. Smells are
  judgement by definition, and removing scope creep means deleting someone's
  work; both are for Paul to scope, not for an unattended session to act on.

Post the whole thing as a comment on the issue — `gh issue comment {{N}}
--body-file <file>` — laid out as:

```
## Standards
…the sub-agent's report…

## Spec
…the sub-agent's report…

## To fix
1. …one line per FIXABLE finding, saying what to change and where…

## Advisory — not to be fixed unattended
- …one line per ADVISORY finding…

RALPH-VERDICT: FIXABLE <n> ADVISORY <n>
```

Two things about that last line: it must be the **final line** of the comment,
on its own, exactly in that shape — the runner parses it to decide whether a
third session runs at all. And the comment goes up **even when both axes come
back clean** (`FIXABLE 0 ADVISORY 0`): it is the only evidence this step ran,
and the run stops when it is missing.
