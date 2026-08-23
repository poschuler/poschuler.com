# The interface language is a typed catalogue, not an i18n library

The strings this site renders around its content — navigation, headings, the 404, empty states — are held in a catalogue keyed by string and typed so that the compiler requires every key in every Locale. No `i18next`, no `react-i18next`, no `remix-i18next`.

This is recorded because the opposite is the obvious path: a reader who finds a hand-rolled catalogue will reasonably assume nobody checked whether a library would do. It was checked, and it works.

Accepted for Phase 3, and written before the code, because the reasoning that produced it lives in a planning document that is not part of this repository.

## Considered Options

- **`remix-i18next` with `i18next` and `react-i18next`.** The conventional arrangement, and **compatible** — `remix-i18next@8.0.0` declares `peerDependencies: { "react-router": "^8.0.0", i18next: "^24 || ^25 || ^26" }`. Rejected on the three costs below rather than on any technical obstacle.

- **A catalogue keyed by string, typed `as const`, exhaustive per Locale.** Chosen.

### What the library gives, against what this site needs

| Capability | Worth here |
|---|---|
| Message catalogue, keyed, separate from JSX | **The actual problem** — and about thirty lines of our own |
| Interpolation | Two sites. A template literal |
| Plural rules | Two sites, and English and Spanish both have two forms. `Intl.PluralRules` is in the runtime if that changes |
| Namespaces, lazy-loaded catalogues | Nothing. Around fifty strings; both Locales fit |
| `Accept-Language` detection | Deliberately unused: this site does not redirect by language |
| Date and number formatting | Not provided — `Intl` is native to the runtime |
| Extraction tooling, translation-management integration | Real, when translation is delegated. It is not |
| Missing-key detection | At runtime, with a silent fallback. A typed catalogue gives it at compile time |

### The three costs

- **It would be the first third-party dependency of any weight in the Worker runtime.** `docs/architecture.md` states the posture as policy rather than accident: sitemap and `robots.txt` rendering are hand-rolled in `app/lib/seo/`, with no third-party SEO dependency. `front-matter` and `marked` sit in `dependencies` and never appear in a Worker import, which is why they look like dead weight until you know why. These would not be that. For scale, the unpacked npm sizes — not bundle sizes, but the order — are 516 KB, 1.5 MB and 63 KB.

- **It would be a second source of truth for what a Locale is.** The vocabulary is declared once, in the content pipeline, and an unrecognised Locale fails the build. A library brings `supportedLngs` and `fallbackLng`, free to disagree with it. That is the shape of defect ADR 0007 and ADR 0008 both exist to close.

- **Its posture toward what is missing is the opposite of this repository's.** i18next falls back to the default language and keeps serving. Here an undeclared Tag fails the build, a file no content tree claims fails the build, and a filename carrying an unrecognised Locale fails the build. With a typed catalogue, a Spanish string that was never written is a compile error. With a silent fallback it is a Spanish page carrying an English sentence, which nobody notices until a reader does.

## Consequences

- **Adding a Locale means adding a column to the catalogue and getting a list of compile errors**, one per string not yet written. That is the intended experience, and it is why the catalogue is typed rather than a plain object of objects.
- **Interpolation and plurals are written by hand** at the small number of sites that need them. If either spreads, that is evidence rather than inconvenience.
- **Dates are formatted with `Intl.DateTimeFormat` given the page's Locale.** No library was ever needed for this; what was needed was passing the Locale, which `toLocaleDateString()` with no argument does not do — it reads the runtime's locale, which on a Worker is not the reader's.
- **Reopen this** when a third Locale arrives, when translation is delegated to someone who is not the author, or when the catalogue passes roughly two hundred strings. Any one of the three and the trade-off inverts: at that point the tooling, the namespaces and the extraction pipeline start paying for the dependency they cost.
