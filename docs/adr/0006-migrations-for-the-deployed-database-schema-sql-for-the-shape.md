# Migrations for the deployed database, `schema.sql` for the shape

`seed/d1/schema.sql` remains the declared shape of the database, and every database that does not exist yet is built from it directly: the test setup, `check:fixtures` and the smoke test each create an empty D1 and apply the file. The deployed database is the one exception, because it already exists and cannot be recreated without a window in which the site serves nothing. It is moved forward by `wrangler d1 migrations` instead, applied by the publication job. Only a database that already exists needs a path; a new one is given the shape.

This reverses half of ADR 0002. That ADR ruled out an ORM, a query builder and a migration tool in a single sentence, then justified all three with arguments that bear only on the ORM: bundle size inside a Worker, a schema definition duplicating `schema.sql`, an abstraction between the reader and the two partial unique indexes that encode Post and Bookmark identity. None of them touch a CLI that is never packaged into the Worker. The ORM half stands unchanged.

What applying the schema by hand actually cost is `seed/verify-schema.ts` — 206 lines whose entire job was to notice that the remote half had been forgotten. That is a drift detector written by hand for a problem migrations do not have. Adopting them removes the last manual step against production and leaves less machinery behind, not more.

## Migrations here are DDL, never a backfill

The usual reason a migration turns dangerous is that it has to move data as well as change shape. That cannot happen here, and not by luck.

D1 is a complete projection of the Markdown (ADR 0001), and `seed/d1/seed.sql` reconciles rather than accumulates: it upserts every Content Item and Project that should exist and deletes every row that should not. Whatever column a migration adds, the seed fills it from the source in the very next step of the same job.

So a migration in this repository is `CREATE`, `ALTER` and `DROP`, and never `UPDATE … SET`. A migration that finds itself needing to write data is a sign that something has stopped being derived, which is a larger decision than the migration.

## Considered Options

- **Keep applying the schema by hand.** Rejected. It works — the gate does fire — but it makes the schema and the code travel in separate channels, and there is no ordering of the two that has no window. Applying first blocks publication from `main` until the code lands, because the check is bidirectional and reports an undeclared table as drift; merging first turns `main` red until someone applies. Neither is dangerous, and both are avoidable.
- **Rebuild the database on every publication.** Tempting, because the data is derived and 15 rows deep. Rejected because the seed is deliberately written to have no moment where a published Post is missing — it writes before it deletes, for both stores — and dropping the tables introduces exactly that moment in production.
- **Drop `schema.sql` and let the migrations be the only description.** Saves the duplication outright. Rejected on two counts: three of the file's four consumers want a whole shape rather than a path, and the file is where the schema is explained — why `updates` is distinct from `updated_at`, why `'experiment'` is accepted from the first day when nothing is one. Split across migration files, those notes are ordered by date instead of sitting next to the column they describe.

## Amendment (Phase 2b): a column is dropped a deploy later than its last reader

The order above has a consequence nothing had needed yet: **the publication job applies migrations before it deploys the Worker.** Step 1 writes to the deployed database; step 5 ships the code. Between them — a seed, two verifications and a build, so minutes rather than seconds — the *previous* Worker is still serving every request against the *new* shape.

Adding a column is safe in that window, because nothing selects a column it does not know about. Dropping one is not: the running Worker's shared column list still names it, so every listing query answers `no such column`, and `/`, `/blog`, `/timeline` and `/bookmarks` return 500 through the seed, the build and the deploy. Minutes, not seconds.

**So a column is removed in two publications, not one — expand, then contract.**

1. The publication that stops reading the column ships the code that no longer selects it, and leaves the column in place.
2. A later publication drops it: the migration, the shared column list, the `INSERT` in the generator, any query in the KV pipeline, and the tests. By then no deployed Worker asks for it, so the same job order is safe.

`content.tags` is the first instance, and it went through both steps. Phase 2b's publication shipped the Worker and the KV generator no longer selecting the column while `0004` left it in place; the next publication dropped it in `0005`. The cost of getting the order wrong was measured rather than assumed: the two steps were nearly written as one, and the shared column list still naming `tags` is what would have made a single deploy answer `no such column` on every listing page.

**The second step is scheduled, not assumed.** A "we will drop it later" that nobody writes down is how a schema accumulates columns nobody dares remove; that one was tracked as its own piece of work, which is what got it done.

This is a fact about how this repository changes schemas rather than about any particular column, and it will recur — which is why it amends this ADR instead of becoming one of its own. It does not touch the DDL-never-a-backfill rule above: both steps are `ALTER` and `DROP`, and the reconciling seed still fills whatever shape the migration leaves.

## Consequences

- **The shape is written twice** — once in `seed/d1/schema.sql`, once in a migration. The migration is usually a line or two; the file is where a reader looks. What makes the duplication safe is that drift between them cannot be published: `verify:schema:local` applies the migration chain from zero to a throwaway database, applies `schema.sql` to a second one, and requires the two shapes to be identical. It runs in the `verify` job on every push, with no credentials, before production has seen anything.
- **`verify:schema:remote` changes meaning.** It no longer blocks a publication because someone forgot; it confirms that the migrations that just ran produced what the file declares. It stays first in the publication job, before a single row is written.
- **The baseline is idempotent.** The deployed database predates all of this, so `0001` describes the shape it already has, with `IF NOT EXISTS` throughout, and is a no-op there. It has to describe the *deployed* shape rather than the current one: a baseline carrying the newer `content` would find the table already present, skip it, and silently never add the column.
- **`d1_migrations` is not a declared table.** `wrangler` creates it to track what has run. `verify-schema.ts` ignores it alongside `sqlite_*` and `_cf_*`, which are excluded for the same reason — they belong to the engines, not to this repository.
- **Migrations live in `seed/d1/migrations/`**, set through `migrations_dir` rather than left at wrangler's default. Everything describing this database's shape and contents is in `seed/d1/`, and separating the path from the shape it leads to helps nobody.
- **Rollback is forward.** `wrangler` has no down migrations, and none are wanted. A migration that did the wrong thing is corrected by another migration and a seed, and nothing is lost in between, because nothing in D1 is original.
- **KV is untouched.** It has no shape to declare and no manual step to remove; its payloads are rewritten in full on every publication and read back before the deploy. Adopting migrations makes D1 look like KV already did.
