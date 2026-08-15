import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";

/**
 * One row in a list: the bordered block, the title that leads it, and the grey
 * metadata line under it.
 *
 * This is the shape the whole site lists in — `/blog`, `/bookmarks`,
 * `/timeline`, the home page and now `/series`. What the rows do *not* share is
 * what goes in them: a Content Item links to a Post or out to a Source, a
 * Series links to its landing and counts its Parts. Those decisions belong to
 * `ContentItem` and `SeriesItem`; this holds the part that must not drift.
 *
 * Extracted rather than copied, on the evidence: this block already existed
 * three times as `PostItem`, a `Bookmark` inside the bookmarks route and a
 * `ContentItem` inside the timeline route, all carrying the same two defects —
 * and the site's chip was written out six times and had drifted in three
 * directions by the time anyone collected it. A Series is not a Content Item
 * (`CONTEXT.md` is careful about that), so it cannot be a third branch of
 * `ContentItem`; sharing the markup is the alternative to a fourth copy.
 *
 * **The title leads and everything else follows it.** Date, source and kind are
 * metadata and read as metadata.
 */
export function ListingRow({
  title,
  href,
  external = false,
  icon: Icon,
  meta,
  children,
  headingLevel = "h2",
}: {
  title: string;
  href: string;
  /** An external destination opens in a new tab and is not a router link. */
  external?: boolean;
  icon: LucideIcon;
  /** The grey line under the title, after the icon. Separators included. */
  meta: React.ReactNode;
  /** An extra line below the metadata, where a list needs one. */
  children?: React.ReactNode;
  /**
   * The same row sits at two depths: the page's second level on an index, the
   * third on the home page under a "Recent writing" heading that is already an
   * `<h2>`. A list item cannot know which.
   */
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const linkClassName = "transition-colors duration-200 hover:text-low";

  return (
    <article className="my-4 border-default border-l-2 py-4 pl-4">
      <Heading className="font-semibold text-lg">
        {external ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
            {title}
          </a>
        ) : (
          <Link to={href} className={linkClassName}>
            {title}
          </Link>
        )}
      </Heading>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-low text-sm">
        <Icon className="size-4 shrink-0" aria-hidden />
        {meta}
      </p>

      {children}
    </article>
  );
}
