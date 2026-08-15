import { useLoaderData } from "react-router";
import { chip } from "~/components/chip";
import { LiveLink } from "~/components/live-link";
import { GitHubIcon } from "~/components/ui/brand-icons";
import { RevisionHistory, RevisionLine } from "~/components/revisions";
import { cloudflareContext } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { cn } from "~/lib/utils";
import { findProjectBySlug } from "~/models/project.server";
import type { Route } from "./+types/_$project-slug";

const SITE = "https://poschuler.com";

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
  const project = await findProjectBySlug(env.POSCHULER_BD, params.projectSlug);

  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }

  const body = await env.BLOG_KV.get<ProjectBodyPayload>(
    `project:${project.slug}:${project.lang}`,
    {
      type: "json",
      // A body only changes when the seed pipeline runs, so let the colo answer
      // from its own cache instead of reaching KV's central store.
      cacheTtl: 3600,
    },
  );

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
    html: body.html,
  };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export function meta({ loaderData }: Route.MetaArgs) {
  const { title, description, slug } = loaderData;
  const pageTitle = `${title} | Paul Osorio Schuler`;

  return [
    { title: pageTitle },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: `${SITE}/projects/${slug}` },
    { property: "og:title", content: pageTitle },
    { property: "og:description", content: description },
    { property: "og:image", content: `${SITE}/og.png` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: `${SITE}/projects/${slug}` },
  ];
}

export default function Project() {
  const { title, summary, status, liveUrl, repoUrl, revisions, html } =
    useLoaderData<typeof loader>();

  return (
    <main className="flex-1 gap-4 bg-ui p-4 font-mono md:gap-8 md:p-10">
      <article className="prose mx-auto py-8">
        <h1 className="mb-2">{title}</h1>

        {/* An archived project is a finished story, and saying so costs
          * nothing. A dead one still written in the present tense is what
          * costs. */}
        {status === "archived" && (
          <p className={cn(chip, "not-prose mb-4")}>
            Archived — no longer maintained
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
              Repository
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
    </main>
  );
}
