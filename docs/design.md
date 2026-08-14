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

`app/app.css` maps those scales onto named tokens in a Tailwind v4 `@theme` block. **Two families are imported, and two have tokens** — an imported scale ships ~2.2 kB of custom properties into render-blocking CSS whether or not a token reads it, so adding an `@import` without a matching token is a regression:

| Family     | Scale     | Used for                       |
| ---------- | --------- | ------------------------------ |
| neutral    | `mauve`   | every surface, border and text |
| primary    | `indigo`  | reserved for an accent         |

Four further families — `tomato`, `amber`, `grass` and `violet`, mapped to `danger`, `warning`, `success` and `info` — were imported and tokenised but never painted anything, and were removed. Bringing a family back means three edits in step: the `@import` pair in `app.css`, the tokens in `@theme`, and `SCALES` in `scripts/generate-system-dark-css.mjs` (then re-run it). Drop one and either the token resolves to nothing or `system` users get the light value in dark mode.

**As rendered, the site is monochrome.** `indigo` has tokens but nothing paints with them; it is held for an accent that has not been designed yet. Anything meant to match the site — the Open Graph card, for one — should be mauve only, and reach for a border rather than a hue when it needs to divide something.

Every class in the tree resolves to a token that exists. It was not always so: the tree was scaffolded from shadcn/ui and carried `bg-primary`, `bg-secondary`, `bg-card`, `bg-accent`, `text-muted-foreground`, `ring-ring`, `ring-offset-background` and `border-input` — eighteen names that live in shadcn's `@theme` and not in this one. They emitted no CSS, so every element carrying one silently inherited its colour, and the site's whole low-emphasis tier rendered at full contrast. They were substituted for real tokens in one pass. **Substituting a real token for a dead one is a rename and is always safe; deciding that the accent should now appear somewhere it never did is a design decision** — do not smuggle the second in under the first.

The lesson generalises past shadcn: **a Tailwind class naming a token that does not exist fails silently.** Nothing in the type system, the linter or the test suite catches it — the class is simply dropped from the output. When adding a token-bearing class, confirm the token is in `@theme`, or grep the built CSS in `build/client/assets/root-*.css` for it.

The step vocabulary is `app`, `subtle`, `ui`, `hover`, `active` and `overlay` for backgrounds; `default` / `low` for text; `default` / `hover` for borders; `default` for rings. **A token exists because a scenario exists.** The scales run twelve steps and every namespace could be filled out to match, but a token nothing selects is a decision nobody made, and it reads to the next person as an intention the site has already committed to. Adding the step you need is one line.

**Write `bg-ui`, `text-low`, `border-default` — not `bg-gray-100`, `text-gray-500`, `border-gray-200`.** The token is the contract; the scale behind it can change. `text-default` is body text, `text-low` is anything secondary (dates, metadata, muted prose).

Long-form Post and Project bodies render through the `prose` utility at the bottom of `app.css`, written out by hand and reading the mauve scale directly, so prose themes alongside the rest of the site with no separate dark variant. It replaced `@tailwindcss/typography`, which styled every element a Markdown document could contain at five size variants and an inverted colour scheme, none of which the site selects.

Two properties are load-bearing and easy to lose when editing it. Every selector is wrapped in `:where()`, so the whole utility sits at **zero specificity** and a class on the element still wins. And every selector excludes `:where(.not-prose, .not-prose *)` — that is what lets a route drop a composed block, a revision list or a stack row, into the middle of a rendered body without prose reaching into it. The body arrives from `marked` as `dangerouslySetInnerHTML`, so there is nowhere else to put a class.

It covers what the corpus contains: headings, paragraphs, lists, links, inline code, fenced blocks, quotes, images and rules. **An element that appears for the first time — a table, a footnote — will render unstyled**, which is the intended failure: it asks for a decision here rather than inheriting a default nobody chose.

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

The same three classes also carry `color-scheme` in `@layer base`: `light`, `dark`, and `light dark` for `system`. That is the one part of a dark page a stylesheet cannot repaint — scrollbars, native form controls, and the canvas the browser paints outside the document — so without it the palette flips and the scrollbar stays white.

## Typography

- **Inter Variable** for the interface, **Intel One Mono Variable** for everything monospaced. Both are self-hosted from `@fontsource-variable/*`, with the `@font-face` rules written out in `app/styles/fonts.css` rather than imported from the packages — see that file for which subsets ship and why. `root.tsx` preloads the two latin faces; without it the browser cannot discover a font until the stylesheet has parsed.
- **`font-mono`** for content pages (`/`, `/blog`, `/bookmarks`, `/projects`, `/timeline`, and the Post and Project bodies) and for the Resume's secondary text. This is deliberate character, not an oversight — and it makes the monospace family the site's dominant typeface, which is why it is named rather than left to Tailwind's default stack. On that default it resolved to whatever the visitor's OS shipped, so the site read differently on every machine.
- Page headings are `text-3xl lg:text-4xl font-semibold tracking-tight`, followed by an italic `blockquote` subtitle in `text-low`. Blog, bookmarks, projects and timeline all share this header shape — match it. The home page does not; see "The home page is the exception".

