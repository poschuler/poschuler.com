# A Draft is a document the build validates and refuses to publish

`draft: true` in front matter is the whole mechanism. The file lives in `app/content/`, the walker classifies it, and every check a published document faces runs against it — its `type` against its placement (ADR 0004), its Tags against the vocabulary (ADR 0008), the manifest that lists it (ADR 0007) — and only after every one of those passes does the row builder stop: no D1 row, no KV payload, absent from the Timeline, `/blog`, `/tags`, every index and the sitemap. Its URL is a 404.

```
seed/d1/seed-sql.ts

export function draftError(relativePath: string, draft: unknown): string | null {
  if (draft === undefined || typeof draft === "boolean") {
    return null;
  }

  return `${relativePath} declares draft: ${JSON.stringify(draft)} — draft must be true or false, nothing else`;
}

export function isDraft(draft: unknown): boolean {
  return draft === true;
}
```

Before this, the repository had two states — *absent* and *live* — and nothing between them. A document a week from finished had nowhere to exist: seeded into D1, rendered into KV, listed beside finished work on the day it was still being written, with nothing in the pipeline able to tell the difference. `draft:` is the third state, and publishing is deleting one line.

This ADR exists because the consequence reads, at first glance, like a violation of ADR 0004. That ADR's rule is that a file under `app/content/` is checked and either becomes a page or fails the build — there is no third outcome. A Draft *is* a third outcome: checked in full, and deliberately producing nothing. Without this record, a future reader finds files that are validated and silent and has to reconstruct why that isn't the defect ADR 0004 exists to prevent.

## What a Draft is not

**Not an exemption from validation.** A Draft passes every check a published document passes — the flag is read last in every generator, after `type`, Tags, manifest listing and revisions have already succeeded or already failed the build. That ordering is the whole point: a problem in a Draft surfaces while it is being written, not on the day it is deleted, one line, to publish.

**Not free to break its Container.** A Container — a Series landing, a Project landing — may be a Draft only while it holds no published content:

```
seed/d1/manifest.ts

export function containerContradictionError(
  relativePath: string,
  files: DraftableFile[],
): string | null {
  const published = files.find((file) => !file.draft);

  if (!published) {
    return null;
  }

  return `${relativePath} is a draft, but '${published.slug}' is published — a Post cannot be reached through a Container that is not.`;
}
```

There is no cascade: a drafted Container does not hide its published children — it refuses to coexist with them. Cascading was considered and rejected, because it reopens the very state this decision closes: a Post marked published that is, in fact, invisible, findable only by opening a different file to learn why.

**Not privacy.** The repository is public and git history is permanent. A Draft is a document that is *out of the site*, not one that is *out of view* — its Markdown is readable in the tree and in every commit that touched it from the first one. That has an operational consequence for anything written under a no-publish policy — the handoff's own is the case in point: no retailer names, no matching thresholds, no volumes, no business metrics — which applies from the first keystroke committed, not edited in afterwards. A threshold written into a Draft and later deleted is not gone; removing it for real means rewriting history and force-pushing.

## Considered Options

- **A file outside `app/content/`** — a `drafts/` directory, or `.gitignore`. Zero code, and the wrong trade: the first time the build looks at the file would be the day it is moved in to publish, so an undeclared Tag or a malformed date surfaces at the worst possible moment instead of while the document is being written. Under `.gitignore` the draft is also unversioned, which is a worse place for a week of writing than the tree it belongs in.
- **A filename convention**, e.g. `product-matching.en-draft.md`. There is a precedent in this repository, and it is the argument against: a file whose name parses to no Locale is skipped today with a warning nobody reads, and has sat unpublished for months because nothing forces a decision about it — a state the system tolerates instead of modelling. Renaming to publish would also change the Slug, the one identifier this model declares immutable once published.
- **A `draft: true` flag in front matter, checked as strictly as everything else.** Chosen. Being a Draft is a property of the document, not of where it is filed — which is what makes it checkable, and what keeps the Slug and the file's placement exactly as stable as a published document's.

## Consequences

- **`draft:` is accepted on any document under `app/content/`** — a loose Post, a Part, a Field Note, a Project landing, a Series landing. A Bookmark accepts it too, though the state is not needed for a pointer with nothing half-written about it: permitting one generic condition costs less than a special-cased refusal, and permitting it enables no bad state.
- **A non-boolean value fails the build.** `draft` is a YAML field, so `draft: 'true'` or `draft: yes` is read as a string, not the boolean it merely looks like — a document silently unpublished, or published, by a typo is worse than one that fails loudly.
- **Turning a published document back into a Draft un-publishes it for real.** It is simply absent from the rows the generator hands the existing prune, which deletes it — the same mechanism a deleted file already goes through, exercised by a round-trip test for each generator.
- **A companion command reads a Draft at its real address without touching a tracked file.** `pnpm run preview:drafts` runs the same D1 and KV generators the committed fixtures come from, with two parameters threaded through the same code path rather than a second one: include Drafts, and write to the gitignored `preview/` instead of `seed/`. The result is applied to the disposable local D1 and KV, so there is nothing to revert and nothing that can be committed by accident.
- **The fixtures are unaffected.** `check:fixtures` regenerates `seed/d1/seed.sql` and `seed/kv/kv_payloads/` with Drafts excluded, exactly as it always has — a Draft in progress never turns the build red, and `preview/` is never the thing that check compares against.
