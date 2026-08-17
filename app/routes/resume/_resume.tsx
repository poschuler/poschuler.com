import { About } from "~/routes/resume/about";
import { Certificates } from "~/routes/resume/certificates";
import { Education } from "~/routes/resume/education";
import { Experience } from "~/routes/resume/experience";
import { Hero } from "~/routes/resume/hero";
import { Skills } from "~/routes/resume/skills";
import { KeyboardManager } from "~/routes/resume/keyboard-manager";
import type { MetaFunction } from "react-router";
import { LOCALES, type Locale } from "~/context";
import { alternateLinks, documentAddresses } from "~/lib/seo/alternates";
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
 *
 * `mainEntityOfPage` is deliberately not here — it is the one field that
 * depends on the Locale the request arrived under, so `meta()` below adds it
 * once it knows which one that is.
 */
const PERSON_BASE = {
  ...PERSON_CORE,
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
 * hydration payload underneath it, 12 kB of the 70 kB `/cv` weighs. As a
 * plain import it travels inside the hashed route chunk, which a browser
 * fetches once and caches.
 */

/**
 * The page's own Locale, read off `root.tsx`'s loader data through `matches`
 * rather than a loader of this route's own — the same bridge `useLocale()`
 * (`app/context.ts`) crosses for every component below this route, reached
 * differently here only because `meta()` runs on the server with no component
 * tree to call a hook from. `matches` is what `MetaFunction` hands every
 * route regardless of whether it has a loader, so this costs nothing the
 * route did not already have.
 *
 * Defaults to `"en"` the same way `useLocale()` does, so a match with no
 * `loaderData` yet — never true in practice, since `root`'s loader always
 * runs first — degrades to the site's default branch rather than throwing.
 */
function localeFromMatches(matches: Parameters<MetaFunction>[0]["matches"]): Locale {
  const root = matches.find((match) => match.id === "root");

  return (root?.loaderData as { locale?: Locale } | undefined)?.locale ?? "en";
}

/**
 * `/cv` is mounted in both Locales (ADR 0010) and, since Phase 3's Part 8
 * (`evolution-plan/15-phase-3-spanish.md`, #48), each branch now carries its
 * own text — so unlike before, this page canonicalises at whichever address it
 * was actually served from, `LOCALES` rather than `["en"]` for the same reason
 * every other index passes it: `/cv` cannot 404 for lacking a Translation
 * (`app/lib/seo/switcher.ts`'s own `resume` case), so both entries always
 * resolve.
 */
export const meta: MetaFunction = ({ matches }) => {
  const locale = localeFromMatches(matches);
  const addresses = documentAddresses({ kind: "index", path: "/cv" }, locale, LOCALES);
  const { canonical } = addresses;
  const person = { ...PERSON_BASE, mainEntityOfPage: canonical };

  return [
    { title: RESUME_TITLE },
    { name: "description", content: RESUME_DESCRIPTION },
    { tagName: "link", rel: "canonical", href: canonical },
    ...alternateLinks(addresses),
    { property: "og:title", content: RESUME_TITLE },
    { property: "og:description", content: RESUME_DESCRIPTION },
    { property: "og:image", content: `${SITE}/og.png` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    { "script:ld+json": person },
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
