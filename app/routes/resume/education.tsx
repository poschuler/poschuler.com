import { useStrings } from "~/lib/catalog";
import { Section } from "./section";
import { education } from "./resume.json";

export function Education() {
  let strings = useStrings();

  return (
    <Section title={strings.resume.headings.education}>
      {education.map((item) => (
        <article key={item.row} className="border-default border-l-2 py-3 pl-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <h3 className="font-sans font-semibold text-base leading-none">
              {item.institution}
            </h3>
            {/* The year it was finished, not the span — a degree is dated by
              * its completion, and the span invites arithmetic about how long
              * it took. `startDate` stays in `resume.json` because it is true
              * and the schema carries it; it is simply not what this reads. */}
            <span className="text-low text-sm">{item.endDate}</span>
          </div>

          <p className="mt-1 text-pretty text-low text-xs leading-5">
            {item.area}
          </p>
        </article>
      ))}
    </Section>
  );
}
