import { dbQuery } from "~/db.server";
import { CONTENT_COLUMNS, type PostRowType } from "~/models/content.server";

/**
 * The Tag queries.
 *
 * A Tag is not a Content Item and has no row of its own: it exists because some
 * Content Item carries it, and `content_tag` holds one row per Tag per item.
 * That is why there is nothing here that finds *a Tag* — what a page asks is
 * always about the items behind it, and a Tag no item backs is simply an empty
 * answer.
 *
 * Its own module rather than a fourth function in `content.server.ts`, the
 * shape `series.server.ts` established: the table is new, the join is the whole
 * subject, and a caller reading this file sees every question a Tag can answer
 * in one place.
 *
 * Every fragment below is fixed text supplied by this module; values go through
 * `.bind()`.
 */

/**
 * The Posts carrying a Tag, newest first.
 *
 * **Posts only, never Bookmarks**, although the table holds rows for both.
 * `CONTEXT.md` states that the Timeline is the only place the two kinds appear
 * together, and a Tag page holding both would make that sentence false. It is a
 * policy of the page rather than of the data, which is why the rows exist
 * anyway: reopening the question later needs no migration and no re-seed.
 *
 * Written as `exists` rather than as a join so the outer select can reuse the
 * shared column list unchanged — `content` and `content_tag` carry columns of
 * the same name, and every one of them would have to be qualified the moment
 * the two tables meet in a `from`. The correlated subquery qualifies its own
 * three references instead.
 *
 * An empty array for a Tag no Post carries. That is a 404 the route decides on,
 * the way `findSeriesBySlug` returns `null` rather than throwing.
 *
 * The Slug breaks a tie on the date. Nothing on this site shares one today, and
 * the order two Posts published the same day come back in would otherwise be
 * whatever SQLite happened to scan.
 */
export function findPostsByTag(db: D1Database, tag: string, lang = "en") {
  return dbQuery<PostRowType>(
    db,
    `select ${CONTENT_COLUMNS}
      from content
      where type = 'post'
        and lang = ?
        and exists (
          select 1
            from content_tag
            where content_tag.slug = content.slug
              and content_tag.lang = content.lang
              and content_tag.tag = ?
        )
      order by published_at desc, slug asc
    `,
    [lang, tag],
  );
}
