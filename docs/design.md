# Design

The conventions this codebase follows: how the interface is put together, how modules are shaped, and what to imitate when adding something new. For runtime and data concerns, see [`architecture.md`](./architecture.md); for vocabulary, [`CONTEXT.md`](../CONTEXT.md).

## Design intent

The site is a developer's notebook, not a marketing page. That reads through in every choice: monospace type on content pages, dark mode as a first-class state, and almost no imagery — one portrait and one Open Graph card, both local. Content is the only thing on screen that competes for attention.

Each page is one column, centred, capped at `lg:max-w-4xl` for lists and prose. Nothing is multi-column; nothing is above the fold in a way that pushes content down. A Content Item in a list is a date, an icon, and a title — nothing else. There are no cards, no excerpts, no thumbnails, no read-time estimates.

### The home page is the exception, on purpose

`/` is a landing page, not a notebook page, and it breaks three of the rules above deliberately. The reasoning is in `evolution-plan/01-information-architecture.md`, Decision 3; what follows is the rule as it now stands.

- **It leads with content above the fold** — a portrait, the role, the timezone, and two paragraphs — because a visitor who arrives from an application has to learn what this person does before anything else is worth reading.
- **Its column is `max-w-[650px]`, not `lg:max-w-4xl`.** Prose wants roughly 75 characters a line; `4xl` is a list width. Both sections of the home use the narrower one so the page reads as a single strip rather than a landing page with a wider index bolted underneath.
- **It does not carry the shared header shape** (see Typography): no italic `blockquote` subtitle, because the subtitle slot is doing real work there — role, then location and timezone.

The Timeline it used to render lives at `/timeline`. The home keeps a short, Post-only excerpt of the three newest, and an integration test asserts it stays Post-only: a Bookmark reaching the landing page means the Timeline has leaked back in.

Between the hero and that excerpt sits **one Project, the flagship, and never more**. Three blocks would invite the visitor to compare a product with users against the site they are already looking at — which lifts neither and lowers the one carrying the weight. The hero's first paragraph asserts it; the block directly below is where the assertion becomes checkable. `/projects` holds the rest.

### Projects

`/projects` renders by Tier, and the Tier is the whole layout rule: the flagship alone in its row, at `text-2xl` with its summary, stack and live link; supporting projects in a two-column grid at `text-lg`. Chekalo never competes with anything because nothing else is in its row.

An archived Project says so — a small `bg-subtle` badge beside the title on the index, and a line under the heading on its own page. A finished project is a complete story and costs nothing; one still written in the present tense after it has stopped is what costs.

A Project page carries its revision line under the summary rather than a published date, because a Project is revised in place and has never been published in the sense a Post has. Earlier revisions go at the foot, below the body, and render only from the second one onward — with one, they would repeat the line under the title.

## Color

Color comes from **Radix Colors** scales, never from Tailwind's default palette. Radix's 12-step scales are semantic by position — step 1 is app background, 6 is a subtle border, 9 is a solid fill, 12 is high-contrast text — and each has a matched dark variant, so a single token name works in both themes with no `dark:` variant needed.

`app/app.css` maps those scales onto named tokens in a Tailwind v4 `@theme` block. **Six families are imported, and six are used** — an imported scale ships ~2.5 kB of custom properties into render-blocking CSS whether or not a token reads it, so adding an `@import` without a matching token is a regression:

| Family     | Scale     | Used for                       |
| ---------- | --------- | ------------------------------ |
| neutral    | `mauve`   | every surface, border and text |
| primary    | `indigo`  | accent                         |
| danger     | `tomato`  | destructive states             |
| warning    | `amber`   | caution states                 |
| success    | `grass`   | confirmation states            |
| info       | `violet`  | informational states           |

Adding a family means three edits in step: the `@import` pair in `app.css`, the tokens in `@theme`, and `SCALES` in `scripts/generate-system-dark-css.mjs` (then re-run it). Drop one and either the token resolves to nothing or `system` users get the light value in dark mode.

