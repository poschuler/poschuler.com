import { Section } from "./section";
import { basics } from "./resume.json";

export function About() {
  let { summary } = basics;

  return (
    <Section title="About">
      <p className="text-pretty text-low text-sm">{summary}</p>
    </Section>
  );
}
