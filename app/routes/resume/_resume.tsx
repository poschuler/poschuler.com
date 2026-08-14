import { About } from "~/routes/resume/about";
import { Certificates } from "~/routes/resume/certificates";
import { Education } from "~/routes/resume/education";
import { Experience } from "~/routes/resume/experience";
import { Hero } from "~/routes/resume/hero";
import { Skills } from "~/routes/resume/skills";
import { KeyboardManager } from "~/routes/resume/keyboard-manager";
import type { MetaFunction } from "react-router";

/**
 * No loader on purpose. The Resume is a static document that only changes when
 * `resume.json` is edited and the site redeployed, so each section imports it
 * directly.
 *
 * Routing it through a loader instead sent the whole document down twice in
 * every single response — once as the rendered HTML, once again as the
 * hydration payload underneath it, 12 kB of the 70 kB `/resume` weighs. As a
 * plain import it travels inside the hashed route chunk, which a browser
 * fetches once and caches.
 */

export const meta: MetaFunction = () => {
  return [
    { title: "Resume | Paul Osorio Schuler" },
    { name: "description", content: "The professional history of Paul Osorio Schuler, Staff Software Engineer: roles, education, skills and certificates, from 12+ years building backend systems in banking and automation." },
    { tagName: "link", rel: "canonical", href: "https://poschuler.com/resume" },
    { property: "og:title", content: "Resume | Paul Osorio Schuler" },
    { property: "og:description", content: "The professional history of Paul Osorio Schuler, Staff Software Engineer: roles, education, skills and certificates, from 12+ years building backend systems in banking and automation." },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://poschuler.com/resume" },
  ];
};

export default function resume() {
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