**As rendered today the site is monochrome.** `indigo` has tokens but nothing paints with them, so the table above is intent rather than description. Anything designed to match the site — the Open Graph card, for one — should be mauve only, and reach for a border rather than a hue when it needs to divide something.

The reason nothing paints with it is that the classes reaching for the accent name **shadcn's** tokens rather than this project's: `bg-primary` and `text-primary` instead of `bg-primary-solid` and `text-primary-default`, plus `bg-secondary`, `text-secondary-foreground`, `ring-ring` and `ring-offset-background`, none of which exist in `@theme`. They resolve to nothing and the elements inherit their colour. `app/components/ui/button.tsx` still carries them; the Resume's chips did until they were rewritten to `text-low`, which is what new code should do. **Substituting a real token for a dead one is a rename and is always safe; deciding that the accent should now appear somewhere it never did is a design decision** — do not smuggle the second in under the first.

Each family expands into the same step vocabulary — `app`, `subtle`, `ui`, `hover`, `active`, `border`, `solid`, `solid-hover`, `solid-active` for backgrounds; `default` / `low` for text; `default` / `ui` / `hover` / `active` for borders and rings.

**Write `bg-ui`, `text-low`, `border-default` — not `bg-gray-100`, `text-gray-500`, `border-gray-200`.** The token is the contract; the scale behind it can change. `text-default` is body text, `text-low` is anything secondary (dates, metadata, muted prose).

Long-form Post bodies render through `@tailwindcss/typography`, with the `prose` utility overridden at the bottom of `app.css` so `--tw-prose-*` variables point back at the mauve scale. Prose therefore themes automatically alongside the rest of the site.

## Theming

Theme is a **server-rendered, cookie-backed preference** with no client-side JavaScript at all:

1. `root.tsx`'s loader reads the `__Host-poschuler-color-scheme` cookie through `app/color-scheme-cookie.ts` — signed with `SESSION_THEME_SECRET`, parsed by a Zod enum that falls back to `system` on anything unexpected.
2. `Layout` puts the resolved value straight onto `<html className={colorScheme}>`. It is in the first byte of the response, so there is nothing to prevent a flash of — no inline script, no provider, no hydration gap.
3. `ModeToggle` is a `<Form method="POST" action="/set-theme" navigate={false}>` holding one button that advances light → dark → system. The server owns the choice; the button only submits it.
4. `/set-theme` writes the cookie and **redirects back to the referring page** (same-origin only — `Referer` is attacker-influenceable). Post/Redirect/Get is what makes the toggle survive without JavaScript: returning a body instead leaves a no-JS browser parked on a page reading `null`.

Three states, not two. `system` means "follow the OS", and it is a real class on `<html>` rather than the absence of one, which is what the `@custom-variant dark` in `app.css` encodes:

```css
@custom-variant dark {
  &:where(.dark, .dark *) { @slot; }
  &:where(.system, .system *) {
    @media (prefers-color-scheme: dark) { @slot; }
  }
}
```

Radix ships its dark values scoped to `.dark, .dark-theme`, which a `.system` root does not match. `app/styles/radix-system-dark.css` re-declares them under `.system` inside the prefers-dark query. It is **generated and committed** — run `node scripts/generate-system-dark-css.mjs` after bumping `@radix-ui/colors` or changing which scales are imported.

## Typography

- **Inter** for the interface, loaded from Google Fonts with `preconnect` hints in `root.tsx`'s `links`.
- **`font-mono`** for content pages (`/`, `/blog`, `/bookmarks`, `/timeline`, `/blog/:slug`) and for the Resume's secondary text. This is deliberate character, not an oversight.
- Page headings are `text-3xl lg:text-4xl font-semibold tracking-tight`, followed by an italic `blockquote` subtitle in `text-muted-foreground`. Blog, bookmarks and timeline all share this header shape — match it. The home page does not; see "The home page is the exception".
- **`text-muted-foreground` resolves to nothing.** No `muted` token exists in `app/app.css`, so every element carrying that class renders in the inherited colour. It is inherited from shadcn and used across the Resume and the `ui/` primitives, which is why the subtitle rule above still names it — the rule describes what the code says, not what it paints. New code should use `text-low`. Fixing the existing occurrences is a change of its own, not something to do in passing.

