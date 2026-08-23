# Authoring

How a document gets written, checked and published here. For what each word
means, see [`CONTEXT.md`](../CONTEXT.md); for why the pipeline is shaped this
way, [`architecture.md`](./architecture.md) and the ADRs it cites.

This file is about mechanism, not editorial judgement. What is worth publishing,
in what order and at what cadence is decided elsewhere and is not the
repository's business.

## The model, in one page

Everything published lives under `app/content/`, in one of four trees, and
**the path is what says what a file is** — the front matter is checked against
it rather than believed (ADR 0004).

```
app/content/
  tags.json                                 the closed Tag vocabulary
  blog/<slug>/<slug>.en.md                  a Post with no Container
  bookmarks/<slug>.md                       a Bookmark
  projects/<project>/<project>.en.md        a Project
  projects/<project>/<note>/<note>.en.md    a Field Note — a Post in that Project
  series/<series>/<series>.en.md            a Series manifest
  series/<series>/<part>/<part>.en.md       a Part — a Post in that Series
```

Three rules follow from that shape, and each of them fails the build rather than
guessing:

- **The file named after its folder *is* that folder; a subfolder is content
  living inside it.** That is the whole of how a Series manifest is told apart
  from its Parts, and a Project from its Field Notes.
- **Only `series/` and `projects/` hold anything nested, and what nests is a
  Post.** A subfolder under `blog/` or `bookmarks/` fails rather than acquiring
  an invented meaning, and so does a fourth level anywhere.
- **The filename carries the Locale under every tree except `bookmarks/`**,
  where it is forbidden. A Bookmark is a pointer to somebody else's document,
  so it has nothing to translate.

The four trees are declared in `seed/d1/content-tree.ts`. A fifth directory
under `app/content/` is not a new kind of content — it is a directory no
generator walks, which is why the build refuses it by name.

## A document of each kind

Every example below is complete: these are the fields, and the ones marked
optional are the only ones that may be left out.

### A Post

`app/content/blog/<slug>/<slug>.en.md`. The filename is the Slug and the Slug is
the URL.

```yaml
---
type: 'post'
title: 'Implementing Value Objects in Node.js'
description: 'A practical guide to…'          # the SEO meta description
tags: ['nodejs', 'typescript', 'ddd']         # optional, from tags.json
publishedAt: '2025-11-02'
repository: 'https://github.com/…'            # optional, renders a repo link
updates:                                      # optional, newest first
  - date: '2026-08-14'
    note: 'Updated for Node 24; the Express 4 examples now use Express 5.'
draft: true                                   # optional — see Drafts
---
```

