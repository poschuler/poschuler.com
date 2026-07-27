# AGENTS.md

## Language

- **Conversation with the user: Spanish.** Explanations, questions, summaries and any chat output go in Spanish, with correct accents and diacritics.
- **Everything written to disk: English.** Code, identifiers, comments, commit messages, documentation, ADRs, `CONTEXT.md`, issue titles and bodies, PR descriptions and test names are all in English.

The split is deliberate: the repo is a public, English-language artifact; the conversation is not.

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues in `poschuler/poschuler.com`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, used verbatim: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
