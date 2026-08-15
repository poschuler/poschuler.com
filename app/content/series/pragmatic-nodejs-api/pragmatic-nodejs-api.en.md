---
type: 'series'
title: 'Pragmatic Node.js API'
description: 'Building a monolithic Node.js API you can defend: structure, validation, persistence, tests, access control and a deployment — one part at a time.'
status: 'ongoing'
startingPoint: 'You can build a CRUD endpoint with Express and TypeScript, and you have hit the point where you no longer know where new code should go.'
destination: 'A monolithic API with real persistence, tests, access control and basic observability, deployed — one you can hold up in production and keep changing without fear.'
outOfScope:
  - 'Microservices'
  - 'Event sourcing'
  - 'CQRS with separate read models'
  - 'Multi-tenancy'
  - 'Modular monolith, in-process events and asynchronous processing — those are volume two'
audience: 'For you if you can ship features but cannot yet defend the structure they live in. Not for you if you are looking for a framework tour or a deployment tutorial.'
sections:
  - slug: 'fundamentals'
    title: 'Fundamentals'
    summary: 'The shape of the project: how it is set up, how input is validated, how errors are answered in one place, and where a feature''s code lives.'
    parts:
      - 'project-setup'
      - 'schema-validation-and-error-handling'
      - 'vertical-slices-and-domain-logic'
  - slug: 'persistence'
    title: 'Persistence'
    summary: 'Postgres behind the domain: migrations that run in order, repositories that keep SQL out of the rest of the code, and transactions that hold under concurrency.'
  - slug: 'correctness'
    title: 'Correctness'
    summary: 'Tests that survive a refactor — unit tests against the domain, and integration tests against a real database in a container.'
  - slug: 'access-control'
    title: 'Access control'
    summary: 'Who the caller is and what they may do: authentication, permissions, and the pagination, filtering and sorting a protected list endpoint needs.'
  - slug: 'operations'
    title: 'Operations'
    summary: 'What it takes to run it: structured logging with request ids, a container image, and a deploy.'
---

**This landing has not been written yet.** The contract above is final — the
starting point, the destination and what the series refuses to cover do not
change. What belongs here is the prose that says why the series exists, what
problem it came out of, and what makes it different from the tutorials it will
be found beside.

It is written before the series ships, and this paragraph is what makes its
absence visible rather than silent.
