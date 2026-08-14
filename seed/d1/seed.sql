
INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, tags, repository, updates, updated_at)
VALUES ('implementing-value-objects-in-nodejs', 'en', 'post', 'Implementing Value Objects in Node.js', 'A practical guide to implementing Value Objects in TypeScript and Node.js to create more robust and expressive domain models, inspired by Domain-Driven Design principles.', '2025-11-02', '["nodejs","typescript","ddd","architecture","value-object"]', 'https://github.com/poschuler/nodejs-ddd-value-objects', '[]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, tags, repository, updates, updated_at)
VALUES ('pragmatic-nodejs-api-schema-validation-and-global-error-handling', 'en', 'post', 'Pragmatic Node.js API #2: Schema Validation and Global Error Handling', 'Standardize your API integrity by implementing Zod for type-safe validation and a centralized error-handling middleware.', '2025-12-27', '["Nodejs","TypeScript","Express","Backend","Zod","Error Handling"]', 'https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/validation-error-handling', '[]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, tags, repository, updates, updated_at)
VALUES ('pragmatic-nodejs-api-setup-nodejs-express-typescript-project', 'en', 'post', 'Pragmatic Node.js API #1: Setup Node.js, Express & TypeScript Project in 2026', 'The definitive starting point for your next project. Learn to setup Node.js, Express, and TypeScript using a professional, class-based architecture designed for long-term maintainability and scale.', '2025-12-25', '["Nodejs","TypeScript","Express","Backend"]', 'https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/initial-project-setup', '[]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, tags, repository, updates, updated_at)
VALUES ('pragmatic-nodejs-api-vertical-slices-and-domain-logic', 'en', 'post', 'Pragmatic Node.js API #3: Vertical Slices Architecture and Domain Logic', 'Organize your Node.js API using Vertical Slices to encapsulate features and maintain a clear separation of concerns, enhancing maintainability and scalability.', '2026-02-20', '["Nodejs","TypeScript","Express","Backend","Vertical Slices","Software Architecture"]', 'https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/vertical-slices-and-domain-logic', '[]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('how-i-would-do-auth', NULL, 'link', 'How I would do auth', 'https://pilcrowonpaper.com/blog/how-i-would-do-auth/', 'pilcrow', '2024-07-31', '["auth","security","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('let-me-be', NULL, 'link', 'Let me be', 'https://www.epicweb.dev/talks/let-me-be', 'Epic Web', '2024-05-04', '["javascript","typescript","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('making-sense-of-typescript-generics', NULL, 'link', 'Making Sense of TypeScript Generics', 'https://kettanaito.com/blog/making-sense-of-typescript-generics', 'kettanaito', '2024-05-31', '["typescript","generics","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('migrating-from-radix-to-react-aria-improving-accessibility-and-ux', NULL, 'link', 'Migrating from Radix to React Aria: Improving Accessibility and UX', 'https://argos-ci.com/blog/react-aria-migration', 'argos CI', '2024-05-28', '["react-aria","radix","accessibility","webdev","UX"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('navigating-the-future-of-frontend', NULL, 'link', 'Navigating the future of frontend', 'https://frontendmastery.com/posts/navigating-the-future-of-frontend/', 'Frontend Mastery', '2024-04-23', '["frontend","javascript","typescript","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('oops-i-accidentally-made-our-website-faster-by-switching-to-remix', NULL, 'link', 'Oops, I accidentally made our website faster by switching to Remix', 'https://echobind.com/post/oops-i-accidentally-made-our-website-faster-by-switching-to-remix', 'Echobind', '2024-09-03', '["remix","performance","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('stop-lying-to-your-users', NULL, 'link', 'Stop Lying to Your Users', 'https://www.epicweb.dev/stop-lying-to-your-users', 'Epic Web', '2024-04-24', '["javascript","typescript","webdev"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES ('the-copenhagen-book', NULL, 'link', 'The Copenhagen Book', 'https://thecopenhagenbook.com/', 'pilcrow', '2024-07-30', '["auth","security","webdev"]', CURRENT_TIMESTAMP);

DELETE FROM content WHERE slug || ':' || ifnull(lang, '') NOT IN ('implementing-value-objects-in-nodejs:en', 'pragmatic-nodejs-api-schema-validation-and-global-error-handling:en', 'pragmatic-nodejs-api-setup-nodejs-express-typescript-project:en', 'pragmatic-nodejs-api-vertical-slices-and-domain-logic:en', 'how-i-would-do-auth:', 'let-me-be:', 'making-sense-of-typescript-generics:', 'migrating-from-radix-to-react-aria-improving-accessibility-and-ux:', 'navigating-the-future-of-frontend:', 'oops-i-accidentally-made-our-website-faster-by-switching-to-remix:', 'stop-lying-to-your-users:', 'the-copenhagen-book:');

INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES ('chekalo', 'en', 'Chékalo', 'A price intelligence platform for Peruvian retail: it ingests nine major retailers daily, resolves the same product across all of them into one canonical identity, and serves search and comparison from OpenSearch.', 'Chékalo ingests nine Peruvian retailers daily and resolves their listings into a single canonical catalog. How it is built, and the matching decision that was reversed.', 'flagship', 'active', '["TypeScript","Node.js","PostgreSQL","OpenSearch","Redis","BullMQ","React Router"]', 'https://chekalo.pe', NULL, 1, '[{"date":"2026-08-14","note":"First published."}]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES ('poschuler-com', 'en', 'poschuler.com', 'This site. Markdown in git, derived into D1 and KV at build time, served from a Cloudflare Worker — with the decisions written down as ADRs rather than remembered.', 'How poschuler.com is built: a build-time pipeline from Markdown into D1 and KV, hand-written SQL, and the architecture decisions recorded as ADRs.', 'supporting', 'active', '["TypeScript","React Router","Cloudflare Workers","D1","KV","Vitest"]', NULL, 'https://github.com/poschuler/poschuler.com', 2, '[{"date":"2026-08-14","note":"First published."}]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES ('pragmatic-nodejs-api', 'en', 'Pragmatic Node.js API', 'The codebase behind the series of the same name: a Node.js and TypeScript API built one decision at a time, with each stage on its own branch so a reader can check out the exact state a post describes.', 'The reference codebase for the Pragmatic Node.js API series — an Express and TypeScript API built decision by decision, each stage on its own branch.', 'supporting', 'active', '["TypeScript","Node.js","Express"]', NULL, 'https://github.com/poschuler/pragmatic-nodejs-api', 3, '[{"date":"2026-08-14","note":"First published."}]', CURRENT_TIMESTAMP);

DELETE FROM project WHERE slug || ':' || lang NOT IN ('chekalo:en', 'poschuler-com:en', 'pragmatic-nodejs-api:en');
