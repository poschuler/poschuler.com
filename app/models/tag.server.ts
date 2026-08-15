import { dbQuery } from "~/db.server";
import { CONTENT_COLUMNS, type PostRowType } from "~/models/content.server";

/**
 * The Tag queries.
 *
 * A Tag is not a Content Item and has no row of its own: it exists because some
 * Content Item carries it, and `content_tag` holds one row per Tag per item.
 * That is why there is nothing here that finds *a Tag* — what a page asks is
 * always about the items behind it, and a Tag no item backs is simply an empty
 * answer. Even the index below asks a question about Posts and gets Tags out of
 * the answer; it never reads the vocabulary, which is a declaration of what may
 * be written rather than a record of what exists.
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
 * One row of the index: a Tag, and how many Posts carry it.
 *
 * `posts` rather than `count`, because the number is a quantity of Posts and
 * nothing else — the same word the page renders beside it.
 */
export type TagCountRowType = {
  tag: string;
  posts: number;
};

/**
 * Every Tag some Post carries, heaviest first.
 *
 * **What the vocabulary declares is not what this returns.** `tags.json` says
 * what may be written; the rows say what exists. Twelve of the declared Tags sit
 * on Bookmarks alone today, and listing them would be an index whose entries
 * lead to the 404 the route serves for a Tag no Post carries.
 *
 * Posts only, for the reason `findPostsByTag` is: the count on this page has to
 * be the number of rows the page behind the link holds, and that page is
 * Posts-only. A count including Bookmarks would be a promise the destination
 * does not keep.
 *
 * A join rather than the `exists` above: the question is about the Tags, so
 * `content_tag` is what is grouped and `content` is what filters it. Only three
 * columns are named and each is qualified, so the two tables sharing `slug` and
 * `lang` costs nothing here.
 *
 * The join on `lang` also carries the Bookmarks out on its own — theirs is NULL
 * in both tables and SQLite matches no NULL to another — but `type = 'post'` is
 * what says so out loud, and it is what would still be true if a Bookmark ever
 * gained a Locale.
 *
 * **Ordered by count descending, then by the Tag.** Read straight down, the list
 * is a profile of the subjects this site covers, which is the whole reason the
 * page is worth having. The alphabetical tie-break is not cosmetic: without it
 * the order of two equal Tags is whatever SQLite happened to scan, and CI
 * compares the generated payloads byte for byte.
 */
export function findTagsWithPostCounts(db: D1Database, lang = "en") {
  return dbQuery<TagCountRowType>(
    db,
    `select content_tag.tag as tag, count(*) as posts
      from content_tag
      join content
        on content.slug = content_tag.slug
       and content.lang = content_tag.lang
      where content.type = 'post'
        and content.lang = ?
      group by content_tag.tag
      order by posts desc, content_tag.tag asc
    `,
    [lang],
  );
}

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
