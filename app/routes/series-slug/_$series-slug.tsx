import { Link, useLoaderData } from "react-router";
import { chip } from "~/components/chip";
import { cloudflareContext } from "~/context";
import { postHref } from "~/lib/hrefs";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { breadcrumbList, creativeWorkSeries, HOME_CRUMB } from "~/lib/seo/structured-data";
import { readingOrder, type ArcSection } from "~/lib/series-arc";
import { cn } from "~/lib/utils";
import { findSeriesArc, findSeriesBySlug } from "~/models/series.server";
import type { Route } from "./+types/_$series-slug";

const SITE = "https://poschuler.com";

interface SeriesBodyPayload {
  html: string;
}

/**
 * The Series landing: the contract, the prose, and the whole arc.
 *
 * Three reads, and each is the right store for what it holds. The row carries
 * the contract — the four statements a reader needs before deciding whether the
 * series is for them. The arc is a query, because ordering and grouping are
 * what SQL is for. The body is a large immutable blob served by exact key,
 * which is KV's job.
 *
 * Its own prefix, `series:`, because the landing is not a Post: the prefix says
 * what kind of payload it is.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const series = await findSeriesBySlug(env.POSCHULER_BD, params.seriesSlug);

  if (!series) {
    throw new Response("Not Found", { status: 404 });
  }

  const [sections, body] = await Promise.all([
    findSeriesArc(env.POSCHULER_BD, series.slug, series.lang),
    env.BLOG_KV.get<SeriesBodyPayload>(`series:${series.slug}:${series.lang}`, {
      type: "json",
      // The body only changes when the seed pipeline runs, so let the colo
      // answer from its own cache instead of reaching KV's central store.
      cacheTtl: 3600,
    }),
  ]);

  if (!body) {
    throw new Response("Not Found", { status: 404 });
  }

  return {
    slug: series.slug,
    title: series.title,
    description: series.description ?? series.destination,
    status: series.status,
    startingPoint: series.startingPoint,
    destination: series.destination,
    outOfScope: series.outOfScope,
    audience: series.audience,
    sections,
    html: body.html,
  };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export function meta({ loaderData }: Route.MetaArgs) {
  const { title, description, slug, sections } = loaderData;
  const pageTitle = `${title} | Paul Osorio Schuler`;

  return [
    { title: pageTitle },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: `${SITE}/series/${slug}` },
    { property: "og:title", content: pageTitle },
    { property: "og:description", content: description },
    { property: "og:image", content: `${SITE}/og.png` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: `${SITE}/series/${slug}` },
    {
      "script:ld+json": creativeWorkSeries({
        slug,
        title,
        description,
        // The arc flattened into reading order — which is the order that makes
        // a position mean anything. A planned Section contributes nothing,
        // because it holds nothing to contribute.
        parts: readingOrder(sections).map(({ part }) => ({
          slug: part.slug,
          title: part.title,
        })),
      }),
    },
    {
      "script:ld+json": breadcrumbList([
        HOME_CRUMB,
        { name: "Series", path: "/series" },
        { name: title, path: `/series/${slug}` },
      ]),
    },
  ];
}

/**
 * What a section's state is called, derived from what it holds.
 *
 * Only *complete* is stored: a section with no Parts is planned and a section
 * with Parts is in progress, and declaring either would restore two sources of
 * truth free to disagree (ADR 0007).
 */
function sectionState(section: ArcSection): "Complete" | "In progress" | "Planned" {
  if (section.status === "complete") {
    return "Complete";
  }

  return section.parts.length > 0 ? "In progress" : "Planned";
}

/**
 * One section of the arc.
 *
 * A planned section shows its title and summary and **does not enumerate
 * anything** — there is nothing to enumerate, which is the whole point: the arc
 * stays fully visible while the empty checkboxes never appear.
 */
function Section({ seriesSlug, section }: { seriesSlug: string; section: ArcSection }) {
  return (
    <article className="my-6 border-default border-l-2 py-3 pl-4">
      <h3 className="flex flex-wrap items-baseline gap-x-3 font-semibold text-lg">
        {section.title}
        <span className={chip}>{sectionState(section)}</span>
      </h3>

      <p className="mt-2 text-pretty text-low text-sm">{section.summary}</p>

      {section.parts.length > 0 && (
        <ol className="mt-3 space-y-2">
          {section.parts.map((part) => (
            <li key={part.slug} className="flex flex-wrap items-baseline gap-x-3">
              <Link
                to={postHref({ slug: part.slug, seriesSlug })}
                className="transition-colors duration-200 hover:text-low"
              >
                {part.title}
              </Link>
              <time className="text-low text-xs" dateTime={part.publishedStringDate}>
                {part.publishedStringDate}
              </time>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export default function SeriesLanding() {
  const {
    slug,
    title,
    status,
    startingPoint,
    destination,
    outOfScope,
    audience,
    sections,
    html,
  } = useLoaderData<typeof loader>();

  return (
    <main className="flex-1 gap-4 bg-ui p-4 font-mono md:gap-8 md:p-10">
      <article className="prose mx-auto py-8">
        <h1 className="mb-2">{title}</h1>

        <p className={cn(chip, "not-prose")}>
          {status === "complete" ? "Complete" : "Ongoing"}
        </p>

        {/* The contract, before anything else on the page. Almost nobody states
          * where a series stops, and it generates more trust than any other
          * line here: it says the author knows where the edges are. The
          * Destination in particular is immutable — changing it mid-series
          * breaks the promise the reader signed up for. */}
        <dl className="not-prose my-8 space-y-5 border-default border-l-2 py-4 pl-4">
          <div>
            <dt className="font-semibold text-sm">You start with</dt>
            <dd className="mt-1 text-pretty text-low">{startingPoint}</dd>
          </div>

          <div>
            <dt className="font-semibold text-sm">You end up with</dt>
            <dd className="mt-1 text-pretty text-low">{destination}</dd>
          </div>

          <div>
            <dt className="font-semibold text-sm">Not covered</dt>
            <dd className="mt-1 text-low">
              <ul className="space-y-1">
                {outOfScope.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-sm">Who it is for</dt>
            <dd className="mt-1 text-pretty text-low">{audience}</dd>
          </div>
        </dl>

        <hr className="mt-7 mb-7" />
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>

      <section className="mx-auto w-full max-w-measure pb-8">
        <h2 className="font-semibold text-xl tracking-tight">The arc</h2>

        {sections.map((section) => (
          <Section key={section.slug} seriesSlug={slug} section={section} />
        ))}

        {/* The promise, spelled out where the arc ends: what *complete* would
          * mean here is reaching the Destination above, not a part count. */}
        <p className="mt-6 text-low text-sm">
          {status === "complete"
            ? "This series is complete: it reaches the destination above."
            : "This series is ongoing. It is finished when it reaches the destination above — however many parts that takes."}
        </p>
      </section>
    </main>
  );
}
