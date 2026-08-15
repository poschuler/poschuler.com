-- Phase 1a: Projects get a table, and both kinds of document get Revisions.
--
-- No `IF NOT EXISTS` here, unlike the baseline. This runs exactly once against
-- a database that does not have any of it, and a statement that quietly does
-- nothing is the failure mode being designed out.
--
-- The column lands after `created_at` and `updated_at` rather than between
-- `tags` and `created_at` as `schema.sql` writes it. That is not a difference:
-- `verify-schema.ts` reads columns through `pragma_table_info` ordered by name,
-- and `ALTER TABLE … ADD COLUMN` produces a row indistinguishable from the one
-- `CREATE TABLE` produces. Recreating the table to place it would cost an outage
-- to buy nothing.

ALTER TABLE content ADD COLUMN updates TEXT NOT NULL DEFAULT '[]';

-- A Project is not a Content Item: no published_at, no place in the Timeline,
-- revised in place rather than published. It gets its own table for that
-- reason, rather than a third `type` on `content`.
CREATE TABLE project (
    id_project INTEGER PRIMARY KEY AUTOINCREMENT,

    slug TEXT NOT NULL,
    lang TEXT NOT NULL, -- unlike content: a Project is always prose in one Locale

    title TEXT NOT NULL,
    summary TEXT NOT NULL, -- outcome-first, one or two sentences, shown on the index
    description TEXT,      -- SEO meta description

    -- Weight, never route shape: promoting a project that grew is a change
    -- here, and its URL never moves.
    tier TEXT NOT NULL,

    -- An archived project is a finished story and costs nothing. A dead one
    -- still written in the present tense reads as exaggeration.
    status TEXT NOT NULL,

    stack TEXT, -- Store as JSON string (e.g., '["TypeScript", "Node.js"]')
    live_url TEXT,
    repo_url TEXT,

    -- Orders within a tier. Editorial: recency is the wrong signal for a
    -- portfolio, and without this the order is whatever readdir returns.
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- As on `content`, and required here: a Project has no published_at, so its
    -- most recent revision is the only date it has. See ADR 0005.
    updates TEXT NOT NULL DEFAULT '[]',

    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),

    -- 'experiment' is accepted from the first day although nothing is one yet:
    -- SQLite cannot alter a CHECK, so adding a value later means recreating the
    -- table by hand in production. The *behaviour* it implies — no page of its
    -- own — is deliberately not built until there is one to exercise it.
    CONSTRAINT project_tier_known
    CHECK (tier IN ('flagship', 'supporting', 'experiment')),

    CONSTRAINT project_status_known
    CHECK (status IN ('active', 'archived'))
);

CREATE UNIQUE INDEX project_idx ON project (slug, lang);
