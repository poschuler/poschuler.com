import { parseLocaleSet, type Locale } from "~/context";
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
 * **There is no `tags` column to select.** `content` carried a JSON copy of
 * them until migration 0005 dropped it. Tags are read from `content_tag`, one
 * row per Tag per Content Item; a Post's own chips render from the front matter
 * that travels verbatim in KV.
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
      series_slug as "seriesSlug",
      project_slug as "projectSlug"`;

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
  lang: Locale;
  description: string | null;
  externalUrl: null;
  source: null;
  /**
   * The Container, when the Post is a Part of a Series or a Field Note of a
   * Project — and `null` when it is a loose Post. Never both at once
   * (`schema.sql`). It is what makes a correct link possible from anywhere:
   * `/timeline`, the home page and `/blog` all interleave the three, and each
   * takes a different prefix. `postHref` is the one place that reads them.
   */
  seriesSlug: string | null;
  projectSlug: string | null;
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
  projectSlug: null;
};

/**
 * Exactly two kinds of Content Item exist and `type` tells them apart, so
 * narrowing on it yields the columns that kind actually carries. The previous
 * flat type declared every column as a non-null `string`, which let a Post's
 * `source` and a Bookmark's `lang` type-check as strings while being `NULL`.
 */
export type ContentRowType = PostRowType | BookmarkRowType;

/** `filter` is a fixed SQL fragment supplied by this module, never by a caller. */
function findContent<T extends ContentRowType>(db: D1Database, filter = "", params: unknown[] = []) {
  return dbQuery<T>(
    db,
    `select ${CONTENT_COLUMNS}
      from content
      ${filter}
      order by published_at desc
    `,
    params,
  );
}

/**
 * This Locale's Posts, newest first.
 *
 * `Locale` is required and typed rather than defaulted: the compiler is what
 * finds every call site once the site serves more than one, and it is what
 * forces the question this file answers per function — `findAllBookmarks`
 * below is the one query that must not take this parameter, because a
 * Bookmark has no Locale to filter by.
 */
export function findAllPosts(db: D1Database, locale: Locale) {
  return findContent<PostRowType>(db, "where type = 'post' and lang = ?", [locale]);
}

/**
 * Posts that belong to no Container — no Series, no Project — in this Locale.
 *
 * `/blog` lists these plus each Series as a **single entry**, because that page
 * answers *what has this person written* and a Container is one thing written,
 * not fifteen. Publishing part nine should update a row there, not lengthen the
 * page. Every other list — the Timeline, the home page — keeps Parts and Field
 * Notes individually, because their question is *what happened lately*.
 *
 * `/blog` lists a Project-with-notes as an entry of its own — see
 * `findProjectsWithNotes` — and this query is what keeps a Field Note from
 * also being double-counted here as a loose Post (1b/6,
 * `evolution-plan/14-phase-1b-field-notes.md` Part 10).
 */
export function findLoosePosts(db: D1Database, locale: Locale) {
  return findContent<PostRowType>(
    db,
    "where type = 'post' and series_slug is null and project_slug is null and lang = ?",
    [locale],
  );
}

/**
 * One Post by Slug, in a Locale, whether it is loose or a Part.
 *
 * The row, not the body: `/blog/:blogSlug` reads it to find out whether the
 * Slug it was handed is served from somewhere else. Returns `null` rather than
 * throwing — a Slug that does not exist is a 404 the route decides on.
 *
 * `locales` rides along as a correlated subquery — the Locales some Post of
 * this Slug exists in, not only this one — so the page this row frames can
 * build its own `hreflang` alternates without a second round trip (Part 10 of
 * `evolution-plan/15-phase-3-spanish.md`, and `CONTENT_COLUMNS`'s docblock,
 * which names this the correlated-subquery precedent). Scoped to `type =
 * 'post'` the same way the outer query is, so a Bookmark that happened to
 * share a Slug could never be counted as a Translation.
 */
export async function findPostBySlug(db: D1Database, slug: string, locale: Locale) {
  const rows = await dbQuery<PostRowType & { locales: string | null }>(
    db,
    `select ${CONTENT_COLUMNS},
        (select group_concat(c2.lang)
          from content c2
          where c2.slug = content.slug and c2.type = 'post') as "locales"
      from content
      where slug = ? and lang = ? and type = 'post'
      limit 1
    `,
    [slug, locale],
  );

  const row = rows[0];

  return row ? { ...row, locales: parseLocaleSet(row.locales) } : null;
}

/**
 * Every Bookmark, in every Locale, because a Bookmark has none.
 *
 * No `locale` parameter — a pointer is not translated (`CONTEXT.md`), so an
 * equality filter here would have nothing to match against and would drop
 * every row.
 */
export function findAllBookmarks(db: D1Database) {
  return findContent<BookmarkRowType>(db, "where type = 'link'");
}

/**
 * The Timeline: this Locale's Posts, interleaved with every Bookmark, newest
 * first.
 *
 * Composed from `findAllPosts` and `findAllBookmarks` rather than answered by
 * a query of its own, and that is deliberate: a Bookmark carries no Locale, so
 * the Timeline cannot narrow by one either without dropping every Bookmark it
 * holds (`CONTEXT.md`'s Timeline entry) — `findAllPosts` has already narrowed
 * to this Locale by the time its rows arrive here, and `findAllBookmarks`
 * correctly never does. Pure, so it needs no `D1Database` and no `Locale`: the
 * scoping already happened in the two queries it merges.
 */
export function mergeTimeline(
  posts: PostRowType[],
  bookmarks: BookmarkRowType[],
): ContentRowType[] {
  return [...posts, ...bookmarks].sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt),
  );
}
