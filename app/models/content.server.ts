import { dbQuery } from "~/db.server";

/**
 * The columns every Content Item query returns, aliased snake_case → camelCase
 * in SQL so the mapping lives next to the query rather than in JavaScript.
 *
 * This is a fixed fragment, not a value: nothing user-supplied is ever
 * interpolated into a statement. Values still go through `.bind()`.
 *
 * Exported because `tag.server.ts` selects Content Items too and a second copy
 * of this list is a column added here and missing there. It stays unqualified,
 * which is what keeps it reusable: a query that puts `content` beside a table
 * carrying columns of the same name correlates in a subquery rather than
 * joining in the `from`.
 *
 * **`tags` is deliberately absent, and the column still exists.** The seed still
 * writes it; what stopped is this Worker reading it, and the gap between those
 * two is the whole point. The publish job applies migrations before it deploys
 * the Worker, so a single deploy that dropped the column *and* removed it from
 * this list would leave the **previous** Worker — still asking for it — answering
 * `no such column` on every listing query, for the length of the seed, the build
 * and the deploy. Stopping the read is one deploy; dropping the column is the
 * next. This is the first of the two.
 *
 * Tags are read from `content_tag`; a Post's own chips render from the front
 * matter that travels verbatim in KV. Nothing needs this copy.
 */
export const CONTENT_COLUMNS = `
      id_content as "idContent",
      slug as "slug",
      lang as "lang",
      type as "type",
      title as "title",
      published_at as "publishedAt",
      strftime('%Y-%m-%d', published_at) AS "publishedStringDate",
      description as "description",
      external_url as "externalUrl",
      source as "source",
      series_slug as "seriesSlug"`;

type ContentRowBase = {
  idContent: number;
  slug: string;
  title: string;
  publishedAt: string;
  /** `publishedAt` truncated to `YYYY-MM-DD`, the form the UI renders. */
  publishedStringDate: string;
};

/** A Post: identified by `(Slug, Locale)`, written by Paul, body lives in KV. */
export type PostRowType = ContentRowBase & {
  type: "post";
  lang: string;
  description: string | null;
  externalUrl: null;
  source: null;
  /**
   * The Container, when the Post is a Part of a Series — and `null` when it is
   * a loose Post. It is what makes a correct link possible from anywhere:
   * `/timeline`, the home page and `/blog` all interleave the two, and each
   * takes a different prefix. `postHref` is the one place that reads it.
   */
  seriesSlug: string | null;
};

/** A Bookmark: identified by Slug alone, body stays at the Source. */
export type BookmarkRowType = ContentRowBase & {
  type: "link";
  lang: null;
  description: string | null;
  externalUrl: string;
  source: string;
  /** A Bookmark has no Container: nothing about it is Paul's to arrange. */
  seriesSlug: null;
};

/**
 * Exactly two kinds of Content Item exist and `type` tells them apart, so
 * narrowing on it yields the columns that kind actually carries. The previous
 * flat type declared every column as a non-null `string`, which let a Post's
 * `source` and a Bookmark's `lang` type-check as strings while being `NULL`.
 */
export type ContentRowType = PostRowType | BookmarkRowType;

/** `filter` is a fixed SQL fragment supplied by this module, never by a caller. */
function findContent<T extends ContentRowType>(db: D1Database, filter = "") {
  return dbQuery<T>(
    db,
    `select ${CONTENT_COLUMNS}
      from content
      ${filter}
      order by published_at desc
    `
  );
}

/** The Timeline: Posts and Bookmarks interleaved, newest first. */
export function findAll(db: D1Database) {
  return findContent<ContentRowType>(db);
}

export function findAllPosts(db: D1Database) {
  return findContent<PostRowType>(db, "where type = 'post'");
}

/**
 * Posts that belong to no Series.
 *
 * `/blog` lists these plus each Series as a **single entry**, because that page
 * answers *what has this person written* and a series is one thing written, not
 * fifteen. Publishing part nine should update a row there, not lengthen the
 * page. Every other list — the Timeline, the home page — keeps Parts
 * individually, because their question is *what happened lately*.
 */
export function findLoosePosts(db: D1Database) {
  return findContent<PostRowType>(db, "where type = 'post' and series_slug is null");
}

/**
 * One Post by Slug, in a Locale, whether it is loose or a Part.
 *
 * The row, not the body: `/blog/:blogSlug` reads it to find out whether the
 * Slug it was handed is served from somewhere else. Returns `null` rather than
 * throwing — a Slug that does not exist is a 404 the route decides on.
 */
export async function findPostBySlug(db: D1Database, slug: string, lang = "en") {
  const rows = await dbQuery<PostRowType>(
    db,
    `select ${CONTENT_COLUMNS}
      from content
      where slug = ? and lang = ? and type = 'post'
      limit 1
    `,
    [slug, lang],
  );

  return rows[0] ?? null;
}

export function findAllBookmarks(db: D1Database) {
  return findContent<BookmarkRowType>(db, "where type = 'link'");
}
