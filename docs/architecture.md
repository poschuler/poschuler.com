# Architecture

How poschuler.com is put together at runtime and where its data comes from. For the vocabulary used below, see [`CONTEXT.md`](../CONTEXT.md); for UI and module conventions, see [`design.md`](./design.md).

## Shape

A single Cloudflare Worker serves the whole site. There is no separate API, no origin server, and no client-side data fetching — React Router runs in framework mode with SSR, so every route's `loader` executes inside the Worker at the edge and the browser receives rendered HTML.

```
Browser
  │
  ▼
Cloudflare Worker  (workers/app.ts → createRequestHandler)
  │  React Router v7, ssr: true
  ├──▶ D1   (POSCHULER_BD)  — Content Item metadata
  ├──▶ KV   (BLOG_KV)       — pre-rendered Post HTML, sitemap XML
  └──▶ cdn.poschuler.dev    — the Resume PDF, proxied
```

`workers/app.ts` is the only entry point. It declares the `Env` type (bindings + vars) and augments React Router's `AppLoadContext` so every loader reaches bindings through `context.cloudflare.env`. Nothing is read from `process.env` at runtime and there is no module-level singleton holding a binding — the Workers runtime forbids capturing request-scoped state across requests.

## The content pipeline

The single most important decision in this codebase: **Markdown files are the source of truth, and the Worker never parses Markdown.**

```
app/content/**/*.md                       ← source of truth, versioned in git
   │
   ├─ front matter ──▶ seed/d1/generate-seed-sql.ts ──▶ seed/d1/seed.sql ──▶ D1 `content`
   │                     (front-matter)                   (committed)          metadata only
   │
   └─ body ──────────▶ seed/kv/generate-kv-json.ts ──▶ seed/kv/kv_payloads/*.json ──▶ KV
                         (marked → HTML)                                    `blog:<slug>:<locale>`
                         (@forge42/seo-tools)                               `sitemap`
```

Both generators are Node scripts run from the developer's machine, never in the Worker. That is why `front-matter`, `marked` and `@forge42/seo-tools` appear in `dependencies` yet are absent from every runtime import.

The KV generator reads the *already-seeded* D1 table (via `wrangler d1 execute --json`) to decide which Posts to render, so **D1 must be seeded before KV**. The npm scripts encode that order:

```
npm run d1:seed:local    # generate seed.sql, then wrangler d1 execute --local
npm run kv:seed:local    # generate JSON payloads, then wrangler kv key put --local
```

`:remote` variants do the same against the deployed resources. `kv-bulk-upload.ts` deletes every existing `blog:` key before uploading, making the upload a full replacement rather than a merge.

## Data stores

### D1 — `POSCHULER_BD`

SQLite at the edge, queried with hand-written SQL through three thin helpers in `app/db.server.ts` (`dbQuery`, `dbQueryRow`, `dbExecute`). No ORM, no query builder, no migration tool: `seed/d1/schema.sql` is applied by hand and `seed.sql` is regenerated wholesale.

The `content` table holds every Content Item. `type` discriminates `'post'` from `'link'` — note that `'link'` is the persisted spelling of what the domain calls a **Bookmark**; `CONTEXT.md` is the authority on the name, the column is legacy spelling. Identity is enforced by two partial unique indexes:

| Index               | Applies to        | Uniqueness    |
| ------------------- | ----------------- | ------------- |
| `content_post_idx`  | rows with a lang  | `(slug, lang)` |
| `content_link_idx`  | rows without lang | `(slug)`       |

plus a `CHECK` that a `'post'` row must carry a lang. This is the schema-level encoding of "a Post is identified by `(Slug, Locale)`, a Bookmark by Slug alone".

`tags` is a JSON string. Nothing currently parses it — the SQL casts it into a `string[]`-typed field that is actually still a string at runtime. Treat `ContentRowType.tags` as unparsed.

### KV — `BLOG_KV`

Read-only at runtime, written only by the seed pipeline.

| Key                     | Value                                                      |
| ----------------------- | ---------------------------------------------------------- |
| `blog:<slug>:<locale>`  | `{ attributes, html }` — front matter plus rendered Post HTML |
| `sitemap`               | `{ sitemap }` — the full sitemap XML as a string             |

A Post body is one KV read. Missing key → 404, which is also how an unpublished or misspelled slug behaves.

## Routes

Routes are declared explicitly in `app/routes.ts` (config-based, not file-system-based) and each one lives in its own folder with its sections colocated as siblings.

