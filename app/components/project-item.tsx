import { Briefcase } from "lucide-react";
import { ListingRow } from "~/components/listing-row";
import { projectHref } from "~/lib/hrefs";
import type { ProjectListingRowType } from "~/models/project.server";

/**
 * One Project in a list — on `/blog`, where a Project with Field Notes is a
 * single entry among the loose Posts and each Series (Part 10 of
 * `evolution-plan/14-phase-1b-field-notes.md`).
 *
 * The cardinality argument that collapsed a Series into one row is the same
 * one here: several notes about one Project would make the page describe the
 * Project rather than describe what this person writes. It shares
 * `ListingRow` with `ContentItem` and `SeriesItem`, and decides the same two
 * things `SeriesItem` does: it links to the landing, and it dates itself by
 * the most recent piece — a Field Note rather than a Part.
 *
 * `/blog` is the only page that lists a Project this way, so unlike
 * `SeriesItem` there is no `showKind` to toggle: the kind always renders.
 */
export function ProjectItem({
  project,
  headingLevel = "h2",
}: {
  project: ProjectListingRowType;
  headingLevel?: "h2" | "h3";
}) {
  return (
    <ListingRow
      headingLevel={headingLevel}
      title={project.title}
      href={projectHref(project.slug)}
      icon={Briefcase}
      meta={
        <>
          <time dateTime={project.publishedStringDate}>{project.publishedStringDate}</time>
          <span>· Project</span>
        </>
      }
    />
  );
}
