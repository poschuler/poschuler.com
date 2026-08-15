import { BookmarkCheck, PenLine } from "lucide-react";
import { ListingRow } from "~/components/listing-row";
import { postHref } from "~/lib/hrefs";
import type { ContentRowType } from "~/models/content.server";

/**
 * One Content Item in a list — a Post or a Bookmark, the two kinds the model
 * has. Used by `/blog`, `/bookmarks`, `/timeline` and the home page.
 *
 * It was three components: `PostItem`, a `Bookmark` inside the bookmarks route
 * and a `ContentItem` inside the timeline route, all rendering the same
 * bordered block with the same date and the same link, and all carrying the
 * same two defects. `ContentRowType` is already the union of exactly these two
 * shapes, so one component narrowing on `type` covers every list on the site.
 *
 * The block itself now lives in `ListingRow`, shared with `SeriesItem`. What
 * stays here is what a Content Item decides: where it links and what its
 * metadata line says.
 *
 * **A Post does not always live under `/blog`.** A Part is served under its
 * Series, and `postHref` is the only place that reads the column which says so.
 */
export function ContentItem({
  item,
  headingLevel = "h2",
  showKind = false,
}: {
  item: ContentRowType;
  headingLevel?: "h2" | "h3";
  /**
   * The Timeline interleaves both kinds, so each row there says which it is.
   * On `/blog` and `/bookmarks` the page has already said it.
   */
  showKind?: boolean;
}) {
  return (
    <ListingRow
      headingLevel={headingLevel}
      title={item.title}
      href={item.type === "post" ? postHref(item) : item.externalUrl}
      external={item.type === "link"}
      icon={item.type === "post" ? PenLine : BookmarkCheck}
      meta={
        <>
          <time dateTime={item.publishedStringDate}>{item.publishedStringDate}</time>
          {item.type === "link" && <span>· {item.source}</span>}
          {showKind && <span>· {item.type === "post" ? "I wrote" : "I read"}</span>}
        </>
      }
    />
  );
}
