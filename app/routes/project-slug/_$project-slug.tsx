import { useLoaderData } from "react-router";
import { chip } from "~/components/chip";
import { LiveLink } from "~/components/live-link";
import { ProjectNoteItem } from "~/components/project-note-item";
import { GitHubIcon } from "~/components/ui/brand-icons";
import { RevisionHistory, RevisionLine } from "~/components/revisions";
import { cloudflareContext, localeContext } from "~/context";
import { useStrings } from "~/lib/catalog";
import { alternateLinks, documentAddresses } from "~/lib/seo/alternates";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { cn } from "~/lib/utils";
import { findProjectBySlug, findProjectNotes } from "~/models/project.server";
import type { Route } from "./+types/_$project-slug";

interface ProjectBodyPayload {
  html: string;
}

/**
 * The row carries everything the page frames the body with — title, summary,
 * links, revisions — and KV carries the body itself. Two reads rather than one
 * because a case study's prose is a large immutable blob served by exact key,
 * which is what KV is for, while the index needs the same metadata as a query.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const locale = context.get(localeContext);
  const project = await findProjectBySlug(env.POSCHULER_BD, params.projectSlug, locale);

  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }

  const [body, notes] = await Promise.all([
    env.BLOG_KV.get<ProjectBodyPayload>(`project:${project.slug}:${project.lang}`, {
      type: "json",
      // A body only changes when the seed pipeline runs, so let the colo answer
      // from its own cache instead of reaching KV's central store.
      cacheTtl: 3600,
    }),
    // The index at the foot of the landing (Part 11 of
    // `evolution-plan/14-phase-1b-field-notes.md`). A Draft holds no row, so
    // it is already absent here — nothing extra to filter.
    findProjectNotes(env.POSCHULER_BD, project.slug, project.lang),
  ]);

  if (!body) {
    throw new Response("Not Found", { status: 404 });
  }

  return {
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    description: project.description ?? project.summary,
    status: project.status,
    liveUrl: project.liveUrl,
    repoUrl: project.repoUrl,
    revisions: project.revisions,
    locale: project.lang,
    // Read off the same row, via the correlated subquery `findProjectBySlug`
    // now carries (Part 10 of `evolution-plan/15-phase-3-spanish.md`) — the
    // canonical's alternates, without a second round trip.
    existingLocales: project.locales,
    html: body.html,
    notes,
  };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export function meta({ loaderData }: Route.MetaArgs) {
  const { title, description, slug, locale, existingLocales } = loaderData;
  const pageTitle = `${title} | Paul Osorio Schuler`;
  const addresses = documentAddresses({ kind: "project", slug }, locale, existingLocales);
  const { canonical } = addresses;

  return [
    { title: pageTitle },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    ...alternateLinks(addresses),
    { property: "og:title", content: pageTitle },
    { property: "og:description", content: description },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
}

export default function Project() {
  const { slug, title, summary, status, liveUrl, repoUrl, revisions, html, notes } =
    useLoaderData<typeof loader>();
  const strings = useStrings();

  return (
    <main className="flex-1 gap-4 bg-ui p-4 font-mono md:gap-8 md:p-10">
      <article className="prose mx-auto py-8">
        <h1 className="mb-2">{title}</h1>

        {/* An archived project is a finished story, and saying so costs
          * nothing. A dead one still written in the present tense is what
          * costs. */}
        {status === "archived" && (
          <p className={cn(chip, "not-prose mb-4")}>
            {strings.projects.archivedNotice}
          </p>
        )}

        {/* `lead` was a `@tailwindcss/typography` class and went with it. The
          * summary is the first paragraph of the article and reads as one. */}
        <p className="text-pretty">{summary}</p>

        <div className="not-prose flex flex-wrap items-center gap-4">
          {liveUrl && <LiveLink href={liveUrl} className="text-low" />}

          {repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-low no-underline transition-colors duration-200 hover:text-default"
            >
              <GitHubIcon className="size-5" />
              {strings.projects.repository}
            </a>
          )}
        </div>

        <div className="not-prose mt-4">
          <RevisionLine revisions={revisions} />
        </div>

        <hr className="mb-7 mt-7" />
        <div dangerouslySetInnerHTML={{ __html: html }} />

        <div className="not-prose">
          <RevisionHistory revisions={revisions} />
        </div>
      </article>

      {/* Below the case study, never above it — a hiring manager reading
        * sixty seconds and leaving must not hit an index first. Absent
        * entirely rather than an empty heading when there is nothing
        * published yet (Part 11 of `evolution-plan/14-phase-1b-field-notes.md`). */}
      {notes.length > 0 && (
        <section className="mx-auto w-full max-w-measure pb-8">
          <h2 className="font-semibold text-xl tracking-tight">{strings.projects.fieldNotesHeading}</h2>

          {notes.map((note) => (
            <ProjectNoteItem key={note.slug} note={note} projectSlug={slug} />
          ))}
        </section>
      )}
    </main>
  );
}
