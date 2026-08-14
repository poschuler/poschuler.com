import { Section } from "./section";
import { skills } from "./resume.json";

/**
 * Grouped rather than one flat cloud, and in the Resume's own order — backend
 * first, frontend last. A list that names everything in no order says nothing
 * about what kind of engineer wrote it.
 */
export function Skills() {
  return (
    <Section title="Skills">
      <div className="space-y-2">
        {skills.map((group) => (
          <div key={group.row}>
            <h4 className="font-mono text-xs font-semibold">{group.category}</h4>

            <div className="mt-1 flex flex-wrap gap-1">
              {group.items.map((item) => (
                <div
                  key={item}
                  className="inline-flex items-center rounded-md border border-transparent bg-subtle px-2 py-0.5 font-mono text-xs font-semibold text-low"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
