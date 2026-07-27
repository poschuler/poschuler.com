# Hand-written SQL over D1, without an ORM

Data access goes through three thin helpers in `app/db.server.ts` (`dbQuery`, `dbQueryRow`, `dbExecute`) that wrap D1's prepared statements, with the SQL written by hand in `app/models/*.server.ts`. No ORM, no query builder, and no migration tool: `seed/d1/schema.sql` is applied by hand and `seed/d1/seed.sql` is regenerated in full rather than migrated.

The site has one table that matters and four read queries against it, none of which joins. An ORM's value — relationship mapping, migrations, query composition — has nothing to work on here, while its cost is real: bundle size in a Worker, a schema definition that duplicates `schema.sql`, and an abstraction between the reader and the two partial unique indexes that encode Post and Bookmark identity.

## Consequences

- Column-to-field mapping is done in SQL (`id_content as "idContent"`), so it lives next to the query rather than in a separate mapping layer.
- Row types (`ContentRowType`) are hand-maintained and **not** checked against the schema by anything. A column rename breaks at runtime, not at `tsc`.
- Schema changes are a manual two-step: edit `seed/d1/schema.sql`, then apply it to local and remote yourself. There is no migration history and no rollback.
- This is a deliberate deviation from the default modern choice. Reopen it if the schema grows relationships worth mapping — not merely because Drizzle or Prisma is available.
