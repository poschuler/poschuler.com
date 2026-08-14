import { Link, useLoaderData, type MetaFunction } from "react-router";
import { findAllPosts } from "~/models/content.server";
import { findAllProjects } from "~/models/project.server";
import { PostItem } from "~/components/post-item";
import type { Route } from "./+types/_home";
import { cloudflareContext } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";

/**
 * Enough to show that the writing exists and is current, without turning the
 * landing page back into an index. `/blog` is one click away and holds the rest.
 */
const RECENT_POST_COUNT = 3;

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  // Newest first, straight from the query's `order by published_at desc`.
  const [posts, projects] = await Promise.all([
    findAllPosts(env.POSCHULER_BD),
    findAllProjects(env.POSCHULER_BD),
  ]);

  // Only the flagship. Three blocks would invite the visitor to compare a
  // product with users against the site they are already looking at — which
  // lifts neither and lowers the one that carries the weight.
  const flagship = projects.find((project) => project.tier === "flagship") ?? null;

  return {
    recentPosts: posts.slice(0, RECENT_POST_COUNT),
    flagship: flagship && {
      slug: flagship.slug,
      title: flagship.title,
      summary: flagship.summary,
      liveUrl: flagship.liveUrl,
    },
  };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

const CONTACT_LINKS = [
  { label: "poschuler@gmail.com", href: "mailto:poschuler@gmail.com" },
  { label: "GitHub", href: "https://github.com/poschuler" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/poschuler/" },
] as const;

/**
 * Tells a crawler that this page describes a *person*, and that the person is
 * the same one behind those profiles — otherwise the site, the GitHub account
 * and the LinkedIn profile are three pages that happen to share a name.
 *
 * `sameAs` is derived from the links the page already renders so the two cannot
 * drift; `mailto:` is not a profile and is dropped.
 */
const PERSON = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Paul Osorio Schuler",
  url: "https://poschuler.com",
  image: "https://poschuler.com/paul-osorio-schuler.webp",
  jobTitle: "Senior Backend Engineer",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Lima",
    addressCountry: "PE",
  },
  knowsAbout: [
    "TypeScript",
    "Node.js",
    "PostgreSQL",
    "OpenSearch",
    "Redis",
    "Software architecture",
  ],
  sameAs: CONTACT_LINKS.filter(({ href }) => !href.startsWith("mailto:")).map(
    ({ href }) => href,
  ),
};

const HOME_TITLE = "Paul Osorio Schuler | Senior Backend Engineer | TypeScript • Node.js";
const HOME_DESCRIPTION =
  "Senior backend engineer in Lima, Peru, with fifteen years in banking systems. I build and operate Chekalo.pe, a price intelligence platform in TypeScript and Node.js.";

export const meta: MetaFunction = () => {
  return [
    { title: HOME_TITLE },
    { name: "description", content: HOME_DESCRIPTION },
    { tagName: "link", rel: "canonical", href: "https://poschuler.com" },
    { property: "og:title", content: HOME_TITLE },
    { property: "og:description", content: HOME_DESCRIPTION },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://poschuler.com" },
    { "script:ld+json": PERSON },
  ];
};

export default function Home() {
  const { recentPosts, flagship } = useLoaderData<typeof loader>();

  return (
    <main className="flex flex-col min-h-[calc(100vh_-_theme(spacing.16))] flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="w-full max-w-[650px] mx-auto pt-4">
        <div className="mx-auto relative flex size-32 overflow-hidden rounded-full">
          {/* Local, not the GitHub avatar: this is the one image the page cannot
            * afford to have served by somebody else. */}
          <img
            src="/paul-osorio-schuler.webp"
            alt="Paul Osorio Schuler"
            width={128}
            height={128}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            Paul Osorio Schuler
          </h1>

          <p className="mt-2 text-lg text-low">
            Senior Backend Engineer — TypeScript · Node.js
          </p>

          {/* A fact about where the work happens, not a signal that he is
            * looking: the timezone is what a distributed team screens on. */}
          <p className="mt-1 text-sm text-low">Lima, Peru · UTC-5</p>
        </div>

        {/* Left-aligned on purpose: centred prose past one line is harder to
          * read, and this is the paragraph the visitor actually has to read. */}
        <div className="mt-8 space-y-4 text-low leading-relaxed">
          <p>
            I build and operate{" "}
            <ProseLink href="https://chekalo.pe">Chekalo.pe</ProseLink>
            , a price intelligence platform that ingests Peru&apos;s major
            retailers every day, resolves the same product across stores into a
            single canonical identity, and serves search and comparison from
            OpenSearch. TypeScript and Node.js throughout, structured as a
            modular monolith over PostgreSQL and Redis-backed work queues.
          </p>

          <p>
            Fifteen years in banking systems: solution architecture for
            enterprise orchestration and integration platforms.
          </p>
        </div>

        {/* A footer for the hero, not a sentence: smaller, quieter, and the
          * visual boundary between who he is and what he has written. */}
        <ul className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-low">
          {CONTACT_LINKS.map(({ label, href }, index) => (
            <li key={href} className="flex items-center gap-x-2">
              {index > 0 && <span aria-hidden="true">·</span>}
              <a
                className="transition-colors duration-200 hover:text-default"
                href={href}
                {...(href.startsWith("mailto:")
                  ? {}
                  : { target: "_blank", rel: "noreferrer" })}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* The hero asserts Chékalo in its first paragraph and asks to be
        * believed; this is where the assertion becomes something a reader can
        * check. Directly below it, for that reason. */}
      {flagship && (
        <section className="w-full max-w-[650px] mx-auto">
          <h2 className="text-lg font-semibold tracking-tight">What I build</h2>

          <article className="my-4 border-default border-l-2 py-4 px-4">
            <h3 className="flex flex-wrap items-baseline gap-x-3 text-base font-semibold">
              <Link to={`/projects/${flagship.slug}`} className="hover:text-default">
                {flagship.title}
              </Link>

              {flagship.liveUrl && (
                <a
                  className="text-sm font-normal text-low transition-colors duration-200 hover:text-default"
                  href={flagship.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {flagship.liveUrl.replace(/^https?:\/\//, "")}
                </a>
              )}
            </h3>

            <p className="mt-2 text-pretty text-sm text-low">{flagship.summary}</p>
          </article>

          <Link
            className="text-sm text-low transition-colors duration-200 hover:text-default"
            to="/projects"
          >
            All projects →
          </Link>
        </section>
      )}

      {/* The same column as the hero, so the page reads as one narrow strip
        * rather than a landing page with a wider index bolted underneath. */}
      <section className="w-full max-w-[650px] mx-auto">
        <h2 className="text-lg font-semibold tracking-tight">Recent writing</h2>

        {recentPosts.map((post) => (
          <PostItem key={post.idContent} post={post} />
        ))}

        <Link
          className="text-sm text-low transition-colors duration-200 hover:text-default"
          to="/blog"
        >
          All articles →
        </Link>
      </section>
    </main>
  );
}

/** An external link inside running text — underlined, because prose links that
  * only change colour are missed by anyone who is scanning. */
function ProseLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      className="text-default underline underline-offset-4"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );
}

