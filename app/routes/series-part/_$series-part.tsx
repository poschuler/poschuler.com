import { useLoaderData } from "react-router";
import { PostArticle } from "~/components/post-article";
import { cloudflareContext, localeContext } from "~/context";
import { formatPostDate } from "~/lib/dates";
import { postHref, seriesHref } from "~/lib/hrefs";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { validateRevisions } from "~/lib/revisions";
import { alternateLinks, documentAddresses } from "~/lib/seo/alternates";
import { blogPosting, breadcrumbList, siteCrumb } from "~/lib/seo/structured-data";
import { orientationFor } from "~/lib/series-arc";
import { findSeriesArc, findSeriesBySlug } from "~/models/series.server";
import type { Route } from "./+types/_$series-part";
import { PartNav, SectionIndex, SeriesBreadcrumb } from "./orientation";

interface PartAttributes {
  title: string;
  description: string;
  publishedAt: string;
  /** The subjects, as written. A Part's Tags are its own, not the Series'. */
  tags?: string[];
  repository?: string;
  /** Front matter as written; `validateRevisions` is what turns it into a list. */
  updates?: unknown;
}

interface PartPayload {
  attributes: PartAttributes;
  html: string;
}

/**
 * One Part of a Series.
 *
 * The body comes from the **`blog:` key space**, the same as any other Post:
 * the prefix says what kind of payload it is, not which URL serves it. A Part
 * is an ordinary Post that happens to have a Container.
 *
 * What the URL adds is the frame. The arc is read from D1 and the reader's
 * position is derived from it — the Part itself does not know where it sits
 * (ADR 0007), so a `partSlug` the arc does not hold is a 404 rather than an
 * article with an empty frame around it. That is also what stops
 * `/series/<any-series>/<any-part>` from serving a Part of some other Series.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const locale = context.get(localeContext);
  const series = await findSeriesBySlug(env.POSCHULER_BD, params.seriesSlug, locale);

  if (!series) {
    throw new Response("Not Found", { status: 404 });
  }

  const sections = await findSeriesArc(env.POSCHULER_BD, series.slug, series.lang);
  const orientation = orientationFor(sections, params.partSlug, series.status);

  if (!orientation) {
    throw new Response("Not Found", { status: 404 });
  }

  const payload = await env.BLOG_KV.get<PartPayload>(
    `blog:${params.partSlug}:${series.lang}`,
    {
      type: "json",
      // A Post body only changes when the seed pipeline runs, so let the colo
      // answer from its own cache instead of reaching KV's central store.
      cacheTtl: 3600,
    },
  );

  if (!payload) {
    throw new Response("Not Found", { status: 404 });
  }

  const { attributes, html } = payload;
  const revisions = validateRevisions(attributes.updates);

  return {
    slug: params.partSlug,
    seriesSlug: series.slug,
    seriesTitle: series.title,
    title: attributes.title,
    description: attributes.description,
    // Out of the payload above. This route reads the arc and never the content
    // row, so D1 would be a new query for what KV has just handed over.
    tags: attributes.tags ?? [],
    publishedAt: formatPostDate(attributes.publishedAt, series.lang),
    // The same date, unformatted. What a reader sees is written for their
    // locale; what a crawler is told has to stay `YYYY-MM-DD`.
    datePublished: attributes.publishedAt,
    locale: series.lang,
    // Read off `orientation.part`, via the correlated subquery `findSeriesArc`
    // now folds into the arc it already reads (Part 10 of
    // `evolution-plan/15-phase-3-spanish.md`) — the canonical's alternates,
    // without a second round trip. `?? []` only for the type: every row this
    // route reads is real, and carries one.
    existingLocales: orientation.part.locales ?? [],
    repository: attributes.repository,
    html,
    // A malformed list is caught at build time; a page is better off without
    // its revision line than not rendering at all.
    revisions: "revisions" in revisions ? revisions.revisions : [],
    orientation,
  };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export function meta({ loaderData }: Route.MetaArgs) {
  const {
    title,
    description,
    seriesSlug,
    seriesTitle,
    slug,
    locale,
    existingLocales,
    datePublished,
    revisions,
  } = loaderData;
  const identity = { kind: "post" as const, slug, seriesSlug };
  const addresses = documentAddresses(identity, locale, existingLocales);
  const { canonical } = addresses;
  const path = postHref(identity, locale);

  return [
    { title: `${title} | Paul Osorio Schuler` },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    ...alternateLinks(addresses),
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonical },
    {
      "script:ld+json": blogPosting({
        url: canonical,
        title,
        description,
        datePublished,
        // Newest first, guaranteed by `validateRevisions`.
        dateRevised: revisions[0]?.date,
        seriesSlug,
        locale,
      }),
    },
    // Home › Series › the Series › this Part — and **no Section**. A
    // `BreadcrumbList` describes the URLs that lead to a page, and a Section
    // has none. It appears in the visual breadcrumb above the article because
    // there it is context for a reader, not a claim about the site's structure.
    {
      "script:ld+json": breadcrumbList([
        siteCrumb("home", locale),
        siteCrumb("series", locale),
        { name: seriesTitle, path: seriesHref(seriesSlug, locale) },
        { name: title, path },
      ]),
    },
  ];
}

export default function SeriesPart() {
  const {
    slug,
    seriesSlug,
    seriesTitle,
    title,
    publishedAt,
    tags,
    repository,
    revisions,
    html,
    orientation,
  } = useLoaderData<typeof loader>();

  return (
    <main className="flex-1 gap-4 bg-ui p-4 font-mono md:gap-8 md:p-10">
      {/* Above the article, both of them: the reader who arrived from a search
        * engine has to learn what this is part of before reading it, not
        * twenty minutes later. */}
      <div className="mx-auto w-full max-w-measure pt-8">
        <SeriesBreadcrumb
          seriesSlug={seriesSlug}
          seriesTitle={seriesTitle}
          sectionTitle={orientation.section.title}
        />

        <SectionIndex
          seriesSlug={seriesSlug}
          section={orientation.section}
          currentSlug={slug}
        />
      </div>

      <PostArticle
        title={title}
        publishedAt={publishedAt}
        tags={tags}
        repository={repository}
        revisions={revisions}
        html={html}
      />

      {/* The contract is not repeated here. Starting point, Destination and
        * out-of-scope live on the landing, one link away: repeating them across
        * fifteen pages turns the one block that should be read carefully into
        * something readers learn to skip. */}
      <div className="mx-auto w-full max-w-measure pb-8">
        <PartNav
          seriesSlug={seriesSlug}
          seriesTitle={seriesTitle}
          orientation={orientation}
        />
      </div>
    </main>
  );
}
