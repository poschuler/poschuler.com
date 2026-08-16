import { Link, useLoaderData } from "react-router";
import { chip } from "~/components/chip";
import { LiveLink } from "~/components/live-link";
import { cloudflareContext, localeContext, LOCALES } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { documentAddresses } from "~/lib/seo/alternates";
import { findAllProjects, type ProjectRowType } from "~/models/project.server";
import type { Route } from "./+types/_projects";

const PROJECTS_TITLE = "Projects | Paul Osorio Schuler";
const PROJECTS_DESCRIPTION =
  "Software Paul Osorio Schuler has built and operates: Chekalo, a price intelligence platform for Peruvian retail, and the systems behind this site.";

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const projects = await findAllProjects(env.POSCHULER_BD);
  // `findAllProjects` carries no Locale filter yet (a known defect, out of
  // scope here) — this page's own Locale is unrelated, and is read only for
  // the canonical below.
  const locale = context.get(localeContext);

  return { projects, locale };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const { canonical } = documentAddresses(
    { kind: "index", path: "/projects" },
    loaderData.locale,
    LOCALES,
  );

  return [
    { title: PROJECTS_TITLE },
    { name: "description", content: PROJECTS_DESCRIPTION },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: PROJECTS_TITLE },
    { property: "og:description", content: PROJECTS_DESCRIPTION },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
};

function ArchivedBadge({ project }: { project: ProjectRowType }) {
  if (project.status !== "archived") {
    return null;
  }

  return (
    <span className={chip}>
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
  const { stack } = project;

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
          <LiveLink href={project.liveUrl} className="font-mono text-sm text-low" />
        )}
      </div>

      <p className="mt-3 text-pretty text-low">{project.summary}</p>

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
  const { stack } = project;

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
  // Everything that is not the flagship, rather than `tier === 'supporting'`.
  // The schema accepts a third tier that nothing uses yet, and a filter naming
  // only the tiers it knows would make the first one that appears render
  // nowhere while its page still served — visible only to whoever went looking.
  const rest = projects.filter((project) => project.tier !== "flagship");

  return (
    <main className="flex flex-1 flex-col gap-4 bg-ui p-4 font-mono md:gap-8 md:p-10">
      <section className="w-full">
        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            Projects
          </h1>
        </div>

        <div className="max-w-[450px] mx-auto">
          <blockquote className="text-center mt-2 italic text-low text-lg">
            Things I have built and run, rather than things I have used
          </blockquote>
        </div>
      </section>

      <section className="mx-auto w-full max-w-measure space-y-8">
        {flagship.map((project) => (
          <Flagship key={project.idProject} project={project} />
        ))}

        {rest.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {rest.map((project) => (
              <Supporting key={project.idProject} project={project} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
