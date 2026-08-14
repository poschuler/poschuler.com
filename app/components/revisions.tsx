import type { Revision } from "~/lib/revisions";

/**
 * What a returning reader needs to know, in one line.
 *
 * The most recent revision only. The rest go at the foot of the document, where
 * they answer a different question — is this maintained, or was it updated once
 * and abandoned? — to someone who has already read it.
 *
 * Dates are rendered as the `YYYY-MM-DD` they are stored as, not through
 * `toLocaleDateString`: that reads the runtime's locale, which is not the same
 * on the server as in the browser, and the mismatch is a hydration warning.
 */
export function RevisionLine({
  publishedAt,
  revisions,
}: {
  /** Absent for a Project, which is revised in place and never published. */
  publishedAt?: string;
  revisions: Revision[];
}) {
  const latest = revisions[0];

  if (!publishedAt && !latest) {
    return null;
  }

  return (
    <div className="text-sm text-low">
      <p className="tabular-nums">
        {publishedAt && <span>Published {publishedAt}</span>}
        {publishedAt && latest && <span> · </span>}
        {latest && <span>Updated {latest.date}</span>}
      </p>

      {latest && <p className="mt-1 text-pretty">{latest.note}</p>}
    </div>
  );
}

/**
 * The revisions before the current one.
 *
 * Renders nothing until there are at least two: with one, this would repeat
 * what the line under the title already said.
 */
export function RevisionHistory({ revisions }: { revisions: Revision[] }) {
  const earlier = revisions.slice(1);

  if (earlier.length === 0) {
    return null;
  }

  return (
    <section className="mt-10 border-default border-t pt-6 text-sm text-low">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-wide">
        Earlier revisions
      </h2>

      <ul className="mt-3 space-y-2">
        {earlier.map((revision) => (
          <li key={revision.date} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
            <span className="tabular-nums whitespace-nowrap">{revision.date}</span>
            <span className="text-pretty">{revision.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
