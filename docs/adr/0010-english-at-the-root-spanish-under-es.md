# English at the root, Spanish under `/es`, and one path map for both

This site is published in two Locales. English is served at the root with no prefix, Spanish under `/es`, as two route branches mounted over the same route modules — and the path segment after the prefix is **the same string in both**, with one exception. The decision is recorded because URLs are permanent: every alternative below was reachable when this was decided and none of them is reachable afterwards without a redirect that never expires.

Accepted for Phase 3, and written before the code, because the reasoning that produced it lives in a planning document that is not part of this repository.

```
/            /es
/blog        /es/blog
/projects    /es/projects
/series      /es/series
/tags        /es/tags
/bookmarks   /es/bookmarks
/timeline    /es/timeline
/cv          /es/cv
```

`/en/…` is not a namespace this site claims: it answers 404, and it gets no redirect, because `app/lib/redirects.ts` holds addresses that **were** published and nothing was ever published there.

## Considered Options

- **An optional `:locale?` segment**, one route serving both. Rejected on what the generated route registry says about it. React Router's typegen turns the two branches into enumerated pages — `"/blog/:blogSlug"` and `"/es/blog/:blogSlug"` — and turns the optional parameter into one page with `locale?: string`. Three things follow from the difference. `/xx/blog/project-setup` **matches** the optional-parameter route, so its loader runs and, without hand-written validation in every loader, answers 200 with English content at an invented address — the catch-all never sees it, because the route matched. The typed `href()` helper is generated from that same registry, so `href("/pt/blog/:blogSlug", …)` is a compile error under two branches and compiles fine under one. And `/es/*` is a page of its own under two branches, so a 404 in the Spanish branch can surrender in Spanish. The set of published Locales is a fact the compiler knows, rather than a convention to remember.

- **Symmetric prefixes — `/en/` and `/es/`, nothing at the root.** Tidier on paper, and rejected on cost. The published sitemap holds sixteen URLs, all at the root; moving them costs sixteen permanent redirects, three of which are already the destination of an earlier rename and would become chained — which `app/lib/redirects.ts` forbids by rule and by test, so those entries would have to be rewritten too. And the root itself becomes a problem: either a redirect to `/en`, adding a hop to the most-shared address on the site, or a language-picker page, which is worse for a crawler and for a reader than either language would have been.

- **Translated path segments** — `/es/proyectos`, `/es/etiquetas`. Rejected because it generalises from a single case. Checked one at a time, only one English segment misleads a Spanish reader, and the rest are either the same word (`blog`, `series`) or plain anglicisms that mean nothing else (`projects`, `tags`, `timeline`, `bookmarks`). The price of the general rule is a path map per Locale — machinery that exists forever, and invites the next reader to translate one more segment for symmetry.

- **Two branches, one path map, and one renamed segment.** Chosen.

### The exception, and the rule it comes from

`resume` is the one segment that does not survive translation, and not because it is English: **it is a Spanish word.** It is the third person singular of *resumir*, so `/es/resume` reads as a conjugated verb rather than as a CV. It is renamed to `cv` in **both** Locales, which is what a Spanish reader writes and what a British English speaker says, and the visible navigation label stays *resume* in English — the label and the path are independent.

That gives the general rule:

> **A Slug never varies by Locale. A route segment may, and does so only when the English word means something else in the other language.**

The first half is not new — Translations of a Post share a Slug, and `(Slug, Locale)` is what identifies it. What is new is the second half, and the distinction it rests on: a Slug is **content identity**, a route segment is **site structure**. Today the rule has exactly one instance.

## Consequences

- **Mounting one module twice needs an explicit `id`**, because the default id *is* the file path. Fifteen of them, and `typegen` handles the rest: it emits one `+types` file per module whose `Matches` becomes a union discriminated by route id.
- **The apparent duplication of the route list is not one.** The branches are built by one function called twice. What is real is that adding a page and calling it once publishes that page in English only, in silence — so the two branches are asserted to have the same shape in the test suite.
- **`/resume` and `/resume.pdf` become permanent entries in the redirect table.** That table is never cleaned; this is the price of the rename, paid once, against a per-Locale path map that would have been maintained forever.
- **The domain term is still *Resume*.** `CONTEXT.md` defines it, and the directory and `resume.json` keep the name. What moved is an address, not a concept — the same distinction ADR 0007 draws between what a document is and where it is served.
- **A third Locale is a third branch**, not a configuration value. That is deliberate: it forces the catalogue, the switcher and the sitemap to be considered together rather than a prefix being added and three things quietly left behind.
- **The absence of a prefix is what means English.** There is no `/en/` to fall back on, so `x-default` is the root URL and the English branch is the one a crawler with no language preference is given.