## Component layers

Two layers, both canonical since the inherited component sets were deleted:

| Layer                  | Use it for                                                    |
| ---------------------- | ------------------------------------------------------------- |
| Route-local components | Anything used by exactly one route — the first choice          |
| `app/components/ui/`   | Shared primitives, each a thin Base UI wrapper                 |

**Prefer a route-local component over a shared one.** A component used by exactly one route belongs beside that route, not in `app/components/`. `routes/resume/hero.tsx`, `experience.tsx` and `keyboard-manager.tsx` are the model: each imports the slice of `resume.json` it renders, so no props need threading. When a route does have a loader, the same shape applies with `useLoaderData<typeof loader>()` and a type-only import of the parent's `loader`. Promote to `app/components/` only on the second consumer.

`ui/` holds only what is actually imported — `button`, `icon-button`, `dialog`, `sheet`, `command`, `brand-icons`. Add the one file you need, never a set.

Every primitive follows the same shape: a Base UI part, `className` merged through `cn()`, and props typed as `Omit<Part.Props, "className"> & { className?: string }`.

**Only the variants the site actually renders carry styles**, and only the parts it renders are exported. `button` keeps `outline` and `secondary`, `icon-button` keeps `contained` and `outline`, `sheet` opens from one edge, and `dialog` exports the root, the content and the title. A variant nobody asks for is a set of class names no browser ever evaluates, which is exactly where a dead token hides indefinitely — the removed `danger` and `success` variants had been reaching for `ring-danger` and `ring-success`, neither of which exists. Adding one back is three lines when a second consumer appears.

**A dialog is given a name it cannot omit.** `SheetContent` takes `title` as a required prop and renders it as the `Dialog.Title`, visually hidden. A modal with no accessible name is announced as nothing, and an optional prop is one a caller forgets — the mobile navigation had, for as long as it existed.

Two Base UI conventions matter when extending them:

- **Compose with `render`, not by nesting.** `<Button render={<Link to="/blog" />}>blog</Button>` — Base UI merges the props of both, so event handlers from each side run. That is what lets a `SheetClose` wrap a `Link` in `header.tsx` and both dismiss the sheet and navigate.
- **Enter and exit key off `data-starting-style` and `data-ending-style`**, not the `data-state` shadcn/ui uses. The base class list carries the resting state; those two variants carry the state outside it. Copying a shadcn class list wholesale will silently animate nothing.

## Motion

Almost none, on purpose. `transition-colors` on hover states, and nothing else. No skeleton shimmer, no scroll-triggered reveal, no entrance on a page. A site whose whole argument is that its author is careful should feel still.

**The one exception is a panel entering from an edge of the screen** — today the mobile navigation in `ui/sheet.tsx`. It earns the movement because the movement carries information: a panel sliding in from the right says the page is still there, to the right, waiting, where a panel that appears in a frame reads as a new page. **Nothing that merely appears in place gets an entrance.** That is why the command palette does not move: it arrives in the middle of the viewport, from no edge, so a slide would say nothing and a zoom would be decoration — and it autofocuses an input, where an entrance is only delay competing with the first keystroke. Its scrim still fades, because the dimming is the part that carries meaning.

The rules, all of them:

| | |
| :-- | :-- |
| **Enter** | `duration-panel ease-panel` — 250ms |
| **Exit** | `data-ending-style:duration-panel-out data-ending-style:ease-in` — 150ms, always faster than the enter |
| **Properties** | `transform` and `opacity` only. Never `width`, `height` or `inset` |
| **Scrim** | fades on the panel's clock, never instant beside a sliding panel |
| **Reduced motion** | `motion-reduce:transition-none` on every animated element |

All three numbers are tokens in `app.css` — `--ease-panel`, `--transition-duration-panel`, `--transition-duration-panel-out` — never literals in a class list. Tailwind resolves a bare `duration-250` to milliseconds by itself, so the names are not a workaround; they exist so the site's entire motion budget is three lines in one file.

Exits are shorter than entrances because the two moments are not symmetrical: arriving has to be understood, leaving has already been decided.

**Transitions, never keyframe animations.** A transition can be interrupted, so a panel closed halfway through opening slides back from where it actually is instead of restarting from the far edge. It also removes the `animation-fill-mode` trap: an animation's end state evaporates when it finishes, and Base UI unmounts a frame or two later, so an exit built on keyframes flashes the element back on screen unless every one of them carries `forwards`. A transition's end state is the element's own style, so there is nothing to hold.

Two footnotes worth keeping. In Tailwind v4 `translate-x-full` sets the `translate` property rather than `transform`, and `transition-transform` covers `transform, translate, scale, rotate` — which is the only reason the pair works. And none of this is covered by a test: jsdom computes no transitions, so a closing panel has to be checked by eye in a browser before it ships.

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
