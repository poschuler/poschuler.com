import { useLocale } from "~/context";
import { useStrings } from "~/lib/catalog";
import { Section } from "./section";
import { basics } from "./resume.json";

export function About() {
  let { summary } = basics;
  let locale = useLocale();
  let strings = useStrings();

  return (
    <Section title={strings.resume.headings.about}>
      <p className="text-pretty text-low text-sm">{summary[locale]}</p>
    </Section>
  );
}
