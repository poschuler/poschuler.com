# poschuler.com

The personal site of **Paul Osorio Schuler** — Staff Software Engineer, backend, TypeScript and Node.js. It holds what he writes, what he reads, and his professional history: [poschuler.com](https://poschuler.com).

The whole site is a single Cloudflare Worker. There is no separate API, no origin server and no client-side data fetching — React Router runs in framework mode with SSR, so every loader executes at the edge and the browser receives rendered HTML.

## What's inside

| Page         | What it shows                                                        |
| ------------ | -------------------------------------------------------------------- |
| `/`          | Landing page — who he is, the flagship project, the newest writing    |
| `/projects`  | Software he built and runs, weighted by tier                          |
| `/blog`      | Long-form articles, written here                                      |
| `/bookmarks` | External articles worth endorsing, credited to their source           |
| `/timeline`  | Posts and Bookmarks interleaved, newest first                         |
| `/resume`    | Structured professional history, plus a PDF download                  |

## How content works

**Markdown files are the source of truth, and the Worker never parses Markdown.** Everything under `app/content/` is versioned in git, and a build-time pipeline splits each file in two:

```
app/content/<tree>/**/*.md     ← authored here, versioned in git
   │                             the tree — blog, bookmarks, projects — says what it is
   ├─ front matter ──▶ D1 (content, project)   metadata: title, dates, tags, source
   └─ body ──────────▶ KV  (blog:… , project:…)   pre-rendered HTML
```

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

A **Post** is a folder plus a locale-suffixed file, `app/content/blog/<slug>/<slug>.en.md`:

```yaml
---
type: 'post'
title: 'Implementing Value Objects in Node.js'
description: 'A practical guide to…'
tags: ['nodejs', 'typescript', 'ddd']
publishedAt: '2025-11-02'
repository: 'https://github.com/…'   # optional, renders a repo link
updates:                             # optional, newest first, curated
  - date: '2026-08-14'
    note: 'Updated for Node 24; the Express 4 examples now use Express 5.'
---
```

`updates` is what the author says changed, not a commit log — the fine-grained history is already in git. It never reorders the Timeline, and it does date the page in the sitemap. See [ADR 0005](docs/adr/0005-revisions-are-a-curated-list-in-the-content.md).

A **Project** is a folder plus a locale-suffixed file, `app/content/projects/<slug>/<slug>.en.md`. It is not a Content Item — no publication date, no place in the Timeline — so it carries revisions instead, and needs at least one:

```yaml
---
type: 'project'
title: 'Chekalo'
summary: 'One or two sentences, outcome first. This is what the index shows.'
description: 'The SEO meta description.'
tier: 'flagship'          # flagship | supporting | experiment
status: 'active'          # active | archived
stack: ['TypeScript', 'Node.js']
liveUrl: 'https://chekalo.pe'        # optional
repoUrl: 'https://github.com/…'      # optional
sortOrder: 1
updates:
  - date: '2026-08-20'
    note: 'First published.'
---
```

`tier` is weight, never route shape: promoting a project that grew is a change to this field, and its URL never moves.

A **Bookmark** is a single file, `app/content/bookmarks/<slug>.md`, front matter only — the body stays at the source:

```yaml
---
type: 'link'
title: "The Copenhagen Book"
source: 'pilcrow'
externalUrl: "https://thecopenhagenbook.com/"
publishedAt: '2024-07-30'
tags: ['auth', 'security', 'webdev']
---
```

The filename is the Slug, and it never changes once published — it is the URL. Re-run both seed scripts after adding a file; the KV upload replaces every `blog:` key rather than merging.

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
  lib/seo/        Hand-rolled sitemap and robots.txt renderers
seed/             Build-time generators for D1 and KV
workers/app.ts    The Worker entry point
tests/            Vitest — unit and integration, never beside the code
scripts/          Local tooling, including the cold-start smoke test
docs/             Architecture, design conventions and ADRs
```

Tests live in `tests/` rather than next to what they cover, because `app/` holds only code reachable from a route — a `.test.ts` there would be an orphan by this repo's own rule.

## CI

Every push to `main` or `dev`, and every pull request into `main`, runs a typecheck, the test suite, a build, and a cold start: the built Worker is served with no secrets and no `.dev.vars`, and each public route has to answer and carry content. That last step exists because a missing variable once took the whole site down, and the only environment where it showed was the one nobody had — an empty one.

The tests and the cold start do not overlap. The cold start proves the Worker boots with nothing configured; the tests prove it answers correctly — a route returning 200 with the wrong content passes the first and fails the second. Both seed their stores from the fixtures committed under `seed/`, applied with `--local`, so neither needs credentials.

Those checks also assert that the committed fixtures are what the generators produce today. Editing a Markdown file without regenerating used to republish the previous version in silence; now it fails the run instead.

On a push to `main`, and only once all of that passes, a second job performs the whole Publication in one place: it confirms the deployed D1 still has the shape `seed/d1/schema.sql` describes, seeds the **deployed** D1 and KV from the committed fixtures, reads both back, builds and deploys the Worker, and finally confirms the version it just uploaded is the one serving traffic. Both seed halves upsert rather than clear-and-rewrite, so running it repeatedly changes nothing and no request ever lands on a half-empty store. It reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the `production` environment, which only accepts `main`.

The order is the point: the seed, the deploy and the check are one sequence with one owner, and any of them failing fails the run. It used to be two systems — this workflow and Cloudflare's Workers Builds — starting on the same push and never learning about each other. See [ADR 0003](docs/adr/0003-ci-owns-the-deploy-workers-builds-is-off.md).

## Documentation

- [`CONTEXT.md`](CONTEXT.md) — the domain vocabulary. What a Post, a Bookmark, a Slug and the Timeline mean here.
- [`docs/architecture.md`](docs/architecture.md) — runtime shape, the content pipeline, data stores, caching, known defects.
- [`docs/design.md`](docs/design.md) — UI and module conventions: color, theming, component layers, data access.
- [`docs/adr/`](docs/adr/) — the decisions worth recording, and why.

## Licensing

Dual-licensed, because the repository holds both code and original writing.

- **Source code — [MIT](LICENSE).** Configuration, build scripts, templates and all Worker TypeScript. Use, modify and distribute it, keeping the copyright and licence notice.
- **Content — [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).** Articles, posts and explanations. Share and adapt them with attribution to Paul Osorio Schuler, for non-commercial purposes.
