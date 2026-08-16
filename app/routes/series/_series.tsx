import { useLoaderData, type MetaFunction } from "react-router";
import { SeriesItem } from "~/components/series-item";
import { cloudflareContext, localeContext } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { breadcrumbList, HOME_CRUMB } from "~/lib/seo/structured-data";
import { findAllSeries } from "~/models/series.server";
import type { Route } from "./+types/_series";

const SITE = "https://poschuler.com";

const SERIES_TITLE = "Series | Paul Osorio Schuler";
const SERIES_DESCRIPTION =
  "The multi-part series Paul Osorio Schuler is writing on backend engineering: what each one assumes, where it takes you, and how far along it is.";

/**
 * The index of what is running.
 *
 * Built now rather than deferred, with one series to list. The alternative was
 * a temporary redirect to the landing with an expiry date nobody would
 * remember; building it closes the `/series` namespace in a single move and
 * leaves no debt behind.
 *
 * Every Series appears, including one whose sections are all still planned:
 * this page's question is *what is running*, and something announced with
 * nothing published yet is an answer to it. `/blog` is where that one is
 * silent, because that page lists what has been written.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const locale = context.get(localeContext);
  const series = await findAllSeries(env.POSCHULER_BD, locale);

  return { series };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export const meta: MetaFunction = () => {
  return [
    { title: SERIES_TITLE },
    { name: "description", content: SERIES_DESCRIPTION },
    { tagName: "link", rel: "canonical", href: `${SITE}/series` },
    { property: "og:title", content: SERIES_TITLE },
    { property: "og:description", content: SERIES_DESCRIPTION },
    { property: "og:image", content: `${SITE}/og.png` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: `${SITE}/series` },
    // An index, so a trail and nothing more. Emitting an `ItemList` of the
    // series here would be a second description of documents that each already
    // describe themselves one click away.
    {
      "script:ld+json": breadcrumbList([HOME_CRUMB, { name: "Series", path: "/series" }]),
    },
  ];
};

export default function Series() {
  const { series } = useLoaderData<typeof loader>();

  return (
    <main className="flex flex-1 flex-col gap-4 bg-ui p-4 font-mono md:gap-8 md:p-10">
      <section className="w-full">
        <div className="text-center">
          <h1 className="mt-8 scroll-m-20 font-semibold text-3xl tracking-tight lg:text-4xl">
            Series
          </h1>
        </div>

        <div className="mx-auto max-w-[450px]">
          <blockquote className="mt-2 text-center text-lg text-low italic">
            Subjects worked through in order, rather than one article at a time
          </blockquote>
        </div>
      </section>

      {/* The Destination only here: this page's question is *where does this
        * take me*, and it is the one line that answers it before a click. */}
      <section className="mx-auto w-full max-w-measure">
        {series.map((one) => (
          <SeriesItem key={one.idSeries} series={one} showDestination />
        ))}
      </section>
    </main>
  );
}
