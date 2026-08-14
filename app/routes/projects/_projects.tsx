import { Link, useLoaderData, type MetaFunction } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { cloudflareContext } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { findAllProjects, type ProjectRowType } from "~/models/project.server";
import type { Route } from "./+types/_projects";

const SITE = "https://poschuler.com";

const PROJECTS_TITLE = "Projects | Paul Osorio Schuler";
const PROJECTS_DESCRIPTION =
  "Software Paul Osorio Schuler has built and operates: Chékalo, a price intelligence platform for Peruvian retail, and the systems behind this site.";

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const projects = await findAllProjects(env.POSCHULER_BD);

  return { projects };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export const meta: MetaFunction = () => {
  return [
    { title: PROJECTS_TITLE },
    { name: "description", content: PROJECTS_DESCRIPTION },
    { tagName: "link", rel: "canonical", href: `${SITE}/projects` },
    { property: "og:title", content: PROJECTS_TITLE },
    { property: "og:description", content: PROJECTS_DESCRIPTION },
    { property: "og:image", content: `${SITE}/og.png` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: `${SITE}/projects` },
  ];
};

/** The stored JSON array, or nothing if a Project declared no stack. */
function stackOf(project: ProjectRowType): string[] {
  try {
    const parsed = JSON.parse(project.stack);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ArchivedBadge({ project }: { project: ProjectRowType }) {
  if (project.status !== "archived") {
    return null;
  }

  return (
    <span className="rounded-md bg-subtle px-2 py-0.5 font-mono text-xs font-semibold text-low">
      Archived
    </span>
  );
}

/**
 * The one project that carries the weight. Alone in its row on purpose: put
 * three side by side and the reader compares them, which lifts nothing and
 * lowers the strongest.
 */
function Flagship({ project }: { project: ProjectRowType }) {
  const stack = stackOf(project);

  return (
    <article className="border-default border-l-2 py-4 pl-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          <Link to={`/projects/${project.slug}`} className="hover:text-default">
            {project.title}
          </Link>
        </h2>
        <ArchivedBadge project={project} />
        {project.liveUrl && (
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-sm text-low transition-colors duration-200 hover:text-default"
          >
            {project.liveUrl.replace(/^https?:\/\//, "")}
            <ArrowUpRight className="h-3 w-3" />
          </a>
        )}
      </div>

      <p className="mt-3 max-w-[65ch] text-pretty text-low">{project.summary}</p>

      {stack.length > 0 && (
        <p className="mt-3 font-mono text-xs text-low">{stack.join(" · ")}</p>
      )}

      <Link
        to={`/projects/${project.slug}`}
        className="mt-4 inline-block font-mono text-sm text-low transition-colors duration-200 hover:text-default"
      >
        Read the case →
      </Link>
    </article>
  );
}

function Supporting({ project }: { project: ProjectRowType }) {
  const stack = stackOf(project);

  return (
    <article className="border-default border-l-2 py-3 pl-4">
      <h2 className="flex flex-wrap items-baseline gap-x-2 text-lg font-semibold">
        <Link to={`/projects/${project.slug}`} className="hover:text-default">
          {project.title}
        </Link>
        <ArchivedBadge project={project} />
      </h2>

      <p className="mt-2 text-pretty text-sm text-low">{project.summary}</p>

      {stack.length > 0 && (
        <p className="mt-2 font-mono text-xs text-low">{stack.join(" · ")}</p>
      )}
    </article>
  );
}

export default function Projects() {
  const { projects } = useLoaderData<typeof loader>();

  const flagship = projects.filter((project) => project.tier === "flagship");
  const supporting = projects.filter((project) => project.tier === "supporting");

  return (
    <main className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-ui p-4 font-mono md:gap-8 md:p-10">
      <section className="mx-auto w-full max-w-2xl space-y-8">
        <div>
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl">
            Projects
          </h1>
          <p className="mt-2 max-w-[65ch] text-pretty text-low">
            Things I have built and run, rather than things I have used.
          </p>
        </div>

        {flagship.map((project) => (
          <Flagship key={project.idProject} project={project} />
        ))}

        {supporting.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {supporting.map((project) => (
              <Supporting key={project.idProject} project={project} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
