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
            <h3 className="font-sans font-semibold text-xs">{group.category}</h3>

            <ul className="mt-1 flex flex-wrap gap-1">
              {group.items.map((item) => (
                <li
                  key={item}
                  className="inline-flex items-center rounded-md border border-default px-2 py-0.5 font-semibold text-low text-xs"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
