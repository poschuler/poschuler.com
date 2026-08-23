import { chip } from "~/components/chip";
import { useStrings } from "~/lib/catalog";
import { Section } from "./section";
import { skills } from "./resume.json";

/**
 * Grouped rather than one flat cloud, and in the Resume's own order — backend
 * first, frontend last. A list that names everything in no order says nothing
 * about what kind of engineer wrote it.
 */
export function Skills() {
  let strings = useStrings();

  return (
    <Section title={strings.resume.headings.skills}>
      <div className="space-y-2">
        {skills.map((group) => (
          <div key={group.row}>
            <h3 className="font-sans font-semibold text-xs">{group.category}</h3>

            <ul className="mt-1 flex flex-wrap gap-1">
              {group.items.map((item) => (
                <li key={item} className={chip}>
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
