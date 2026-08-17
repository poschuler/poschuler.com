# AGENTS.md

## Language

- **Conversation with the user: Spanish.** Explanations, questions, summaries and any chat output go in Spanish, with correct accents and diacritics.
- **Everything written to disk: English.** Code, identifiers, comments, commit messages, documentation, ADRs, `CONTEXT.md`, issue titles and bodies, PR descriptions and test names are all in English.

The split is deliberate: the repo is a public, English-language artifact; the conversation is not.

## How work arrives

**Understanding first, then the spec, then the tickets, then the code.** A piece of work moves through five skills in this order, and Paul starts each one:

```
/grill-with-docs  →  /to-spec  →  /to-tickets  →  /implement  →  /code-review
```

**All of them are the `mattpocock-skills` ones** (`skills/engineering/` in that plugin), never a similarly named skill from somewhere else. `/improve-codebase-architecture`, from the same plugin, runs every so often outside that line: it looks for architectural friction rather than for the next feature, and whatever it surfaces re-enters at the top as its own grilling.

None of these steps starts itself. Reaching the end of one is not permission to begin the next — say what you would do and wait. An answer that ends in a diff nobody asked for costs more to review than it saved.

### The grilling is the part that matters

Everything downstream is synthesis of what was settled here, so a rushed session produces a confident spec for the wrong thing. How to run it:

- **One question at a time, and stop.** Wait for the answer before asking the next. A numbered list of six questions is not an interview; it is a form, and it gets a form's answers.
- **Ground each question in this codebase.** Name the file, the function, the row, the URL that makes the question real. "How should this behave in Spanish?" is a worse question than "`/es/tags` serves this trail today — is that what it should say?"
- **Teach while you ask.** Where a decision turns on how something works — how React Router resolves a relative `to`, what a crawler does with a one-sided `hreflang` — explain it, with the example, before asking him to choose. He is deciding, not guessing, and cannot decide against a mechanism nobody described.
- **Recommend, and say why.** Lay out the options honestly, then name the one you would take and the reasoning that got you there. A neutral menu pushes the work back onto him; a recommendation he can reject moves it forward.
- **He directs the session and every decision in it.** Follow the thread he pulls, even when another looks more interesting, and put the alternative on the table rather than steering. The goal is a shared understanding — the same picture on both sides — not agreement extracted from him.

### The rest of the line

`/to-spec` synthesises the conversation into a spec, without a second interview. `/to-tickets` cuts that spec into tickets. Both publish to the tracker — GitHub issues in `poschuler/poschuler.com` (`docs/agents/issue-tracker.md`).

### What a ticket has to be

Tickets here are written for a machine to pick up alone, so three constraints hold on every one of them:

- **A vertical slice that can be verified**, and sized so that **one independent Sonnet session can finish it** — not an Opus one. That is not a guess about capability: `ralph/RALPH.md` sets `RALPH_MODEL` to `claude-sonnet-5`, so Sonnet is what actually executes these. A ticket too large for one such session is two tickets.
- **Strictly sequential, never parallelisable.** Each one blocks the next, in a single line — no fan-out, no "these three can go at once". A publication is one ordered sequence and so is the work that leads to it; two agents landing on `dev` at once is a merge conflict nobody asked for.
- **No human decision left inside it.** ralph implements these headless, with no one to ask, so anything requiring judgement is either settled up front in the grilling or pulled out into a separate piece of work. A ticket that says *decide whether…* is not a ticket; it is a question that belongs one step earlier. What Paul writes himself is a `ready-for-human` issue, which is the other way of pulling it out.

### Implementing, and reviewing

`/implement` builds from those tickets. **It must not run a code review at the end**, even though its own text tells it to: in a headless session — which is how ralph runs it — the *native* `/code-review` launches background agents whose results come back as deferred notifications nobody will deliver. On 16 Aug 2026 that ended a run with the work complete and green, uncommitted, the issue still open and ralph reporting `INCOMPLETE`. Committing to the current branch *is* part of `/implement`; reviewing is not.

The review is its own step, started by Paul, with `mattpocock-skills`' `/code-review`: the diff since a fixed point, read against this repo's standards and against what the originating ticket asked for. It shares its name with Claude Code's own `/code-review` — in this flow it always means Matt Pocock's. ralph models the same separation, with the review as an isolated second step carrying its own skill and its own model (`RALPH_REVIEW`, `RALPH_REVIEW_SKILL`, `RALPH_REVIEW_MODEL` in `ralph/ralph.config.sh.template`), which is the arrangement to reach for rather than folding a review back into step one.

