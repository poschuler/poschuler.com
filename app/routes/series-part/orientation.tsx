import { Link } from "react-router";
import { postHref, seriesHref } from "~/lib/hrefs";
import type { ArcSection, Orientation, PartLink } from "~/lib/series-arc";

/**
 * What surrounds a Part: where it sits, what came before, what comes after.
 *
 * **There are no numbers here, and that is the design.** "Part 1 of 5" would
 * need a datum nobody has — the manifest lists Parts that exist, so nothing
 * knows Fundamentals will reach five — and "Part 3 of 3" is available and worse
 * than nothing: in a section still being written it tells the reader they have
 * reached the end, and they have not.
 *
 * The list of titles answers the three questions a reader arriving from a
 * search engine actually has — *what is this part of*, *should I have read
 * something first*, *is it worth going on* — and a number answers none of them.
 * It also cannot lie: it shows what exists and grows only when something is
 * published.
 */

const linkClassName = "transition-colors duration-200 hover:text-default";

/**
 * `/series` is reached from here rather than from the nav. A seventh nav entry
 * pointing at a subset of the one beside it is not worth the width.
 */
export function SeriesBreadcrumb({
  seriesSlug,
  seriesTitle,
  sectionTitle,
}: {
  seriesSlug: string;
  seriesTitle: string;
  sectionTitle: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-low text-sm">
      <ol className="flex flex-wrap items-center gap-x-2">
        <li>
          <Link to="/series" className={linkClassName}>
            Series
          </Link>
        </li>
        <li aria-hidden="true">›</li>
        <li>
          <Link to={seriesHref(seriesSlug)} className={linkClassName}>
            {seriesTitle}
          </Link>
        </li>
        <li aria-hidden="true">›</li>
        {/* No `aria-current="page"`. A Section has no address — which is why
          * it is left out of the `BreadcrumbList` entirely — so announcing it
          * as the current page tells a screen reader the reader is on a thing
          * that cannot be visited. Here it is context for a human, and the
          * page it labels is the article below. */}
        <li>{sectionTitle}</li>
      </ol>
    </nav>
  );
}

/**
 * The reader's own section, above the article.
 *
 * Above rather than below, deliberately: someone who landed on part three
 * without reading part one needs to know before reading, not after twenty
 * minutes. Compact — one section, not the whole series.
 */
export function SectionIndex({
  seriesSlug,
  section,
  currentSlug,
}: {
  seriesSlug: string;
  section: ArcSection;
  currentSlug: string;
}) {
  return (
    <nav aria-label={`${section.title} — the parts published so far`} className="mt-4">
      <ol className="space-y-1 text-sm">
        {section.parts.map((part) => {
          const isCurrent = part.slug === currentSlug;

          return (
            <li key={part.slug} className="flex items-baseline gap-x-2">
              <span aria-hidden="true" className="text-low">
                {isCurrent ? "●" : "○"}
              </span>

              {isCurrent ? (
                <span aria-current="page">
                  {part.title}
                  <span className="ml-2 text-low text-xs">— you are here</span>
                </span>
              ) : (
                <Link
                  to={postHref({ slug: part.slug, seriesSlug })}
                  className={`text-low ${linkClassName}`}
                >
                  {part.title}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A neighbour, with its section named only when the move crosses one. */
function Neighbour({
  seriesSlug,
  link,
  direction,
}: {
  seriesSlug: string;
  link: PartLink;
  direction: "previous" | "next";
}) {
  return (
    <Link
      to={postHref({ slug: link.part.slug, seriesSlug })}
      rel={direction === "previous" ? "prev" : "next"}
      className={`flex items-baseline gap-x-2 text-low ${linkClassName}`}
    >
      <span aria-hidden="true">{direction === "previous" ? "←" : "→"}</span>
      <span>
        {link.sectionTitle && <span className="text-xs">{link.sectionTitle} · </span>}
        {link.part.title}
      </span>
    </Link>
  );
}

/**
 * Previous and next, with **real titles**: `Next →` alone forces a click to
 * find out whether it is interesting.
 *
 * The block below them is the one that matters. The reader hits an empty `next`
 * exactly when they are most engaged, and what fills that slot is the
 * difference between a series in progress and one that was abandoned. It costs
 * nothing to say: the planned section's summary is already in the manifest,
 * because the landing needs it.
 */
export function PartNav({
  seriesSlug,
  seriesTitle,
  orientation,
}: {
  seriesSlug: string;
  seriesTitle: string;
  orientation: Orientation;
}) {
  const { previous, next, section, nextUp, endOfSeries } = orientation;

  return (
    <nav aria-label="Where to go next" className="mt-8 space-y-4 border-default border-t pt-6">
      {previous ? (
        <Neighbour seriesSlug={seriesSlug} link={previous} direction="previous" />
      ) : (
        // The first Part of the Series has no previous, and that slot is worth
        // more as the way up than as a blank: start here, the full arc.
        <Link to={seriesHref(seriesSlug)} className={`flex gap-x-2 text-low ${linkClassName}`}>
          <span aria-hidden="true">←</span>
          <span>{seriesTitle} — start here</span>
        </Link>
      )}

      {next && <Neighbour seriesSlug={seriesSlug} link={next} direction="next" />}

      {!next && (
        <div className="text-low text-sm">
          <p>
            {endOfSeries
              ? "That is the end of the series."
              : `That is the end of ${section.title}.`}
          </p>

          {nextUp && (
            <div className="mt-3">
              <p className="font-semibold">Next up · {nextUp.title}</p>
              <p className="mt-1 text-pretty">{nextUp.summary}</p>
            </div>
          )}
        </div>
      )}

      {/* Not rendered when the slot above is already this link — on the first
        * Part of the Series, the way back and the way to the arc are the same
        * page. */}
      {previous !== null && (
        <Link to={seriesHref(seriesSlug)} className={`block text-low text-sm ${linkClassName}`}>
          See the full arc →
        </Link>
      )}
    </nav>
  );
}
