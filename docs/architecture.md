# Architecture

How poschuler.com is put together at runtime and where its data comes from. For the vocabulary used below, see [`CONTEXT.md`](../CONTEXT.md); for UI and module conventions, [`design.md`](./design.md); for what to do when any of this is wrong in production, [`runbook.md`](./runbook.md).

## Shape

A single Cloudflare Worker serves the whole site. There is no separate API, no origin server, and no client-side data fetching — React Router runs in framework mode with SSR, so every route's `loader` executes inside the Worker at the edge and the browser receives rendered HTML.

```
Browser
  │
  ▼
Cloudflare Worker  (workers/app.ts → createRequestHandler)
  │  React Router v8, ssr: true
  ├──▶ D1   (POSCHULER_BD)  — Content Item metadata
  ├──▶ KV   (BLOG_KV)       — pre-rendered Post HTML, sitemap XML
  └──▶ cdn.poschuler.dev    — the Resume PDF, proxied
```

`workers/app.ts` is the only entry point. Per request it consults `app/lib/redirects.ts`, builds a `RouterContextProvider`, sets the `cloudflareContext` declared in `app/context.ts`, and hands it to the request handler; loaders then read bindings with `const { env } = context.get(cloudflareContext)`. There is no module-level singleton holding a binding — the Workers runtime forbids capturing request-scoped state across requests.

The redirects come first because a URL this site no longer serves has no route to match and no loader to run. The table and the matching are a separate module for the same reason the security headers are: this one cannot be imported by a test. Every entry is a permanent 301 with no expiry — it exists for links already published, which never update — and a test walks the map against D1, because a 301 pointing at a 404 is worse than no redirect at all.

**No exceptions, and one of them was paid for.** `app/color-scheme-cookie.ts` briefly built its cookie at module scope from `process.env`, throwing on a missing value. It took production down: the module is evaluated on the way to serving *any* request, so a missing var meant error 1101 on every route — the whole site off to protect a theme preference. The cookie is now built per request from the `env` in `cloudflareContext`, like everything else.

Two rules came out of it. **Read bindings inside the request, never at module scope** — what works in dev, where the Vite plugin populates `process.env` from `.dev.vars`, is not what runs at the edge. And **size the blast radius to the feature**: reading the cookie degrades to the default theme and logs, while writing it still throws, so a misconfigured Worker serves every page and only the toggle fails.

`app/context.ts` also owns the `AppEnv` type: the bindings `wrangler types` generates from `wrangler.jsonc` intersected with the vars that only exist in `.dev.vars`/secrets. Adding a binding means editing `wrangler.jsonc` and regenerating; adding a var means editing `AppEnv` by hand.

## The content pipeline

The single most important decision in this codebase: **Markdown files are the source of truth, and the Worker never parses Markdown.**

```
app/content/<tree>/**/*.md                ← source of truth, versioned in git
   │                                        the tree decides what a file is — ADR 0004
   │
   ├─ front matter ──▶ seed/d1/generate-seed-sql.ts ──▶ seed/d1/seed.sql ──▶ D1 `content`
   │                     (front-matter)                   (committed)          `content_tag`
   │                     (app/content/tags.json)                               `project`
   │                                                                           `series`
   │                                                                           `series_section`
   │
   └─ body ──────────▶ seed/kv/generate-kv-json.ts ──▶ seed/kv/kv_payloads/<kind>/*.json ──▶ KV
                         (seed/kv/markdown.ts)                              `blog:<slug>:<locale>`
                         (app/lib/seo/sitemap.ts)                           `project:<slug>:<locale>`
                                                                            `series:<slug>:<locale>`
                                                                            `sitemap`
```

The trees are `blog/`, `bookmarks/`, `projects/` and `series/`. Each generator
walks only its own, and the `type` in the front matter is checked against the
tree rather than believed — a mismatch, or a top-level directory no generator
walks, fails the build. Payload directories follow the same rule: the directory
a payload sits in decides its key prefix.

Inside a tree, **depth decides what a file is**: the file named after its folder
*is* that folder, and a subfolder is content living inside it. So
`series/<series>/<series>.en.md` is the Series,
`series/<series>/<part>/<part>.en.md` is a Post (a Part) whose container it is,
and `projects/<project>/<note>/<note>.en.md` is a Post (a Field Note) whose
container is the Project above it — one tree, two types, told apart by the path
(ADR 0004, amended). What each tree allows to nest is declared in
`CONTENT_TREES`; `blog/` and `bookmarks/` allow nothing, so a stray subfolder
there fails rather than acquiring a meaning. `series/` and `projects/` each
allow one nested type — `post` — which is what makes a Part and a Field Note
possible in the first place.

`CONTENT_TREES` also declares whether a tree's files carry a Locale. A
recognised suffix — `<slug>.en.md` or `<slug>.es.md` — is required under
`blog/`, `projects/` and `series/`, and forbidden under `bookmarks/`: a
Bookmark is a pointer to somebody else's document, not a Translation of one,
and would seed with `lang` set against the partial unique index that assumes
it has none. Before this was declared, the vocabulary lived in a regular
expression alone, and a suffix it did not recognise — a typo, or the
`.en-old.md` convention this repository used to draft under — was absorbed
into the Slug and skipped without a word (ADR 0004). Both mistakes now fail
the build, each with a message of its own.

The arc itself — which sections a Series has, in what order, and which Parts sit
in each — is declared once in the Series manifest and nowhere else. A Project's
manifest is the same idea without an arc: a flat `notes:` list, in the order its
Field Notes should be indexed, with no Sections, no Destination and no reading
order to promise (ADR 0007, amended). Neither a Part's nor a Field Note's own
front matter says anything about where it is.

A Post's Container is recorded on `content` as `series_slug` + `series_section`
for a Series, or `project_slug` for a Project — never both — plus
`container_order` for its position in whichever list holds it. `schema.sql`
carries the reasoning for why that is two specific columns rather than one
generic pair, and for `container_order` having replaced `section_order` — a
rename that could not be one statement, so it took two publications: `0006`
added the new column and `0007` dropped the old one, once the Worker reading
the new name was the one serving (ADR 0006, amended). `section_order` survives
only on `series_section`, where it means a section's position within the arc.

