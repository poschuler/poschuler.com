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
