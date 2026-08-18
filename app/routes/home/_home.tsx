import { Link, useLoaderData } from "react-router";
import { findAllPosts } from "~/models/content.server";
import { findAllProjects } from "~/models/project.server";
import { LiveLink } from "~/components/live-link";
import { ContentItem } from "~/components/content-item";
import type { Route } from "./+types/_home";
import { cloudflareContext, type Locale, localeContext, LOCALES } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { CONTACT_LINKS, LOCATION } from "~/lib/contact";
import { useStrings } from "~/lib/catalog";
import { projectHref, withLocale } from "~/lib/hrefs";
import { alternateLinks, documentAddresses } from "~/lib/seo/alternates";
import { PERSON_CORE } from "~/lib/seo/person";
import { HOME_BIO, HOME_TITLE, OG_IMAGE_ALT, ROLE } from "./bio";

/**
 * Enough to show that the writing exists and is current, without turning the
 * landing page back into an index. `/blog` is one click away and holds the rest.
 */
const RECENT_POST_COUNT = 3;

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const locale = context.get(localeContext);
  // Newest first, straight from the query's `order by published_at desc`.
  const [posts, projects] = await Promise.all([
    findAllPosts(env.POSCHULER_BD, locale),
    findAllProjects(env.POSCHULER_BD, locale),
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
    locale,
  };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;


/**
 * Tells a crawler that this page describes a *person*, and that the person is
 * the same one behind those profiles — otherwise the site, the GitHub account
 * and the LinkedIn profile are three pages that happen to share a name.
 *
 * The identity comes from `PERSON_CORE`, which carries the `@id` every article
 * and the Resume also point at. What is added here is what he works on: the
 * credentials belong on the Resume, and a second copy of them would be a second
 * thing to keep in step.
 *
 * `knowsAbout` is the page's own Locale's, so a Spanish reader and a Spanish
 * crawler are told the same thing. Built inside `meta()` rather than as a
 * module constant for that reason: it is no longer one object, it is one per
 * Locale, and the Locale only exists per request.
 */
const person = (locale: Locale) => ({
  ...PERSON_CORE,
  knowsAbout: HOME_BIO[locale].knowsAbout,
});

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const { locale } = loaderData;
  const addresses = documentAddresses({ kind: "index", path: "/" }, locale, LOCALES);
  const { canonical } = addresses;
  const { description } = HOME_BIO[locale];

  return [
    { title: HOME_TITLE },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    ...alternateLinks(addresses),
    { property: "og:title", content: HOME_TITLE },
    { property: "og:description", content: description },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: OG_IMAGE_ALT },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    { "script:ld+json": person(locale) },
  ];
};

export default function Home() {
  const { recentPosts, flagship, locale } = useLoaderData<typeof loader>();
  const strings = useStrings();
  const bio = HOME_BIO[locale];

  return (
    <main className="flex flex-col flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="mx-auto w-full max-w-measure pt-4">
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

          <p className="mt-2 text-lg text-low">{ROLE}</p>

          {/* A fact about where the work happens, not a signal that he is
            * looking: the timezone is what a distributed team screens on. */}
          <p className="mt-1 text-sm text-low">{LOCATION[locale]}</p>
        </div>

        {/* Left-aligned on purpose: centred prose past one line is harder to
          * read, and this is the paragraph the visitor actually has to read. */}
        <div className="mt-8 space-y-4 text-low leading-relaxed">
          {/* Keyed by position: these are two fixed paragraphs of one
            * biography, not a list that reorders. */}
          {bio.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
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

      {/* The hero asserts Chekalo in its first paragraph and asks to be
        * believed; this is where the assertion becomes something a reader can
        * check. Directly below it, for that reason. */}
      {flagship && (
        <section className="mx-auto w-full max-w-measure">
          <h2 className="text-lg font-semibold tracking-tight">{strings.home.whatIBuild}</h2>

          <article className="my-4 border-default border-l-2 py-4 px-4">
            <h3 className="flex flex-wrap items-baseline gap-x-3 text-base font-semibold">
              {/* `locale`, not `flagship.lang`: the flagship above is already
                * this Locale's own row (`findAllProjects` is Locale-filtered),
                * and the loader trims the fields it sends to exactly what this
                * block renders — a `lang` this Link would otherwise need. */}
              <Link to={projectHref(flagship.slug, locale)} className="hover:text-default">
                {flagship.title}
              </Link>

              {flagship.liveUrl && (
                <LiveLink href={flagship.liveUrl} className="text-sm font-normal text-low" />
              )}
            </h3>

            <p className="mt-2 text-pretty text-sm text-low">{flagship.summary}</p>
          </article>

          <Link
            className="text-sm text-low transition-colors duration-200 hover:text-default"
            to={withLocale("/projects", locale)}
          >
            {strings.home.allProjects}
          </Link>
        </section>
      )}

      {/* The same column as the hero, so the page reads as one narrow strip
        * rather than a landing page with a wider index bolted underneath. */}
      <section className="mx-auto w-full max-w-measure">
        <h2 className="text-lg font-semibold tracking-tight">{strings.home.recentWriting}</h2>

        {recentPosts.map((post) => (
          <ContentItem key={post.idContent} item={post} headingLevel="h3" />
        ))}

        <Link
          className="text-sm text-low transition-colors duration-200 hover:text-default"
          to={withLocale("/blog", locale)}
        >
          {strings.home.allArticles}
        </Link>
      </section>
    </main>
  );
}

