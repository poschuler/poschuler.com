import { BookmarkCheck, PenLine } from "lucide-react";
import { Link } from "react-router";
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
 * **The title leads and everything else follows it.** All three used to open
 * with the date at `text-base font-medium` in the default colour and put the
 * title under it, a size smaller, in `text-low` — which made the loudest thing
 * in the list the one word that tells a reader nothing. Date, source and kind
 * are metadata and read as metadata.
 */
export function ContentItem({
  item,
  headingLevel = "h2",
  showKind = false,
}: {
  item: ContentRowType;
  /**
   * The same item sits at two depths: the page's second level on an index, the
   * third on the home page under a "Recent writing" heading that is already an
   * `<h2>`. A list item cannot know which.
   */
  headingLevel?: "h2" | "h3";
  /**
   * The Timeline interleaves both kinds, so each row there says which it is.
   * On `/blog` and `/bookmarks` the page has already said it.
   */
  showKind?: boolean;
}) {
  const Heading = headingLevel;
  const Icon = item.type === "post" ? PenLine : BookmarkCheck;

  return (
    <article className="my-4 border-default border-l-2 py-4 pl-4">
      <Heading className="font-semibold text-lg">
        {item.type === "post" ? (
          <Link
            to={`/blog/${item.slug}`}
            className="transition-colors duration-200 hover:text-low"
          >
            {item.title}
          </Link>
        ) : (
          <a
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-200 hover:text-low"
          >
            {item.title}
          </a>
        )}
      </Heading>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-low text-sm">
        <Icon className="size-4 shrink-0" aria-hidden />
        <time dateTime={item.publishedStringDate}>
          {item.publishedStringDate}
        </time>
        {item.type === "link" && <span>· {item.source}</span>}
        {showKind && <span>· {item.type === "post" ? "I wrote" : "I read"}</span>}
      </p>
    </article>
  );
}
