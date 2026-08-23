---
type: 'series'
title: 'The name of the series'
description: 'One sentence. This is the SEO meta description.'
status: 'ongoing'
startingPoint: 'What the reader is assumed to already be able to do.'
destination: 'What they end up with. Immutable once the first Part ships.'
outOfScope: ['Something this series will not cover']
audience: 'Who this is for, and who it is not for.'
sections:
  - slug: 'the-first-section'
    title: 'The First Section'
    summary: 'One or two sentences. This is what the landing renders.'
    parts:
      - 'the-first-part'
  - slug: 'a-later-section'
    title: 'A Later Section'
    summary: 'Planned, and it says so by holding no parts.'
---

The body is why this series exists and what problem it came out of. The landing
renders the contract and the arc from the front matter above; this is the voice
around them, and a manifest without it fails the build.

Copy this to `app/content/series/<series>/<series>.en.md`, then write each Part
at `app/content/series/<series>/<part>/<part>.en.md` and list its slug here, in
the order it should be read.

Three rules the build enforces:

- **`destination` is immutable once the first Part ships.** Everything else may
  change; that is the promise the reader signed up for.
- **`outOfScope` cannot be empty.** What a series refuses to cover is half of
  what it promises.
- **A section declares `status: 'complete'` or nothing at all**, and only with
  parts in it. A section with no parts is planned and a section with parts is in
  progress — both are read from the list rather than written down.
