# Revisions are a curated list in the content, not a timestamp

A Post or a Project declares its revisions in its front matter as an ordered list, newest first, each with a date and a one-line note. The list is stored as a JSON string in one column — the same shape `tags` already uses — and there is no separate "last updated" field: the most recent revision is the first element.

```yaml
updates:
  - date: '2027-08-14'
    note: 'Updated for Node 24 and pnpm 11; the Express 4 examples now use Express 5.'
```

Technical writing dates badly in a way that has nothing to do with when it was published. An article about setting up an API is wrong the moment the package manager or a major version moves, and a reader who cannot tell whether it was revised has to assume the worst. The `updated_at` column already on `content` cannot answer that: it is set to `CURRENT_TIMESTAMP` by every seed, so publishing one Bookmark marks every Post as updated that day. It records when the row was written, which `CONTEXT.md` already distinguishes from the editorial dates the site presents.

A Project needs the same thing for a different reason — it is revised in place and never published, so a revision date is the only date it has.

## Considered Options

- **Make `updated_at` editorial.** Stop stamping it in the seed and set it from the front matter. Rejected: the column is genuinely useful as a row timestamp, and one column cannot be both the pipeline's record and the author's claim. It also carries a date and nothing else — see the next option.
- **A single `updatedAt` date, no note.** One field, one line under the title. Rejected: it tells a returning reader that something changed without telling them whether it affects the part they remember. The revision that motivated this — a package manager and a major version — is exactly the case where "updated" alone leaves the reader to re-read or to guess.
- **A `content_revision` table.** The normalised answer. Rejected: this repo has one table that matters and no joins by design (ADR 0002), and a relation for a list that is almost always one element long buys nothing a JSON column does not. `tags` already established the pattern.
- **Date plus note, as a list.** Chosen. A list whose first element is the current state costs the same as a single field and does not have to be migrated when a second revision arrives.

## Consequences

- **There is no field that can contradict the list.** "Last updated" is a read of the first element, not a stored value, so the two cannot drift the way a `updatedAt` field and a changelog would.
- **`content` carries two similar-looking columns**, `updated_at` and `updates`, meaning different things. The first is when the row was written by the pipeline; the second is what the author says changed. Renaming either would be a schema change applied by hand in production (ADR 0002), so the distinction is documented here rather than encoded in the names.
- **Revisions do not reorder the Timeline.** `published_at` still orders it. If a revision promoted a Post, correcting a broken link would rewrite the front page and a reader could no longer tell new writing from retouched writing.
- **Revisions do drive the sitemap's `lastmod`.** A revised Post is dated by its revision rather than by its publication, which is what a crawler needs and what the previous behaviour got wrong.
- **The list is curated, not a commit log.** Only revisions that change what a reader takes away belong in it. The fine-grained history is already in git and this repository is public, so a second, hand-maintained copy of it would add nothing — and a changelog that records formatting fixes stops being read, which costs the entries that mattered.
- **A revision list is an implicit promise.** One article marked as revised, beside three that are not, suggests the other three are neglected rather than still correct. That is a real editorial cost, and a reason to revise deliberately rather than often.
