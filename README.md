# poschuler.com

The personal site of **Paul Osorio Schuler** — Staff Software Engineer, backend, TypeScript and Node.js. It holds what he writes, what he reads, and his professional history: [poschuler.com](https://poschuler.com).

The whole site is a single Cloudflare Worker. There is no separate API, no origin server and no client-side data fetching — React Router runs in framework mode with SSR, so every loader executes at the edge and the browser receives rendered HTML.

The site is bilingual: English is served at the root with no prefix, Spanish under `/es`, as a second branch over the same route modules. The Resume is the one page whose address changes between them — `/cv` and `/es/cv` — because *resume* is a Spanish verb; every other path segment is the same string in both. The language switcher that links one to the other ships hidden, gated on Spanish content that has not been written yet. See [ADR 0010](docs/adr/0010-english-at-the-root-spanish-under-es.md) for the route shape and [ADR 0011](docs/adr/0011-the-interface-language-is-a-typed-catalogue.md) for why the interface strings are a typed catalogue rather than an i18n library.

## What's inside

| Page          | What it shows                                                        |
| ------------- | -------------------------------------------------------------------- |
| `/`           | Landing page — who he is, the flagship project, the newest writing    |
| `/projects`   | Software he built and runs, weighted by tier                          |
| `/blog`       | Long-form articles and the series they belong to                      |
| `/series`     | Subjects worked through in order — each with a contract and an arc     |
| `/bookmarks`  | External articles worth endorsing, credited to their source           |
| `/timeline`   | Posts and Bookmarks interleaved, newest first                         |
| `/tags`       | Every subject some Post covers, heaviest first, with its count        |
| `/tags/<tag>` | The Posts on one subject, newest first — `noindex, follow`            |
| `/cv`         | Structured professional history, plus a PDF download                  |

Every page above also exists under `/es`, serving the same document translated where one exists. A document with no Translation answers 404 rather than falling back to English; an empty Spanish index still answers 200, `noindex, follow`, explaining itself and linking back to English.

## How content works

**Markdown files are the source of truth, and the Worker never parses Markdown.** Everything under `app/content/` is versioned in git, and a build-time pipeline splits each file in two:

```
app/content/<tree>/**/*.md     ← authored here, versioned in git
   │                             the tree — blog, bookmarks, projects, series — says what it is
   │                             and how deep it sits says whether it is the item or lives inside one
   ├─ front matter ──▶ D1 (content, content_tag, project, series, series_section)
   └─ body ──────────▶ KV  (blog:… , project:… , series:…)   pre-rendered HTML
```

A key's prefix says what kind of payload it is, not which URL serves it: a Part of a series is an ordinary Post with a container, so its body lives under `blog:` and is served at `/series/<series>/<part>`.

Serving a Post is therefore one KV read, and listing Content Items is one indexed D1 query — no Markdown parsing on the request path. That is why `front-matter` and `marked` are dependencies yet appear in no runtime import. See [ADR 0001](docs/adr/0001-markdown-as-source-of-truth-derived-into-d1-and-kv.md).

## Stack

| Layer            | Choice                          | Notes                                                     |
| ---------------- | ------------------------------- | --------------------------------------------------------- |
| Platform         | Cloudflare Workers              | The only runtime; `workers_dev` off, own domain only       |
| Framework        | React Router v8, framework mode | SSR, config-based routes in `app/routes.ts`                |
| UI               | React 19 + Base UI              | Headless primitives wrapped in `app/components/ui/`        |
| Styling          | Tailwind CSS v4 + Radix Colors  | Semantic tokens in `@theme`; no default Tailwind palette   |
| Metadata store   | Cloudflare D1                   | Hand-written SQL, no ORM — see [ADR 0002](docs/adr/0002-hand-written-sql-over-d1-without-an-orm.md) |
| Content store    | Cloudflare KV                   | Rendered Post HTML and the sitemap, read-only at runtime   |
| Validation       | Zod                             | Cookie parsing                                             |
| Build            | Vite 8 (Rolldown + Oxc)         | Not Rollup, not esbuild                                    |
| Package manager  | pnpm                            | Pinned via `packageManager`; the only lockfile             |

## Getting started

Requires **Node 22+** (developed on 24) and **pnpm** — `corepack enable` picks up the pinned version.

```bash
git clone https://github.com/poschuler/poschuler.com.git
cd poschuler.com
pnpm install                       # also runs `wrangler types`

cp .vars.template .dev.vars        # then fill SESSION_THEME_SECRET
openssl rand -base64 32            # a value for it
```

`SESSION_THEME_SECRET` signs the theme cookie. Nothing reads it at startup: without it the site still serves every page in the default theme, and only the toggle itself fails.

Create the local D1 table, then seed the two stores **in that order** — the KV generator reads the already-seeded D1 table to decide which Posts to render:

```bash
pnpm exec wrangler d1 execute poschuler --file ./seed/d1/schema.sql --local
pnpm run d1:seed:local             # front matter → seed.sql → D1
pnpm run kv:seed:local             # bodies → JSON payloads → KV
pnpm run dev
```

`:remote` variants of both seed scripts do the same against the deployed resources.

## Adding content

**[`docs/authoring.md`](docs/authoring.md) is the guide** — the front matter of
every kind, the languages, drafts, the commands and what fails the build. What
follows is the shape it assumes.

Everything published lives under `app/content/`, in one of four trees, and **the
path is what says what a file is**: the front matter's `type` is checked against
its placement rather than believed (ADR 0004).

```
app/content/
  tags.json                                 the closed Tag vocabulary
  blog/<slug>/<slug>.en.md                  a Post with no Container
  bookmarks/<slug>.md                       a Bookmark — front matter only, no Locale
  projects/<project>/<project>.en.md        a Project
  projects/<project>/<note>/<note>.en.md    a Field Note — a Post in that Project
  series/<series>/<series>.en.md            a Series manifest — the whole arc
  series/<series>/<part>/<part>.en.md       a Part — a Post in that Series
```

The file named after its folder *is* that folder, and a subfolder is content
living inside it. That one rule is how a Series manifest is told apart from its
Parts, and a Project from its Field Notes — neither a Part nor a Field Note
declares where it sits, because the manifest above it already does
([ADR 0007](docs/adr/0007-the-manifest-declares-the-arc-a-part-does-not-know-where-it-is.md)).
Nothing nests under `blog/` or `bookmarks/`, and a directory no generator walks
fails the build rather than publishing nothing in silence.

Four things beyond the shape, each with its own decision behind it:

- **A Tag is its slug, and the vocabulary is closed.** `app/content/tags.json`
  lists every Tag this site may use; one that is not declared there fails the
  build, so writing about a new subject starts by adding a line to that file
  ([ADR 0008](docs/adr/0008-a-tag-is-its-slug-and-the-vocabulary-is-declared.md)).
- **A Revision is what the author says changed**, not a commit log — the
  fine-grained history is already in git. It never reorders the Timeline, and it
  does date the page in the sitemap
  ([ADR 0005](docs/adr/0005-revisions-are-a-curated-list-in-the-content.md)).
- **Any document may carry `draft: true`.** It is checked exactly as strictly as
  a published one and only then produces no row, no payload and no address;
  publishing is deleting that line. `pnpm run preview:drafts` reads it at its
  real address without touching a tracked file
  ([ADR 0009](docs/adr/0009-a-draft-is-a-document-the-build-validates-and-refuses-to-publish.md)).
- **The filename is the Slug, and it never changes once published** — it is the
  URL. If one has to move anyway, add the old address to `app/lib/redirects.ts`;
  a test walks that map against the database, so a redirect pointing at a page
  that no longer exists fails the build.

Re-run both seed scripts after adding or editing a file, D1 before KV; the KV
upload replaces every payload rather than merging.

## Commands

| Command                  | What it does                                              |
| ------------------------ | --------------------------------------------------------- |
| `pnpm run dev`           | Dev server on workerd, with the local D1 and KV            |
| `pnpm run build`         | Production build into `build/`                             |
| `pnpm run preview`       | Build, then serve the built output                         |
| `pnpm run typecheck`     | Regenerate types (`wrangler` + `react-router`), then `tsc` |
| `pnpm test`              | Vitest — unit, plus integration against a local D1 and KV  |
| `pnpm run test:watch`    | The same, in watch mode                                    |
| `pnpm run test:coverage` | Coverage over the modules the suite is meant to cover      |
| `pnpm run smoke`         | Build, then serve it with nothing configured and check it answers |
| `pnpm run deploy`        | Build and ship in one step                                 |
| `pnpm run d1:reset:local` | Rebuild the local D1 from `schema.sql` (KV is left alone)  |
| `pnpm run d1:seed:local` | Regenerate `seed.sql` and apply it locally                 |
| `pnpm run kv:seed:local` | Regenerate KV payloads and upload them locally             |
| `pnpm run preview:drafts` | Render Drafts into the local D1 and KV, touching no tracked file |
| `pnpm run verify:stores:local` | Read D1 and KV back and check they match the repo    |
| `pnpm run check:fixtures` | Regenerate the fixtures and fail if anything changed       |
| `pnpm run verify:schema:local` | Check the migration chain arrives at `schema.sql`     |
| `pnpm run verify:schema:remote` | Check the deployed D1 arrives at `schema.sql`        |
| `pnpm run d1:migrate:remote` | Apply pending migrations to the deployed D1 (CI does this) |

Changing the schema is two files, not one: edit `seed/d1/schema.sql`, then add a
migration under `seed/d1/migrations/` making the same change. `verify:schema:local`
fails the build if they disagree, so neither can be forgotten. See ADR 0006.

The generated `worker-configuration.d.ts` and `.react-router/` are gitignored, so a fresh clone must install before it type-checks.

> **Note:** the build copies `.dev.vars` into `build/server/` so the output can be previewed locally. `build/` is gitignored and `wrangler deploy` does not turn those into Worker vars — but never publish `build/` as an artifact.

## Layout

```
app/
  content/        Markdown — the source of truth
  components/ui/  Shared Base UI primitives
  models/         Named domain queries over D1
  routes/         One folder per route, entry file prefixed with _
  lib/seo/        Hand-rolled sitemap and robots.txt renderers, and the JSON-LD
  lib/redirects.ts  URLs this site published and no longer serves
seed/             Build-time generators for D1 and KV
workers/app.ts    The Worker entry point
tests/            Vitest — unit and integration, never beside the code
scripts/          Local tooling, including the cold-start smoke test
docs/             Authoring, architecture and design conventions
docs/adr/         The decisions worth recording, indexed in its own README
docs/templates/   One front matter template per kind, copied to start a document
docs/agents/      How an agent working in this repo finds the tracker and the domain docs
```

Tests live in `tests/` rather than next to what they cover, because `app/` holds only code reachable from a route — a `.test.ts` there would be an orphan by this repo's own rule.

## CI

Every push to `main` or `dev`, and every pull request into `main`, runs a typecheck, the test suite, a build, and a cold start: the built Worker is served with no secrets and no `.dev.vars`, and a route from each namespace, in both languages, has to answer and carry content. That last step exists because a missing variable once took the whole site down, and the only environment where it showed was the one nobody had — an empty one.

The tests and the cold start do not overlap. The cold start proves the Worker boots with nothing configured; the tests prove it answers correctly — a route returning 200 with the wrong content passes the first and fails the second. Both seed their stores from the fixtures committed under `seed/`, applied with `--local`, so neither needs credentials.

Those checks also assert that the committed fixtures are what the generators produce today. Editing a Markdown file without regenerating used to republish the previous version in silence; now it fails the run instead.

On a push to `main`, and only once all of that passes, a second job performs the whole Publication in one place: it confirms the deployed D1 still has the shape `seed/d1/schema.sql` describes, seeds the **deployed** D1 and KV from the committed fixtures, reads both back, builds and deploys the Worker, and finally confirms the version it just uploaded is the one serving traffic. Both seed halves upsert rather than clear-and-rewrite, so running it repeatedly changes nothing and no request ever lands on a half-empty store. It reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the `production` environment, which only accepts `main`.

The order is the point: the seed, the deploy and the check are one sequence with one owner, and any of them failing fails the run. It used to be two systems — this workflow and Cloudflare's Workers Builds — starting on the same push and never learning about each other. See [ADR 0003](docs/adr/0003-ci-owns-the-deploy-workers-builds-is-off.md).

## Documentation

- [`CONTEXT.md`](CONTEXT.md) — the domain vocabulary. What a Post, a Bookmark, a Series, a Part and the Timeline mean here.
- [`docs/authoring.md`](docs/authoring.md) — how a document is written, checked and published: front matter by kind, languages, drafts, the commands, and what fails the build. Templates in [`docs/templates/`](docs/templates/).
- [`docs/architecture.md`](docs/architecture.md) — runtime shape, the content pipeline, data stores, caching, known defects.
- [`docs/runbook.md`](docs/runbook.md) — what to do when production is wrong: a failed publication, a rollback and what it does not undo, reverting content, and the symptoms with a known cause.
- [`docs/design.md`](docs/design.md) — UI and module conventions: color, theming, component layers, data access.
- [`docs/adr/`](docs/adr/) — the decisions worth recording, and why. Its [index](docs/adr/README.md) lists all eleven with their state, and says which ones were later amended or half superseded.

## Licensing

Dual-licensed, because the repository holds both code and original writing.

- **Source code — [MIT](LICENSE).** Configuration, build scripts, templates and all Worker TypeScript. Use, modify and distribute it, keeping the copyright and licence notice.
- **Content — [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).** Articles, posts and explanations. Share and adapt them with attribution to Paul Osorio Schuler, for non-commercial purposes.