A document under any tree may declare itself a Draft (`draft: true`) rather
than being placed outside it — checked exactly as strictly as a published one,
and producing no row and no payload only once every other check has passed
(ADR 0009). `pnpm run preview:drafts` runs the same generators with Drafts
included, writing to a gitignored `preview/` directory instead of the tracked
fixtures, so a Draft can be read at its real address without touching a
tracked file.

Both generators are Node scripts run from the developer's machine, never in the Worker. That is why `front-matter` and `marked` appear in `dependencies` yet are absent from every runtime import. Sitemap and `robots.txt` rendering is hand-rolled in `app/lib/seo/`, with no third-party SEO dependency.

**`seed/kv/markdown.ts` is where Post HTML is made safe, and the only place it can be.** The Worker injects what it reads from KV with `dangerouslySetInnerHTML` and never looks at it again, so the HTML has to arrive already sanitised. Raw HTML in a Markdown body is escaped rather than passed through, and `javascript:`-style URLs on links and images are dropped while their text survives — `marked` does neither on its own; its URL handling is only `encodeURI`. Sanitising here rather than in the Worker costs nothing per visit, and the only process that writes to KV is this pipeline. The trade is that a Post cannot embed HTML — no YouTube iframe. Allowing some requires an allow-list here, not a change in the route.

The KV generator reads the *already-seeded* D1 table (via `wrangler d1 execute --json`) to decide which Posts to render, so **D1 must be seeded before KV**. The npm scripts encode that order:

```
pnpm run d1:seed:local    # generate seed.sql, then wrangler d1 execute --local
pnpm run kv:seed:local    # generate JSON payloads, then wrangler kv key put --local
```

`:remote` variants do the same against the deployed resources. `kv-bulk-upload.ts` uploads every payload first and only then removes keys with nothing behind them, across every prefix this repository writes, so the result is a full replacement without a moment where a published Post is missing.

## Data stores

### D1 — `POSCHULER_BD`

SQLite at the edge, queried with hand-written SQL through a single thin helper in `app/db.server.ts` (`dbQuery`). No ORM and no query builder (ADR 0002); `seed.sql` is regenerated wholesale rather than migrated. There is no write helper because no request writes — content reaches D1 through the seed pipeline. `dbQueryRow` and `dbExecute` existed, were never called, and were deleted; add them back the day a route needs one.

The schema is **not** applied by hand. `seed/d1/schema.sql` is the declared shape and every database that does not exist yet is built from it in one step — the test setup, `check:fixtures`, the smoke test. The deployed one already exists, so it is moved forward by the migrations in `seed/d1/migrations/`, applied by the publication job (ADR 0006). Only a database that already exists needs a path.

Changing the schema is therefore: edit `schema.sql`, add a migration that makes the same change, and push. `verify:schema:local` applies the chain from zero and fails the `verify` job if the two disagree — so the duplication cannot reach production, and neither can a migration nobody wrote.

The `content` table holds every Content Item. `type` discriminates `'post'` from `'link'` — note that `'link'` is the persisted spelling of what the domain calls a **Bookmark**; `CONTEXT.md` is the authority on the name, the column is legacy spelling. Identity is enforced by two partial unique indexes:

| Index               | Applies to        | Uniqueness    |
| ------------------- | ----------------- | ------------- |
| `content_post_idx`  | rows with a lang  | `(slug, lang)` |
| `content_link_idx`  | rows without lang | `(slug)`       |

plus a `CHECK` that a `'post'` row must carry a lang. This is the schema-level encoding of "a Post is identified by `(Slug, Locale)`, a Bookmark by Slug alone".

The `content_tag` table holds the Tags, one row per Tag per Content Item, for Posts and Bookmarks alike:

| Column | Notes |
| ------ | ----- |
| `slug` | with `lang`, the natural key of the Content Item |
| `lang` | `NULL` for a Bookmark, as in `content` |
| `tag`  | the Tag itself, which is its own slug — `app/content/tags.json` declares the closed set the generator checks against (ADR 0008) |

The primary key is `(slug, lang, tag)`, plus a partial unique index on `(slug, tag)` where `lang IS NULL`, because SQLite treats NULLs in a key as distinct and a Bookmark's `lang` is one. It is deliberately **not** keyed on `content.id_content`: that is an `AUTOINCREMENT` and the seed upserts with `INSERT OR REPLACE`, which deletes and re-inserts on a conflict — so the id changes on every run and a child row pointing at it would be stale by the next deploy. `(slug, lang)` is what all the existing prunes already key on.

Rows exist for both kinds, and which of them a page lists is a policy of the page: `app/models/tag.server.ts` filters to `type = 'post'` in both queries, so a Tag page and its count on the index describe the same set. Deciding at render is what lets that policy change without a migration.

`content` used to carry a JSON `tags` column, seeded from the front matter and read by nothing once `content_tag` arrived. Migration `0005` dropped it, in the publication *after* the one that stopped selecting it — ADR 0006's amendment says why that order is not optional, and this column is the first of its two worked examples. The second is the `section_order` → `container_order` rename above, which cost two publications rather than three because its reader moved in the expand step.

The row types encode the same split as the indexes: `ContentRowType` is `PostRowType | BookmarkRowType`, discriminated on `type`, so the columns a kind does not carry are typed `null` rather than `string`.

### KV — `BLOG_KV`

Read-only at runtime, written only by the seed pipeline.

| Key                     | Value                                                      |
| ----------------------- | ---------------------------------------------------------- |
| `blog:<slug>:<locale>`    | `{ attributes, html }` — front matter plus rendered Post HTML |
| `project:<slug>:<locale>` | `{ attributes, html }` — the same shape, for a Project body   |
| `series:<slug>:<locale>`  | `{ attributes, html }` — a Series landing's prose             |
| `sitemap`                 | `{ sitemap }` — the full sitemap XML as a string              |

A Post body is one KV read. Missing key → 404, which is also how an unpublished or misspelled slug behaves.

