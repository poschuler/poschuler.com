---
type: 'project'
title: 'URL Shortener'
summary: 'Short codes nobody can guess, generated without a database round trip on every write, and a read path that scales on its own and keeps answering when Redis goes down.'
description: 'A URL shortener in Node.js and TypeScript with Fastify, PostgreSQL and Redis: unguessable short codes, separate reads and writes, every decision in an ADR.'
tier: 'supporting'
status: 'active'
stack: ['TypeScript', 'Node.js', 'Fastify', 'PostgreSQL', 'Redis']
repoUrl: 'https://github.com/poschuler/url-shortener'
sortOrder: 4
updates:
  - date: '2026-10-16'
    note: 'First published.'
---

A URL shortener in Node.js and TypeScript. It exposes two endpoints: a write endpoint that takes a target URL and returns a short code, and a read endpoint that takes that code as a path parameter and redirects to the target URL.

It is a modular monolith that runs as two processes, one for reads and one for writes. They were split because reads usually far outnumber writes, and with separate instances each side scales on its own. The read side also puts Redis in front as a cache to keep response times down.

There is more on the design decisions in [Designing a URL shortener](/blog/designing-a-url-shortener).

## Design decisions

- **Codes nobody can guess.** Each link gets a sequential ID, which goes through a keyed Feistel network before it becomes a code, so knowing one code gets you nowhere near the others (`short-code-permutation.ts`, ADR-0004).
- **IDs reserved in blocks.** Each process reserves blocks of a thousand IDs from a Postgres sequence and hands them out from memory, so creating a link never needs a query to get its ID (`ranged-number-sequence.ts`, ADR-0010 and ADR-0011).
- **Reads that do not depend on Redis.** If Redis goes down, reads keep being served from Postgres: slower, but without errors (`redis-link-cache.ts`, ADR-0017).

## Scope

- **Built for production.** Hexagonal architecture with a thin layer of DDD, layer boundaries enforced with dependency-cruiser, contract tests and a k6 load test of the read path. Each piece has an ADR explaining why it is there.
- **Out of scope.** There is no authentication, links cannot be edited or deleted, and visits are not recorded.

## Architecture

![Container diagram of the URL shortener](https://raw.githubusercontent.com/poschuler/url-shortener/refs/tags/v1.0.0/architecture/diagrams/dark/containers.svg)

The code, the ADRs and all three levels of the C4 model are in the [repository](https://github.com/poschuler/url-shortener), along with the steps to run it locally.
