---
type: 'link'
title: 'The title as its Source published it'
source: 'the publication or author it is credited to'
externalUrl: 'https://example.com/the-article'
publishedAt: '2026-01-01'
tags: ['webdev']
---

A Bookmark has no body: the article lives at its Source and only its metadata is
here. Anything written below this line is ignored.

Copy this to `app/content/bookmarks/<slug>.md` — one file, no folder, and **no
Locale suffix**: a Bookmark is a pointer, not a document of its own, so it has
nothing to translate and belongs to both Locales at once.

`publishedAt` is when it was read, not when the Source published it. It is what
orders the Timeline.
