import { Section } from "./section";
import { work } from "./resume.json";

export function Experience() {
  return (
    <Section title="Work Experience">
      {work.map((item) => (
        <div key={item.row} className="rounded-lg bg-subtle text-default p-1">
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center justify-between gap-x-2 text-base">
              <h3 className="inline-flex items-center justify-center gap-x-1 font-semibold leading-none">
                {item.name}
                <span className="inline-flex gap-x-1">
                  {item.location && item.location !== "" && (
                    <div className="inline-flex items-center text-nowrap rounded-md border border-transparent bg-ui px-2 py-0.5 align-middle font-mono text-xs font-semibold text-low transition-colors hover:bg-hover">
                      {item.location}
                    </div>
                  )}
                </span>
              </h3>
              <div className="text-sm tabular-nums text-low">
                {`${item.startDate} - ${item.endDate}`}
              </div>
            </div>
            <h4 className="font-mono text-sm leading-none">{item.position}</h4>
          </div>

          <div className="mt-2 mb-2 text-pretty font-mono text-xs leading-5 text-low">
            {item.summary && (
              item.summary
            )}

            {item.highlights && item.highlights.length > 0 && (
              <ul className="mt-4 list-disc pl-4 space-y-2">
                {item.highlights.map((highlight, index) => (
                  <li key={index} className="text-pretty font-mono text-xs text-low">
                    {highlight}
                  </li>
                ))}
              </ul>
            )}

          </div>

        </div>
      ))}
    </Section>
  );
}
