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

    -- No Tags here, deliberately. `content_tag` below holds one row per Tag per
    -- Content Item and is what a query reaches for; a Post's own chips render
    -- from the front matter that travels verbatim in KV. A JSON copy on this
    -- row existed until 0005 and had no reader by the end.

    -- The Container, when this Post has one — a Project. Written by the
    -- generator from the Project manifest and never appears in front matter: a
    -- Field Note does not know where it is, the manifest says (ADR 0007).
    -- `project_slug` is what makes a correct link possible from anywhere: the
    -- Timeline interleaves Bookmarks, loose Posts and Field Notes, and a Field
    -- Note takes a different prefix from the rest.
    project_slug TEXT,

    -- The Container's position in its list: a Field Note's position within its
    -- Project's `notes:`. Every query orders by this column.
    --
    -- It was named `section_order` until 0006, and renaming in place was not
    -- available: this job applies migrations before it deploys the Worker, so
    -- the previously deployed one would have been left asking for a column that
    -- no longer existed. So 0006 added this column beside the old one, which
    -- stayed written with the same value and read by nothing, and 0007 dropped
    -- that one a publication later (ADR 0006's amendment).
    container_order INTEGER,

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
