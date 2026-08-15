---
type: 'project'
title: 'poschuler.com'
summary: 'This site. Markdown in git, derived into D1 and KV at build time, served from a Cloudflare Worker — with the decisions written down as ADRs rather than remembered.'
description: 'How poschuler.com is built: a build-time pipeline from Markdown into D1 and KV, hand-written SQL, and the architecture decisions recorded as ADRs.'
tier: 'supporting'
status: 'active'
stack: ['TypeScript', 'React Router', 'Cloudflare Workers', 'D1', 'KV', 'Vitest']
repoUrl: 'https://github.com/poschuler/poschuler.com'
sortOrder: 2
updates:
  - date: '2026-08-14'
    note: 'First published.'
---

You are reading it, which makes this the one project on the site you can check while you read about it.

It is a personal site, and personal sites are the most common project there is. What makes this one worth a page is not the site — it is that the decisions behind it are written down, in the repository, as ADRs. Here are the ones worth arguing about.

## Markdown is the source; the stores are derived

Content is authored as Markdown files and versioned in git. The Worker never reads or parses them. A build-time pipeline splits each file in two: the front matter becomes a row in D1, and the body is rendered to HTML and stored in KV under an exact key.

Serving a post is therefore one KV read, and listing everything is one indexed query. No Markdown parsing on the request path — which is why `front-matter` and `marked` are dependencies that appear in no runtime import.

The obvious alternative was to read the Markdown at request time; the files are already in the bundle. It puts a parse on every request, and it makes *"everything published, newest first"* a question you can only answer by opening every file.

## No ORM, and a reversal on migrations

Data access is hand-written SQL through a helper thin enough to read in one sitting. One table that matters, four read queries, no joins.

An ORM's value is relationship mapping, migrations and query composition — and there is nothing here for any of the three to work on, while the costs are real: bundle size inside a Worker, and a schema definition that duplicates the one in `schema.sql` and is free to disagree with it. That half still holds.

The same decision ruled out a migration tool in the same sentence, and that half did not survive. Every argument above is about what ships inside a Worker, and a CLI ships nothing — so migrations had been rejected by association rather than on their merits. What applying the schema by hand actually cost was a two-hundred-line script whose only job was to notice that the remote half had been forgotten: a drift detector written by hand for a problem migrations do not have. Adopting them removed the last manual step against production and left less machinery behind, not more.

`schema.sql` stayed, because it is where the schema is explained rather than merely stated, and every database that does not exist yet is still built from it in one step. The migrations move the only one that already does. So the shape is written twice — and what makes that safe is a check that applies the chain from zero to a throwaway database and requires it to arrive at exactly the declared shape, on every push, before the deployed one has seen anything.

There are still no down migrations, and none are wanted. A migration that did the wrong thing is corrected by another migration and a seed, and nothing is lost in between, because nothing in this database is original.

## The publication is one ordered operation

A push to `main` used to start two things that never learned about each other: a CI job that wrote the deployed stores, and Cloudflare's own build system deploying the Worker on its own schedule. Nothing ordered them, and nothing failed when only one succeeded.

Now one job does the whole thing in sequence — verify the deployed schema, seed both stores, read them back, build, deploy, then confirm that the version now serving is the one just uploaded. Any step failing fails the run.

Seeding happens before deploying, and that order is a chosen failure mode rather than an accident: old code serving new content is almost always harmless, while new code over old content 404s a post that was just published.

## What it is not

There is no CMS, no admin interface, no comments and no newsletter. The Markdown pipeline works, and the absence of the rest is the point rather than a backlog.
