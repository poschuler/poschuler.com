import { useLoaderData } from "react-router";
import { findLoosePosts, type PostRowType } from "~/models/content.server";
import { findProjectsWithNotes, type ProjectListingRowType } from "~/models/project.server";
import { ContentItem } from "~/components/content-item";
import { EmptyIndex } from "~/components/empty-index";
import { ProjectItem } from "~/components/project-item";
import type { Route } from "./+types/_blog";
import { cloudflareContext, localeContext, LOCALES } from "~/context";
import { useStrings } from "~/lib/catalog";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { alternateLinks, documentAddresses, emptyIndexRobots } from "~/lib/seo/alternates";

/** One row on this page: a loose Post, or a whole Project as a single entry. */
type BlogEntry =
  | { kind: "post"; post: PostRowType }
  | { kind: "project"; project: ProjectListingRowType };

/**
 * `/blog` answers *what has this person written*, and a Project's Field Notes
 * are one thing written — not fifteen. It lists **a Post with no Container, or
 * a Project that holds Field Notes** — loose Posts, plus each Project with at
 * least one published Field Note, as a single entry linking to its landing.
 * Publishing a new Field Note updates a row here instead of lengthening the
 * page.
 *
 * The alternative — loose Posts only, with Projects exclusively at their own
 * index — is cleaner as a model and worse as a site: this page would hold one
 * row while most of the writing lived elsewhere, and `/blog` is the address a
 * reader guesses.
 *
 * A Project has no Published At of its own, so it sorts by its **most recent**
 * Field Note: its first note would sink an actively-written Project to the
 * bottom. A Project with no published notes is left out entirely, and
 * `/projects` answers what exists — `findProjectsWithNotes` excludes it by
 * construction, so nothing changes on this page until the first note
 * publishes.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const locale = context.get(localeContext);
  const [posts, projects] = await Promise.all([
    findLoosePosts(env.POSCHULER_BD, locale),
    findProjectsWithNotes(env.POSCHULER_BD, locale),
  ]);

  const entries: BlogEntry[] = [
    ...posts.map((post): BlogEntry => ({ kind: "post", post })),
    ...projects.map((project): BlogEntry => ({ kind: "project", project })),
  ];

  const dateOf = (entry: BlogEntry) => {
    if (entry.kind === "post") return entry.post.publishedAt;
    return entry.project.publishedAt;
  };

  entries.sort((left, right) => dateOf(right).localeCompare(dateOf(left)));

  return { entries, locale };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const addresses = documentAddresses({ kind: "index", path: "/blog" }, loaderData.locale, LOCALES);
  const { canonical } = addresses;

  return [
    { title: "Blog | Paul Osorio Schuler" },
    { name: "description", content: "Long-form articles by Paul Osorio Schuler on building backend systems with Node.js and TypeScript: API structure, domain-driven design and software architecture." },
    { tagName: "link", rel: "canonical", href: canonical },
    ...alternateLinks(addresses),
    { property: "og:title", content: "Blog | Paul Osorio Schuler" },
    { property: "og:description", content: "Long-form articles by Paul Osorio Schuler on building backend systems with Node.js and TypeScript: API structure, domain-driven design and software architecture." },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    ...emptyIndexRobots(loaderData.entries.length === 0),
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

      {entries.length === 0 ? (
        <EmptyIndex englishHref="/blog" />
      ) : (
        /* `ProjectItem` always says its own kind: this list interleaves two
         * units, so a row that is a whole Project has to say so before the
         * reader clicks it expecting one article. */
        <section className="mx-auto w-full max-w-measure">
          {entries.map((entry) => {
            if (entry.kind === "post") {
              return <ContentItem key={`post:${entry.post.idContent}`} item={entry.post} />;
            }

            return <ProjectItem key={`project:${entry.project.idProject}`} project={entry.project} />;
          })}
        </section>
      )}
    </main>
  );
}
