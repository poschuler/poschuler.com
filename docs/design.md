# Design

The conventions this codebase follows: how the interface is put together, how modules are shaped, and what to imitate when adding something new. For runtime and data concerns, see [`architecture.md`](./architecture.md); for vocabulary, [`CONTEXT.md`](../CONTEXT.md).

## Design intent

The site is a developer's notebook, not a marketing page. That reads through in every choice: monospace type on content pages, a single accent hue, dark mode as a first-class state, and no imagery beyond a GitHub avatar. Content is the only thing on screen that competes for attention.

Each page is one column, centred, capped at `lg:max-w-4xl` for lists and prose. Nothing is multi-column; nothing is above the fold in a way that pushes content down. A Content Item in a list is a date, an icon, and a title — nothing else. There are no cards, no excerpts, no thumbnails, no read-time estimates.

## Color

Color comes from **Radix Colors** scales, never from Tailwind's default palette. Radix's 12-step scales are semantic by position — step 1 is app background, 6 is a subtle border, 9 is a solid fill, 12 is high-contrast text — and each has a matched dark variant, so a single token name works in both themes with no `dark:` variant needed.

`app/app.css` maps those scales onto named tokens in a Tailwind v4 `@theme` block:

| Family     | Scale     | Used for                       |
| ---------- | --------- | ------------------------------ |
| neutral    | `mauve`   | every surface, border and text |
| primary    | `indigo`  | accent                         |
| danger     | `tomato`  | destructive states             |
| warning    | `amber`   | caution states                 |
| success    | `grass`   | confirmation states            |
| info       | `violet`  | informational states           |

Each family expands into the same step vocabulary — `app`, `subtle`, `ui`, `hover`, `active`, `border`, `solid`, `solid-hover`, `solid-active` for backgrounds; `default` / `low` for text; `default` / `ui` / `hover` / `active` for borders and rings.

**Write `bg-ui`, `text-low`, `border-default` — not `bg-gray-100`, `text-gray-500`, `border-gray-200`.** The token is the contract; the scale behind it can change. `text-default` is body text, `text-low` is anything secondary (dates, metadata, muted prose).

Long-form Post bodies render through `@tailwindcss/typography`, with the `prose` utility overridden at the bottom of `app.css` so `--tw-prose-*` variables point back at the mauve scale. Prose therefore themes automatically alongside the rest of the site.

## Theming

Theme is a **server-rendered, cookie-backed preference**, not a client-side toggle:

1. `root.tsx`'s loader resolves the theme from the `poschuler__theme` cookie (signed with `SESSION_THEME_SECRET`) and passes it to `ThemeProvider`.
2. `PreventFlashOnWrongTheme` inlines the resolved theme into the document head, so there is no flash of the wrong theme on first paint.
3. `ModeToggle` posts to the `/action/set-theme` resource route, which writes the cookie.
4. The theme class lands on `<html>`; `@custom-variant dark (&:is(.dark *))` drives every dark-mode rule from there.

`ModeToggle` is wrapped in `ClientOnly` with a static fallback, because the toggle's *current* state is only meaningful once hydrated. Follow that pattern for any control whose rendered state depends on client-side theme resolution.

## Typography

- **Inter** for the interface, loaded from Google Fonts with `preconnect` hints in `root.tsx`'s `links`.
- **`font-mono`** for content pages (`/`, `/blog`, `/bookmarks`, `/blog/:slug`) and for the Resume's secondary text. This is deliberate character, not an oversight.
- Page headings are `text-3xl lg:text-4xl font-semibold tracking-tight`, followed by an italic `blockquote` subtitle in `text-muted-foreground`. Home, blog and bookmarks all share this header shape — match it.

## Component layers

Two layers, both canonical since the inherited component sets were deleted:

| Layer                  | Use it for                                                    |
| ---------------------- | ------------------------------------------------------------- |
| Route-local components | Anything used by exactly one route — the first choice          |
| `app/components/ui/`   | Shared primitives (shadcn/ui, plus `icon-button`)              |

**Prefer a route-local component over a shared one.** A component used by exactly one route belongs beside that route, not in `app/components/`. `routes/resume/hero.tsx`, `experience.tsx` and `keyboard-manager.tsx` are the model: they read the parent route's loader data directly via `useLoaderData<typeof loader>()` with a type-only import of the parent's `loader`, so no props need threading. Promote to `app/components/` only on the second consumer.

`ui/` holds only what is actually imported — `button`, `command`, `dialog`, `sheet`, `toast`, `toaster`, `use-toast`, `icon-button`. Adding a shadcn/ui primitive means adding the one file you need, not restoring the set. Note that `icon-button` is built on `react-aria-components` while the rest are Radix-based; it survived the cleanup because `ModeToggle` uses it, so match whichever API the component you are extending already exposes (`onPress` vs. `onClick`).

## Route conventions

- Routes are declared explicitly in `app/routes.ts`. Adding a route means editing that file — there is no file-system convention doing it for you.
- One folder per route, entry file prefixed with `_`: `routes/blog/_blog.tsx`, `routes/resume/_resume.tsx`. Sections sit as unprefixed siblings in the same folder. The prefix is what makes the entry point obvious in a folder listing.
- Types come from the generated `./+types/<name>` module — `Route.LoaderArgs`, `Route.ComponentProps`, `Route.MetaFunction`. Never hand-write loader argument types.
- Server-only modules end in `.server.ts` so the bundler keeps them out of the client.

## Data access

Three layers, each with one job:

```
route loader          knows the request, picks the query
  └─ app/models/*.server.ts    named domain queries, returns typed rows
       └─ app/db.server.ts     dbQuery / dbQueryRow / dbExecute over D1
```

Rules that hold across `content.server.ts`:

- **Queries alias snake_case columns to camelCase in SQL**, not in JavaScript. `id_content as "idContent"` — the mapping lives in one place, next to the query.
- **Every model function takes `db: D1Database` as its first parameter.** Bindings are request-scoped in Workers; a module-level connection is not an option.
- **Model functions are named for the domain question they answer** — `findAllPosts`, `findAllBookmarks`, `findAll` — not for their SQL.
- **Values are bound, never interpolated.** `dbQuery(db, sql, values)` goes through `.bind()`.

## SEO

Every user-facing route exports its own `meta`, and each one supplies the full set: `title`, `description`, canonical link, `og:title`, `og:description`, `og:image`, `og:type`, `og:url`. There is no shared meta helper — the root's `meta` is commented out on purpose, so a new page that omits `meta` gets nothing. Copy the block from a neighbouring route.

`og:type` is `"article"` for a Post and `"website"` for everything else. `og:image` is the GitHub avatar throughout.

## Known inconsistencies

- **Spanish strings in `root.tsx`.** Toast titles are built as "Mensaje" / "Alerta" while the document is `lang="en"`. Per `AGENTS.md`, shipped strings are English. (`mode.toggle.tsx` was fixed during the cleanup.)
- **`/blog` is headed "Articles & Insights"** while the domain term is Post and the route is `/blog`. Cosmetic, but the glossary is the authority.
- **Toast infrastructure is wired but unused.** `remix-toast`, `Toaster` and `useToast` are all in `root.tsx`; no route emits a toast. It is a read-only site with no forms. The Spanish strings above are inside that unused branch.
