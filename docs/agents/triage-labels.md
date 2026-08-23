# Triage Labels

The skills speak in terms of five canonical triage roles. This repo uses those
five strings verbatim, so a role and a label are the same word — there is no
mapping to remember.

| Label             | Meaning                                  |
| ----------------- | ---------------------------------------- |
| `needs-triage`    | Maintainer needs to evaluate this issue  |
| `needs-info`      | Waiting on reporter for more information |
| `ready-for-agent` | Fully specified, ready for an AFK agent  |
| `ready-for-human` | Requires human implementation            |
| `wontfix`         | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the
label of the same name.

Two of them are load-bearing rather than descriptive. **`ready-for-agent` is the
gate ralph reads**: `RALPH_REQUIRE_LABEL` defaults to it, so an issue without it
is skipped by the loop however well specified it is (`ralph/RALPH.md`).
**`ready-for-human` marks what Paul writes himself** — the content tickets a
phase leaves behind, which no agent should pick up.

The rest of the repo's labels — `bug`, `enhancement`, `documentation` and
GitHub's defaults — classify what an issue *is*. These five say what state it is
in. The two axes are independent, and only the state one is read by anything.
