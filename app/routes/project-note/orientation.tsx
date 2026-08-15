import { Link } from "react-router";
import { projectHref } from "~/lib/hrefs";

/**
 * The Project named above a Field Note's title (Part 11 of
 * `evolution-plan/14-phase-1b-field-notes.md`).
 *
 * A reader arriving at a note from a search engine has never seen the home
 * page and would otherwise start reading without knowing what system this is
 * about. `SeriesBreadcrumb` in `series-part/orientation.tsx` is the same idea
 * for a Part; this is its Project sibling, with no section to name because a
 * Project has none.
 */

const linkClassName = "transition-colors duration-200 hover:text-default";

export function ProjectBreadcrumb({
  projectSlug,
  projectTitle,
}: {
  projectSlug: string;
  projectTitle: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-low text-sm">
      <ol className="flex flex-wrap items-center gap-x-2">
        <li>
          <Link to="/projects" className={linkClassName}>
            Projects
          </Link>
        </li>
        <li aria-hidden="true">›</li>
        <li>
          <Link to={projectHref(projectSlug)} className={linkClassName}>
            {projectTitle}
          </Link>
        </li>
      </ol>
    </nav>
  );
}
