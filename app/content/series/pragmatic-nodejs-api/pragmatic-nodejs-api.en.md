---
type: 'series'
title: 'Pragmatic Node.js API'
description: 'Build a monolithic Node.js API: structure, validation, persistence, tests, access control and a deployment.'
status: 'ongoing'
startingPoint: 'You can build a CRUD endpoint with Express and TypeScript, but you do not know how to structure the project as it grows.'
destination: 'A monolithic API with real persistence, tests, access control and basic observability, deployed — one you can hold up in production and keep changing without fear.'
outOfScope:
  - 'Microservices'
  - 'Event sourcing'
  - 'CQRS'
  - 'Modular monolith'
audience: 'You want to build a monolithic Node.js API you can deploy to production and keep evolving over time.'
sections:
  - slug: 'fundamentals'
    title: 'Fundamentals'
    summary: 'How the project is set up, how input is validated, how errors are handled in one place, and a basic feature that shows how the solution is structured.'
    parts:
      - 'project-setup'
      - 'schema-validation-and-error-handling'
      - 'vertical-slices-and-domain-logic'
  - slug: 'persistence'
    title: 'Persistence'
    summary: 'Postgres as the database engine: migrations, repositories, transactions, and listings you can paginate, filter and sort.'
  - slug: 'correctness'
    title: 'Tests'
    summary: 'Tests: unit tests against the domain, and integration tests against a real Postgres in a test container.'
  - slug: 'access-control'
    title: 'Access control'
    summary: 'Who can get in and what they can do in the API: authentication and role-based authorisation, with no permission system behind it.'
  - slug: 'operations'
    title: 'Operations'
    summary: 'Structured logging and basic observability.'
---

Building an API in Node.js looks simple at first, but as the project grows the structure of the code becomes hard to maintain. This series is a guide to building and deploying an API yourself, with a simple and maintainable structure, one you can hold up in production and keep evolving over time.

Each section has a starting branch and a final branch, so the series is easy to follow.
