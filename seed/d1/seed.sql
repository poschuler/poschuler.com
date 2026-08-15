
INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, tags, repository, updates, series_slug, series_section, section_order, updated_at)
VALUES ('implementing-value-objects-in-nodejs', 'en', 'post', 'Implementing Value Objects in Node.js', 'A practical guide to implementing Value Objects in TypeScript and Node.js to create more robust and expressive domain models, inspired by Domain-Driven Design principles.', '2025-11-02', '["nodejs","typescript","ddd","software-architecture","value-object"]', 'https://github.com/poschuler/nodejs-ddd-value-objects', '[]', NULL, NULL, NULL, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('how-i-would-do-auth', NULL, 'link', 'How I would do auth', 'https://pilcrowonpaper.com/blog/how-i-would-do-auth/', 'pilcrow', '2024-07-31', '["auth","security","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('let-me-be', NULL, 'link', 'Let me be', 'https://www.epicweb.dev/talks/let-me-be', 'Epic Web', '2024-05-04', '["javascript","typescript","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('making-sense-of-typescript-generics', NULL, 'link', 'Making Sense of TypeScript Generics', 'https://kettanaito.com/blog/making-sense-of-typescript-generics', 'kettanaito', '2024-05-31', '["typescript","generics","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('migrating-from-radix-to-react-aria-improving-accessibility-and-ux', NULL, 'link', 'Migrating from Radix to React Aria: Improving Accessibility and UX', 'https://argos-ci.com/blog/react-aria-migration', 'argos CI', '2024-05-28', '["react-aria","radix","accessibility","webdev","ux"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('navigating-the-future-of-frontend', NULL, 'link', 'Navigating the future of frontend', 'https://frontendmastery.com/posts/navigating-the-future-of-frontend/', 'Frontend Mastery', '2024-04-23', '["frontend","javascript","typescript","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('oops-i-accidentally-made-our-website-faster-by-switching-to-remix', NULL, 'link', 'Oops, I accidentally made our website faster by switching to Remix', 'https://echobind.com/post/oops-i-accidentally-made-our-website-faster-by-switching-to-remix', 'Echobind', '2024-09-03', '["remix","performance","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('stop-lying-to-your-users', NULL, 'link', 'Stop Lying to Your Users', 'https://www.epicweb.dev/stop-lying-to-your-users', 'Epic Web', '2024-04-24', '["javascript","typescript","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('the-copenhagen-book', NULL, 'link', 'The Copenhagen Book', 'https://thecopenhagenbook.com/', 'pilcrow', '2024-07-30', '["auth","security","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, tags, repository, updates, series_slug, series_section, section_order, updated_at)
VALUES ('project-setup', 'en', 'post', 'Setup Node.js, Express & TypeScript Project in 2026', 'The definitive starting point for your next project. Learn to setup Node.js, Express, and TypeScript using a professional, class-based architecture designed for long-term maintainability and scale.', '2025-12-25', '["nodejs","typescript","express","backend"]', 'https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/initial-project-setup', '[]', 'pragmatic-nodejs-api', 'fundamentals', 0, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, tags, repository, updates, series_slug, series_section, section_order, updated_at)
VALUES ('schema-validation-and-error-handling', 'en', 'post', 'Schema Validation and Global Error Handling', 'Standardize your API integrity by implementing Zod for type-safe validation and a centralized error-handling middleware.', '2025-12-27', '["nodejs","typescript","express","backend","zod","error-handling"]', 'https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/validation-error-handling', '[]', 'pragmatic-nodejs-api', 'fundamentals', 1, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, tags, repository, updates, series_slug, series_section, section_order, updated_at)
VALUES ('vertical-slices-and-domain-logic', 'en', 'post', 'Vertical Slices Architecture and Domain Logic', 'Organize your Node.js API using Vertical Slices to encapsulate features and maintain a clear separation of concerns, enhancing maintainability and scalability.', '2026-02-20', '["nodejs","typescript","express","backend","vertical-slices","software-architecture"]', 'https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/vertical-slices-and-domain-logic', '[]', 'pragmatic-nodejs-api', 'fundamentals', 2, CURRENT_TIMESTAMP);

DELETE FROM content WHERE slug || ':' || ifnull(lang, '') NOT IN ('implementing-value-objects-in-nodejs:en', 'how-i-would-do-auth:', 'let-me-be:', 'making-sense-of-typescript-generics:', 'migrating-from-radix-to-react-aria-improving-accessibility-and-ux:', 'navigating-the-future-of-frontend:', 'oops-i-accidentally-made-our-website-faster-by-switching-to-remix:', 'stop-lying-to-your-users:', 'the-copenhagen-book:', 'project-setup:en', 'schema-validation-and-error-handling:en', 'vertical-slices-and-domain-logic:en');

INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES ('chekalo', 'en', 'Chekalo', 'A price intelligence platform for Peruvian retail: it ingests nine major retailers daily, resolves the same product across all of them into one canonical identity, and serves search and comparison from OpenSearch.', 'Chekalo ingests nine Peruvian retailers daily and resolves their listings into a single canonical catalog. How it is built, and the matching decision that was reversed.', 'flagship', 'active', '["TypeScript","Node.js","PostgreSQL","OpenSearch","Redis","BullMQ","React Router"]', 'https://chekalo.pe', NULL, 1, '[{"date":"2026-08-14","note":"First published."}]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES ('poschuler-com', 'en', 'poschuler.com', 'This site. Markdown in git, derived into D1 and KV at build time, served from a Cloudflare Worker — with the decisions written down as ADRs rather than remembered.', 'How poschuler.com is built: a build-time pipeline from Markdown into D1 and KV, hand-written SQL, and the architecture decisions recorded as ADRs.', 'supporting', 'active', '["TypeScript","React Router","Cloudflare Workers","D1","KV","Vitest"]', NULL, 'https://github.com/poschuler/poschuler.com', 2, '[{"date":"2026-08-14","note":"First published."}]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES ('pragmatic-nodejs-api', 'en', 'Pragmatic Node.js API', 'The codebase behind the series of the same name: a Node.js and TypeScript API built one decision at a time, with each stage on its own branch so a reader can check out the exact state a post describes.', 'The reference codebase for the Pragmatic Node.js API series — an Express and TypeScript API built decision by decision, each stage on its own branch.', 'supporting', 'active', '["TypeScript","Node.js","Express"]', NULL, 'https://github.com/poschuler/pragmatic-nodejs-api', 3, '[{"date":"2026-08-14","note":"First published."}]', CURRENT_TIMESTAMP);

DELETE FROM project WHERE slug || ':' || lang NOT IN ('chekalo:en', 'poschuler-com:en', 'pragmatic-nodejs-api:en');

INSERT OR REPLACE INTO series (slug, lang, title, description, status, starting_point, destination, out_of_scope, audience, updated_at)
VALUES ('pragmatic-nodejs-api', 'en', 'Pragmatic Node.js API', 'Building a monolithic Node.js API you can defend: structure, validation, persistence, tests, access control and a deployment — one part at a time.', 'ongoing', 'You can build a CRUD endpoint with Express and TypeScript, and you have hit the point where you no longer know where new code should go.', 'A monolithic API with real persistence, tests, access control and basic observability, deployed — one you can hold up in production and keep changing without fear.', '["Microservices","Event sourcing","CQRS with separate read models","Multi-tenancy","Modular monolith, in-process events and asynchronous processing — those are volume two"]', 'For you if you can ship features but cannot yet defend the structure they live in. Not for you if you are looking for a framework tour or a deployment tutorial.', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO series_section (series_slug, lang, slug, title, summary, status, section_order, updated_at)
VALUES ('pragmatic-nodejs-api', 'en', 'fundamentals', 'Fundamentals', 'The shape of the project: how it is set up, how input is validated, how errors are answered in one place, and where a feature''s code lives.', NULL, 0, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO series_section (series_slug, lang, slug, title, summary, status, section_order, updated_at)
VALUES ('pragmatic-nodejs-api', 'en', 'persistence', 'Persistence', 'Postgres behind the domain: migrations that run in order, repositories that keep SQL out of the rest of the code, and transactions that hold under concurrency.', NULL, 1, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO series_section (series_slug, lang, slug, title, summary, status, section_order, updated_at)
VALUES ('pragmatic-nodejs-api', 'en', 'correctness', 'Correctness', 'Tests that survive a refactor — unit tests against the domain, and integration tests against a real database in a container.', NULL, 2, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO series_section (series_slug, lang, slug, title, summary, status, section_order, updated_at)
VALUES ('pragmatic-nodejs-api', 'en', 'access-control', 'Access control', 'Who the caller is and what they may do: authentication, permissions, and the pagination, filtering and sorting a protected list endpoint needs.', NULL, 3, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO series_section (series_slug, lang, slug, title, summary, status, section_order, updated_at)
VALUES ('pragmatic-nodejs-api', 'en', 'operations', 'Operations', 'What it takes to run it: structured logging with request ids, a container image, and a deploy.', NULL, 4, CURRENT_TIMESTAMP);

DELETE FROM series WHERE slug || ':' || lang NOT IN ('pragmatic-nodejs-api:en');
DELETE FROM series_section WHERE series_slug || ':' || lang || ':' || slug NOT IN ('pragmatic-nodejs-api:en:fundamentals', 'pragmatic-nodejs-api:en:persistence', 'pragmatic-nodejs-api:en:correctness', 'pragmatic-nodejs-api:en:access-control', 'pragmatic-nodejs-api:en:operations');
