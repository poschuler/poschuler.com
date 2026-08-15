-- Phase 2a: Series get two tables, and a Post gets a Container.
--
-- No `IF NOT EXISTS`, following 0002: this runs exactly once against a database
-- that has none of it, and a statement that quietly does nothing is the failure
-- mode being designed out.
--
-- The three columns land at the end of `content` rather than beside `tags` as
-- `schema.sql` writes them. That is not a difference — `verify-schema.ts` reads
-- columns through `pragma_table_info` ordered by name — and recreating the table
-- to place them would cost an outage to buy nothing.

-- The Container, written by the generator from the Series manifest and never
-- present in front matter: a Part does not know where it is. `series_slug` is
-- what lets any listing build a correct link to a Part.
ALTER TABLE content ADD COLUMN series_slug TEXT;
ALTER TABLE content ADD COLUMN series_section TEXT;
ALTER TABLE content ADD COLUMN section_order INTEGER;

-- A Series is a Container, not a Content Item: no Published At, no place in the
-- Timeline, revised in place as Parts arrive. What it holds instead is a
-- contract with the reader, stated once and, for the Destination, never changed.
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