**Quote the date.** `publishedAt: 2025-11-02` unquoted is parsed by YAML as a
date object, not a string, and the failure that produces is confusing and far
from the file that caused it (issue #13). Every date in this repository's front
matter is quoted, `updates` included.

The body below the front matter is the article. It renders through the `prose`
utility, which covers headings, paragraphs, lists, links, inline code, fenced
blocks, quotes, images and rules — **an element outside that set renders
unstyled on purpose** (`design.md`), and raw HTML in the body is escaped rather
than passed through, so there is no embedding a video.

### A Part

An ordinary Post one level deeper: `app/content/series/<series>/<part>/<part>.en.md`,
with exactly the front matter above. **It declares nothing about the Series.**
Its Container is the folder it sits in, and its position is wherever the
manifest lists it (ADR 0007) — there is no `series:` field and no `order:` to
write.

### A Field Note

The same idea under a Project: `app/content/projects/<project>/<note>/<note>.en.md`,
served at `/projects/<project>/<note>`, with a Post's front matter and nothing
added. The Project's manifest lists it.

### A Bookmark

`app/content/bookmarks/<slug>.md` — one file, front matter only, no folder and
**no Locale suffix**. The body stays at the Source.

```yaml
---
type: 'link'
title: 'The Copenhagen Book'
source: 'pilcrow'                             # who it is credited to
externalUrl: 'https://thecopenhagenbook.com/'
publishedAt: '2024-07-30'                     # when it was read, not published
tags: ['auth', 'security', 'webdev']          # optional
---
```

A Bookmark **cannot carry `updates`**: the body is not here and is not yours to
revise. Declaring them fails the build rather than being ignored, because being
ignored looks identical to working.

### A Project

`app/content/projects/<project>/<project>.en.md`. A Project is not a Content
Item — no Published At, no place in the Timeline — so it is revised in place and
**needs at least one revision**, the day its page went up.

```yaml
---
type: 'project'
title: 'Chekalo'
summary: 'One or two sentences, outcome first. This is what the index shows.'
description: 'The SEO meta description.'
tier: 'flagship'                              # flagship | supporting | experiment
status: 'active'                              # active | archived
stack: ['TypeScript', 'Node.js']              # optional
liveUrl: 'https://chekalo.pe'                 # optional
repoUrl: 'https://github.com/…'               # optional
sortOrder: 1                                  # optional, defaults to 0
updates:                                      # at least one, newest first
  - date: '2026-08-20'
    note: 'First published.'
notes:                                        # optional — its Field Notes, in order
  - 'product-matching'
  - 'alias-flip-vs-reindex-in-place'
---
```

`tier` is weight, never route shape: promoting a Project that grew is a change
to this field, and its URL never moves. `notes:` is a flat list, not an arc — a
Project accumulates what happened; it does not promise where it is going.

**Reconciliation is bidirectional.** A listed note with no file fails, a note
file the manifest does not list fails, and the same slug listed twice fails.

### A Series manifest

`app/content/series/<series>/<series>.en.md`. It declares the whole arc, and it
is the only place the arc exists.

```yaml
---
type: 'series'
title: 'Pragmatic Node.js API'
description: 'The SEO meta description.'
status: 'ongoing'                             # ongoing | complete
startingPoint: 'What the reader is assumed to already be able to do.'
destination: 'What they end up with. Immutable once the first Part ships.'
outOfScope: ['Microservices', 'Event sourcing']   # at least one
audience: 'Who this is for, and who it is not for.'
sections:
  - slug: 'fundamentals'
    title: 'Fundamentals'
    summary: 'One or two sentences. This is what the landing renders.'
    status: 'complete'                        # optional, and 'complete' is the only value
    parts:                                    # omit entirely for a section not started
      - 'project-setup'
      - 'schema-validation-and-error-handling'
---

The prose saying why this series exists and what problem it came out of.
```

Four things about it are load-bearing:

- **The Destination is immutable once the first Part ships.** Everything else
  may change — the number of Parts, their order, where the section boundaries
  fall. That may not: it is the promise the reader signed up for.
- **`outOfScope` cannot be empty.** What a series refuses to cover is half of
  what it promises.
- **Only `complete` is ever declared on a section**, and only with Parts in it.
  A section with no Parts is planned and a section with Parts is in progress —
  both are read from what the section holds, so writing them down would be a
  second source for a fact the list already carries.
- **A manifest needs a body.** A landing with a contract and no voice fails the
  build.

## Tags

`app/content/tags.json` is the closed vocabulary: every Tag this site may use,
and **a Tag it does not declare fails the build**. Writing about a new subject
therefore starts by adding a line to that file.

A Tag is written in lower-case kebab-case, and **that same string is its URL** —
nothing is derived from anything. It describes subject matter, not format:
`ddd` is a Tag, `post` is not. And **it does not vary by Locale**: a subject has
no language; what has a language is what is written about it, so the Spanish
Translation of a Post carries the same `tags:` list as the English one.

Each Tag some Post carries gets a page at `/tags/<tag>` with no route to
declare. A Tag no Post carries is a 404 and is absent from the index (ADR 0008).

## Languages

English is written at the root, Spanish under `/es`, and the Slug is the same
string in both. A Translation is **a second file beside the first**, differing
only in its suffix:

```
app/content/blog/implementing-value-objects-in-nodejs/
  implementing-value-objects-in-nodejs.en.md
  implementing-value-objects-in-nodejs.es.md
```

What travels unchanged, and what is written again:

| Field | In the Translation |
|---|---|
| The Slug — the filename and the folder | **Identical.** `(Slug, Locale)` is what identifies a Post |
| `tags` | **Identical.** A Tag is a subject, and subjects have no language |
| `publishedAt` | **Identical.** It is the same document, in another language |
| `type`, `repository`, `liveUrl`, `repoUrl`, `stack`, `tier`, `status`, `sortOrder` | **Identical.** None of them is prose |
| `title`, `description`, `summary` | Written again, in Spanish |
| `updates[].note`, and a Series' contract fields | Written again, in Spanish |
| The body | Written again, in Spanish |

Only the first row is enforced: the Slug is identical because it is the folder
and the filename, and nothing else in that table is checked by the build. A
Translation carrying different Tags, or a different `publishedAt`, seeds without
complaint and produces two documents that disagree about what they are — which
is why the rule is written down here rather than left to be noticed.

**A Container is translated before anything inside it.** A Part in a Locale its
Series has no manifest for fails the build, and the message names both:

```
… is in 'es' and pragmatic-nodejs-api has no manifest in that Locale
```

So a Spanish Series starts with `<series>.es.md` — the whole contract and the
whole arc — and only then can its Parts follow. The same holds for a Project and
its Field Notes. This is the one ordering constraint in the whole of translation,
and it is the one that is easy to discover the hard way.

**Nothing falls back.** A Spanish address with no Translation behind it is a
404, never the English document at a Spanish URL. An index whose list is empty
still answers 200 with `noindex, follow` and explains itself.

**The Resume is one document with per-Locale text**, not two files:
`app/routes/resume/resume.json` holds `{ "en": …, "es": … }` at each field that
is prose. Editing one language means editing that object, and leaving the other
untouched is a visible half-translation rather than a build failure — the file
is data, not content the pipeline checks.

**Interface strings are not content.** Navigation, headings, empty states and
the 404 live in `STRINGS` in `app/lib/catalog.ts`, typed so that a Locale
missing a key is a compile error (ADR 0011). A document's own words — a title, a
summary, `og:` copy — never go there.

**The language switcher is hidden behind one line.** `LANGUAGE_SWITCHER_REVEALED`
in `app/components/language-switcher.tsx` is a single `false`; the switcher is
built, tested and wired into both places it belongs. Flipping it is what reveals
`/es` to a reader, and the rule for when is that **no section of the navigation
is empty on that day**.

## Drafts

Any document under `app/content/` may carry `draft: true` — a loose Post, a
Part, a Field Note, a Project or a Series landing.

**A Draft is checked exactly as strictly as a published document**: its type
against its placement, its Locale suffix, its Tags against the vocabulary, its
listing in the manifest that holds it, its revisions. Only once every one of
those passes does it produce no row, no payload and no address (ADR 0009).
**Publishing is deleting that one line.**

The value must be a real boolean. `draft: 'true'` and `draft: yes` fail the
build, because a document silently unpublished by a typo is worse than one that
fails loudly.

It is not privacy. The repository is public and its history is permanent, so a
Draft is out of the site, not out of view.

To read one at its real address:

```bash
pnpm run preview:drafts     # rebuilds the local D1, seeds both stores with Drafts included
pnpm run dev
```

It writes into a gitignored `preview/` directory and never touches the committed
fixtures — that separation is the whole point of the command. Go back to the
published state with what it prints on the way out:

```bash
pnpm run d1:reset:local && pnpm run d1:seed:local && pnpm run kv:seed:local
```

## From written to published

The order matters and is not a preference: **the KV generator reads the
already-seeded D1** to decide which Posts to render.

```bash
pnpm run d1:seed:local          # front matter → seed.sql → local D1
pnpm run kv:seed:local          # bodies → JSON payloads → local KV
pnpm run dev                    # read it at its real address

pnpm run verify:stores:local    # read both stores back and compare against the Markdown
pnpm run check:fixtures         # regenerate everything and fail if anything changed
```

`seed/d1/seed.sql` and `seed/kv/kv_payloads/` are **committed**, and that is what
`check:fixtures` enforces: editing a Markdown file without regenerating used to
republish the previous version in silence. Both generated trees belong in the
same commit as the Markdown that produced them.

Then the ordinary route: a branch off `dev`, a PR into `dev`, and `dev` → `main`
when it is ready. **A merge to `main` is the Publication** — one CI job applies
migrations, seeds the deployed D1 and KV from those committed fixtures, deploys
and verifies, in that order. Nothing else deploys anything, and a PR deploys
nothing at all (ADR 0003).

## Editing something already published

**The Slug never changes.** It is the URL, and changing it breaks every link
already published. If a document has to move anyway, add its old address to
`app/lib/redirects.ts` — a test walks that map against the database, so a
redirect pointing at a page that no longer exists fails the build.

**A Revision is what the author says changed**, not a commit log: a date and one
line about what a returning reader should know. Add one to `updates` when the
change alters what a reader takes away — not for a typo. It never reorders the
Timeline, which `publishedAt` alone governs, and it does date the page in the
sitemap (ADR 0005).

Re-run both seed scripts after any edit. The KV upload replaces every payload
rather than merging.

## Templates

`docs/templates/` holds one file per kind, ready to copy:

```bash
cp docs/templates/post.en.md app/content/blog/my-new-post/my-new-post.en.md
```

They are a second description of the front matter, which is exactly the kind of
duplication that drifts in silence — so they do not sit there unchecked.
`tests/unit/seed/templates.test.ts` passes each one through the same functions
the generator calls for a real file, under the path this document tells you to
copy it to, and requires a row rather than an error or a skip. It reads the Tag
vocabulary off the disk rather than stubbing it, so a Tag dropped from
`tags.json` turns the suite red too.

A template that stops being valid is otherwise invisible: nothing reads those
files, so the failure would land on whoever copied one, while they were writing
rather than debugging.

## What fails the build, and what it says

Every one of these stops the run rather than warning. They are worth reading
once, because each one names the file responsible.

| What you did | What you get |
|---|---|
| Put a file outside the four trees | `… is not under a content tree — nothing would read it and nothing would say so` |
| Nested a folder under `blog/` or `bookmarks/` | `… is nested inside a post, and nothing nests under blog` |
| Declared a `type` the path disagrees with | `… declares type 'post' but its position in the series tree says 'series'` |
| Left off the Locale suffix, or mistyped it | `… carries no recognised Locale — a file under blog/ must end in .en.md or .es.md` |
| Gave a Bookmark a Locale suffix | `… is a Bookmark and its filename carries a Locale suffix ('en') — a Bookmark is a pointer and has no Locale to translate` |
| Wrote a Part the manifest does not list | `… is not listed in the pragmatic-nodejs-api manifest — a Part nothing indexes cannot be reached or ordered` |
| Translated a Part before its manifest | `… is in 'es' and pragmatic-nodejs-api has no manifest in that Locale` |
| Added Parts with no manifest at all | `app/content/series/<slug> holds Parts and no manifest — nothing would order them or say what the series is for` |
| Used a Tag `tags.json` does not declare | `… carries the Tag 'foo', which app/content/tags.json does not declare — declare it there, or use the Tag this site already has for that subject` |
| Wrote a Tag that is not a slug | `… carries the Tag "Foo Bar", which is not a slug — a Tag is written in lower-case kebab-case, and that same string is its URL` |
| Wrote `draft: 'true'` | `… declares draft: "true" — draft must be true or false, nothing else` |
| Gave a Project no revision | `… declares no updates — a Project needs at least one, the day its page went up` |
| Left a Series manifest with no body | `… has no body — the landing would render a contract and no voice` |
| Declared a section `status` other than complete | `… section 'x' declares status 'y' — the only declarable value is 'complete'; planned and in-progress are read from whether it has Parts` |

Two failures arrive from further away. A missing `title` or `publishedAt` is
rejected by SQLite when the seed is applied, not by the generator, because those
columns are `NOT NULL` — the message names the constraint rather than the file.
And an unquoted date fails inside the generator with a message about a value
that is not a string.
