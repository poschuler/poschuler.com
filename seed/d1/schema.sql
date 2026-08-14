CREATE TABLE content (
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

    -- What the author says changed, newest first, as a JSON array of
    -- { date, note }. Distinct from `updated_at` below, which is when the
    -- pipeline last wrote the row and moves on every seed. See ADR 0005.
    updates TEXT NOT NULL DEFAULT '[]',

    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),

    CONSTRAINT lang_required_for_posts
    CHECK (type <> 'post' OR lang IS NOT NULL) -- CHECK constraint is supported
);

-- Conditional Unique Index for 'post' types (lang IS NOT NULL)
-- This is supported in SQLite/D1.
CREATE UNIQUE INDEX content_post_idx ON content (slug, lang) WHERE lang IS NOT NULL;

-- Conditional Unique Index for 'link' types (lang IS NULL)
-- This is supported in SQLite/D1.
CREATE UNIQUE INDEX content_link_idx ON content (slug) WHERE lang IS NULL;

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