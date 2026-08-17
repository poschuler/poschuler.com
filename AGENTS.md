# AGENTS.md

## Language

- **Conversation with the user: Spanish.** Explanations, questions, summaries and any chat output go in Spanish, with correct accents and diacritics.
- **Everything written to disk: English.** Code, identifiers, comments, commit messages, documentation, ADRs, `CONTEXT.md`, issue titles and bodies, PR descriptions and test names are all in English.

The split is deliberate: the repo is a public, English-language artifact; the conversation is not.

## What this is

A React Router site on Cloudflare Workers, with D1 and KV behind it, managed with **pnpm**. `pnpm dev` runs it; `pnpm smoke` builds it and boots it with no vars and no secrets. `docs/architecture.md` has the runtime shape.

## How work arrives

Work reaches the code as a GitHub issue, and gets there through five `mattpocock-skills` skills in this order — `/grill-with-docs → /to-spec → /to-tickets → /implement → /code-review` — each one started by Paul. **None of them starts itself.** Reaching the end of one is not permission to begin the next: say what you would do, and wait.

How each step is run, what a ticket has to be, and where the review lives: `docs/agents/workflow.md`.

Two rules hold in every session:

- **Write what was asked for, not the adjacent thing you found on the way.** Report the finding and let him scope it — that is what the top of that line is for.
- **Commit when asked, never by default**, and never push without being told. `/implement` is the one exception, and only for the ticket it is implementing.

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
