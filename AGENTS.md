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

## Plans

Two directories hold planning material. `/plans/` holds one working document per piece of work Paul is about to do himself — the outline of a post he is writing, the shape of a change before it is a ticket. `/evolution-plan/` holds the long-form plan for where this site is going: positioning, content model, the phases. Both are scaffolding for the person, not a record of the repository.

**Planning material is internal, and it stays internal.** Neither directory is versioned, and nothing that is versioned may reference either one — not a commit body, not a pull request, not an issue, not an ADR, not a docblock, not a test name, not a line of content. A plan is never cited, never quoted, never named. Read anywhere else, this repository gives no sign that one exists, and that is the point.

**Two files break that rule so that it holds.** `.gitignore` names both directories because naming them there is what keeps them out, and this section names them because a rule that cannot say what it forbids is one nobody enforces twice: the next agent to find `/plans/` on disk, having read nothing that rules it out, cites it. Those two are the whole list. Everywhere else the prohibition is absolute.

**An anchor is a ticket.** A commit body cites the issue it implements, never the phase document and part that produced it. Reasoning worth keeping outlives its plan by moving into an ADR, a docblock or the content itself, in its own words — a docblock that has to point at a plan to be understood is a docblock that has not said its piece yet.

One file per unit of work in `/plans/`, named after what it plans — a post's plan takes that post's slug. No example is given here, because naming one would be the very thing this section forbids.

The language rule at the top bends here and only here: a plan drafting Spanish content is written in Spanish, because what it holds is that draft.

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

1. **One line anchoring the work**: the ticket it implements. `Implements #48.` Never the plan behind it — see **Plans** for why, and for where that reasoning goes instead.
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
pnpm run kv:upload:local         # the committed KV payloads land in the local namespace
pnpm run verify:stores:local     # both local stores hold what the Markdown says
pnpm run smoke                   # builds, then boots it with no vars and no secrets
```

If you touched anything under `architecture/`, add the check CI runs on it — it needs Docker, which nothing else in this list does, so it is not part of the block above:

```bash
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD/architecture:/ws:ro" \
  structurizr/structurizr:2026.06.28 validate -w /ws/workspace.dsl
```

It is silent on success. Do not check a broken workspace by opening Structurizr Lite: when the DSL stops parsing, Lite serves the last model it parsed successfully and says nothing.

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
