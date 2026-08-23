import { PenLine } from "lucide-react";
import { ListingRow } from "~/components/listing-row";
import { useLocale } from "~/context";
import { postHref } from "~/lib/hrefs";
import type { ProjectNoteRowType } from "~/models/project.server";

/**
 * One Field Note in a Project's index — the foot of the case study (Part 11 of
 * `evolution-plan/14-phase-1b-field-notes.md`).
 *
 * Shares `ListingRow` with `ContentItem` and `SeriesItem` rather than copying
 * its bordered block a fourth time. What it adds is the summary: a list of
 * technical notes does not let a reader choose between them on the title
 * alone, so it goes on the extra line `ListingRow` already supports.
 */
export function ProjectNoteItem({
  note,
  projectSlug,
}: {
  note: ProjectNoteRowType;
  projectSlug: string;
}) {
  const locale = useLocale();

  return (
    <ListingRow
      title={note.title}
      href={postHref({ slug: note.slug, seriesSlug: null, projectSlug }, locale)}
      icon={PenLine}
      meta={<time dateTime={note.publishedStringDate}>{note.publishedStringDate}</time>}
    >
      {note.summary && <p className="mt-2 text-pretty text-low text-sm">{note.summary}</p>}
    </ListingRow>
  );
}
