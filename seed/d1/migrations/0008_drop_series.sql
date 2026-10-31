-- Contract half of retiring the Series: the two tables and the two `content`
-- columns that only a Series ever used go.
--
-- The Series was retired from the site in an earlier publication (ADR 0014),
-- and this is the step that waits for it. It is a *deploy* that gates this
-- file, not a merge: this job applies migrations before it deploys the Worker
-- (ADR 0006's amendment), so landing it while the previous Worker still read
-- `series_slug` or `series_section` would answer `no such column` on every
-- listing page — `/`, `/blog`, `/timeline`, `/bookmarks` — until the deploy
-- finished. That publication is live and nothing serving reads either column.
--
-- Nothing is lost that the Markdown does not still hold: the seed reconciles
-- the whole database from it on the very next step of this job (ADR 0001).
--
-- The order is the one SQLite accepts. `series_section` has no foreign key to
-- `series`, so neither table blocks the other, and dropping a table takes its
-- index with it. The columns come last: `DROP COLUMN` is refused for a column
-- that sits in an index, a primary key or a CHECK, and neither `series_slug`
-- nor `series_section` is in any — the indexes on `content` are over
-- `(slug, lang)` and `(slug)`, and its one CHECK is over `type` and `lang`.
DROP TABLE series_section;
DROP TABLE series;
ALTER TABLE content DROP COLUMN series_slug;
ALTER TABLE content DROP COLUMN series_section;
