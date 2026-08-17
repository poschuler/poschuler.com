---
type: 'post'
title: 'What happened, named as the problem rather than the feature'
description: 'One sentence. This is the SEO meta description.'
tags: ['backend']
publishedAt: '2026-01-01'
# draft: true                          # while it is being written
---

A Field Note is an ordinary Post whose Container is a Project. It carries no
arc, no previous and no next: it stands on its own and is read on its own.

Copy this to `app/content/projects/<project>/<note>/<note>.en.md`, then **list
`<note>` in that Project's `notes:`**, in the order it should be indexed. A note
the manifest does not list fails the build, and so does a listed note with no
file — the reconciliation runs both ways.

A Part of a Series uses this same front matter; what differs is where it sits
and which manifest lists it.