**The prefix says what kind of payload it is, not which URL serves it.** A Part of a Series, or a Field Note of a Project, is an ordinary Post with a container, so its body sits under `blog:` and is served at `/series/<series>/<part>` or `/projects/<project>/<note>` respectively. A Series or a Project landing takes its own prefix because it is not a Post — a different kind of document.

## Routes

Routes are declared explicitly in `app/routes.ts` (config-based, not file-system-based) and each one lives in its own folder with its sections colocated as siblings.

| Route            | Store  | Cache-Control  | Notes                                       |
| ---------------- | ------ | -------------- | ------------------------------------------- |
| `/`              | D1     | none           | landing page — three newest Posts, plus the flagship Project |
| `/blog`          | D1     | none           | a Post with no Container, or a Container that holds Posts — loose Posts, Series and Projects-with-Field-Notes, one entry each, merged by date |
| `/bookmarks`     | D1     | none           | `findAllBookmarks`                          |
| `/timeline`      | D1     | none           | Timeline — this Locale's `findAllPosts` merged with every `findAllBookmarks`, via `mergeTimeline` |
| `/blog/:blogSlug`| D1 + KV | none          | the row first, Locale-aware: a Post with a container 301s to it. The KV body fetch is keyed off the resolved row's own Locale |
| `/series`        | D1     | none           | `findAllSeries` — every Series, including one with nothing published |
| `/series/:seriesSlug` | D1 + KV | none      | the contract and the arc from D1, the prose from `series:` |
| `/series/:seriesSlug/:partSlug` | D1 + KV | none | position derived from the arc; a Part the arc does not hold is a 404 |
| `/tags`          | D1     | none           | `findTagsWithPostCounts` — every Tag some Post carries, by count then alphabetically; indexed, and the only `/tags` URL in the sitemap |
| `/tags/:tag`     | D1     | none           | `findPostsByTag` — Posts only, newest first; a Tag no Post carries is a 404. `noindex, follow`, and absent from the sitemap |
| `/projects`      | D1     | none           | `findAllProjects` — flagship first, supporting in a grid |
| `/projects/:projectSlug` | D1 + KV | none      | row frames the page, KV carries the body; both keyed off the resolved row's Locale; index of its Field Notes at the foot, via `findProjectNotes` |
| `/projects/:projectSlug/:noteSlug` | D1 + KV | none | a Field Note — the Project named above the title, sibling notes and a link back at the foot, no previous/next; a Draft, or a note another Project's manifest lists, is a 404 |
| `/cv`        | none   | none           | no loader — sections import `resume.json` directly      |
| `/cv.pdf`    | fetch  | 1 day          | proxies `cdn.poschuler.dev`, forces `Content-Disposition: attachment` |
| `/sitemap.xml`   | KV     | 1 hour         | serves the pre-generated XML verbatim       |
| `/robots.txt`    | none   | 1 hour         | `PUBLIC_HOST`, or the request's own origin  |
| `/set-theme`     | cookie | none           | writes the cookie, then redirects back      |
| `*`              | none   | none           | 404, inside the layout so it keeps the header |

Every route above except the last four sits inside `routes/layouts/_layout.tsx`, which supplies the sticky header — the 404 included, so a lost visitor still has navigation. `/cv.pdf`, `/sitemap.xml`, `/robots.txt` and `/set-theme` are resource routes outside it.

**`/cv` deliberately has no loader.** The Resume is a static document that changes only when `resume.json` is edited and the site redeployed, so each section imports it. Returning it from a loader instead sent all 14 kB down twice in every response — once as rendered HTML, once again as the hydration payload beneath it, 12 kB of the 70 kB the page weighed. As a plain import it rides inside the hashed route chunk, fetched once and cached; the chunk grew 10 kB and every visit saves 12. Route data that is per-request belongs in a loader; a document baked into the build does not.

**Content routes export `shouldRevalidate`.** React Router revalidates every active loader after a form submission, which would make each theme toggle cost a D1 query or a KV read. `app/lib/revalidation.ts` suppresses exactly that one case — `formAction === "/set-theme"` — and defers to the default for everything else, so navigations and any future action still revalidate.

## Locales

The site is published in two Locales, English and Spanish (`Locale` in `app/context.ts`, `"en" | "es"`). English is served at the root with no prefix; Spanish under `/es`, as a second branch over the same route modules, mounted by calling `contentRoutes()` in `app/routes.ts` twice — once bare, once through `prefix(ES_PREFIX.slice(1), …)`. The path segment after the prefix is the same string in both branches, with one exception, `/cv`, and there is no `/en/` namespace: the absence of `ES_PREFIX` is what English means, so `/en/…` answers 404 with no redirect (ADR 0010, for why and for the alternatives it rejects).

**The Locale is derived once.** `deriveLocale` (`app/context.ts`) reads a request's pathname against `ES_PREFIX` and is called in exactly one place, `workers/app.ts`'s fetch handler, which puts the result on `localeContext` beside `cloudflareContext` and `nonceContext` — the same request-scoped shape every other per-request value already takes. Every loader below that reads the Locale off the context rather than re-deriving it, and `root.tsx`'s loader is the one bridge that crosses it into `useRouteLoaderData`, read by components through `useLocale()`. The test platform helper builds a loader's context the same way, through the same function, so a loader test exercises the real derivation rather than a stand-in for it.

**The model layer takes the Locale as a required, typed argument**, not a default parameter — a deliberate compile break across every call site when it landed, which is what turned *a query forgot the Locale* from a runtime defect into one the compiler finds. One finder is the deliberate exception, and it is an exception to the *argument* rather than to the filter: `findAllBookmarks` takes no Locale and narrows on none, because a Bookmark carries none and an equality test would have nothing to match and would drop every row. The Timeline is not a third query at all — `mergeTimeline` is pure, interleaving this Locale's Posts with every Bookmark, so the narrowing has already happened in the two finders it composes. The glossary's definition of the Timeline is what forces both (`CONTEXT.md`).

