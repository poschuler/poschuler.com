import { useLoaderData, type MetaFunction } from "react-router";
import { findLoosePosts, type PostRowType } from "~/models/content.server";
import { findAllSeries, type SeriesListingRowType } from "~/models/series.server";
import { ContentItem } from "~/components/content-item";
import { SeriesItem } from "~/components/series-item";
import type { Route } from "./+types/_blog";
import { cloudflareContext } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";

/** One row on this page: a loose Post, or a whole Series as a single entry. */
type BlogEntry =
  | { kind: "post"; post: PostRowType }
  | { kind: "series"; series: SeriesListingRowType };

/**
 * `/blog` answers *what has this person written*, and a series is one thing
 * written — not fifteen. So it lists **loose Posts plus each Series as a single
 * entry**, linking to its landing. Publishing part nine updates a row here
 * instead of lengthening the page.
 *
 * The alternative — loose Posts only, with series exclusively at `/series` — is
 * cleaner as a model and worse as a site: this page would hold one row while
 * most of the writing lived elsewhere, and `/blog` is the address a reader
 * guesses.
 *
 * A Series has no Published At, so it sorts by its **most recent** Part. Its
 * first would sink an actively-written series to the bottom. One with nothing
 * published yet is left out entirely: it is announced, not written, and
 * `/series` is the page that answers what is running.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const [posts, series] = await Promise.all([
    findLoosePosts(env.POSCHULER_BD),
    findAllSeries(env.POSCHULER_BD),
  ]);

  const entries: BlogEntry[] = [
    ...posts.map((post): BlogEntry => ({ kind: "post", post })),
    ...series
      .filter((one) => one.publishedAt !== null)
      .map((one): BlogEntry => ({ kind: "series", series: one })),
  ];

  const dateOf = (entry: BlogEntry) =>
    entry.kind === "post" ? entry.post.publishedAt : (entry.series.publishedAt ?? "");

  entries.sort((left, right) => dateOf(right).localeCompare(dateOf(left)));

  return { entries };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export const meta: MetaFunction = () => {
  return [
    { title: "Blog | Paul Osorio Schuler" },
    { name: "description", content: "Long-form articles by Paul Osorio Schuler on building backend systems with Node.js and TypeScript: API structure, domain-driven design and software architecture." },
    { tagName: "link", rel: "canonical", href: "https://poschuler.com/blog" },
    { property: "og:title", content: "Blog | Paul Osorio Schuler" },
    { property: "og:description", content: "Long-form articles by Paul Osorio Schuler on building backend systems with Node.js and TypeScript: API structure, domain-driven design and software architecture." },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://poschuler.com/blog" },
  ];
};

export default function Blog() {
  const { entries } = useLoaderData<typeof loader>();

  return (
    <main className="flex flex-col flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="w-full">

        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            Articles
          </h1>
        </div>

        <div className="max-w-[450px] mx-auto">
          <blockquote className="text-center mt-2 italic text-low text-lg">
            My articles on topics I care about
          </blockquote>
        </div>
      </section>

      {/* `showKind` on the Series rows: this list interleaves two units, so a
        * row that is a whole series has to say so before the reader clicks it
        * expecting one article. */}
      <section className="mx-auto w-full max-w-measure">
        {entries.map((entry) =>
          entry.kind === "post" ? (
            <ContentItem key={`post:${entry.post.idContent}`} item={entry.post} />
          ) : (
            <SeriesItem key={`series:${entry.series.idSeries}`} series={entry.series} showKind />
          ),
        )}
      </section>
    </main>
  );
}
