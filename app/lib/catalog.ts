import { type Locale, useLocale } from "~/context";

/**
 * The interface language, as a typed catalogue rather than an i18n library
 * (ADR 0011, Part 3 of `evolution-plan/15-phase-3-spanish.md`).
 *
 * Every string the site renders **around** its content — navigation, the
 * theme row, headings, empty states, listing metadata — lives here, keyed by
 * where it is used and typed so that `STRINGS` below cannot compile unless
 * both Locales supply every key. Omit a Spanish string and the build fails at
 * the assignment, not at a reader's screen.
 *
 * **What is deliberately not here.** A document's own data — a Post's title,
 * a Project's summary, the home page's biography, `<meta>`/`og:` copy — is
 * content, not chrome: it is written once, in the language it is written in,
 * the same way a Post's body is. Cataloguing it here would mean this module
 * inventing Spanish marketing prose no author reviewed. Nothing in `meta()`
 * changes for this reason, on any route; that is deliberate, not an
 * oversight.
 *
 * **No runtime test asserts this catalogue is complete.** The type below is
 * the check: `STRINGS` is declared `Record<Locale, Chrome>`, so a Locale
 * missing a key — or holding the wrong shape — is a compile error, which is
 * the whole point of a typed catalogue over a library that falls back to
 * English and keeps serving (ADR 0011). A test that walked `LOCALES` and
 * asserted every key exists would assert something the compiler already
 * guarantees, for a maintenance cost of its own.
 */