**One module answers what address a document has.** `app/lib/hrefs.ts` stays the only place a *relative* path is built — `withLocale` and the per-kind helpers (`postHref`, `projectHref`, `seriesHref`) all funnel through `ES_PREFIX`, so the two branches cannot disagree about what marks the Spanish one. `app/lib/seo/alternates.ts` is the one place a path is made absolute and given its siblings: `documentAddresses` takes a document's identity, its own Locale and the set of Locales that exist for it, and returns the canonical, the reciprocal `hreflang` alternates and the `x-default` (the English address). Every route's `<head>` reads it, the structured data builds its `@id`s on the same addresses, and the sitemap reads it too — nothing reconstructs the rule a second time, which is what makes reciprocity a property of the system rather than of whoever last edited a route. **The `hreflang` set has one definition, `hreflangEntries`**, and both halves of a pair emit exactly it: thirteen routes spread `alternateLinks` into their own `meta` array, the sitemap turns the same list into `<xhtml:link>` elements. It was composed twice for one publication and only the sitemap's half was ever written, so the XML advertised pairs no page confirmed — the one shape of `hreflang` a crawler discards outright. A document that exists in a single Locale still declares that Locale and an `x-default`, which is what makes the pair reciprocal the day the other side is written. The same module's `switcherDestination` computes where the language switcher sends a reader — the counterpart document when a Translation exists, the section index when it does not — from the identical `existingLocales` a route's own `documentAddresses` call already computed, so the switcher and the `hreflang` set cannot drift apart.

**A trail belongs to the branch that emits it.** The fixed upper levels of every `BreadcrumbList` — the home page and the section index above a document — come from `siteCrumb` (`app/lib/seo/structured-data.ts`), which addresses through `withLocale` and names each section with the same heading that page already renders, read from `STRINGS[locale]` rather than `useStrings()` because `meta()` is not a component. It was a constant, `HOME_CRUMB`, and the two indexes reachable in Spanish today published the English trail verbatim: on `/es/tags`, *Home* and *Tags* pointing at `poschuler.com` and `/tags`, three lines under a canonical that said `/es/tags`. Not one step of that list was the page emitting it. The steps below the index are the document's own and each route builds those from `postHref` / `seriesHref` / `projectHref`, which have taken a Locale all along.

**An index is skeleton, a document is a leaf.** A Spanish address with no Translation behind it is a 404 — the switcher never offers it, and `hreflang` never declares it. An index whose list is empty still answers 200, in the navigation, with `noindex, follow` and `EmptyIndex` (`app/components/empty-index.tsx`) explaining why and linking back to English; nothing serves English content at a Spanish address as a fallback.

**The interface language is a typed catalogue**, not an i18n library — `STRINGS` in `app/lib/catalog.ts`, keyed so the compiler requires every key in every Locale. A missing Spanish string is a compile error, not a runtime fallback (ADR 0011, for the measurement this rejected a library over).

**The language switcher ships hidden.** `LANGUAGE_SWITCHER_REVEALED` in `app/components/language-switcher.tsx` is a single `false` — the switcher is built, tested and wired into both places `ModeToggle` occupies, but nothing links to it until a later ticket flips that one line once a Spanish document exists to send a reader to.

**The sitemap groups by document, not by row**, so an entry that exists in two Locales gets one `<url>` with an `<xhtml:link rel="alternate">` per Locale rather than two separate entries — the same reciprocity `documentAddresses` gives the page head, checked from one file because both sides sit in it.

## Security headers

