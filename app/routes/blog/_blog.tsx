import { useLoaderData } from "react-router";
import { findLoosePosts, type PostRowType } from "~/models/content.server";
import { findAllSeries, type SeriesListingRowType } from "~/models/series.server";
import { findProjectsWithNotes, type ProjectListingRowType } from "~/models/project.server";
import { ContentItem } from "~/components/content-item";
import { SeriesItem } from "~/components/series-item";
import { ProjectItem } from "~/components/project-item";
import type { Route } from "./+types/_blog";
import { cloudflareContext, localeContext, LOCALES } from "~/context";
import { useStrings } from "~/lib/catalog";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { documentAddresses } from "~/lib/seo/alternates";

/** One row on this page: a loose Post, or a whole Container — Series or Project — as a single entry. */
type BlogEntry =
  | { kind: "post"; post: PostRowType }
  | { kind: "series"; series: SeriesListingRowType }
  | { kind: "project"; project: ProjectListingRowType };

/**
 * `/blog` answers *what has this person written*, and a Container is one thing
 * written — not fifteen. The rule generalises rather than gaining an exception
 * for a Project: it lists **a Post with no Container, or a Container that holds
 * Posts** — loose Posts, plus each Series and each Project with at least one
 * published Field Note, all as single entries linking to their landing.
 * Publishing part nine, or a new Field Note, updates a row here instead of
 * lengthening the page.
 *
 * The alternative — loose Posts only, with Series and Projects exclusively at
 * their own indexes — is cleaner as a model and worse as a site: this page
 * would hold one row while most of the writing lived elsewhere, and `/blog` is
 * the address a reader guesses.
 *
 * Neither Container has a Published At of its own, so each sorts by its **most
 * recent** child. A Series' first Part would sink an actively-written series to
 * the bottom; the same is true of a Project's first note. A Series with nothing
 * published yet is left out entirely (`/series` answers what is running); a
 * Project with no published notes is left out the same way, and `/projects`
 * answers what exists — `findProjectsWithNotes` excludes it by construction, so
 * nothing changes on this page until the first note publishes.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const locale = context.get(localeContext);
  const [posts, series, projects] = await Promise.all([
    findLoosePosts(env.POSCHULER_BD, locale),
    findAllSeries(env.POSCHULER_BD, locale),
    findProjectsWithNotes(env.POSCHULER_BD, locale),
  ]);

  const entries: BlogEntry[] = [
    ...posts.map((post): BlogEntry => ({ kind: "post", post })),
    ...series
      .filter((one) => one.publishedAt !== null)
      .map((one): BlogEntry => ({ kind: "series", series: one })),
    ...projects.map((project): BlogEntry => ({ kind: "project", project })),
  ];

  const dateOf = (entry: BlogEntry) => {
    if (entry.kind === "post") return entry.post.publishedAt;
    if (entry.kind === "series") return entry.series.publishedAt ?? "";
    return entry.project.publishedAt;
  };

  entries.sort((left, right) => dateOf(right).localeCompare(dateOf(left)));

  return { entries, locale };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const { canonical } = documentAddresses({ kind: "index", path: "/blog" }, loaderData.locale, LOCALES);

  return [
    { title: "Blog | Paul Osorio Schuler" },
    { name: "description", content: "Long-form articles by Paul Osorio Schuler on building backend systems with Node.js and TypeScript: API structure, domain-driven design and software architecture." },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: "Blog | Paul Osorio Schuler" },
    { property: "og:description", content: "Long-form articles by Paul Osorio Schuler on building backend systems with Node.js and TypeScript: API structure, domain-driven design and software architecture." },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
};

export default function Blog() {
  const { entries } = useLoaderData<typeof loader>();
  const strings = useStrings();

  return (
    <main className="flex flex-col flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="w-full">

        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            {strings.blog.heading}
          </h1>
        </div>

        <div className="max-w-[450px] mx-auto">
          <blockquote className="text-center mt-2 italic text-low text-lg">
            {strings.blog.subtitle}
          </blockquote>
        </div>
      </section>

      {/* `showKind` on the Series rows, and `ProjectItem` always says its own:
        * this list interleaves three units, so a row that is a whole
        * Container has to say so before the reader clicks it expecting one
        * article. */}
      <section className="mx-auto w-full max-w-measure">
        {entries.map((entry) => {
          if (entry.kind === "post") {
            return <ContentItem key={`post:${entry.post.idContent}`} item={entry.post} />;
          }

          if (entry.kind === "series") {
            return (
              <SeriesItem key={`series:${entry.series.idSeries}`} series={entry.series} showKind />
            );
          }

          return <ProjectItem key={`project:${entry.project.idProject}`} project={entry.project} />;
        })}
      </section>
    </main>
  );
}
