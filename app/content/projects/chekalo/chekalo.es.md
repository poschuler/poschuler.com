---
type: 'project'
title: 'Chekalo'
summary: 'Plataforma de inteligencia de precios para el retail peruano: ingesta diaria de nueve retailers, identifica un mismo producto entre todos ellos bajo una identidad canónica y usa OpenSearch como motor de búsqueda y comparación.'
description: 'Chekalo procesa a diario los catálogos de nueve retailers peruanos y los resuelve en un único catálogo canónico — un problema de normalización, no de similitud.'
tier: 'flagship'
status: 'active'
stack: ['TypeScript', 'Node.js', 'PostgreSQL', 'OpenSearch', 'Redis', 'BullMQ', 'React Router']
liveUrl: 'https://chekalo.pe'
sortOrder: 1
updates:
  - date: '2026-08-14'
    note: 'First published.'
---

Cuando buscas un producto entre los diferentes catálogos web de los retailers, te encuentras con que una misma lavadora es `Samsung WA13CG5745BV` en el primero, una *Lavadora Samsung 13kg Carga Superior Negro* en el segundo, y el tercero utiliza un nombre distinto. Los productos rara vez comparten un identificador que permita emparejarlos, y tampoco existe un lugar donde consultarlos de forma consolidada. Si quieres saber que las tres fichas pertenecen al mismo producto, alguien tiene que emparejarlas manualmente.

Una herramienta de comparación de precios depende de un correcto emparejamiento de productos. Si esto falla, el usuario no ve una oferta: ve el precio de dos productos distintos. No es un error de precio, es un error de producto. Este es el problema que Chekalo resuelve. Todos los días recoge los catálogos de los principales retailers del país y consolida sus fichas en una identidad canónica, para que el usuario pueda ver el precio de cada tienda en una misma página.

Los retailers suelen subir el precio de un producto para bajarlo al día siguiente y presentarlo como oferta, pero con el número de un solo día el usuario no tiene cómo identificar una oferta real. Chekalo sabe algo que los retailers no dicen. Conoce el precio a través del tiempo y presenta el historial en cada producto: lo que costó cada día que fue observado, cuánto se movió la última vez y cuándo. Con eso el usuario puede decidir si es o no un buen momento para comprar.

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