`workers/app.ts` rebuilds every response with `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and `Permissions-Policy`, plus `Strict-Transport-Security` and a `Content-Security-Policy` in production only.

It rebuilds rather than mutates because a response proxied from `fetch` — the Resume PDF — carries immutable headers, and `.set` on those throws.

The CSP uses a **per-request nonce**: `workers/app.ts` generates it, puts it in `nonceContext`, and `entry.server.tsx` hands it to `<ServerRouter nonce>`, which stamps it onto every inline script React Router emits. The allow-list covers what the site actually loads — the Cloudflare Insights beacon — and nothing else. `style-src` and `font-src` are both plain `'self'`: the fonts are self-hosted, so no third party can put a stylesheet or a face into this document. No third-party image host is authorised: `img-src` is `'self' data:`, because the portrait and the Open Graph card are both served from this origin. `style-src` keeps `'unsafe-inline'` because Base UI positions popups with inline `style` attributes; scripts do not need it.

Dev is exempt: Vite injects its own inline scripts with no nonce, and a CSP would block them. **That means the policy is only exercised in a production build** — verify changes with `pnpm run preview`, not `pnpm run dev`.

## Caching

Two layers, and the split between them is deliberate.

**Public HTTP caching, on the three routes whose response is the same for everyone.** `robots.txt` and `sitemap.xml` get an hour, the Resume PDF a day; the PDF is additionally fetched with `cf: { cacheTtl, cacheEverything }` so a warm colo does not re-fetch it from the CDN. The response bodies change only when the seed pipeline runs, so staleness is bounded and the Worker leaves the hot path entirely.

**No public caching on HTML — and this is a constraint, not an omission.** The colour scheme is a class on `<html>`, resolved per request from the `__Host-poschuler-color-scheme` cookie. A shared cache would hand one visitor's theme to the next. Making documents cacheable means first taking the theme out of the server-rendered markup (`prefers-color-scheme` only, no cookie), and that trades away the toggle's `system`/explicit distinction. Do not add `Cache-Control: public` to a document route without doing that first.

**KV reads pass `cacheTtl: 3600`**, which is where the blog's latency win actually comes from: the colo answers from its own cache instead of paying a round trip to KV's central store. That is safe regardless of the cookie, because it caches the *body*, not the rendered document.

## Configuration

`wrangler.jsonc` declares the bindings, `nodejs_compat`, and observability (logs and traces persisted at full sampling). `workers_dev` is off — the site is served from its own domain only.

**Configuration splits on one question: is the value secret?**

| Value                  | Where it lives            | Used by                                                     |
| ---------------------- | ------------------------- | ----------------------------------------------------------- |
| `SESSION_THEME_SECRET` | secret (`wrangler secret`) | signs the `__Host-poschuler-color-scheme` cookie              |
| `PUBLIC_HOST`          | `vars` in `wrangler.jsonc` | canonical origin in `robots.txt`                             |
| `DEPLOYMENT_ENV`       | `vars` in `wrangler.jsonc` | declared, no longer read — see below                         |
| `DB_DEBUG_FLAG`        | `.dev.vars` only           | declared, currently unread                                   |

Non-secret values belong in `wrangler.jsonc`, in git, where a deploy cannot forget them and a new environment needs no manual step. Only the signing secret is invisible to the repository, and `.dev.vars` overrides the rest locally.

**`DEPLOYMENT_ENV` no longer has a reader**, and the way it lost one is worth keeping. It used to decide whether the theme cookie got `Secure` and `Domain=poschuler.com`. While the var was missing in production the cookie was emitted host-only; the day it was finally deployed the same cookie gained a `Domain`, and a browser treats those as two different cookies of the same name. Both get sent, the first one wins, and every returning visitor had their theme frozen while each click wrote the new value somewhere nothing would read it. The cookie is now `__Host-` prefixed, which forbids `Domain` outright — see `app/color-scheme-cookie.ts`. Nothing else consulted the var.

**A secret shadows a var of the same name in production.** If a var in `wrangler.jsonc` appears to have no effect, check `wrangler secret list` before anything else.

Neither is required to boot. `SESSION_THEME_SECRET` throws only when the cookie is written, and `robots.txt` falls back to the request's own origin. Both limits were learned the hard way — see the note under Shape, and the `robots.txt` entry under Known defects.

`pnpm run deploy` builds and ships in one step. Type generation (`wrangler types` + `react-router typegen`) runs on `postinstall` and before `typecheck`; the generated `worker-configuration.d.ts` and `.react-router/` are gitignored, so a fresh clone must install before it type-checks.

**The bundler is Rolldown**, not Rollup or esbuild: Vite 8 replaced both with Rolldown and Oxc. Build output reflects it — the server bundle now carries a `rolldown-runtime` chunk. `vite.config.ts` needs no bundler-specific options, which is why the upgrade required no config changes; if you ever add them, they are `build.rolldownOptions`, not `build.rollupOptions`.

**The package manager is pnpm**, pinned in `package.json` via `packageManager` and enforced by `pnpm-lock.yaml` being the only lockfile. Two consequences worth knowing: pnpm does not hoist transitive dependencies, so a package must be a declared dependency to be importable (`require("esbuild")` fails at the root even though Vite depends on it); and pnpm blocks dependency build scripts unless allow-listed, which is why `pnpm-workspace.yaml` opts `esbuild` and `workerd` in — both download native binaries on install and nothing runs without them.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` or `dev` and on every pull request into `main`: install, `pnpm typecheck`, `pnpm test`, `pnpm run verify:schema:local`, `scripts/check-generated-fixtures.sh`, `pnpm build`, then `scripts/smoke-test.sh`. A push to `main` adds a second job, `publish`, which is the only thing that changes anything deployed — see Publishing below.

**The smoke test is the part that earns its keep.** It serves the built Worker with no secrets and no `.dev.vars`, asserts that a route from each namespace answers 200 and actually carries content — in **both** Locales, because the Spanish branch derives a Locale before the router runs and renders an empty index against the string catalogue, neither of which an English request evaluates — then posts to `/set-theme` without the signing secret and checks the site is *still* serving. That is the outage, written down as a test: a module read `process.env` at evaluation time and threw on a missing value, taking every route down to protect a theme preference, and it survived review because the machine it was written on had a `.dev.vars` holding the value. Nothing about the code looked wrong; only the empty environment showed it. Reintroducing that bug turns every route red here.

**No configuration is not the same as no data.** D1 and KV are seeded first, from `seed/d1/seed.sql` and `seed/kv/kv_payloads/`, both committed and both applied with `--local` — no network, no Cloudflare credentials, nothing near the deployed resources. Empty stores are not a state production is ever in, and they are not harmless either: `/sitemap.xml` reads the pre-generated XML from KV and throws 404 when it is missing, so without seeding the check fails on every run for a reason that has nothing to do with the code.

Run it locally with `pnpm run smoke`. It moves `.dev.vars` aside for the duration and puts it back when it ends, including the copy the build leaves in `build/server/`. Without that the script is theatre on a dev machine: every value it is meant to run without is simply present, and a Worker that cannot boot in CI passes locally.

Three conditions the script enforces on itself, each one learned by getting it wrong first: it refuses to start if something is already listening on the port, because a stale preview from an earlier run answers every check happily while serving an older build; it holds each response in a variable instead of piping it into `grep -q`, because under `pipefail` grep exits on the first match, curl dies of SIGPIPE and the pipeline fails exactly when the check passes; and it derives the Post Slug it requests from the payload files rather than hardcoding one.

**The four Spanish addresses are the one block that is hardcoded, and deliberately.** `/es`, `/es/blog`, `/es/timeline` and `/es/cv` need no Spanish document to exist: an index exists in every Locale whether or not its list has anything in it, the home page is one, and `/es/cv` renders from `resume.json`, which carries both. The routes that *do* need a Translation — a Post, a Series, a Project — answer 404 in Spanish today and correctly so, which is why none of them is probed. One of them asserts `lang="es"` in the response rather than a status code, because a Spanish address answering 200 in English is what a broken `deriveLocale` looks like from the outside, and every status check would pass through it.

### Tests

`pnpm test` runs Vitest between `typecheck` and `build`. Two projects, split by what they need rather than by what they are called:

- **`unit`** — no bindings. The Markdown sanitiser, the theme cookie, the sitemap and `robots.txt` renderers, `shouldRevalidate`, the seed generators' logic, the security headers, and the front matter templates in `docs/templates/` — run through the generator's own validators so a template a reader copies cannot have quietly stopped being valid.
- **`integration`** — real D1 and KV, from Miniflare, seeded from the committed fixtures into `.wrangler/state-test`. The content queries and every loader that reads a store.

