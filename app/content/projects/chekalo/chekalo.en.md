---
type: 'project'
title: 'Chekalo'
summary: 'A price intelligence platform for Peruvian retail: it ingests nine major retailers daily, resolves the same product across all of them into one canonical identity, and serves search and comparison from OpenSearch.'
description: 'Chekalo ingests nine Peruvian retailers daily and resolves their listings into one canonical catalogue — a normalisation problem, not a similarity one.'
tier: 'flagship'
status: 'active'
stack: ['TypeScript', 'Node.js', 'PostgreSQL', 'OpenSearch', 'Redis', 'BullMQ', 'React Router']
liveUrl: 'https://chekalo.pe'
sortOrder: 1
updates:
  - date: '2026-08-14'
    note: 'First published.'
---

When you go into different retailers' web catalogues you find out the same washing machine is a `Samsung WA13CG5745BV` in the first and a *Lavadora Samsung 13kg Carga Superior Negro* in the second, and a third has its own name for it. They rarely share an identifier, and there's nothing to look one up in, so pairing those three listings is work that has to be done.

A price comparison is worthless unless you're sure both prices are for that same machine — and when you get it wrong, you're not showing a customer a slightly off price, you're showing them the wrong product.

That's the problem Chekalo solves, and it's most of what the system actually is.

## The shape of it

Three modules, each owning its own durable state behind a hard boundary, in one deployable:

**Ingestion** pulls each retailer daily. Every retailer is its own integration — a different shape of response, a different idea of what a price is, a different set of things that can go wrong — so each one gets its own adapter and its own rate limit, and none of them can take another one down. Payloads are validated at the boundary, in production, on the way in: a retailer that quietly changes a field fails loudly here rather than three stages later, where the damage is a corrupted catalogue instead of a rejected batch. Unchanged payloads are recognised and dropped, which halves what gets stored.

**Catalog** is where the hard part lives. It takes those per-retailer listings and resolves them into canonical products, each with the offers behind it and the price history for each one.

**Search projection** pushes the catalogue into OpenSearch — only the canonical products that actually changed — and reindexes behind atomic alias swaps, so search keeps answering through every schema change instead of going dark for the duration.

The consumer site is a pure read model. No query API, no database of its own: it reads the projected index directly and renders on the server. There is nothing between a visitor and the index worth putting there.

## Product identity is not a similarity problem

The first version of Chekalo was more ambitious than this one. It tried to match everything, not just electronics and appliances but groceries, where the same five kilos of rice is *Arroz Extra 5Kg* in one catalogue and *Arroz Superior Bolsa 5 Kilos* in the next, and half the shelf is private label, so the brands genuinely differ too. Below the packaged aisles it stops being a naming problem at all. A kilo of *palta* has no brand, no model and no barcode; one retailer lists *Palta Fuerte*, another lists *Palta* and nothing else — and if that second one is *Hass*, the gap between those two prices is not a saving I am showing a shopper, it is a different fruit. If product identity in electronics is ambiguous, in fresh food there is frequently nothing to read.

After trying different approaches I ended up in a vector store. Identity wasn't reliable, so similarity was the only handle left: listings became embeddings, candidate pairs came out of cosine distance, and an LLM adjudicated the ones sitting near the threshold. It wasn't perfect, but it worked — reviewing the pairs, I agreed with most of them. Accuracy was never what killed it. What killed it was everything around the accuracy, over months in which each of these got harder to explain away:

**It was not reproducible.** The same catalogue, run twice against the same models, could produce different matches: a different set of candidates surfaced, and the judge deciding between them does not promise the same verdict twice. For a system whose entire value is the claim *these two prices are for the same product*, "usually" is not a grade of correct.

**And it could not be improved.** The daily increment was manageable on its own. But changing the embedding model, or the model making the decision, means every match already in the catalogue was made by a version that no longer exists, so the whole catalogue has to be reprocessed from zero. That does not fit in the window I have to put a price in front of a user while the offer is still real — so the improvement does not happen.

**It could not be argued with.** When it paired two products that were not the same, the answer to *why* was a number. There was nothing to fix — only a threshold to nudge, and nudging it to rescue one pair broke another somewhere else in the catalogue.

**It cost real money on every run** — every day, forever, to answer a question that outside the grocery aisle is not fuzzy at all.

That last clause is what settled it. The whole apparatus existed to survive the hardest category, and the hardest category was the one I could not serve honestly even when the matching agreed with itself. A similarity score pairs *Palta* with *Palta Hass* at high confidence, because by every measure available to it they are the same thing; there is no threshold that encodes *there is no answer here*. So I dropped the category. Chekalo covers electronics, appliances and white goods, where identity is something the manufacturer prints on the box.

What replaced the matching is deterministic identity resolution: brand, model, and a normalised variant signature — capacity, colour, dimensions, whatever distinguishes that product line — corroborated by barcode where the retailer publishes one. Rules I wrote, that I can read, that a colleague can disagree with, and that produce the same answer on Tuesday as on Monday. It runs in a fraction of the time, for none of the money, and when it is wrong, it is wrong in a way I can find and fix.

I do not think the first approach was stupid, and it did not fail. It answered the question I asked it, which turned out not to be the question the product needed. Product identity in retail is not a similarity problem; it is a normalisation problem wearing a similarity problem's clothes, and the resemblance is close enough to cost you a couple of months.

## What it is not

It is not microservices. Three modules with enforced boundaries inside one deployable have given me every property I actually wanted from separation — independent state, independent failure, code that cannot reach where it should not — and none of the operational cost I would have paid for the version with network calls between them. If one of those modules ever needs to scale on its own, the boundary is already there to cut along.

It is not a machine learning system, any more. See above.

And it is not finished. Price history is stored but barely used; the interesting things you can say to a shopper once you know what a product cost for the last six months are almost all still ahead.