**What he writes himself is labelled.** `ready-for-human` on an issue means content — a Post, a landing, a Field Note — and no agent picks those up; `ready-for-agent` is the gate ralph reads (`docs/agents/triage-labels.md`). A phase whose code is done and whose content is not is the normal state of this repository, not a stalled one.

**Write what was asked for, not the adjacent thing you found on the way.** Report the finding and let him scope it — that is what the top of this line is for.

**Commit when asked, never by default**, and never push without being told. `/implement` is the one exception, and only for the ticket it is implementing. Everywhere else the work stands or falls in the working tree until he says otherwise.

## Branches, and what publishes

`main` is production and `dev` is integration. Work forks from `dev` and returns to it by pull request; `dev` → `main` is a release.

**A merge to `main` is the Publication**, and it is the only thing that deploys anything: one CI job applies migrations, seeds the deployed D1 and KV from the committed fixtures, deploys the Worker and verifies the uploaded version is the one serving — in that order, with one owner (ADR 0003). A pull request deploys nothing. Never commit to `main` directly.

## Commits

One commit per unit of work. `type(scope): subject`, where the type is one of `feat`, `fix`, `refactor`, `docs`, `perf`, `build`, `ci`, `chore`, `test` or `content`, and the scope names the area — `i18n`, `tags`, `d1`, `seo`, `ui`, `css`, `seed`, `resume`, `header`, `theme`.

**The subject is a lower-case narrative sentence, not an imperative.** It says what happened, not what to do:

```
feat(i18n): the sitemap declares both Locales and stops duplicating a URL
fix(smoke): the Project namespace stops waiting for a note that does not exist
docs(tags): the reasoning lands with the code, and the glossary says what a Tag is
```

Not `update sitemap`, not `add locale support`. It reads as a sentence about the codebase because that is how everything else here is written — the ADRs, the docblocks, this file. Fifty characters is not the limit; the median subject in this history is a little over sixty.

The body, when there is one — and there usually is:

1. **One line anchoring the work**: the ticket, or the phase document and part it implements. `Part 8 of evolution-plan/15-phase-3-spanish.md (#48).` That directory is planning material and is deliberately not versioned here, so a reference to it resolves on the author's machine and nowhere else — which is why the reasoning worth keeping ends up in an ADR instead.
2. **A bullet per area touched**, saying what changed there and why, not restating the diff.
3. **One line naming what was verified and what it said.** `Suite (615), typecheck and build all green.` If something was checked by hand — a Draft rendered at its real address, a page read in a production build — say that instead, and say what you saw.
4. `Co-Authored-By:` as the trailer.

## Before you commit

Run what CI runs, in the order CI runs it:

```bash
pnpm typecheck
pnpm test
pnpm run verify:schema:local     # the migration chain arrives at schema.sql
pnpm run check:fixtures          # the committed fixtures are what the generators produce
pnpm run smoke                   # builds, then boots it with no vars and no secrets
```

The order is the cheap checks first and the one needing a build last — `smoke` builds for you, which is why `pnpm build` is not a separate line here; CI splits the two because it has other reasons to want the build step named. The smoke test is the one catching what no unit test can: a module reading configuration at evaluation time, which took the whole site down once.

## Content, and the files generated from it

`seed/d1/seed.sql` and `seed/kv/kv_payloads/` are **committed**, and they are generated. Editing anything under `app/content/` means regenerating both and committing them alongside the Markdown that produced them — D1 first, then KV, because the KV generator reads the seeded D1 to decide what to render. `check:fixtures` fails the build otherwise; before it existed, an edit without a regeneration republished the previous version in silence.

`docs/authoring.md` is the guide to the content itself: the front matter each kind carries, how a Translation is written, drafts, and every message the build refuses with. Read it before touching `app/content/`, and copy a starting point from `docs/templates/`.

**A schema change is two files, never one**: edit `seed/d1/schema.sql`, then add a migration under `seed/d1/migrations/` making the same change. `verify:schema:local` fails when they disagree, so neither can be forgotten (ADR 0006).

## Where code goes

`app/` holds only code reachable from a route — a new orphan there is a defect, not background noise. Tests live in `tests/`, never beside what they cover. `docs/design.md` has the rest: which layer a component belongs in, how a route is declared and mounted in both Locales, and how a page's metadata is assembled.

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues in `poschuler/poschuler.com`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, used verbatim: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
