import { Tag as TagIcon } from "lucide-react";
import { useLoaderData } from "react-router";
import { EmptyIndex } from "~/components/empty-index";
import { ListingRow } from "~/components/listing-row";
import { cloudflareContext, localeContext, LOCALES, useLocale } from "~/context";
import { useStrings } from "~/lib/catalog";
import { tagHref } from "~/lib/hrefs";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { alternateLinks, documentAddresses, emptyIndexRobots } from "~/lib/seo/alternates";
import { breadcrumbList, HOME_CRUMB } from "~/lib/seo/structured-data";
import { findTagsWithPostCounts, type TagCountRowType } from "~/models/tag.server";
import type { Route } from "./+types/_tags";

const TAGS_TITLE = "Tags | Paul Osorio Schuler";
const TAGS_DESCRIPTION =
  "Every subject Paul Osorio Schuler writes about, ordered by how much there is on each: Node.js, TypeScript, backend architecture and the rest.";

/**
 * The whole range of subjects this site covers, on one page.
 *
 * It also closes the namespace. Without it the bare path is a 404 in the middle
 * of a live address space — the first place a crawler goes after a Tag page, and
 * the only place a reader can ask *what else is there*. The precedent is
 * `/series`, built for a namespace holding one entry on the same grounds: an
 * index earns its place by closing the namespace, and the alternative was a
 * redirect with an expiry date nobody would remember.
 *
 * **Every entry goes somewhere real.** The list is what the content carries, not
 * what `app/content/tags.json` declares — twelve of the declared Tags sit on
 * Bookmarks alone today, and their pages are the 404 the route one level down
 * serves on purpose. An index that offered them would be a page of links whose
 * job is to be followed, half of which cannot be.
 *
 * Read straight down, the ordering is the point: heaviest first is a profile of
 * the subjects this site covers, which is the site's own tie-breaker for
 * whether a page earns its place.
 *
 * **Not in the header navigation.** Ten entries do not earn a permanent slot
 * beside four sections; the question is worth asking again when there are many
 * more Tags.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const locale = context.get(localeContext);
  const tags = await findTagsWithPostCounts(env.POSCHULER_BD, locale);

  return { tags, locale };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

/**
 * **No robots directive, deliberately — as long as it has something to say.**
 * Every individual Tag page declares `noindex, follow`, and this page is the
 * exception that makes that rule pay: it is the one document in the namespace
 * with something of its own to say — the shape of what this site writes about
 * — rather than a list of links to a single Post. It is also the only `/tags`
 * URL the sitemap advertises, and a sitemap must not advertise a page that
 * asks not to be indexed.
 *
 * A trail and nothing more, as on `/series`: an `ItemList` of the Tags here
 * would be a second description of pages that each already describe themselves
 * one click away — and those pages are `noindex`.
 *
 * **The exception has its own exception.** No Tag exists until a Post carries
 * it, so an empty-content Locale closes this namespace too — `/es/tags` today
 * — and the same rule every other index follows applies here as well: an
 * index with nothing to say declares `noindex, follow` rather than entering
 * the index thin (Part 6 of `evolution-plan/15-phase-3-spanish.md`).
 */
export const meta: Route.MetaFunction = ({ loaderData }) => {
  const addresses = documentAddresses({ kind: "index", path: "/tags" }, loaderData.locale, LOCALES);
  const { canonical } = addresses;

  return [
    { title: TAGS_TITLE },
    { name: "description", content: TAGS_DESCRIPTION },
    { tagName: "link", rel: "canonical", href: canonical },
    ...alternateLinks(addresses),
    { property: "og:title", content: TAGS_TITLE },
    { property: "og:description", content: TAGS_DESCRIPTION },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    {
      "script:ld+json": breadcrumbList([HOME_CRUMB, { name: "Tags", path: "/tags" }]),
    },
    ...emptyIndexRobots(loaderData.tags.length === 0),
  ];
};

/**
 * One Tag in the list.
 *
 * The site's own listing row, which is what keeps this page readable as a list
 * rather than as a fourth layout: the Tag leads the way a title leads
 * everywhere else, and the count reads as metadata under it, where a date reads
 * on every other index.
 *
 * The count is the whole metadata line. It is what a reader judges the click on
 * — one Post is a different proposition from four — and it is the number the
 * page behind the link has to hold.
 */
function TagRow({ tag, posts }: TagCountRowType) {
  const locale = useLocale();
  const strings = useStrings();

  return (
    <ListingRow
      title={tag}
      href={tagHref(tag, locale)}
      icon={TagIcon}
      meta={<span>{strings.tags.posts(posts)}</span>}
    />
  );
}

export default function Tags() {
  const { tags } = useLoaderData<typeof loader>();
  const strings = useStrings();

  return (
    <main className="flex flex-1 flex-col gap-4 bg-ui p-4 font-mono md:gap-8 md:p-10">
      <section className="w-full">
        <div className="text-center">
          <h1 className="mt-8 scroll-m-20 font-semibold text-3xl tracking-tight lg:text-4xl">
            {strings.tags.heading}
          </h1>
        </div>

        <div className="mx-auto max-w-[450px]">
          <blockquote className="mt-2 text-center text-lg text-low italic">
            {strings.tags.subtitle}
          </blockquote>
        </div>
      </section>

      {tags.length === 0 ? (
        <EmptyIndex englishHref="/tags" />
      ) : (
        <section className="mx-auto w-full max-w-measure">
          {tags.map((one) => (
            <TagRow key={one.tag} tag={one.tag} posts={one.posts} />
          ))}
        </section>
      )}
    </main>
  );
}