**Four modules exist so that logic could be tested at all**, and the split is the same each time — the rules move out, the I/O stays put:

| Pure module | Extracted from | What it owns |
| ----------- | -------------- | ------------ |
| `seed/d1/seed-sql.ts` | `generate-seed-sql.ts` | filename → row, SQL escaping, insert-before-prune |
| `seed/kv/sitemap-routes.ts` | `generate-kv-json.ts` | which routes the sitemap advertises |
| `workers/security-headers.ts` | `workers/app.ts` | the headers and the CSP |
| `app/lib/redirects.ts` | `workers/app.ts` | the URLs this site no longer serves |

The last two are not a preference: `workers/app.ts` imports `virtual:react-router/server-build`, which only exists under the React Router Vite plugin, so the module cannot be imported from a test at all. The policy and the map can.

**The seed refactor was verified by regeneration, not by reading.** `seed.sql` and `kv_payloads/` are committed, so the check is exact: regenerate both and require nothing to have changed. That is now `scripts/check-generated-fixtures.sh`, run on every push — the bar any refactor of the generators is held to is enforced rather than remembered.

Two things had to become deterministic before it could be: `getMarkdownFilePaths` now sorts, because `readdir` order is whatever the filesystem returns and the statement order in `seed.sql` follows it; and `generate-kv-json.ts` no longer reads the clock for the sitemap's fallback `lastmod`, which would have turned every change of calendar day into a failed build. The second one is the same mistake twice — `sitemap-routes.ts` takes that date as a parameter *precisely* so the output would be reproducible, and the caller handed it `new Date()`.

The check uses `git status`, not `git diff`. A Post whose payload has never been generated produces an *untracked* file, which `git diff` does not see — and that is the one case the check exists for.

**Not `@cloudflare/vitest-pool-workers`, and the reason is worth keeping.** The pool is Cloudflare's supported way to test a Worker, but it does not survive this stack: React Router in framework mode plus `@cloudflare/vite-plugin` fails with `The entry point "react" cannot be marked as external` ([workers-sdk#10170](https://github.com/cloudflare/workers-sdk/issues/10170), closed with "use plain Vitest" as the accepted workaround). So the bindings come from `getPlatformProxy()` in wrangler instead — the same Miniflare instances `wrangler --local` uses, reached from an ordinary Node test process. Nothing in the data layer is mocked.

`vitest.config.ts` is a separate file from `vite.config.ts` on purpose: Vitest prefers it when both exist, which is what keeps the Cloudflare and React Router plugins out of the test run.

**The test stores are their own state directory.** `.wrangler/state-test`, not the `.wrangler/state/v3` that `wrangler --local` and the smoke test share, so running the suite never disturbs what a developer has seeded. It is rebuilt from scratch on every run — a suite that only passes against a dirty store is worse than no suite. One sharp edge: the wrangler CLI appends `/v3` to whatever `--persist-to` receives and `getPlatformProxy` takes its path verbatim, so the two constants in `tests/setup/platform.ts` differ by exactly that suffix.

**Tests live in `tests/`, never beside the code.** `app/` holds only code reachable from a route — a `.test.ts` there would be an orphan by this repo's own rule, and would drag Vitest's types into the Worker's type check. `tsconfig.test.json` covers them, run as a second `tsc -p` because `tsc -b` refuses to build a referenced project that disables emit.

**Nothing in the suite depends on `.dev.vars`.** The tests that need the signing secret supply their own. That is the same lesson as the smoke test, one layer down: the outage survived review because the machine it was written on had the value configured.

**The smoke test stays.** It boots the *built* Worker with an empty environment, which no Vitest run reproduces. The two do not overlap: it proves the Worker starts, these prove it answers correctly.

**`pnpm test:coverage` measures a deliberately narrow set of files**, listed in `vitest.config.ts`: the sanitiser, the cookie, the SEO renderers, the data layer, the resource routes, the seed generators' logic and the security headers. Within that scope it sits at about 98% of statements — the remainder is the 404 page's React component, kept in the list rather than excluded so the number stays honest. It is the one component measured, and it is measured because it moved out of the route: a route that matches and then finds nothing behind the address renders it from its own `ErrorBoundary`, and leaving it out of the list would have raised the percentage by relocating uncovered lines rather than by covering them.

Measured across all of `app/`, `seed/` and `workers/` instead it reads about 33%, and the difference is React components and the scripts' I/O — code no test here claims to exercise. A figure that counts work nobody signed up for is a figure nobody acts on, which is why the scope is pinned in the config rather than left at the default.

**Passing is not the same as protecting.** Every guarantee above was checked by breaking the code on purpose and confirming a named test went red — twelve mutations across the four areas: removing `mailto:` from the safe schemes; making `getColorScheme` rethrow instead of degrading; giving the cookie a `Domain` back; following the `Referer` blindly in `/set-theme`; letting `/blog` return Bookmarks; serving a failed upstream as a PDF; swallowing a D1 error; leading the seed file with its `DELETE`; degrading `INSERT OR REPLACE` to a plain `INSERT`; dropping the quote-doubling in `escapeSql`; applying the CSP in development; and mutating the response headers instead of rebuilding them. A test that does not fail when it should is worse than no test, because it reads like cover.

### Publishing

A second job, `publish`, runs only on a push to `main` and only after `verify` passes. It owns the whole Publication, in this order and in one workspace:

1. **`wrangler d1 migrations apply --remote`** — the only step that writes to production before the seed, and the only one that can. Migrations already recorded are skipped, so a publication carrying no schema change is a no-op here.
2. **`seed/verify-schema.ts`** — the deployed D1 has the shape `seed/d1/schema.sql` describes, or the run stops before any *content* is written. It confirms what step 1 produced rather than guarding against a step somebody forgot; there is no longer a step to forget.
3. **Seed D1, then KV** from the committed fixtures.
4. **`seed/verify-stores.ts`** — read both stores back.
5. **`pnpm run deploy`** — build, then `wrangler deploy`.
6. **`scripts/verify-deployment.sh`** — the version just uploaded is the one serving, at 100%.

