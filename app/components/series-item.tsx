import { Library } from "lucide-react";
import { ListingRow } from "~/components/listing-row";
import { seriesHref } from "~/lib/hrefs";
import type { SeriesListingRowType } from "~/models/series.server";

/**
 * One Series in a list — on `/series`, and on `/blog` where a whole series is a
 * single entry among the loose Posts.
 *
 * It shares `ListingRow` with `ContentItem` and decides two things for itself:
 * it links to the landing, and its metadata line ends in a **size**. `3 parts`
 * is not a position and promises nothing about how many are coming — the
 * denominator a reader would infer from `Part 3 of 5` is the one claim this
 * design refuses to make anywhere.
 *
 * The date is the most recent Part's. A Series has none of its own: it is
 * revised in place, which is also why it never appears in the Timeline.
 */
export function SeriesItem({
  series,
  headingLevel = "h2",
  showKind = false,
  showDestination = false,
}: {
  series: SeriesListingRowType;
  headingLevel?: "h2" | "h3";
  /**
   * `/blog` interleaves series with loose Posts, so a row there says which it
   * is. On `/series` the heading has already said it.
   */
  showKind?: boolean;
  /**
   * Only on `/series`, whose question is *where does this take me*. On `/blog`
   * the row sits among sober Posts and stays as sober as they are.
   */
  showDestination?: boolean;
}) {
  const size =
    series.partCount === 0
      ? "no parts yet"
      : `${series.partCount} ${series.partCount === 1 ? "part" : "parts"}`;

  const facts = [
    series.publishedStringDate ? (
      <time key="date" dateTime={series.publishedStringDate}>
        {series.publishedStringDate}
      </time>
    ) : null,
    showKind ? <span key="kind">Series</span> : null,
    <span key="size">{size}</span>,
  ].filter(Boolean);

  return (
    <ListingRow
      headingLevel={headingLevel}
      title={series.title}
      href={seriesHref(series.slug, series.lang)}
      icon={Library}
      meta={facts.map((fact, index) => (
        // The separator belongs to the piece that follows it, so a Series with
        // no Parts published yet does not open its metadata line with a stray
        // middle dot.
        <span key={index} className="flex items-center gap-x-2">
          {index > 0 && <span aria-hidden="true">·</span>}
          {fact}
        </span>
      ))}
    >
      {showDestination && (
        <p className="mt-2 text-pretty text-low text-sm">{series.destination}</p>
      )}
    </ListingRow>
  );
}
