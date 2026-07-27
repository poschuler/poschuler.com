import { About } from "~/routes/resume/about";
import { Certificates } from "~/routes/resume/certificates";
import { Education } from "~/routes/resume/education";
import { Experience } from "~/routes/resume/experience";
import { Hero } from "~/routes/resume/hero";
import { Skills } from "~/routes/resume/skills";
import {
  basics,
  work,
  education,
  languages,
  skills,
  certificates,
} from "~/routes/resume/resume.json";
import { KeyboardManager } from "~/routes/resume/keyboard-manager";
import type { Route } from "./+types/_resume";
import type { MetaFunction } from "react-router";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";

export async function loader() {
  return { basics, work, education, languages, skills, certificates };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export const meta: MetaFunction = () => {
  return [
    { title: "Resume | Paul Osorio Schuler" },
    { name: "description", content: "The professional history of Paul Osorio Schuler, Staff Software Engineer: roles, education, skills and certificates, from 12+ years building backend systems in banking and automation." },
    { tagName: "link", rel: "canonical", href: "https://poschuler.com/resume" },
    { name: "og:title", content: "Resume | Paul Osorio Schuler" },
    { name: "og:description", content: "The professional history of Paul Osorio Schuler, Staff Software Engineer: roles, education, skills and certificates, from 12+ years building backend systems in banking and automation." },
    { name: "og:image", content: "https://avatars.githubusercontent.com/u/1238212?v=4" },
    { name: "og:type", content: "website" },
    { name: "og:url", content: "https://poschuler.com/resume" },
  ];
};

export default function resume({ loaderData }: Route.ComponentProps) {
  return (
    <main className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-ui p-4 md:gap-8 md:p-10">
      <section className="mx-auto w-full max-w-2xl space-y-8">
        <Hero />
        <About />
        <Experience />
        <Education />
        <Skills />
        <Certificates />
      </section>
      <KeyboardManager />
    </main>
  );
}
