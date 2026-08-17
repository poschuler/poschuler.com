---
type: 'project'
title: 'The name of the thing'
summary: 'One or two sentences, outcome first. This is what the index shows.'
description: 'One sentence. This is the SEO meta description.'
tier: 'supporting'
status: 'active'
stack: ['TypeScript', 'Node.js']
# liveUrl: 'https://…'                 # optional
# repoUrl: 'https://github.com/…'      # optional
# sortOrder: 1                         # optional, defaults to 0
updates:
  - date: '2026-01-01'
    note: 'First published.'
# notes:                               # its Field Notes, in the order they are indexed
#   - 'the-first-note'
---

The body is the case study: the problem, what it does, how it is built, what was
learned. It renders below the summary and above the index of Field Notes.

Copy this to `app/content/projects/<project>/<project>.en.md`.

`tier` is `flagship`, `supporting` or `experiment`, and it is weight rather than
route shape: promoting a Project changes this field and never its address.
`status` is `active` or `archived`.

A Project is not a Content Item — no place in the Timeline — so it is revised in
place, and **needs at least one revision**: the day its page went up.
