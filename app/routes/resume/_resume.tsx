import { About } from "~/routes/resume/about";
import { Certificates } from "~/routes/resume/certificates";
import { Education } from "~/routes/resume/education";
import { Experience } from "~/routes/resume/experience";
import { Hero } from "~/routes/resume/hero";
import { Skills } from "~/routes/resume/skills";
import { KeyboardManager } from "~/routes/resume/keyboard-manager";
import type { MetaFunction } from "react-router";
import { documentAddresses } from "~/lib/seo/alternates";
import { PERSON_CORE, SITE } from "~/lib/seo/person";
import { basics, certificates, education, languages } from "~/routes/resume/resume.json";

/**
 * The same person the home page and every article point at — `PERSON_CORE`
 * carries the `@id`, so a crawler reading four pages finds one entity rather
 * than four that share a name.
 *
 * Richer than the home page's, because this is where the credentials live:
 * `alumniOf` and `hasCredential` are what let a crawler treat "iSAQB" and
 * "Universidad Tecnológica del Perú" as entities rather than as text. Every
 * field added here is read from `resume.json` rather than restated, so the
 * structured data cannot drift from the document it describes.
 *
 * `sameAs` is not restated either: it comes from `PERSON_CORE`, which derives
 * it from the same two profiles this page links to.
 */
const PERSON = {
  ...PERSON_CORE,
  mainEntityOfPage: `${SITE}/resume`,
  email: `mailto:${basics.email}`,
  knowsLanguage: languages.map(({ language }) => language),
  alumniOf: education.map(({ institution, url }) => ({
    "@type": "EducationalOrganization",
    name: institution,
    url,
  })),
  hasCredential: certificates.map(({ name, issuer, url }) => ({
    "@type": "EducationalOccupationalCredential",
    name,
    url,
    recognizedBy: { "@type": "Organization", name: issuer },
  })),
};

const RESUME_TITLE = "Resume | Paul Osorio Schuler";
const RESUME_DESCRIPTION =
  "The professional history of Paul Osorio Schuler, senior backend engineer: roles, education, skills and certifications, from 15+ years across banking and product.";

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

/**
 * No loader, so no `locale` arrives from `localeContext` the way every other
 * page's does — deliberately, for the reason above this file's `meta` used to
 * carry alone. This page has exactly one address until Phase 3's Part 8 gives
 * the Resume its Spanish text (`evolution-plan/15-phase-3-spanish.md`), so the
 * Locale it canonicalises at is written here rather than threaded through a
 * loader added for this alone.
 */
export const meta: MetaFunction = () => {
  const { canonical } = documentAddresses({ kind: "index", path: "/resume" }, "en", ["en"]);

  return [
    { title: RESUME_TITLE },
    { name: "description", content: RESUME_DESCRIPTION },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: RESUME_TITLE },
    { property: "og:description", content: RESUME_DESCRIPTION },
    { property: "og:image", content: `${SITE}/og.png` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    { "script:ld+json": PERSON },
  ];
};

/**
 * `font-mono` sits on the `<main>` rather than on eighteen elements below it.
 * The Resume's rule is that its headings are sans and everything else is mono
 * (see `docs/design.md`, Typography), and this states it directly: the page is
 * mono, and a heading opts out with `font-sans`.
 *
 * It was written the other way round — mono applied by hand, element by
 * element — which is why the two dates were sans by omission and one `<h4>`
 * was mono by hand, neither of them on purpose.
 */
export default function resume() {
  return (
    <main className="flex flex-1 flex-col gap-4 bg-ui p-4 font-mono md:gap-8 md:p-10">
      <section className="mx-auto w-full max-w-measure space-y-8">
        {/* The CV's order, and it is load-bearing: a reader is placed by stack
          * before being told the history, not after it. */}
        <Hero />
        <About />
        <Skills />
        <Experience />
        <Education />
        <Certificates />
      </section>
      <KeyboardManager />
    </main>
  );
}
