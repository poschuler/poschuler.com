import { CONTACT_LINKS } from "~/lib/contact";

/** Everything structured data says about this site is rooted here. */
export const SITE = "https://poschuler.com";

/**
 * The one identifier for the person behind this site.
 *
 * Four pages describe him — the home page, the Resume, and every article he
 * wrote — and without an `@id` those are four unrelated entities that happen to
 * share a name. With it they are one, so a search engine can connect an article
 * to the credentials and the location on the Resume. Which is exactly the
 * connection a site that exists to earn interviews wants made.
 *
 * A fragment on the origin rather than a page URL: the entity is the person,
 * not any one document about him.
 */
export const PERSON_ID = `${SITE}/#paul`;

/** How a document points at him without describing him again. */
export const AUTHOR = { "@id": PERSON_ID } as const;

/**
 * The identity every page states the same way.
 *
 * Only the fields that would be a contradiction if they differed. The two pages
 * that describe him at length still add their own — the home page what he
 * works on, the Resume his credentials — and that asymmetry is deliberate: the
 * Resume is where the credentials live, and repeating them on the home page
 * would be a second copy to keep in step.
 *
 * `sameAs` is derived from the links the pages already render rather than
 * restated, so a crawler and a reader cannot be told different things.
 * `mailto:` is not a profile and is dropped.
 *
 * Built from constants rather than from `resume.json` on purpose: this module
 * is imported by every article, and `resume.json` carries an entire work
 * history that has no business in that bundle.
 */
export const PERSON_CORE = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": PERSON_ID,
  name: "Paul Osorio Schuler",
  url: SITE,
  image: `${SITE}/paul-osorio-schuler.webp`,
  jobTitle: "Senior Backend Engineer",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Lima",
    addressCountry: "PE",
  },
  sameAs: CONTACT_LINKS.filter(({ href }) => !href.startsWith("mailto:")).map(({ href }) => href),
} as const;
