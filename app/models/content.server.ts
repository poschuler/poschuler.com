import { dbQuery } from "~/db.server";

/**
 * The columns every Content Item query returns, aliased snake_case → camelCase
 * in SQL so the mapping lives next to the query rather than in JavaScript.
 *
 * This is a fixed fragment, not a value: nothing user-supplied is ever
 * interpolated into a statement. Values still go through `.bind()`.
 */
const CONTENT_COLUMNS = `
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
      tags as "tags"`;

type ContentRowBase = {
  idContent: number;
  slug: string;
  title: string;
  publishedAt: string;
  /** `publishedAt` truncated to `YYYY-MM-DD`, the form the UI renders. */
  publishedStringDate: string;
  /**
   * A JSON array as stored, **not** parsed. Nothing reads Tags yet; whoever
   * does should parse it here and change this to `string[]`.
   */
  tags: string;
};

/** A Post: identified by `(Slug, Locale)`, written by Paul, body lives in KV. */
export type PostRowType = ContentRowBase & {
  type: "post";
  lang: string;
  description: string | null;
  externalUrl: null;
  source: null;
};

/** A Bookmark: identified by Slug alone, body stays at the Source. */
export type BookmarkRowType = ContentRowBase & {
  type: "link";
  lang: null;
  description: string | null;
  externalUrl: string;
  source: string;
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

export function findAllBookmarks(db: D1Database) {
  return findContent<BookmarkRowType>(db, "where type = 'link'");
}
