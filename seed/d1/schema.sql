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

    -- The Container, when this Post has one — a Series or a Project, never
    -- both. Written by the generator from the Series or Project manifest and
    -- never appears in front matter: a Part or a Field Note does not know
    -- where it is, the manifest says (ADR 0007). `project_slug` arrives with
    -- this column; nothing writes it yet, that is a later ticket.
    --
    -- Two Container slugs, not one generic pair: `series_section` does not
    -- generalise — a Field Note has no section and never will — so a
    -- `container_kind` + `container_slug` pair would leave it stranded beside
    -- a column with nothing to say. `series_slug` and `project_slug` are what
    -- make a correct link possible from anywhere: the Timeline interleaves
    -- Bookmarks, loose Posts, Parts and Field Notes, and each takes a
    -- different prefix. The invariant that at most one is set is enforced in
    -- TypeScript, as a discriminated union over these columns, not by a
    -- `CHECK` — SQLite cannot add one without recreating the table.
    series_slug TEXT,
    series_section TEXT, -- the section's slug, within that Series
    project_slug TEXT,   -- the Project, when the Container is one

    -- The Container's position in its list: a Part's position within its
    -- section, or a Field Note's position within its Project's `notes:`. Every
    -- query orders by this column now.
    container_order INTEGER,

    -- The same fact, under the name this column used to carry alone —
    -- `section_order`, which also names a column on `series_section` below
    -- with a different meaning: that table's is a section's position within
    -- the arc, not a Part's position within its section. Migration 0006 could
    -- not rename it in place: this job applies migrations before it deploys
    -- the Worker, and the previously deployed Worker is still asking for
    -- `c.section_order` while that migration runs. So it stays, written by the
    -- generator with the same value as `container_order` and read by nothing
    -- here, until migration 0007 drops it — safe once this publication is
    -- live, per ADR 0006's amendment.
    section_order INTEGER,

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

-- A Series is a Container, not a Content Item: it has no Published At — it is
-- revised in place as Parts arrive — and never appears in the Timeline. What it
-- holds instead is a contract with the reader, stated once and, for the
-- Destination, never changed.
CREATE TABLE series (
    id_series INTEGER PRIMARY KEY AUTOINCREMENT,

    slug TEXT NOT NULL,
    lang TEXT NOT NULL, -- as on a Project: prose in one Locale

    title TEXT NOT NULL,
    description TEXT, -- SEO meta description

    -- Editorial, and deliberately not derived from every section being
    -- complete: another section can always be added. It states whether the
    -- Destination has been reached.
    status TEXT NOT NULL,

    -- The four halves of the contract, all required. A landing that omits one
    -- of them is the failure this phase exists to prevent: a reader cannot tell
    -- whether the series is for them.
    starting_point TEXT NOT NULL,
    destination TEXT NOT NULL,
    out_of_scope TEXT NOT NULL, -- Store as JSON string (e.g., '["Microservices"]')
    audience TEXT NOT NULL,

    -- No `updates` column, unlike `project`. ADR 0005 gives Revisions to a
    -- document with no other possible date; a Series has one — what changes on
    -- its landing is that a Part arrived, and that Part is already dated.
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),

    CONSTRAINT series_status_known
    CHECK (status IN ('ongoing', 'complete'))
);

CREATE UNIQUE INDEX series_idx ON series (slug, lang);

-- One row per section of a Series' arc, in the order the manifest lists them.
CREATE TABLE series_section (
    id_series_section INTEGER PRIMARY KEY AUTOINCREMENT,

    series_slug TEXT NOT NULL,
    lang TEXT NOT NULL,

    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL, -- one or two sentences; rendered even when the section is planned

    -- Nullable, and the only value it accepts is 'complete'. The other two
    -- states `08` described are already stated by the structure: a section with
    -- no Parts is planned, a section with Parts is in progress. Only *finished*
    -- cannot be observed, because it is a promise the author holds. Allowing
    -- the other two to be declared would restore two sources of truth free to
    -- disagree. See ADR 0007.
    status TEXT,

    -- The position in the manifest's list, written by the generator. A list has
    -- no gaps and no duplicate positions, which is why nothing checks for them.
    section_order INTEGER NOT NULL,

    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),

    CONSTRAINT series_section_status_known
    CHECK (status IS NULL OR status = 'complete')
);

CREATE UNIQUE INDEX series_section_idx ON series_section (series_slug, lang, slug);