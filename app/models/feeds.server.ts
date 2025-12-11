import { dbQuery } from "~/db.server";

export type FeedRowType = {
  idFeed: number;
  content: string;
  stringDate: string;
};

export async function findAllFeeds() {
  let queryResult = await dbQuery<FeedRowType>(
    `select
      id_feed as "idFeed",
      content as "content",
      TO_CHAR(date, 'YYYY-MM-DD') as "stringDate"
      from feeds
      order by date desc
    `,
    null
  );

  return queryResult;
}
