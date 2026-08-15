-- Phase 2b: Tags become rows a query can reach.
--
-- No `IF NOT EXISTS`, following 0002 and 0003: this runs exactly once against a
-- database that does not have it, and a statement that quietly does nothing is
-- the failure mode being designed out.
--
-- Nothing here touches the JSON `tags` column on `content`, and that is the
-- decision rather than an omission. The Worker's shared column list and the KV
-- generator both still select it, and this job applies migrations *before* it
-- deploys the Worker — so dropping the column now would leave the previous
-- Worker asking for it: `no such column` on every listing query, and 500s on
-- the home page, the blog index, the Timeline and the Bookmarks page for the
-- length of the seed, the build and the deploy. Expand now, contract later.

-- One row per Tag per Content Item, derived from the Markdown like everything
-- else and rebuilt on every seed run. It exists so that *which Posts carry this
-- Tag* and *how many does each Tag hold* are queries rather than work done in
-- JavaScript over every row and its parsed JSON.
--
-- Rows are written for Posts and Bookmarks alike. What a Tag page lists is a
-- policy of the page, not of the data: today it lists Posts only, and the day
-- that is reopened there is nothing to seed first.
CREATE TABLE content_tag (
    -- The natural key of the Content Item plus the Tag. Never `id_content`:
    -- that is an autoincrement, and the seed upserts with `INSERT OR REPLACE`,
    -- which deletes and re-inserts on a conflict — so the id changes on every
    -- run. `(slug, lang)` is what all four existing prunes already key on.
    slug TEXT NOT NULL,
    lang TEXT, -- NULL for a Bookmark, as in `content`
    tag TEXT NOT NULL,

    PRIMARY KEY (slug, lang, tag)
);

-- The Bookmark half of that key, because SQLite treats NULLs as distinct in a
-- unique index — and a PRIMARY KEY on a rowid table is one. Without this a
-- Bookmark's rows conflict with nothing, `INSERT OR REPLACE` inserts rather
-- than replaces, and every seed run doubles them. It is the same partial index
-- `content_link_idx` already is, for the same reason.
CREATE UNIQUE INDEX content_tag_link_idx ON content_tag (slug, tag) WHERE lang IS NULL;
