import { dbQuery } from "~/db.server";
import type { ArcPart, ArcSection } from "~/lib/series-arc";

/**
 * A Series is not a Content Item, so it has its own tables and its own queries.
 * It carries no Published At, never appears in the Timeline, and is revised in
 * place as Parts arrive.
 *
 * Columns are aliased snake_case → camelCase in SQL so the mapping lives next
 * to the query, the shape `content.server.ts` and `project.server.ts` use. Every
 * fragment below is fixed text supplied by this module; values go through
 * `.bind()`.
 *
 * The joins are qualified — `series.slug`, `ss.slug`, `c.slug` — because
 * `content` carries columns of the same name and an unqualified one would be
 * ambiguous the moment the tables meet.
 */

/** Editorial: whether the Destination has been reached. Never derived. */
export type SeriesStatus = "ongoing" | "complete";

/** A row as the column layout stores it, with `out_of_scope` unparsed JSON. */
type StoredSeriesRow = {
  idSeries: number;
  slug: string;
  lang: string;
  title: string;
  description: string | null;
  status: SeriesStatus;
  startingPoint: string;
  destination: string;
  outOfScope: string;
  audience: string;
};

/** A Series as the routes receive it, with the JSON column already read. */
export type SeriesRowType = Omit<StoredSeriesRow, "outOfScope"> & {
  outOfScope: string[];
};

/**
 * A Series in a list, with the two facts a row shows: how big it is and when it
 * last moved.
 *
 * `partCount` is a **size**, never a position — it promises nothing about how
 * many are still coming, which is the claim the whole design refuses to make.
 * The date is the most recent Part's, computed here rather than stored: a
 * Series has no Published At of its own, and ordering `/blog` by its *first*
 * Part would sink an actively-written series to the bottom of the page.
 */
export type SeriesListingRowType = SeriesRowType & {
  partCount: number;
  /** `null` for a Series whose Parts are all still unwritten. */
  publishedAt: string | null;
  publishedStringDate: string | null;
};

const SERIES_COLUMNS = `
      series.id_series as "idSeries",
      series.slug as "slug",
      series.lang as "lang",
      series.title as "title",
      series.description as "description",
      series.status as "status",
      series.starting_point as "startingPoint",
      series.destination as "destination",
      series.out_of_scope as "outOfScope",
      series.audience as "audience"`;

/** A stored JSON array, or an empty one — a column is not worth a 500. */
function parseOutOfScope(stored: string): string[] {
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function hydrate<T extends StoredSeriesRow>(row: T): Omit<T, "outOfScope"> & { outOfScope: string[] } {
  const { outOfScope, ...rest } = row;

  return { ...rest, outOfScope: parseOutOfScope(outOfScope) };
}

/**
 * Every Series, most recently advanced first.
 *
 * The count and the date come from `content` rather than from a column on
 * `series`: they are answers about the Parts, and a stored copy would be a
 * second source of truth that the next seed could leave behind.
 *
 * `left join`, so a Series whose sections are all still planned appears on
 * `/series` — the index answers *what is running*, and something announced with
 * nothing published yet is an answer to that. `/blog` filters those out on its
 * own terms; that page lists what has been written.
 */
export async function findAllSeries(db: D1Database, lang = "en") {
  const rows = await dbQuery<StoredSeriesRow & { partCount: number; publishedAt: string | null }>(
    db,
    `select ${SERIES_COLUMNS},
        count(c.id_content) as "partCount",
        max(c.published_at) as "publishedAt"
      from series
      left join content c
        on c.series_slug = series.slug and c.lang = series.lang
      where series.lang = ?
      group by series.id_series
      order by "publishedAt" is null, "publishedAt" desc, series.slug asc
    `,
    [lang],
  );

  return rows.map((row): SeriesListingRowType => ({
    ...hydrate(row),
    // Truncated here rather than in SQL: `max()` over an aggregate cannot be
    // wrapped by `strftime` and grouped in the same select without repeating
    // the aggregate, and the column is already a `YYYY-MM-DD …` string.
    publishedStringDate: row.publishedAt?.slice(0, 10) ?? null,
  }));
}

/**
 * One Series by Slug, in a Locale. `null` when nothing is behind it — a 404 the
 * route decides on, not a database error.
 */
export async function findSeriesBySlug(db: D1Database, slug: string, lang = "en") {
  const rows = await dbQuery<StoredSeriesRow>(
    db,
    `select ${SERIES_COLUMNS}
      from series
      where series.slug = ? and series.lang = ?
      limit 1
    `,
    [slug, lang],
  );

  return rows[0] ? (hydrate(rows[0]) as SeriesRowType) : null;
}

/** One `series_section` row joined to one Part, or to nothing at all. */
type ArcJoinRow = {
  sectionSlug: string;
  sectionTitle: string;
  summary: string;
  status: "complete" | null;
  partSlug: string | null;
  partTitle: string | null;
  publishedStringDate: string | null;
};

/**
 * The whole arc in one query: every section in manifest order, with its Parts
 * in reading order.
 *
 * One query rather than one per section, and the same one for all three pages
 * that need it — the landing lists it whole, a Part shows its own section above
 * the article, and previous/next are positions inside it. Ordering is
 * `series_section.section_order` — the position of a section in the
 * manifest's list — and `content.container_order` — the position of a Part in
 * that section's. Two different columns now, not one name meaning both: see
 * `schema.sql` and migration 0006. Neither number appears in any content file.
 *
 * The `left join` is what keeps a planned section in the result. It renders on
 * the landing with its summary and no list, and it is what a finished section
 * announces as coming next.
 */
export async function findSeriesArc(
  db: D1Database,
  seriesSlug: string,
  lang = "en",
): Promise<ArcSection[]> {
  const rows = await dbQuery<ArcJoinRow>(
    db,
    `select
        ss.slug as "sectionSlug",
        ss.title as "sectionTitle",
        ss.summary as "summary",
        ss.status as "status",
        c.slug as "partSlug",
        c.title as "partTitle",
        strftime('%Y-%m-%d', c.published_at) as "publishedStringDate"
      from series_section ss
      left join content c
        on c.series_slug = ss.series_slug
        and c.lang = ss.lang
        and c.series_section = ss.slug
      where ss.series_slug = ? and ss.lang = ?
      order by ss.section_order asc, c.container_order asc
    `,
    [seriesSlug, lang],
  );

  const sections: ArcSection[] = [];

  for (const row of rows) {
    let section = sections.at(-1);

    if (section?.slug !== row.sectionSlug) {
      section = {
        slug: row.sectionSlug,
        title: row.sectionTitle,
        summary: row.summary,
        status: row.status,
        parts: [],
      };

      sections.push(section);
    }

    // A planned section arrives as one row with every Part column null.
    if (row.partSlug && row.partTitle && row.publishedStringDate) {
      section.parts.push({
        slug: row.partSlug,
        title: row.partTitle,
        publishedStringDate: row.publishedStringDate,
      } satisfies ArcPart);
    }
  }

  return sections;
}
