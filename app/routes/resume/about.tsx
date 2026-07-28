import { Section } from "~/components/section";
import { basics } from "./resume.json";

export function About() {
  let { summary } = basics;

  return (
    <Section title="About">
      <p className="text-pretty font-mono text-sm text-muted-foreground">
        {summary}
      </p>
    </Section>
  );
}
