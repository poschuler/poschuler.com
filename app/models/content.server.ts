import { dbQuery, dbQueryRow } from "~/db.server";


export type ContentRowType = {
  idContent: number;
  slug: string;
  lang: string;
  type: string;
  title: string;
  publishedAt: string;
  publishedStringDate: string;
  description: string;
  externalUrl: string;
  source: string;
  tags: string[];
};

export async function findAllBookmarks(db: D1Database) {
  let queryResult = await dbQuery<ContentRowType>(
    db,
    ` select
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
      tags as "tags"
      from content
      where type = 'link'
      order by published_at desc
    `,
    null
  );
  return queryResult;
}

export async function findAllPosts(db: D1Database) {
  let queryResult = await dbQuery<ContentRowType>(
    db,
    ` select
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
      tags as "tags"
      from content
      where type = 'post'
      order by published_at desc
    `,
    null
  );
  return queryResult;
}

export async function findAll(db: D1Database) {
  let queryResult = await dbQuery<ContentRowType>(
    db,
    ` select
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
      tags as "tags"
      from content
      order by published_at desc
    `,
    null
  );
  return queryResult;
}