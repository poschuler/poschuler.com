CREATE TABLE feeds (
    id_feed INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    date TEXT NOT NULL, -- Stored as ISO8601 string (e.g., '2025-12-09 23:59:59.123')
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

CREATE TABLE projects (
    id_project INTEGER PRIMARY KEY AUTOINCREMENT,
    img_url TEXT NOT NULL,
    project_url TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date TEXT NOT NULL, -- Stored as ISO8601 string
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

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