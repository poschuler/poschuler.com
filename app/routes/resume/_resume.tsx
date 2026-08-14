import { About } from "~/routes/resume/about";
import { Certificates } from "~/routes/resume/certificates";
import { Education } from "~/routes/resume/education";
import { Experience } from "~/routes/resume/experience";
import { Hero } from "~/routes/resume/hero";
import { Skills } from "~/routes/resume/skills";
import { KeyboardManager } from "~/routes/resume/keyboard-manager";
import type { MetaFunction } from "react-router";
import { basics, certificates, education, languages } from "~/routes/resume/resume.json";

const SITE = "https://poschuler.com";

/**
 * Every field a reader can see on this page is read from `resume.json` rather
 * than restated, so the structured data cannot drift from the document it
 * describes. `jobTitle` is the one exception: `basics.label` carries the title
 * *and* the stack (`Senior Backend Engineer | TypeScript • Node.js`), and
 * schema.org wants the title alone — so it is stated here, and it is the one
 * string to change in two places when the title changes.
 *
 * Richer than the home page's `Person` because this is where the credentials
 * live, and `alumniOf` / `hasCredential` are what let a crawler treat "iSAQB"
 * and "Universidad Tecnológica del Perú" as entities rather than as text.
 */
const PERSON = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: basics.name,
  url: basics.url,
  mainEntityOfPage: `${SITE}/resume`,
  image: `${SITE}${basics.image}`,
  jobTitle: "Senior Backend Engineer",
  email: `mailto:${basics.email}`,
  address: {
    "@type": "PostalAddress",
    addressLocality: basics.location.city,
    addressCountry: basics.location.countryCode,
  },
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
  sameAs: basics.profiles.map(({ url }) => url),
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

export const meta: MetaFunction = () => {
  return [
    { title: RESUME_TITLE },
    { name: "description", content: RESUME_DESCRIPTION },
    { tagName: "link", rel: "canonical", href: `${SITE}/resume` },
    { property: "og:title", content: RESUME_TITLE },
    { property: "og:description", content: RESUME_DESCRIPTION },
    { property: "og:image", content: `${SITE}/og.png` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: `${SITE}/resume` },
    { "script:ld+json": PERSON },
  ];
};

export default function resume() {
  return (
    <main className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-ui p-4 md:gap-8 md:p-10">
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
