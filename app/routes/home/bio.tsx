import type { Locale } from "~/context";

/**
 * The home page's own words, in both Locales.
 *
 * This is the one document on the site whose text has no source outside the
 * code: a Post has its Markdown, the Resume has `resume.json`, and the home
 * page had two paragraphs sitting inside its JSX. Splitting them out is what
 * makes a Spanish home page possible without duplicating the markup that
 * surrounds them — `_home.tsx` keeps the structure, this file keeps the prose,
 * and neither has to know how the other changes.
 *
 * `satisfies Record<Locale, Bio>` is the guarantee: a paragraph written in
 * English and forgotten in Spanish is a compile error at this assignment, not
 * a reader in Lima being served a language they did not ask for. It is the
 * same posture `app/lib/catalog.ts` takes with the interface strings, applied
 * to content rather than chrome — and it is the reason the two stay separate
 * files. The catalogue is a translator's inventory of labels; this is his
 * biography, and nobody but him writes it.
 *
 * The Spanish here is not a fresh translation. It is `resume.json`'s own
 * `basics.summary.es`, which says the same thing about Chekalo in the same
 * order, trimmed to the home page's shorter shape. Two pages that describe the
 * same work in the same language should not describe it in two voices.
 */
type Bio = {
  /** `<meta name="description">` and `og:description` — the biography, compressed for a crawler. */
  description: string;
  /** The running paragraphs under the portrait, in order. */
  paragraphs: React.ReactNode[];
  /** `knowsAbout` on the `Person` JSON-LD. Product names stay put; a field of knowledge does not. */
  knowsAbout: string[];
};

/**
 * Deliberately not per-Locale, and the same decision `resume.json` already
 * made: its `basics.label` is one string for both branches. A job title is a
 * name for a role in a market, not a sentence about him — *Senior Backend
 * Engineer* is what the posting he wants to answer says, in Lima as much as
 * anywhere — so translating it would narrow the page rather than open it.
 * Dates, employers, technologies and certificates stay single-form for the
 * same reason (`app/lib/catalog.ts`).
 */
export const ROLE = "Senior Backend Engineer — TypeScript · Node.js";

/** Name and role, so it is single-form for the reason `ROLE` is. */
export const HOME_TITLE = "Paul Osorio Schuler | Senior Backend Engineer | TypeScript • Node.js";

/** Single-form for the reason `ROLE` is: it names the person and the role, and nothing else. */
export const OG_IMAGE_ALT = "Paul Osorio Schuler — Senior Backend Engineer";

export const HOME_BIO = {
  en: {
    description:
      "Senior backend engineer in Lima, Peru, with fifteen years in banking systems. I build and operate Chekalo.pe, a price intelligence platform in TypeScript and Node.js.",
    paragraphs: [
      <>
        I build and operate <ProseLink href="https://chekalo.pe">Chekalo.pe</ProseLink>, a price
        intelligence platform that ingests Peru&apos;s major retailers every day, resolves the same
        product across stores into a single canonical identity, and serves search and comparison
        from OpenSearch. TypeScript and Node.js throughout, structured as a modular monolith over
        PostgreSQL and Redis-backed work queues.
      </>,
      <>
        Fifteen years in banking systems: solution architecture for enterprise orchestration and
        integration platforms.
      </>,
    ],
    knowsAbout: [
      "TypeScript",
      "Node.js",
      "PostgreSQL",
      "OpenSearch",
      "Redis",
      "Software architecture",
    ],
  },
  es: {
    description:
      "Ingeniero backend senior en Lima, Perú, con quince años en sistemas bancarios. Construyo y opero Chekalo.pe, una plataforma de inteligencia de precios en TypeScript y Node.js.",
    paragraphs: [
      <>
        Desarrollo y opero <ProseLink href="https://chekalo.pe">Chekalo.pe</ProseLink>, una
        plataforma de inteligencia de precios con ingesta diaria de los principales retailers del Perú, 
        que identifica un mismo producto entre tiendas bajo una identidad canónica, 
        y usa OpenSearch como motor de búsqueda y comparación. TypeScript y Node.js en todo el stack,
        con arquitectura de monolito modular sobre PostgreSQL y colas de trabajo en Redis.
      </>,
      <>
        Quince años en sistemas bancarios: arquitectura de soluciones para plataformas empresariales
        de orquestación e integración.
      </>,
    ],
    knowsAbout: [
      "TypeScript",
      "Node.js",
      "PostgreSQL",
      "OpenSearch",
      "Redis",
      "Arquitectura de software",
    ],
  },
} satisfies Record<Locale, Bio>;

/**
 * An external link inside running text — underlined, because prose links that
 * only change colour are missed by anyone who is scanning.
 *
 * It lives here rather than in `_home.tsx` because the prose it appears inside
 * lives here: a paragraph and the link within it are one piece of writing, and
 * splitting them across two files would mean editing both to change one
 * sentence.
 */
function ProseLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      className="text-default underline underline-offset-4"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );
}
