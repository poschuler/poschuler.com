import { Section } from "~/components/section";
import { education } from "./resume.json";

export function Education() {
  return (
    <Section title="Education">
      {education.map((item) => (
        <div key={item.row} className="rounded-lg bg-subtle text-default">
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center justify-between gap-x-2 text-base">
              <h3 className="inline-flex items-center justify-center gap-x-1 font-semibold leading-none">
                {item.institution}
              </h3>
              {/* The year it was finished, not the span — a degree is dated by
                * its completion, and the span invites arithmetic about how long
                * it took. `startDate` stays in `resume.json` because it is true
                * and the schema carries it; it is simply not what this reads. */}
              <div className="text-sm tabular-nums text-low">
                {item.endDate}
              </div>
            </div>
          </div>
          <div className="mt-2 text-pretty font-mono text-xs leading-5 text-low">
            {item.area}
          </div>
        </div>
      ))}
    </Section>
  );
}
