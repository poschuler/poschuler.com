---
type: 'project'
title: 'Chékalo'
summary: 'A price intelligence platform for Peruvian retail: it ingests nine major retailers daily, resolves the same product across all of them into one canonical identity, and serves search and comparison from OpenSearch.'
description: 'Chékalo ingests nine Peruvian retailers daily and resolves their listings into a single canonical catalog. How it is built, and the matching decision that was reversed.'
tier: 'flagship'
status: 'active'
stack: ['TypeScript', 'Node.js', 'PostgreSQL', 'OpenSearch', 'Redis', 'BullMQ', 'React Router']
liveUrl: 'https://chekalo.pe'
sortOrder: 1
updates:
  - date: '2026-08-14'
    note: 'First published.'
---

Retailers do not agree on what a product is called.

The same washing machine is a `Samsung WA13CG5745BV` in one catalogue, a *Lavadora Samsung 13kg Carga Superior Negro* in another, and something else again in a third. None of them share an identifier. There is no registry to look it up in. And a price comparison is worthless unless you are certain the two prices belong to the same thing — showing a customer two different products side by side is not a small error, it is the whole product being wrong.

That problem is what Chékalo is. Everything else is logistics.

## The shape of it

Three modules, each owning its own durable state behind a hard boundary, in one deployable:

**Ingestion** pulls each retailer daily. Every retailer is its own integration — a different shape of response, a different idea of what a price is, a different set of things that can go wrong — so each one gets its own adapter and its own rate limit, and none of them can take another one down. Payloads are validated at the boundary, in production, on the way in: a retailer that quietly changes a field fails loudly here rather than three stages later, where the damage is a corrupted catalogue instead of a rejected batch. Unchanged payloads are recognised and dropped, which halves what gets stored.

**Catalog** is where the hard part lives. It takes those per-retailer listings and resolves them into canonical products, each with the offers behind it and the price history for each one.

**Search projection** pushes the catalogue into OpenSearch — only the canonical products that actually changed — and reindexes behind atomic alias swaps, so search keeps answering through every schema change instead of going dark for the duration.

The consumer site is a pure read model. No query API, no database of its own: it reads the projected index directly and renders on the server. There is nothing between a visitor and the index worth putting there.

## The decision I reversed

The first version of the matching resolved products with embeddings. Listings went into a vector store, similarity was cosine distance, and an LLM adjudicated the ambiguous pairs. It demoed well. It was the obvious thing to reach for, and I reached for it.

It was the wrong tool, for three reasons that took months to become undeniable:

**It could not be argued with.** When it matched two products that were not the same, the answer to *why* was a number. There was nothing to fix, only a threshold to nudge — and nudging it to fix one pair broke another.

**It was not reproducible.** The same catalogue run twice could produce different matches. For a system whose entire value is the claim *these two prices are for the same product*, "usually" is not a grade of correct.

**It cost real money per run**, every day, forever, to answer a question that mostly is not fuzzy at all.

What replaced it is deterministic identity resolution: brand, model, and a normalised variant signature — capacity, colour, dimensions, whatever distinguishes that product line — corroborated by barcode where the retailer publishes one. Rules I wrote, that I can read, that a colleague can disagree with, and that produce the same answer on Tuesday as on Monday. It is a fraction of the cost, and when it is wrong, it is wrong in a way I can find and fix.

I do not think the first approach was stupid. I think it answered a different question than the one I had. Product identity in retail is not a similarity problem; it is a normalisation problem wearing a similarity problem's clothes, and the resemblance is close enough to cost you a couple of months.

## What it is not

It is not microservices. Three modules with enforced boundaries inside one deployable have given me every property I actually wanted from separation — independent state, independent failure, code that cannot reach where it should not — and none of the operational cost I would have paid for the version with network calls between them. If one of those modules ever needs to scale on its own, the boundary is already there to cut along.

It is not a machine learning system, any more. See above.

And it is not finished. Price history is stored but barely used; the interesting things you can say to a shopper once you know what a product cost for the last six months are almost all still ahead.