Its credentials, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, are secrets of the `production` environment rather than of the repository, and that environment only accepts deployments from `main`. Repository secrets are readable by every workflow in the repo; environment secrets reach only a job that declares `environment: production`, and only from an allowed branch — so the restriction holds even if this file is edited badly. The token needs `D1:Edit`, `Workers KV Storage:Edit` and `Workers Scripts:Edit`, and nothing else.

**One job, not three, and not by preference.** `wrangler deploy` locates the built Worker through `.wrangler/deploy/config.json`, a gitignored artefact `@cloudflare/vite-plugin` writes at build time. A separate deploy job would not have it, and wrangler would silently fall back to the root `wrangler.jsonc` — whose `main` is the unbuilt entry point and which declares no `assets`. That run is green and ships the wrong Worker with no static files. Passing `build/` between jobs does not fix it either; the redirect lives outside that directory.

**Why the schema is applied *and* checked.** The migration does the work; the check says it added up. Those are different questions, and a migration can succeed while leaving a shape the repository does not declare — which is exactly the risk of writing the shape twice, once whole in `schema.sql` and once as a path. The check builds its expectation by applying `schema.sql` to a throwaway local database instead of parsing it, so there is no third description to drift from the other two.

The same script runs in `verify` as `verify:schema:local`, where it compares the migration chain applied from zero against the declared shape. That one matters more than it sounds: without it, the deployed database would be the only place those migration files ever ran.

Four things it had to learn the hard way. Comparing the stored DDL as text does not work: SQLite keeps a deployed table's comments and drops them from one rewritten by `ALTER`, and `ALTER TABLE … ADD COLUMN` appends rather than inserting, so the column order differs too. So columns are compared through `pragma_table_info`, which reports shape rather than wording. But a pragma reports no constraints, so named `CHECK`s are parsed out of the stored statement and compared alongside — this schema keeps its `tier` and `status` value lists there, and a migration that recreated a table without them would otherwise read as identical. Indexes stay as text, because a partial index's `WHERE` clause is not exposed by any pragma — and that clause is the entire reason `INSERT OR REPLACE` behaves as an upsert here; `IF NOT EXISTS` is normalised away with the whitespace, since the baseline migration is guarded and `schema.sql` is not. And `sqlite_sequence`, Cloudflare's `_cf_KV` and wrangler's `d1_migrations` are filtered out: they belong to the engines, not to this repository, so leaving them in would fail every run forever.

**A successful upload is not a live deployment.** `wrangler deploy` exiting 0 means the version was accepted; it does not mean that version is serving. Step 5 reads that back and refuses anything that is not this run's version at 100%, which also catches a gradual rollout nobody meant to configure.

**It started as a request to the site, and that failed on its first run — with a 403, from a healthy site.** The zone has Bot Fight Mode on, and a GitHub runner is a datacentre client, so Cloudflare issued a managed challenge that `curl` cannot solve. Cloudflare's documentation is explicit that there is no way around it: "You cannot bypass or skip Bot Fight Mode using WAF custom rules or Page Rules" — it runs outside the Ruleset Engine, so *Skip*, *Bypass* and *Allow* have no effect. Super Bot Fight Mode, which does support skip rules, is a paid plan.

Detecting the challenge and continuing would have been worse than removing the step. The challenge is issued at the edge, before the Worker, so a genuinely broken origin returns the same thing as a healthy one: the check could never fail, while still reading like cover.

**`main` only, and never on a pull request.** There is one D1 and one KV — no per-environment resources — so a seed from any other branch would overwrite live content with a work in progress.

**Both halves are idempotent, and neither empties anything first.** That property is load-bearing now that this runs unattended:

- **D1** upserts and then prunes. The partial unique indexes on `(slug, lang)` and `(slug)` make `INSERT OR REPLACE` a genuine upsert, so `generate-seed-sql.ts` emits the inserts first and closes with a `DELETE … WHERE slug || ':' || ifnull(lang,'') NOT IN (…)` that removes only rows no Markdown file backs any more. It used to open with `DELETE FROM content`, which on the remote database empties the live table and serves an empty Timeline until the inserts land.
- **KV** writes before it deletes. `kv-bulk-upload.ts` uploads every payload in one `kv bulk put` — a `put` over an existing key is a replacement — and only then removes keys with no payload behind them. It used to clear every key first and upload them back one at a time, so every published Post 404'd for the length of the upload.

**The verifier is separate from the seed on purpose.** The seed scripts report what they *sent*; `verify-stores.ts` reports what is *there*. It derives its expectations from the Markdown files rather than from the generated SQL — a generator that silently dropped a file would otherwise produce a seed and a check that agree with each other and with nothing else — and it compares each KV value against its payload as parsed JSON. Run it by hand with `pnpm run verify:stores:local` or `:remote`.

One sharp edge worth knowing: `wrangler kv key get` does not fail on a missing key. It prints `Value not found` and exits 0, so the verifier treats an unparseable read as a missing key rather than letting it surface as a crash.

**Deploys used to belong to nobody.** Workers Builds deployed on push to `main` on Cloudflare's side while this workflow seeded, with no ordering between them and nothing failing when only one succeeded. It is disconnected now, and this job owns both halves — see ADR 0003 for what that cost and what was weighed against it.

**Runs on `main` queue; everywhere else they cancel.** `cancel-in-progress` is an expression, false only on `main`, because a cancellation landing between the seed and the deploy recreates the exact split the job exists to remove. A superseded run that is still *pending* is dropped instead, which is harmless: it has executed nothing, and `main` is linear, so whatever replaced it carries the same commits.

The protection has edges. It covers concurrency-driven cancellation only — a manual cancel from the UI, or an expired `timeout-minutes`, still lands wherever it lands, with about ten seconds of grace and a hard kill at five minutes. Hence the job's generous timeout. And if the deploy fails after the stores have moved, there is no rollback: the run goes red and old code serves new content until someone merges a fix. [`runbook.md`](./runbook.md) has that case, and what each step of the sequence leaves behind when it is the one that fails.

