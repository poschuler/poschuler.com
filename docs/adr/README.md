# Architecture decisions

The decisions worth recording, and why — each one written when it was made, and left standing afterwards. An ADR here is not a description of how the code works today: that is [`architecture.md`](../architecture.md), [`design.md`](../design.md) and [`authoring.md`](../authoring.md). It is the record of what was chosen, what was rejected, and what the choice cost.

**They are amended, never rewritten.** When a later phase generalises a decision, an `## Amendment` section is added below the original and the original text stays as it was. So a file can contain a sentence that was true when it was written and is not now — the amendment beneath it is what says so, and this index is what tells you to look.

| # | Decision | State |
|---|---|---|
| [0001](./0001-markdown-as-source-of-truth-derived-into-d1-and-kv.md) | Markdown is the source of truth, derived into D1 and KV at seed time | Stands |
| [0002](./0002-hand-written-sql-over-d1-without-an-orm.md) | Hand-written SQL over D1, without an ORM | **Half superseded by 0006** |
| [0003](./0003-ci-owns-the-deploy-workers-builds-is-off.md) | CI owns the deploy; Workers Builds is off | Stands |
| [0004](./0004-the-content-tree-classifies-the-front-matter-is-checked-against-it.md) | The content tree classifies; the front matter is checked against it | **Amended** (2a) |
| [0005](./0005-revisions-are-a-curated-list-in-the-content.md) | Revisions are a curated list in the content, not a timestamp | Stands |
| [0006](./0006-migrations-for-the-deployed-database-schema-sql-for-the-shape.md) | Migrations for the deployed database, `schema.sql` for the shape | **Amended twice** (2b, 1b) |
| [0007](./0007-the-manifest-declares-the-arc-a-part-does-not-know-where-it-is.md) | The manifest declares the arc; a Part does not know where it is | **Amended** (1b) |
| [0008](./0008-a-tag-is-its-slug-and-the-vocabulary-is-declared.md) | A Tag is its Slug, and the vocabulary is declared | Stands |
| [0009](./0009-a-draft-is-a-document-the-build-validates-and-refuses-to-publish.md) | A Draft is a document the build validates and refuses to publish | Stands |
| [0010](./0010-english-at-the-root-spanish-under-es.md) | English at the root, Spanish under `/es`, one path map for both | Stands |
| [0011](./0011-the-interface-language-is-a-typed-catalogue.md) | The interface language is a typed catalogue, not an i18n library | Stands |
| [0012](./0012-the-verifier-shares-the-rules-never-the-rows.md) | The verifier shares the rules, never the rows | Stands |

## What changed after the fact

**0002 is half superseded, and which half matters.** It ruled out an ORM, a query builder *and* a migration tool in one sentence, then argued all three from costs that bear only on the ORM — bundle size inside a Worker, a schema definition duplicating `schema.sql`. None of those touch a CLI that is never packaged into the Worker, so **0006 reversed the migration half** and the deployed database moved onto `wrangler d1 migrations`. The decision against an ORM and a query builder is untouched. 0002's own consequence list carries the note; read it there before quoting the file's opening line, which still says the schema is applied by hand.

**0004 was generalised, not replaced, in Phase 2a.** The original rule assumed one tree holds one kind of file, which `series/` broke by holding both a manifest and its Parts. The amendment makes *depth* the discriminator inside a tree — the file named after its folder is that folder, and a subfolder is content living inside it. One line in it has since gone stale on purpose: it says `projects: { nested: null }`, because a Field Note needed a column that did not exist yet. Phase 1b added the column and the nesting, and 0007's amendment is where that is recorded.

**0006 is amended twice, and both amendments are about the same hazard** — that a schema change and the code reading it deploy at different moments. Phase 2b's says a column is dropped a deploy *later* than its last reader, worked through on `content.tags`. Phase 1b's says a rename is an expand-and-contract too, and its contract step is gated on the deploy that stopped reading the old name — worked through on `section_order` → `container_order`, which is why that rename cost two publications rather than one.

**0007 was extended to a second Container in Phase 1b.** The original describes a Series manifest declaring an arc. The amendment adds a Project's, which declares a flat `notes:` list and no arc at all — a Series orders because it promised a Destination, a Project accumulates because the problems turn up when they turn up.

## Writing a new one

Number it sequentially and name the file after the decision rather than the area, in the same voice as the title inside it — `0008-a-tag-is-its-slug-and-the-vocabulary-is-declared.md`, not `0008-tags.md`. Then: the decision stated first, in the present tense and in one paragraph; **Considered Options**, each with why it was rejected, including the ones that look obvious in hindsight; and **Consequences**, including the ones that cost something. Ten of the eleven are shaped that way — 0002 argues its alternatives in prose instead, which is the older habit and not the one to copy.

Record a decision here when it will outlive the code that implements it, when the obvious alternative was rejected for a reason a reader would not reconstruct, or when it constrains what can be done later — a URL shape, a store, a schema. Not every choice earns one. Add the row above in the same commit, or the index is one more thing that drifts.
