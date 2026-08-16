# The manifest declares the arc; a Part does not know where it is

A Series is described in one file — `app/content/series/<series>/<series>.<locale>.md` — whose front matter carries the contract and the whole arc: every Series Section in order, and inside each, the Slugs of its Parts in order. A Part's own front matter says nothing about the Series it belongs to, which Section it sits in, or where in that Section it comes. It is an ordinary Post. Its Container is the directory it is filed under, and its position is wherever the manifest lists it.

The same file settles the second question: **a Section's status is derived, not declared.** A Section with no Parts is planned, a Section with Parts is in progress, and `complete` is the only value that can be written down — because it is the only one that is not already answered by what the Section holds.

```yaml
sections:
  - slug: 'fundamentals'
    title: 'Fundamentals'
    summary: 'The shape of the project: how it is set up, how input is validated…'
    parts:
      - 'project-setup'
      - 'schema-validation-and-error-handling'
      - 'vertical-slices-and-domain-logic'
  - slug: 'persistence'
    title: 'Persistence'
    summary: 'Postgres behind the domain: migrations that run in order…'
```

`persistence` declares nothing about its state. It has no `parts`, so it is planned, and the day the first one is published it becomes in progress by having one — with no second edit anywhere and no moment where a Section says *planned* above a list of published articles.

## Considered Options

- **Each Part declares its own place.** `series: pragmatic-nodejs-api`, `section: fundamentals`, `order: 2` in every Post's front matter, the way most static-site generators do it. Rejected on what it costs to change one's mind. Inserting a Part between two published ones is an edit to every file after it, in a single commit, with nothing that can check the result: the ordering is only correct if fifteen integers happen to agree, and the failure — two Parts claiming position 4, or a gap at 3 — is invisible until the page renders. A list has no gaps and no duplicate positions, so those two invariants stopped being checkable by disappearing.
- **A Section declares its status.** `status: 'planned'` beside `status: 'in-progress'`. Rejected because it is a second source of truth for something the first one already answers, and the two are free to disagree in exactly the direction that damages the page: a Section still marked *planned* while listing three published Parts, or marked *in-progress* with nothing under it. Both are one forgotten edit away, and both make a live series look mismanaged.
- **The manifest declares everything; a Part declares nothing.** Chosen. The arc is one file, read top to bottom, that reads the way the landing page renders. Reordering is moving a line. Announcing the next Section is adding four.

## Consequences

- **Reading order is one straight line, and it crosses Sections.** The order of Sections in the manifest, and inside each the order of its Parts, flattened. `app/lib/series-arc.ts` computes it, and previous/next are derived from a Part's index in it — which is why the last Part of *Fundamentals* links forward to the first of *Persistence* rather than to nothing.
- **A Part that the manifest does not list is a 404, not an orphan.** `/series/:series/:part` derives the reader's position from the arc; when the Part is not in it, there is no position and the route answers 404. That is also what stops one Series' URL from serving another Series' Part.
- **Two checks fail the build, and they are the ones that matter now.** Every Slug the manifest lists must exist on disk, and every file under `app/content/series/<series>/` must be listed exactly once. Between them, a Part cannot be written and forgotten, and a Slug cannot be renamed without the manifest following.
- **Nothing on the site states a total.** "Part 3 of 5" needs a number nobody has — the manifest lists what exists, so nothing knows *Fundamentals* will reach five — and "Part 3 of 3" is available and worse than useless: in a Section still being written it tells the reader they have reached the end, and they have not. What is rendered instead is the list of titles, which cannot lie and grows only when something is published.
- **`series_section` is a table with rows for Sections that hold nothing.** A planned Section is a row with a title and a summary and no Parts pointing at it, because the arc is the thing being published, not a by-product of the Posts that exist so far.
- **The manifest is where a mistake is loud.** One file, in the order it renders, is a file a reader of the diff can check. That was the deciding argument over the distributed alternative: not that it is less typing, but that it is reviewable.

## Amendment (Phase 1b): the manifest governs a second Container

A Project declares which Field Notes it holds, and in what order, the same way a Series declares its Parts — a list in its own front matter, reconciled against the folder beneath it by the same two checks: a listed note with no file fails, a file the manifest does not list fails, and the same note listed twice fails. `seed/d1/manifest.ts` is that reconciliation pulled out of `series-sql.ts` into a function both Containers call, rather than copied — a check with two implementations has two chances to drift the day one of them is fixed and the other is not.

What a Project's manifest deliberately does not declare is everything this ADR's opening settled for a Series: no Sections, no Destination, no `complete` status, no contiguity check. The reason is the boundary between the two Containers, and it is worth stating on its own:

> A Series orders because it promised a Destination; a Project accumulates because the problems turn up when they turn up. Both declare what they hold; only one declares where it is going.

A Series' arc is a promise a reader can rely on — Part five costs less if Part two was read first, because the Series said so on its landing before either existed. A Project's notes carry no such claim: each one is self-contained, and the manifest orders them for curation, not for a sequence a reader has to follow. That is also why a Project's manifest carries no status derivation — a Section's *planned* / *in progress* / *complete* states exist because a Section is a stage of an arc moving toward a Destination, and a Project's list of notes is not moving toward anything, only accumulating what happened.

Two supporting consequences:

- **A note listed in the manifest while it is a Draft reconciles normally and renders nothing** — Draft is an orthogonal state (ADR 0009), and the manifest lists a note the day it is declared, not the day it is finished, so a Draft's presence in the list is not a special case the reconciliation has to know about.
- **The Container-contradiction check (ADR 0009) applies identically to both Containers** — a Project marked as a Draft while one of its notes is published fails the build exactly as a Series landing would, through the same `containerContradictionError`.
