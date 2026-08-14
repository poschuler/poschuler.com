import { Section } from "./section";
import { basics } from "./resume.json";

export function About() {
  let { summary } = basics;

  return (
    <Section title="About">
      <p className="text-pretty font-mono text-sm text-low">
        {summary}
      </p>
    </Section>
  );
}
