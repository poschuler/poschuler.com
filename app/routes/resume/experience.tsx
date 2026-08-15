import { Section } from "./section";
import { work } from "./resume.json";

export function Experience() {
  return (
    <Section title="Work Experience">
      {work.map((item) => (
        /* The same left border every list on the site uses, rather than a
         * filled card. The fill was `bg-subtle` on a `bg-ui` page — a step
         * *down* the scale, so the card sank into the page instead of sitting
         * on it — and it was padded by `p-1`, four pixels, which is a rounded
         * rectangle drawn tight around its own text. */
        <article
          key={item.row}
          className="border-default border-l-2 py-3 pl-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <h3 className="font-sans font-semibold text-base leading-none">
              {item.name}
            </h3>
            <span className="text-low text-sm">
              {`${item.startDate} - ${item.endDate}`}
            </span>
          </div>

          {/* The position stays a heading. It is the phrase this page most
            * wants to be found by, and a crawler reads a heading differently
            * from a line of text. The location chip sits beside it rather than
            * inside the `<h3>`, where the heading a screen reader announced
            * was "Scotiabank Lima, Peru". */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="font-sans font-medium text-low text-sm">
              {item.position}
            </h4>
            {item.location && (
              <span className="inline-flex items-center text-nowrap rounded-md border border-default px-2 py-0.5 font-semibold text-low text-xs">
                {item.location}
              </span>
            )}
          </div>

          {item.summary && (
            <p className="mt-2 text-pretty text-low text-xs leading-5">
              {item.summary}
            </p>
          )}

          {item.highlights && item.highlights.length > 0 && (
            <ul className="mt-3 list-disc space-y-2 pl-4 text-low text-xs">
              {item.highlights.map((highlight) => (
                <li key={highlight} className="text-pretty">
                  {highlight}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </Section>
  );
}