**What the order does not buy.** Seeding first means old code serves new data for the length of the deploy. If a commit changes the *shape* of a KV payload, that page is broken for those seconds. Only splitting such a change across two merges avoids it, and nothing here enforces that.

## Known defects

- **Nothing checks that production actually serves.** The publication proves the stores hold the right content and that the uploaded version is live, and the cold start proves the built Worker boots with nothing configured — but no step makes a request to `poschuler.com`. A missing secret, or a binding pointing at the wrong resource, would pass everything here. Closing it needs a request from somewhere Bot Fight Mode does not challenge, which means continuous monitoring by a client on Cloudflare's verified-bot list rather than a step in the run. Worth remembering that the two incidents this would have caught, the 1101 and the `robots.txt` 500, both lasted far longer than a deploy.

- **The build copies `.dev.vars` into `build/server/`.** `@cloudflare/vite-plugin` does this so the built output can be previewed locally, but it means a build run on a machine with real local secrets leaves them in plaintext inside the build directory. `build/` is gitignored and `wrangler deploy` does not turn them into Worker vars (confirmed with `--dry-run`), so nothing leaks by default — but do not ship `build/` anywhere as an artifact. Behaviour predates Vite 8; verified identical on Vite 7.
- **`generate-kv-json.ts` builds its D1 query with nested unescaped double quotes** inside a double-quoted `--command` string. It works only because SQL treats the collapsed quoting as bare identifiers.
- **The sitemap's `/cv` `lastmod` is maintained by hand.** The Resume has no Published At to derive one from, so it is `meta.lastModified` inside `resume.json` — passed into `buildSitemapRoutes` rather than held as a constant in the seed pipeline, so the date sits beside the document it describes and whoever edits one is looking at the other. Deriving it from git does not work: CI checks out with `fetch-depth: 1`, so the only commit present is the checkout's own and the date would describe the build rather than the Resume.
- **No test renders a component.** CSS and markup regressions are caught by eye only. jsdom does not compute animations, so a component test would not have found the sidebar's closing flash either — catching that class of defect needs a real browser, which is a third runtime nobody has signed up for yet.
- **`/cv` has no loader, so most of it has no test the way the others do.** Its sections import `resume.json` directly, and what could break there — a section that stops rendering — needs a component test, which is the same gap as above. `meta()` is the one piece of request-time behaviour the route does have — it reads the Locale off `root`'s loader data through `matches` — and it is tested directly, the same way `tags/_tags.tsx`'s and `tag/_$tag.tsx`'s `meta()` are.
- **Cloudflare prepends a managed `robots.txt`.** The zone has AI Crawl Control's managed robots.txt on, which blocks the AI training crawlers and adds Content Signals. It merges with this Worker's response *only when the origin answers 200* — while `/robots.txt` was throwing on a missing `PUBLIC_HOST`, Cloudflare's block was served alone and the failure was invisible, `Sitemap:` line and all. If that line ever disappears again, request the route directly before suspecting the dashboard.
- **KV can still hold unsanitised HTML from before the pipeline sanitised it.** The Worker trusts whatever it reads, so the guarantee is only as old as the last seed run. This is now watched rather than assumed: a test re-renders every published Post and compares it byte for byte against its committed payload, and a second one asserts no payload carries a script tag, an inline event handler or a `javascript:` URL. What that cannot see is the deployed namespace — it checks the payloads in git, so a key written by an older pipeline and never regenerated would still hold whatever it holds until someone re-seeds.

## Inherited code (removed)

This repo was scaffolded from an earlier e-commerce project and carried roughly two thirds of its `app/` tree as unreachable baggage: an inherited design system, a second `ui-react-aria/` component set, product cards and sliders, ~25 storefront hooks (brand/category/department/geolocation), the unused two thirds of shadcn/ui, and two model files that no longer compiled (`feeds.server.ts` and `projects.server.ts` called `dbQuery` with the pre-D1 two-argument signature and used Postgres `TO_CHAR`). The `feeds` and `projects` tables backing them were created but never read or written.

**The code went; the tables stayed.** That pass deleted the modules and left the two tables standing in the deployed database, where they sat unreferenced for months. Nothing could see them: no test touches the remote schema and no document recorded them, so this section read as if the cleanup had been complete. `seed/verify-schema.ts` found them the first time it ran, which is the argument for the check in one sentence — the deployed schema is not something you can reason about from the repository. They are dropped by hand, and the check now refuses any table `schema.sql` does not declare.

All of it was deleted in one pass, verified by walking the import graph from the real entry points (`workers/app.ts`, `app/root.tsx`, and every module named in `app/routes.ts`). `app/` went from 178 source files to 40, with zero unreachable files remaining. The one live import into the inherited tree — `ModeToggle`'s icon button — was preserved by moving that component to `app/components/ui/icon-button.tsx` rather than rewriting the toggle, so the UI was unchanged. It has since been folded into `ui/button.tsx`, which is the one button the site has.

**`app/` now contains only reachable code.** A new orphan is therefore a defect, not background noise: if a file is not reachable from a route, it does not belong in `app/`.

Two related cleanups went with it: `app/app.css` lost its inherited rules (`.horizontal-product-list`, `.nav-btn`, `.custom-scrollbar`, `.border-gradient`, `#nprogress`, a commented-out masonry layout) and the design tokens for social-login buttons and hero gradients that no component used.

A second pass finished the job on the parts the first one had judged to be design system rather than dead code:

- **Eleven of the seventeen Radix scales were imported and never referenced.** They cost 25.7 kB of the 91 kB render-blocking stylesheet. Only the six families in `design.md`'s Color table remain; `radix-system-dark.css` shrank from 599 lines to 214, and the stylesheet to 59.6 kB.
- **The toast stack had no emitter.** `remix-toast`, `ToastProvider`, `Toaster`, `ServerToast`, `toast.tsx` and `toaster.tsx` were wired up in `root.tsx` for a read-only site with no forms. Removing them orphaned `app/utils/use-server-layout-effect.ts` and `is-running-on-server.ts`, so `app/utils/` went too.
- **`dbQueryRow` and `dbExecute`** were exported, never called, and are gone.