| Route            | Store  | Notes                                                       |
| ---------------- | ------ | ----------------------------------------------------------- |
| `/`              | D1     | Timeline — `findAll`, Posts and Bookmarks interleaved        |
| `/blog`          | D1     | `findAllPosts`                                              |
| `/bookmarks`     | D1     | `findAllBookmarks`                                          |
| `/blog/:blogSlug`| KV     | Locale hardcoded to `en`; body injected via `dangerouslySetInnerHTML` |
| `/resume`        | none   | `app/routes/resume/resume.json`, imported at build time      |
| `/resume.pdf`    | fetch  | proxies `cdn.poschuler.dev`, forces `Content-Disposition: attachment` |
| `/sitemap.xml`   | KV     | serves the pre-generated XML verbatim                        |
| `/robots.txt`    | none   | generated per request from `PUBLIC_HOST`                     |
| `/action/set-theme` | cookie | theme preference, no UI of its own                        |
| `*`              | none   | 404                                                          |

The first five sit inside `routes/layouts/_layout.tsx`, which supplies the sticky header. `/resume.pdf`, `/sitemap.xml`, `/robots.txt` and `/action/set-theme` are resource routes outside it.

## Configuration

`wrangler.jsonc` declares the bindings, `nodejs_compat`, and observability (logs and traces persisted at full sampling). `workers_dev` is off — the site is served from its own domain only.

Vars, templated in `.vars.template` and supplied through `.dev.vars` locally / secrets in production:

| Var                    | Used by                                                   |
| ---------------------- | --------------------------------------------------------- |
| `SESSION_THEME_SECRET` | signs the `poschuler__theme` cookie; startup throws if empty |
| `PUBLIC_HOST`          | canonical origin for `robots.txt`                          |
| `DEPLOYMENT_ENV`       | `"production"` tightens the theme cookie to `.poschuler.com` + `secure` |
| `DB_DEBUG_FLAG`        | declared, currently unread                                 |

`npm run deploy` builds and ships in one step. Type generation (`wrangler types` + `react-router typegen`) runs on `postinstall` and before `typecheck`; the generated `worker-configuration.d.ts` and `.react-router/` are gitignored, so a fresh clone must install before it type-checks.

## Known defects

- **`app/routes/robots.ts:8`** reads `context.cloudflare.env.process.env.PUBLIC_HOST`. There is no `process` on `Env`; the var is `context.cloudflare.env.PUBLIC_HOST`. The `typeof … !== "string"` guard means this throws its own "Missing env" error rather than a property access error, which masks the real cause.
- **`/blog/:blogSlug` hardcodes `:en`.** The schema, the seed pipeline and the KV key layout are all Locale-aware; the route is not, and no URL carries a Locale. Serving a second Translation needs a routing decision first (`/es/blog/…` vs. a query param vs. content negotiation).
- **`generate-kv-json.ts` builds its D1 query with nested unescaped double quotes** inside a double-quoted `--command` string. It works only because SQL treats the collapsed quoting as bare identifiers.
- **The sitemap's `/resume` `lastmod` is the hardcoded string `2025-12-21`.**

## Inherited code (removed)

This repo was scaffolded from an earlier e-commerce project and carried roughly two thirds of its `app/` tree as unreachable baggage: an inherited design system, a second `ui-react-aria/` component set, product cards and sliders, ~25 storefront hooks (brand/category/department/geolocation), the unused two thirds of shadcn/ui, and two model files that no longer compiled (`feeds.server.ts` and `projects.server.ts` called `dbQuery` with the pre-D1 two-argument signature and used Postgres `TO_CHAR`). The `feeds` and `projects` tables backing them were created but never read or written.

All of it was deleted in one pass, verified by walking the import graph from the real entry points (`workers/app.ts`, `app/root.tsx`, and every module named in `app/routes.ts`). `app/` went from 178 source files to 40, with zero unreachable files remaining. The one live import into the inherited tree — `ModeToggle`'s icon button — was preserved by moving that component to `app/components/ui/icon-button.tsx` rather than rewriting the toggle, so the UI is unchanged.

**`app/` now contains only reachable code.** A new orphan is therefore a defect, not background noise: if a file is not reachable from a route, it does not belong in `app/`.

Two related cleanups went with it: `app/app.css` lost its inherited rules (`.horizontal-product-list`, `.nav-btn`, `.custom-scrollbar`, `.border-gradient`, `#nprogress`, a commented-out masonry layout) and the design tokens for social-login buttons and hero gradients that no component used. The semantic color scales were kept in full — they are the design system, not dead code.
