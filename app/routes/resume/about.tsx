import { useLoaderData } from "react-router";
import { Section } from "~/components/section";
import type { loader } from "./_resume";

export function About() {
  let {
    basics: { summary },
  } = useLoaderData<typeof loader>();

  return (
    <Section title="About">
      <p className="text-pretty font-mono text-sm text-muted-foreground">
        {summary}
      </p>
    </Section>
  );
}
