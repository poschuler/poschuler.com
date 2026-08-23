This repo documents how its code is written, and none of it loads by itself —
open what you need:

- **`AGENTS.md`** — the standing rules: the two languages, branches and what
  publishes, the commit format, the checklist to run before committing, the
  generated fixtures, where code is allowed to live.
- **`CONTEXT.md`** — the glossary. A Post, a Locale, a Tag, a Trail mean
  something precise here; use those words, in code and in prose.
- **`docs/adr/`** — the decisions and their reasoning. Start from
  `docs/adr/README.md`: it says which ADRs were amended or half superseded,
  which an ADR's own opening paragraph will not tell you. Read the ones that
  touch the area you are working in.
- **`docs/architecture.md`** — runtime shape, data stores, the content pipeline.
- **`docs/design.md`** — UI conventions, tokens, component layers, how a route
  is declared and mounted in both Locales.
- **`docs/authoring.md`** — required before touching anything under
  `app/content/`.
- **`docs/agents/`** — the issue tracker, the triage labels, the domain docs and
  the flow this work belongs to.

A rule written in one of those files beats any general convention you carry.
