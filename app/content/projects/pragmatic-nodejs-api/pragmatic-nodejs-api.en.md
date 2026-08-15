---
type: 'project'
title: 'Pragmatic Node.js API'
summary: 'The codebase behind the series of the same name: a Node.js and TypeScript API built one decision at a time, with each stage on its own branch so a reader can check out the exact state a post describes.'
description: 'The reference codebase for the Pragmatic Node.js API series — an Express and TypeScript API built decision by decision, each stage on its own branch.'
tier: 'supporting'
status: 'active'
stack: ['TypeScript', 'Node.js', 'Express']
repoUrl: 'https://github.com/poschuler/pragmatic-nodejs-api'
sortOrder: 3
updates:
  - date: '2026-08-14'
    note: 'First published.'
---

This one is a repository in service of the writing, not the other way round.

The series it belongs to answers a question I keep being asked by developers who are past the tutorial stage: *I can ship features, but I cannot defend the structure they live in.* Every post takes one decision — where configuration is validated, where the domain ends and the transport begins, what a mapper is for — argues it, and implements it.

The repository is what makes that checkable. Each stage lives on its own branch, so a post's code can be read as a diff rather than as a finished thing that arrived from nowhere. You can check out the exact state the words describe.

## Why it is deliberately boring

No framework of my own, no clever abstractions, no dependency injection container. Express, TypeScript, and structure.

That is the argument, not a limitation of it. The problem the series addresses is not a missing library — it is that nobody told the reader *where things go*, and adding a framework on top of that confusion buys a different confusion with a steeper exit. Everything in the repository is something a reader could have written and can therefore change.

## Where it ends

The destination is stated up front and does not move: a monolithic API with real persistence, tests, access control and basic observability, deployed — one you can hold up in production and keep changing without fear.

Explicitly outside it: microservices, event sourcing, CQRS with separate read models, multi-tenancy. Modular monoliths, in-process events and asynchronous processing are a second arc, not this one.

Writing down what a thing will *not* cover turns out to generate more trust than anything it promises. It is also the reason the scope has not drifted.
