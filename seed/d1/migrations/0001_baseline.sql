-- The shape the deployed database already had when migrations were adopted.
--
-- Every statement is `IF NOT EXISTS`, because this one is a no-op in production
-- and a real creation everywhere else. That is the whole job of a baseline: the
-- deployed database predates this directory, so the chain has to start at a
-- point that is already true there.
--
-- Deliberately *not* the current `schema.sql`. A baseline carrying the newer
-- `content` would find the table present, skip it, and silently never add the
-- `updates` column — the exact failure this whole arrangement removes. What is
-- missing here arrives in 0002. See ADR 0006.

CREATE TABLE IF NOT EXISTS content (
    id_content INTEGER PRIMARY KEY AUTOINCREMENT,

    slug TEXT NOT NULL,
    repository TEXT,

    lang TEXT,

    type TEXT NOT NULL, -- "post" or "link"
    title TEXT NOT NULL,
    published_at TEXT NOT NULL, -- Stored as ISO8601 string

    -- Content for SEO
    description TEXT,

    -- content for "links"
    external_url TEXT,
    source TEXT,

    tags TEXT, -- Store as JSON string (e.g., '["tag1", "tag2"]')

    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),

    CONSTRAINT lang_required_for_posts
    CHECK (type <> 'post' OR lang IS NOT NULL) -- CHECK constraint is supported
);

CREATE UNIQUE INDEX IF NOT EXISTS content_post_idx ON content (slug, lang) WHERE lang IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS content_link_idx ON content (slug) WHERE lang IS NULL;
