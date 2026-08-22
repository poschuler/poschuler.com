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

When you go looking for a product across retailers' web catalogues, the same washing machine is a `Samsung WA13CG5745BV` in the first, a *Lavadora Samsung 13kg Carga Superior Negro* in the second, and something else again in the third. Listings rarely share an identifier you could pair them on, and there is nowhere to look them up together. If you want to know that those three listings are one product, someone has to pair them by hand.

A price comparison tool is only as good as its matching. When the matching is wrong the shopper is not looking at a deal, they are looking at the prices of two different products. It is not a wrong price, it is a wrong product. That is the problem Chekalo solves. Every day it collects the catalogues of the country's major retailers and resolves their listings into one canonical identity, so a shopper can see every store's price on a single page.

Retailers will raise a price so they can drop it the next day and call it an offer, and with a single day's number there is no way to tell a real discount from a staged one. Chekalo knows something the retailers do not say. It knows the price over time, and it shows that history on every product: what it cost on each day it was observed, how far it last moved and when. From there a shopper can decide whether this is a good moment to buy.

## Inside Chekalo

A modular monolith with three clearly defined modules. Each one persists its data in schemas of its own, which is what holds the boundaries between them.

**Retail Ingestion** collects each store's catalogue daily and stores what it read, without interpreting it. Every retailer is its own integration, with its own adapter and its own rate limit, managed through BullMQ.

**Catalog** is where the hard part lives. It takes the listings and decides what they mean: which ones are the same product, what each store is asking for it, and how the price moved.

**Search Projection** carries the resolved catalogue into a search index, projecting only what changed, and rebuilds it without search ever going quiet.

The site reads the OpenSearch index directly: it has no database of its own and no API behind it.

## Product identity is not a similarity problem

Chekalo matches products in technology, appliances and white goods. The first version was more ambitious than this one: it tried to match every category, groceries included, where the same five kilos of rice are *Arroz Extra 5Kg* in one catalogue and *Arroz Superior Bolsa 5 Kilos* in the next, and where half the aisle is the retailer's own label, so the brands do not line up either. And past the packaged aisles there is everything sold loose. A kilo of *palta* has no brand, no model and no barcode: one retailer lists it as *Palta Fuerte*, another as *Palta*, and nothing more. If that second one is, say, a *Hass*, the gap between those two prices is not a saving I am showing a shopper, it is a different fruit. If product identity in appliances is ambiguous, in food there is often nothing to read at all.

After trying different approaches I ended up on a vector database. Identity was not reliable, so similarity was the only handle left: listings became embeddings, candidate pairs came out of cosine distance, and an LLM settled the ones sitting near the threshold. It was not perfect, but it worked, and reviewing the pairs I agreed with most of them. Accuracy was never the problem. Everything around the accuracy was, and as the months went by this approach got harder to justify:

**It was not reproducible.** The same catalogue, run twice against the same models, could produce different matches: a different set of candidates surfaced, and the judge deciding between them does not return the same verdict every time. For a system whose entire value is the claim *these two prices are for the same product*, "usually" is not enough.

**Matches expired with the model.** The daily increment was manageable. But changing the embedding model, or the model making the decision, means every match already in the catalogue was made by a version that no longer exists, so the whole catalogue has to be reprocessed from zero. That does not fit in the window I have to put a price in front of a shopper while the offer is still real.

**It could not be audited.** When it paired two products that were not the same, the answer to *why* was a number. There was nothing to fix, only a threshold to nudge, and nudging it to rescue one pair broke another somewhere else in the catalogue.

**It cost money every time it ran.** Every new product, every change in the catalogue and every change of model turned into new embeddings to generate and new prompts to pay for, one at a time or in bulk. A recurring cost that grew with the catalogue and that the project could not carry.

All of it added up to a system I could neither audit nor afford, which left it with very little to stand on. But the real problem was not the matching method, it was the categories where identity is illegible or simply absent. A similarity score pairs *Palta* with *Palta Hass* at high confidence, because as far as similarity goes they are nearly the same thing, and there is no threshold that solves that. So I changed Chekalo's scope to the categories where identity is easier to read.

What replaced probabilistic matching is deterministic identity resolution: brand, model, and a normalised variant signature, whether that is capacity, colour or dimensions, whatever distinguishes that product line, corroborated by barcode where the retailer publishes one. Rules I wrote, that I can read, that someone else can disagree with, and that give the same answer on Tuesday as on Monday. It runs in a fraction of the time, no decision costs money, and when it is wrong it is wrong in a way I can find and fix.

I do not think the first approach was bad, and it did not fail. It answered the question I asked it, which was whether two listings were similar. The question the product needed was a different one: whether they are really the same product. Identity in retail is not a similarity problem, it is a normalisation problem dressed up as one.

## What Chekalo is not

It is not microservices. The boundaries are in the code, not in the deployment units.

It is not a store. Chekalo sells nothing: every price is a reference taken from the retailers' own catalogues, and every offer sends the shopper to the retailer that published it.

It is not real time. Prices refresh once a day, so there is always a chance that one has moved, that the product has sold out, or that the retailer has stopped carrying it.