type Chrome = {
  /** Shared across every route that needs it, rather than one copy per route. */
  a11y: {
    /** `aria-label` on a breadcrumb `<nav>` — identical wherever one appears. */
    breadcrumb: string;
  };
  nav: {
    home: string;
    projects: string;
    blog: string;
    bookmarks: string;
    timeline: string;
    /**
     * Deliberately identical in both Locales. *Resume* is a Spanish word —
     * the third person singular of *resumir* — so translating the label
     * would misread as a conjugated verb; the address moves to `/cv`
     * instead (Part 4 of `evolution-plan/15-phase-3-spanish.md`, #43) and
     * the label stays put. Catalogued anyway, so this file is still the one
     * place every nav string comes from.
     */
    resume: string;
    /** sr-only text on the button that opens the mobile panel. */
    openMenu: string;
    /** `aria-label` on both `<nav>` landmarks — the row and the panel. */
    mainLabel: string;
    /** The mobile panel's own title, sr-only and read into `Close …`. */
    panelTitle: string;
    /** Beside the toggle in the mobile panel. */
    themeRowLabel: string;
    /** Beside the switcher in the mobile panel — this Locale's own word for "Language". */
    languageRowLabel: string;
  };
  theme: {
    mode: Record<"light" | "dark" | "system", string>;
    tooltip: (current: string, next: string) => string;
    srAnnouncement: (current: string, next: string) => string;
  };
  /**
   * The language switcher's own copy (Part 9 of
   * `evolution-plan/15-phase-3-spanish.md`). Looked up by the *destination*
   * Locale, never the page's own — the switcher is written in the language it
   * leads to, so `Español` reads correctly to a screen reader on an English
   * page and vice versa.
   */
  languageSwitcher: {
    /** This Locale's own name, in its own language — "English" / "Español". */
    language: string;
    /** A section's name in this Locale, keyed the way `SwitcherSection` is (`app/lib/seo/alternates.ts`). */
    section: Record<"blog" | "series" | "projects", string>;
    /**
     * What the switcher says when the current document has no Translation and
     * falls back to a section index — `"Blog in English"` / `"Blog en
     * español"` — always composed in this Locale's own language.
     */
    inThisLanguage: (section: string) => string;
  };
  notFound: {
    title: string;
    backHome: string;
  };
  /**
   * What an index answers when its list is empty rather than 404ing (Part 6 of
   * `evolution-plan/15-phase-3-spanish.md`) — today only reachable under `/es`,
   * before the first Spanish document of a section exists. One pair reused by
   * every index that can be empty: the heading above it already names the
   * section, so the message only has to say why the list below is missing and
   * the link only has to say where the content already is.
   */
  emptyIndex: {
    message: string;
    readInEnglish: string;
  };
  home: {
    whatIBuild: string;
    allProjects: string;
    recentWriting: string;
    allArticles: string;
  };
  bookmarks: {
    heading: string;
    subtitle: string;
  };
  blog: {
    heading: string;
    subtitle: string;
  };
  timeline: {
    heading: string;
    subtitle: string;
  };
  projects: {
    heading: string;
    subtitle: string;
    /** Badge on a listing row. */
    archivedBadge: string;
    readTheCase: string;
    /** On a Project's own landing — a fuller sentence than the badge above. */
    archivedNotice: string;
    /** The repository link on a Project's own landing. */
    repository: string;
    fieldNotesHeading: string;
    /** The kind label on `/blog`'s listing row — singular, unlike `heading`. */
    kindLabel: string;
  };
  series: {
    heading: string;
    subtitle: string;
    arcHeading: string;
    sectionState: Record<"complete" | "inProgress" | "planned", string>;
    /** The landing's own badge — a different pair of words than a Section's state. */
    landingState: Record<"complete" | "ongoing", string>;
    startingPoint: string;
    destination: string;
    outOfScope: string;
    audience: string;
    completeSummary: string;
    ongoingSummary: string;
    startHere: (seriesTitle: string) => string;
    endOfSeries: string;
    endOfSection: (sectionTitle: string) => string;
    nextUp: (partTitle: string) => string;
    seeFullArc: string;
    whereNextLabel: string;
    sectionIndexLabel: (sectionTitle: string) => string;
    youAreHere: string;
  };
  tags: {
    heading: string;
    subtitle: string;
    posts: (count: number) => string;
  };
  tag: {
    subtitle: string;
  };
  /**
   * The Resume's own section headings (Part 8 of
   * `evolution-plan/15-phase-3-spanish.md`, #48) — the one piece of chrome
   * `resume.json` itself does not carry, because a heading is not a fact about
   * the person the way `basics`, `work` or `education` are. Everything else the
   * Resume renders either travels bilingual inside `resume.json` (the About
   * paragraph, the experience bullets) or stays single-form on purpose (dates,
   * employers, job titles, technologies, certificates).
   */
  resume: {
    headings: {
      about: string;
      skills: string;
      experience: string;
      education: string;
      certificates: string;
    };
  };
  contentItem: {
    wrote: string;
    read: string;
  };
  seriesItem: {
    kindLabel: string;
    noPartsYet: string;
    parts: (count: number) => string;
  };
  postArticle: {
    viewGithubRepository: string;
  };
  revisions: {
    published: (date: string) => string;
    updated: (date: string) => string;
    earlierRevisions: string;
  };
  projectNote: {
    moreFieldNotesFrom: (projectTitle: string) => string;
    theProject: (projectTitle: string) => string;
  };
};

