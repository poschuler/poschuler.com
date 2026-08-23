# The flow a piece of work moves through

**Understanding first, then the spec, then the tickets, then the code.** A piece of work moves through five skills in this order, and Paul starts each one:

```
/grill-with-docs  →  /to-spec  →  /to-tickets  →  /implement  →  /code-review
```

**All of them are the `mattpocock-skills` ones** (`skills/engineering/` in that plugin), never a similarly named skill from somewhere else. `/improve-codebase-architecture`, from the same plugin, runs every so often outside that line: it looks for architectural friction rather than for the next feature, and whatever it surfaces re-enters at the top as its own grilling.

None of these steps starts itself. Reaching the end of one is not permission to begin the next — say what you would do and wait. An answer that ends in a diff nobody asked for costs more to review than it saved.

## The grilling is the part that matters

Everything downstream is synthesis of what was settled here, so a rushed session produces a confident spec for the wrong thing. How to run it:

- **One question at a time, and stop.** Wait for the answer before asking the next. A numbered list of six questions is not an interview; it is a form, and it gets a form's answers.
- **Ground each question in this codebase.** Name the file, the function, the row, the URL that makes the question real. "How should this behave in Spanish?" is a worse question than "`/es/tags` serves this trail today — is that what it should say?"
- **Teach while you ask.** Where a decision turns on how something works — how React Router resolves a relative `to`, what a crawler does with a one-sided `hreflang` — explain it, with the example, before asking him to choose. He is deciding, not guessing, and cannot decide against a mechanism nobody described.
- **Recommend, and say why.** Lay out the options honestly, then name the one you would take and the reasoning that got you there. A neutral menu pushes the work back onto him; a recommendation he can reject moves it forward.
- **He directs the session and every decision in it.** Follow the thread he pulls, even when another looks more interesting, and put the alternative on the table rather than steering. The goal is a shared understanding — the same picture on both sides — not agreement extracted from him.

## The rest of the line

`/to-spec` synthesises the conversation into a spec, without a second interview. `/to-tickets` cuts that spec into tickets. Both publish to the tracker — GitHub issues in `poschuler/poschuler.com` (`docs/agents/issue-tracker.md`).

## What a ticket has to be

Tickets here are written for a machine to pick up alone, so three constraints hold on every one of them:

- **A vertical slice that can be verified**, and sized so that **one independent Sonnet session can finish it** — not an Opus one. That is not a guess about capability: `ralph/RALPH.md` sets `RALPH_MODEL` to `claude-sonnet-5`, so Sonnet is what actually executes these. A ticket too large for one such session is two tickets.
- **Strictly sequential, never parallelisable.** Each one blocks the next, in a single line — no fan-out, no "these three can go at once". A publication is one ordered sequence and so is the work that leads to it; two agents landing on `dev` at once is a merge conflict nobody asked for.
- **No human decision left inside it.** ralph implements these headless, with no one to ask, so anything requiring judgement is either settled up front in the grilling or pulled out into a separate piece of work. A ticket that says *decide whether…* is not a ticket; it is a question that belongs one step earlier. What Paul writes himself is a `ready-for-human` issue, which is the other way of pulling it out.

## Implementing, and reviewing

`/implement` builds from those tickets. **It must not run a code review at the end**, even though its own text tells it to: in a headless session the *native* `/code-review` launches background agents whose findings return as notifications nobody will deliver, and the session ends with the work complete, green and uncommitted. Committing to the current branch *is* part of `/implement`; reviewing is not.

The review is its own step, started by Paul, with `mattpocock-skills`' `/code-review`: the diff since a fixed point, read against this repo's standards and against what the originating ticket asked for. It shares its name with Claude Code's own `/code-review` — in this flow it always means Matt Pocock's, and anything that invokes it by name should say which one it means.

ralph models the same separation, and goes one step further: implement, review, then apply what the review found, three isolated sessions that each judge work they didn't do. It reaches none of these skills to do it — its prompts live in `ralph/prompts/*.md`, versioned with the repo, because a skill moves with its plugin while a prompt in git is pinned to the commit that ran it. `ralph/RALPH.md` has that arrangement, and the run that produced this rule.

## What he writes himself is labelled

`ready-for-human` on an issue means content — a Post, a landing, a Field Note — and no agent picks those up; `ready-for-agent` is the gate ralph reads (`docs/agents/triage-labels.md`). A phase whose code is done and whose content is not is the normal state of this repository, not a stalled one.