## Component layers

Two layers, both canonical since the inherited component sets were deleted:

| Layer                  | Use it for                                                    |
| ---------------------- | ------------------------------------------------------------- |
| Route-local components | Anything used by exactly one route — the first choice          |
| `app/components/ui/`   | Shared primitives, each a thin Base UI wrapper                 |

**Prefer a route-local component over a shared one.** A component used by exactly one route belongs beside that route, not in `app/components/`. `routes/resume/hero.tsx`, `experience.tsx` and `keyboard-manager.tsx` are the model: each imports the slice of `resume.json` it renders, so no props need threading. When a route does have a loader, the same shape applies with `useLoaderData<typeof loader>()` and a type-only import of the parent's `loader`. Promote to `app/components/` only on the second consumer.

`ui/` holds only what is actually imported — `button`, `icon-button`, `dialog`, `sheet`, `command`, `brand-icons`. Add the one file you need, never a set.

Every primitive follows the same shape: a Base UI part, styled with `cva` variants, `className` merged through `cn()`, and props typed as `Omit<Part.Props, "className"> & { className?: string }`. Two Base UI conventions matter when extending them:

- **Compose with `render`, not by nesting.** `<Button render={<Link to="/blog" />}>blog</Button>` — Base UI merges the props of both, so event handlers from each side run. That is what lets a `SheetClose` wrap a `Link` in `header.tsx` and both dismiss the sheet and navigate.
- **Transitions key off `data-open` / `data-closed`**, not the `data-state` shadcn/ui uses. Copying a shadcn class list wholesale will silently animate nothing.
- **An exit animation needs `data-[closed]:fill-mode-forwards`, and the backdrop needs the panel's duration.** `animate-out` defaults to `animation-fill-mode: none`, so when the exit animation ends the element snaps back to its base style — visible, on-screen — and stays there until Base UI unmounts it a frame or two later. Pair that with a backdrop left on the default 150ms against a panel closing in 300ms and the black comes back at full opacity halfway through the close. That is what the sheet and the dialog do now; anything new that animates on `data-closed` needs both.

The second point is a class of bug no test here catches: jsdom does not compute animations, so only a real browser would see it. Check a closing transition by eye before shipping it.

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
       └─ app/db.server.ts     dbQuery over D1 — the only helper
