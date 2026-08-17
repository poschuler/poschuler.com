import { Link } from "react-router";
import { useLocale } from "~/context";
import { useStrings } from "~/lib/catalog";
import { postHref, projectHref } from "~/lib/hrefs";
import type { ProjectNoteRowType } from "~/models/project.server";
import { indexHref } from "~/lib/trail";

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
  const locale = useLocale();
  const strings = useStrings();

  return (
    <nav aria-label={strings.a11y.breadcrumb} className="text-low text-sm">
      <ol className="flex flex-wrap items-center gap-x-2">
        <li>
          <Link to={indexHref("projects", locale)} className={linkClassName}>
            {strings.projects.heading}
          </Link>
        </li>
        <li aria-hidden="true">›</li>
        <li>
          <Link to={projectHref(projectSlug, locale)} className={linkClassName}>
            {projectTitle}
          </Link>
        </li>
      </ol>
    </nav>
  );
}

/**
 * The way onward, at the foot of a note (Part 11 of
 * `evolution-plan/14-phase-1b-field-notes.md`). `SectionIndex` in
 * `series-part/orientation.tsx` is the same idea for a Part's neighbours
 * inside its section; this is its Project sibling — a flat list rather than
 * one grouped by section, because a Project declares no sections.
 *
 * `notes` is the Project's whole manifest order; the current note is filtered
 * out here rather than by the caller, so the "only one note" rule — do not
 * render at all — and the sibling list stay one computation instead of two
 * that have to agree.
 *
 * **No previous/next.** A Project promises no reading order, so nothing here
 * claims one.
 */
export function NoteSiblings({
  projectSlug,
  projectTitle,
  notes,
  currentSlug,
}: {
  projectSlug: string;
  projectTitle: string;
  notes: ProjectNoteRowType[];
  currentSlug: string;
}) {
  const locale = useLocale();
  const strings = useStrings();
  const siblings = notes.filter((note) => note.slug !== currentSlug);

  if (siblings.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={strings.projectNote.moreFieldNotesFrom(projectTitle)}
      className="mx-auto mt-8 w-full max-w-measure space-y-4 border-default border-t pt-6 pb-8"
    >
      <p className="font-semibold text-sm">{strings.projectNote.moreFieldNotesFrom(projectTitle)}</p>

      <ol className="space-y-1 text-sm">
        {siblings.map((note) => (
          <li key={note.slug}>
            <Link
              to={postHref({ slug: note.slug, seriesSlug: null, projectSlug }, locale)}
              className={`text-low ${linkClassName}`}
            >
              {note.title}
            </Link>
          </li>
        ))}
      </ol>

      <Link
        to={projectHref(projectSlug, locale)}
        className={`block text-low text-sm ${linkClassName}`}
      >
        → {strings.projectNote.theProject(projectTitle)}
      </Link>
    </nav>
  );
}