/** `n === 1` in both Locales — English and Spanish share the same two plural forms (ADR 0011). */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export const STRINGS: Record<Locale, Chrome> = {
  en: {
    a11y: {
      breadcrumb: "Breadcrumb",
    },
    nav: {
      home: "home",
      projects: "projects",
      blog: "blog",
      bookmarks: "bookmarks",
      timeline: "timeline",
      resume: "resume",
      openMenu: "Open navigation",
      mainLabel: "Main",
      panelTitle: "Navigation",
      themeRowLabel: "Theme",
      languageRowLabel: "Language",
    },
    theme: {
      mode: { light: "light", dark: "dark", system: "system" },
      tooltip: (current, next) => `Theme: ${current} — switch to ${next}`,
      srAnnouncement: (current, next) => `Theme: ${current}. Switch to ${next}`,
    },
    languageSwitcher: {
      language: "English",
      section: { blog: "Blog", series: "Series", projects: "Projects" },
      inThisLanguage: (section) => `${section} in English`,
    },
    notFound: {
      title: "404 — Not Found",
      backHome: "Back to the home page",
    },
    emptyIndex: {
      message: "Nothing has been published here yet.",
      readInEnglish: "Read it in English →",
    },
    home: {
      whatIBuild: "What I build",
      allProjects: "All projects →",
      recentWriting: "Recent writing",
      allArticles: "All articles →",
    },
    bookmarks: {
      heading: "Bookmarks",
      subtitle: "Links I've bookmarked and learned from",
    },
    blog: {
      heading: "Articles",
      subtitle: "My articles on topics I care about",
    },
    timeline: {
      heading: "Timeline",
      subtitle: "What I write and what I read, in the order it happened",
    },
    projects: {
      heading: "Projects",
      subtitle: "Things I have built and run, rather than things I have used",
      archivedBadge: "Archived",
      readTheCase: "Read the case →",
      archivedNotice: "Archived — no longer maintained",
      repository: "Repository",
      fieldNotesHeading: "Field notes",
      kindLabel: "Project",
    },
    series: {
      heading: "Series",
      subtitle: "Subjects worked through in order, rather than one article at a time",
      arcHeading: "The arc",
      sectionState: { complete: "Complete", inProgress: "In progress", planned: "Planned" },
      landingState: { complete: "Complete", ongoing: "Ongoing" },
      startingPoint: "You start with",
      destination: "You end up with",
      outOfScope: "Not covered",
      audience: "Who it is for",
      completeSummary: "This series is complete: it reaches the destination above.",
      ongoingSummary:
        "This series is ongoing. It is finished when it reaches the destination above — however many parts that takes.",
      startHere: (seriesTitle) => `${seriesTitle} — start here`,
      endOfSeries: "That is the end of the series.",
      endOfSection: (sectionTitle) => `That is the end of ${sectionTitle}.`,
      nextUp: (partTitle) => `Next up · ${partTitle}`,
      seeFullArc: "See the full arc →",
      whereNextLabel: "Where to go next",
      sectionIndexLabel: (sectionTitle) => `${sectionTitle} — the parts published so far`,
      youAreHere: "— you are here",
    },
    tags: {
      heading: "Tags",
      subtitle: "Everything I write about, most-written-about first",
      posts: (count) => `${count} ${plural(count, "post", "posts")}`,
    },
    tag: {
      subtitle: "Everything I have written on this subject",
    },
    resume: {
      headings: {
        about: "About",
        skills: "Skills",
        experience: "Work Experience",
        education: "Education",
        certificates: "Certificates",
      },
    },
    contentItem: {
      wrote: "I wrote",
      read: "I read",
    },
    seriesItem: {
      kindLabel: "Series",
      noPartsYet: "no parts yet",
      parts: (count) => `${count} ${plural(count, "part", "parts")}`,
    },
    postArticle: {
      viewGithubRepository: "View Github Repository",
    },
    revisions: {
      published: (date) => `Published ${date}`,
      updated: (date) => `Updated ${date}`,
      earlierRevisions: "Earlier revisions",
    },
    projectNote: {
      moreFieldNotesFrom: (projectTitle) => `More Field Notes from ${projectTitle}`,
      theProject: (projectTitle) => `${projectTitle}, the project`,
    },
  },
  es: {
    a11y: {
      breadcrumb: "Ruta de navegación",
    },
    nav: {
      home: "inicio",
      projects: "proyectos",
      blog: "blog",
      bookmarks: "marcadores",
      timeline: "cronología",
      resume: "resume",
      openMenu: "Abrir navegación",
      mainLabel: "Principal",
      panelTitle: "Navegación",
      themeRowLabel: "Tema",
      languageRowLabel: "Idioma",
    },
    theme: {
      mode: { light: "claro", dark: "oscuro", system: "sistema" },
      tooltip: (current, next) => `Tema: ${current} — cambiar a ${next}`,
      srAnnouncement: (current, next) => `Tema: ${current}. Cambiar a ${next}`,
    },
    languageSwitcher: {
      language: "Español",
      section: { blog: "Blog", series: "Series", projects: "Proyectos" },
      inThisLanguage: (section) => `${section} en español`,
    },
    notFound: {
      title: "404 — No encontrado",
      backHome: "Volver a la página de inicio",
    },
    emptyIndex: {
      message: "Todavía no se ha publicado nada aquí.",
      readInEnglish: "Leerlo en inglés →",
    },
    home: {
      whatIBuild: "Lo que construyo",
      allProjects: "Todos los proyectos →",
      recentWriting: "Escritos recientes",
      allArticles: "Todos los artículos →",
    },
    bookmarks: {
      heading: "Marcadores",
      subtitle: "Enlaces que he guardado y de los que he aprendido",
    },
    blog: {
      heading: "Artículos",
      subtitle: "Mis artículos sobre temas que me importan",
    },
    timeline: {
      heading: "Cronología",
      subtitle: "Lo que escribo y lo que leo, en el orden en que sucedió",
    },
    projects: {
      heading: "Proyectos",
      subtitle: "Lo que he construido y opero, no lo que he usado",
      archivedBadge: "Archivado",
      readTheCase: "Leer el caso →",
      archivedNotice: "Archivado — ya no tiene mantenimiento",
      repository: "Repositorio",
      fieldNotesHeading: "Notas de campo",
      kindLabel: "Proyecto",
    },
    series: {
      heading: "Series",
      subtitle: "Temas trabajados en orden, en vez de un artículo a la vez",
      arcHeading: "El arco",
      sectionState: { complete: "Completa", inProgress: "En curso", planned: "Planeada" },
      landingState: { complete: "Completa", ongoing: "En curso" },
      startingPoint: "Empiezas con",
      destination: "Terminas con",
      outOfScope: "Fuera de alcance",
      audience: "Para quién es",
      completeSummary: "Esta serie está completa: alcanza el destino descrito arriba.",
      ongoingSummary:
        "Esta serie está en curso. Termina cuando alcanza el destino descrito arriba, sin importar cuántas partes tome.",
      startHere: (seriesTitle) => `${seriesTitle} — empieza aquí`,
      endOfSeries: "Ese es el final de la serie.",
      endOfSection: (sectionTitle) => `Ese es el final de ${sectionTitle}.`,
      nextUp: (partTitle) => `Sigue · ${partTitle}`,
      seeFullArc: "Ver el arco completo →",
      whereNextLabel: "Adónde ir después",
      sectionIndexLabel: (sectionTitle) => `${sectionTitle} — las partes publicadas hasta ahora`,
      youAreHere: "— estás aquí",
    },
    tags: {
      heading: "Etiquetas",
      subtitle: "Todo sobre lo que escribo, empezando por lo más frecuente",
      posts: (count) => `${count} ${plural(count, "artículo", "artículos")}`,
    },
    tag: {
      subtitle: "Todo lo que he escrito sobre este tema",
    },
    resume: {
      headings: {
        about: "Acerca de",
        skills: "Habilidades",
        experience: "Experiencia laboral",
        education: "Educación",
        certificates: "Certificados",
      },
    },
    contentItem: {
      wrote: "Escribí",
      read: "Leí",
    },
    seriesItem: {
      kindLabel: "Series",
      noPartsYet: "sin partes todavía",
      parts: (count) => `${count} ${plural(count, "parte", "partes")}`,
    },
    postArticle: {
      viewGithubRepository: "Ver repositorio de GitHub",
    },
    revisions: {
      published: (date) => `Publicado ${date}`,
      updated: (date) => `Actualizado ${date}`,
      earlierRevisions: "Revisiones anteriores",
    },
    projectNote: {
      moreFieldNotesFrom: (projectTitle) => `Más notas de campo de ${projectTitle}`,
      theProject: (projectTitle) => `${projectTitle}, el proyecto`,
    },
  },
};

/** The current page's chrome strings — `STRINGS[useLocale()]`, named for what it is used for. */
export function useStrings(): Chrome {
  return STRINGS[useLocale()];
}