```

A loader reaches its bindings through the typed context, never a global:

```ts
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return { posts: await findAllPosts(env.POSCHULER_BD) };
}
```

Rules that hold across `content.server.ts`:

- **Queries alias snake_case columns to camelCase in SQL**, not in JavaScript. `id_content as "idContent"` — the mapping lives in one place, next to the query.
- **The projection is written once.** `CONTENT_COLUMNS` plus a private `findContent(db, filter)` back all three finders; they differ only in their `where` clause. A new column is one edit, not three.
- **Every model function takes `db: D1Database` as its first parameter.** Bindings are request-scoped in Workers; a module-level connection is not an option.
- **Model functions are named for the domain question they answer** — `findAllPosts`, `findAllBookmarks`, `findAll` — not for their SQL.
- **Values are bound, never interpolated.** `dbQuery(db, sql, values)` goes through `.bind()`. The only strings interpolated into SQL are fixed fragments this module owns — `CONTENT_COLUMNS` and the `where` clauses — never anything reaching it from a request.

**Row types mirror the domain, not the table.** `ContentRowType` is the union `PostRowType | BookmarkRowType`, discriminated on `type`, because `CONTEXT.md` says a Bookmark has no Locale and a Post has no Source — and the table stores `NULL` for exactly those. Narrow on `item.type` and you get the columns that kind carries; a component that only ever renders one kind should take that kind's type. `tags` is typed `string` because it is stored as unparsed JSON — parse it in the model, not in a component, when something finally reads it.

**A Project has its own model, `app/models/project.server.ts`, not a third branch of the content one.** It is not a Content Item — no Published At, no Timeline — so it shares almost none of the rules above beyond their shape. `findAllProjects` orders by `sort_order` and deliberately **not** by `tier`: tier groups the rendering, and folding it into the ordering would make a tier change silently reorder the page. `stack` and `updates` are typed `string` for the same reason `tags` is.

## SEO

Every user-facing route exports its own `meta`, and each one supplies the full set: `title`, `description`, canonical link, `og:title`, `og:description`, `og:image`, `og:type`, `og:url`. There is deliberately no shared helper and no `meta` on the root, so a page that forgets its own renders with none rather than silently inheriting the home page's. Copy the block from a neighbouring route.

**Open Graph descriptors use `property`, never `name`.** That is what the OG protocol specifies, and scrapers that follow it strictly — LinkedIn among them — ignore a `name`. Only `description` stays a `name`, because that one is an HTML meta tag rather than an OG one.

`og:type` is `"article"` for a Post and `"website"` for everything else.

`og:image` is `https://poschuler.com/og.png` throughout — one static 1200×630 card carrying the portrait, the name and the role, in the site's own palette. It replaced a hotlinked GitHub avatar, which was a 460 px square where every scraper expects a 1.91:1 rectangle. It is deliberately identity rather than page content, because a single card has to serve the home page, a Post, the Bookmarks and the Resume alike; per-page generated cards are a later idea, not a gap. Every route ships `og:image:width`, `og:image:height` and `og:image:alt` alongside it, so a scraper can lay the card out before it has finished downloading it.

**Two routes emit `Person` JSON-LD**, both through the same `meta` export, using React Router's `script:ld+json` descriptor. Each derives its fields from what that page already renders rather than restating them — the home from its contact links, the Resume from `resume.json` — so the structured data cannot drift from the page carrying it.

They describe the same person and do not have to be identical: `/resume` adds `alumniOf`, `hasCredential` and `knowsLanguage`, because that is where the credentials are, and sets `mainEntityOfPage` to itself while leaving `url` pointing at the site. A crawler reading both takes the union, which is the intended result. Neither carries `worksFor`.

**Write metadata the way the rest of the site is written.** Titles name the page — `Blog | Paul Osorio Schuler`, not `Paul Osorio Schuler's Blog | Software Architecture, Node.js & Azure`. Descriptions say what is on the page, in plain words, and only claim what the page actually contains: the blog once advertised Azure while no Post mentioned it. No "advanced", no "insights", no "essential reading". This is a notebook, and the metadata is part of its voice.

## Navigation

Internal links are `<Link>`. Not `<a href>`, and not `reloadDocument` — both throw away the client-side router the site already ships. `reloadDocument` is for resource routes that are not React at all, like the `/resume.pdf` download in `routes/resume/hero.tsx`.

One consequence to remember inside the mobile sheet: client-side navigation leaves the panel mounted, so a link in there has to dismiss it as well. `<SheetClose render={<Link to="…" />}>` does both.

## Keyboard shortcuts

`routes/resume/keyboard-manager.tsx` owns the only global key handler on the site. Two rules it follows, and any new shortcut must too:

- **Never bind a chord the browser owns.** The profile shortcuts require `Shift` on top of `⌘`/`Ctrl` precisely because ⌘X is cut, ⌘L is the address bar and ⌘G is find-next. A resume page that breaks copy-paste is a worse offence than one without shortcuts.
- **Ignore keystrokes aimed at text fields** — inputs, textareas, selects and `contenteditable`, which includes the command palette's own search box.

## Known inconsistencies

- **Spanish strings in `mode.toggle.tsx`.** The button's `title` and screen-reader label read "Tema claro — cambiar a oscuro" while the document is `lang="en"`. Per `AGENTS.md`, shipped strings are English.
