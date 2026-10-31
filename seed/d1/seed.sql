
INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, repository, updates, project_slug, container_order, updated_at)
VALUES ('designing-a-url-shortener', 'en', 'post', 'Designing a URL shortener', 'System design of a URL shortener: how to generate unique codes nobody can guess, how many characters to use, and how to scale the reads.', '2026-10-16', 'https://github.com/poschuler/url-shortener/tree/v1.0.0', '[]', NULL, NULL, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, repository, updates, project_slug, container_order, updated_at)
VALUES ('designing-a-url-shortener', 'es', 'post', 'Diseñando un URL shortener', 'System design de un acortador de URLs: cómo generar códigos únicos que no se puedan adivinar, cuántos caracteres usar y cómo escalar la lectura.', '2026-10-16', 'https://github.com/poschuler/url-shortener/tree/v1.0.0', '[]', NULL, NULL, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, repository, updates, project_slug, container_order, updated_at)
VALUES ('implementing-the-result-pattern-in-nodejs', 'en', 'post', 'Implementing the Result pattern in Node.js', 'How to implement the Result pattern in TypeScript and Node.js: known errors live in the signature, and try/catch is reserved for the ones that are truly unexpected.', '2026-10-26', 'https://github.com/poschuler/nodejs-result-pattern', '[]', NULL, NULL, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, repository, updates, project_slug, container_order, updated_at)
VALUES ('implementing-the-result-pattern-in-nodejs', 'es', 'post', 'Implementación del Result pattern en Node.js', 'Cómo implementar el Result pattern en TypeScript y Node.js: los errores conocidos quedan en la firma, y el try/catch se reserva para los que realmente son inesperados.', '2026-10-26', 'https://github.com/poschuler/nodejs-result-pattern', '[]', NULL, NULL, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, repository, updates, project_slug, container_order, updated_at)
VALUES ('implementing-value-objects-in-nodejs', 'en', 'post', 'Implementing Value Objects in Node.js', 'Implementing Value Objects in TypeScript and Node.js by building five real cases, from an email to a price, where every rule of the domain lives in a single place.', '2025-11-02', 'https://github.com/poschuler/nodejs-ddd-value-objects', '[{"date":"2026-09-07","note":"Rewritten end to end. Spanish is now where this post is written first, and this English version was translated from it by an LLM. It adds three value objects — Amount, Currency and Price — plus serialization and why Set and Map do not honor equality by value."}]', NULL, NULL, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, repository, updates, project_slug, container_order, updated_at)
VALUES ('implementing-value-objects-in-nodejs', 'es', 'post', 'Implementación de Value Objects en Node.js', 'Implementación de Value Objects en TypeScript y Node.js, construyendo cinco casos reales, de un email a un precio, donde cada regla del dominio vive en un solo lugar.', '2026-09-07', 'https://github.com/poschuler/nodejs-ddd-value-objects', '[]', NULL, NULL, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, updated_at)
VALUES ('how-i-would-do-auth', NULL, 'link', 'How I would do auth', 'https://pilcrowonpaper.com/blog/how-i-would-do-auth/', 'pilcrow', '2024-07-31', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, updated_at)
VALUES ('let-me-be', NULL, 'link', 'Let me be', 'https://www.epicweb.dev/talks/let-me-be', 'Epic Web', '2024-05-04', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, updated_at)
VALUES ('making-sense-of-typescript-generics', NULL, 'link', 'Making Sense of TypeScript Generics', 'https://kettanaito.com/blog/making-sense-of-typescript-generics', 'kettanaito', '2024-05-31', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, updated_at)
VALUES ('migrating-from-radix-to-react-aria-improving-accessibility-and-ux', NULL, 'link', 'Migrating from Radix to React Aria: Improving Accessibility and UX', 'https://argos-ci.com/blog/react-aria-migration', 'argos CI', '2024-05-28', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, updated_at)
VALUES ('navigating-the-future-of-frontend', NULL, 'link', 'Navigating the future of frontend', 'https://frontendmastery.com/posts/navigating-the-future-of-frontend/', 'Frontend Mastery', '2024-04-23', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, updated_at)
VALUES ('oops-i-accidentally-made-our-website-faster-by-switching-to-remix', NULL, 'link', 'Oops, I accidentally made our website faster by switching to Remix', 'https://echobind.com/post/oops-i-accidentally-made-our-website-faster-by-switching-to-remix', 'Echobind', '2024-09-03', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, updated_at)
VALUES ('stop-lying-to-your-users', NULL, 'link', 'Stop Lying to Your Users', 'https://www.epicweb.dev/stop-lying-to-your-users', 'Epic Web', '2024-04-24', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, updated_at)
VALUES ('the-copenhagen-book', NULL, 'link', 'The Copenhagen Book', 'https://thecopenhagenbook.com/', 'pilcrow', '2024-07-30', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('designing-a-url-shortener', 'en', 'system-design');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('designing-a-url-shortener', 'en', 'software-architecture');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('designing-a-url-shortener', 'en', 'backend');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('designing-a-url-shortener', 'es', 'system-design');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('designing-a-url-shortener', 'es', 'software-architecture');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('designing-a-url-shortener', 'es', 'backend');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-the-result-pattern-in-nodejs', 'en', 'nodejs');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-the-result-pattern-in-nodejs', 'en', 'typescript');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-the-result-pattern-in-nodejs', 'en', 'error-handling');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-the-result-pattern-in-nodejs', 'en', 'backend');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-the-result-pattern-in-nodejs', 'es', 'nodejs');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-the-result-pattern-in-nodejs', 'es', 'typescript');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-the-result-pattern-in-nodejs', 'es', 'error-handling');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-the-result-pattern-in-nodejs', 'es', 'backend');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-value-objects-in-nodejs', 'en', 'nodejs');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-value-objects-in-nodejs', 'en', 'typescript');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-value-objects-in-nodejs', 'en', 'domain-driven-design');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-value-objects-in-nodejs', 'en', 'software-architecture');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-value-objects-in-nodejs', 'en', 'value-object');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-value-objects-in-nodejs', 'es', 'nodejs');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-value-objects-in-nodejs', 'es', 'typescript');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-value-objects-in-nodejs', 'es', 'domain-driven-design');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-value-objects-in-nodejs', 'es', 'software-architecture');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('implementing-value-objects-in-nodejs', 'es', 'value-object');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('how-i-would-do-auth', NULL, 'auth');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('how-i-would-do-auth', NULL, 'security');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('how-i-would-do-auth', NULL, 'webdev');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('let-me-be', NULL, 'javascript');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('let-me-be', NULL, 'typescript');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('let-me-be', NULL, 'webdev');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('making-sense-of-typescript-generics', NULL, 'typescript');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('making-sense-of-typescript-generics', NULL, 'generics');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('making-sense-of-typescript-generics', NULL, 'webdev');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('migrating-from-radix-to-react-aria-improving-accessibility-and-ux', NULL, 'react-aria');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('migrating-from-radix-to-react-aria-improving-accessibility-and-ux', NULL, 'radix');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('migrating-from-radix-to-react-aria-improving-accessibility-and-ux', NULL, 'accessibility');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('migrating-from-radix-to-react-aria-improving-accessibility-and-ux', NULL, 'webdev');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('migrating-from-radix-to-react-aria-improving-accessibility-and-ux', NULL, 'ux');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('navigating-the-future-of-frontend', NULL, 'frontend');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('navigating-the-future-of-frontend', NULL, 'javascript');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('navigating-the-future-of-frontend', NULL, 'typescript');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('navigating-the-future-of-frontend', NULL, 'webdev');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('oops-i-accidentally-made-our-website-faster-by-switching-to-remix', NULL, 'remix');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('oops-i-accidentally-made-our-website-faster-by-switching-to-remix', NULL, 'performance');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('oops-i-accidentally-made-our-website-faster-by-switching-to-remix', NULL, 'webdev');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('stop-lying-to-your-users', NULL, 'javascript');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('stop-lying-to-your-users', NULL, 'typescript');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('stop-lying-to-your-users', NULL, 'webdev');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('the-copenhagen-book', NULL, 'auth');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('the-copenhagen-book', NULL, 'security');

INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES ('the-copenhagen-book', NULL, 'webdev');

DELETE FROM content WHERE slug || ':' || ifnull(lang, '') NOT IN ('designing-a-url-shortener:en', 'designing-a-url-shortener:es', 'implementing-the-result-pattern-in-nodejs:en', 'implementing-the-result-pattern-in-nodejs:es', 'implementing-value-objects-in-nodejs:en', 'implementing-value-objects-in-nodejs:es', 'how-i-would-do-auth:', 'let-me-be:', 'making-sense-of-typescript-generics:', 'migrating-from-radix-to-react-aria-improving-accessibility-and-ux:', 'navigating-the-future-of-frontend:', 'oops-i-accidentally-made-our-website-faster-by-switching-to-remix:', 'stop-lying-to-your-users:', 'the-copenhagen-book:');
DELETE FROM content_tag WHERE slug || ':' || ifnull(lang, '') || ':' || tag NOT IN ('designing-a-url-shortener:en:system-design', 'designing-a-url-shortener:en:software-architecture', 'designing-a-url-shortener:en:backend', 'designing-a-url-shortener:es:system-design', 'designing-a-url-shortener:es:software-architecture', 'designing-a-url-shortener:es:backend', 'implementing-the-result-pattern-in-nodejs:en:nodejs', 'implementing-the-result-pattern-in-nodejs:en:typescript', 'implementing-the-result-pattern-in-nodejs:en:error-handling', 'implementing-the-result-pattern-in-nodejs:en:backend', 'implementing-the-result-pattern-in-nodejs:es:nodejs', 'implementing-the-result-pattern-in-nodejs:es:typescript', 'implementing-the-result-pattern-in-nodejs:es:error-handling', 'implementing-the-result-pattern-in-nodejs:es:backend', 'implementing-value-objects-in-nodejs:en:nodejs', 'implementing-value-objects-in-nodejs:en:typescript', 'implementing-value-objects-in-nodejs:en:domain-driven-design', 'implementing-value-objects-in-nodejs:en:software-architecture', 'implementing-value-objects-in-nodejs:en:value-object', 'implementing-value-objects-in-nodejs:es:nodejs', 'implementing-value-objects-in-nodejs:es:typescript', 'implementing-value-objects-in-nodejs:es:domain-driven-design', 'implementing-value-objects-in-nodejs:es:software-architecture', 'implementing-value-objects-in-nodejs:es:value-object', 'how-i-would-do-auth::auth', 'how-i-would-do-auth::security', 'how-i-would-do-auth::webdev', 'let-me-be::javascript', 'let-me-be::typescript', 'let-me-be::webdev', 'making-sense-of-typescript-generics::typescript', 'making-sense-of-typescript-generics::generics', 'making-sense-of-typescript-generics::webdev', 'migrating-from-radix-to-react-aria-improving-accessibility-and-ux::react-aria', 'migrating-from-radix-to-react-aria-improving-accessibility-and-ux::radix', 'migrating-from-radix-to-react-aria-improving-accessibility-and-ux::accessibility', 'migrating-from-radix-to-react-aria-improving-accessibility-and-ux::webdev', 'migrating-from-radix-to-react-aria-improving-accessibility-and-ux::ux', 'navigating-the-future-of-frontend::frontend', 'navigating-the-future-of-frontend::javascript', 'navigating-the-future-of-frontend::typescript', 'navigating-the-future-of-frontend::webdev', 'oops-i-accidentally-made-our-website-faster-by-switching-to-remix::remix', 'oops-i-accidentally-made-our-website-faster-by-switching-to-remix::performance', 'oops-i-accidentally-made-our-website-faster-by-switching-to-remix::webdev', 'stop-lying-to-your-users::javascript', 'stop-lying-to-your-users::typescript', 'stop-lying-to-your-users::webdev', 'the-copenhagen-book::auth', 'the-copenhagen-book::security', 'the-copenhagen-book::webdev');

INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES ('chekalo', 'en', 'Chekalo', 'A price intelligence platform for Peruvian retail: it ingests nine major retailers daily, resolves the same product across all of them into one canonical identity, and serves search and comparison from OpenSearch.', 'Chekalo ingests nine Peruvian retailers daily and resolves their listings into one canonical catalog — a normalization problem, not a similarity one.', 'flagship', 'active', '["TypeScript","Node.js","PostgreSQL","OpenSearch","Redis","BullMQ","React Router"]', 'https://chekalo.pe', NULL, 1, '[{"date":"2026-08-14","note":"First published."}]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES ('chekalo', 'es', 'Chekalo', 'Plataforma de inteligencia de precios para el retail peruano: ingesta diaria de nueve retailers, identifica un mismo producto entre todos ellos bajo una identidad canónica y usa OpenSearch como motor de búsqueda y comparación.', 'Chekalo procesa a diario los catálogos de nueve retailers peruanos y los resuelve en un único catálogo canónico — un problema de normalización, no de similitud.', 'flagship', 'active', '["TypeScript","Node.js","PostgreSQL","OpenSearch","Redis","BullMQ","React Router"]', 'https://chekalo.pe', NULL, 1, '[{"date":"2026-08-14","note":"First published."}]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES ('poschuler-com', 'en', 'poschuler.com', 'This site. Markdown in git, derived into D1 and KV at build time, served from a Cloudflare Worker — with the decisions written down as ADRs rather than remembered.', 'How poschuler.com is built: a build-time pipeline from Markdown into D1 and KV, hand-written SQL, and the architecture decisions recorded as ADRs.', 'supporting', 'active', '["TypeScript","React Router","Cloudflare Workers","D1","KV","Vitest"]', NULL, 'https://github.com/poschuler/poschuler.com', 2, '[{"date":"2026-08-14","note":"First published."}]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES ('url-shortener', 'en', 'URL Shortener', 'Short codes nobody can guess, generated without a database round trip on every write, and a read path that scales on its own and keeps answering when Redis goes down.', 'A URL shortener in Node.js and TypeScript with Fastify, PostgreSQL and Redis: unguessable short codes, separate reads and writes, every decision in an ADR.', 'supporting', 'active', '["TypeScript","Node.js","Fastify","PostgreSQL","Redis"]', NULL, 'https://github.com/poschuler/url-shortener', 4, '[{"date":"2026-10-16","note":"First published."}]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES ('url-shortener', 'es', 'URL Shortener', 'Códigos cortos que no se pueden adivinar, generados sin ir a la base de datos en cada escritura, y una lectura que escala por separado y sigue respondiendo si Redis se cae.', 'Acortador de URLs en Node.js y TypeScript con Fastify, PostgreSQL y Redis: códigos que no se pueden adivinar, lectura y escritura separadas, decisiones en ADRs.', 'supporting', 'active', '["TypeScript","Node.js","Fastify","PostgreSQL","Redis"]', NULL, 'https://github.com/poschuler/url-shortener', 4, '[{"date":"2026-10-16","note":"Primera publicación."}]', CURRENT_TIMESTAMP);

DELETE FROM project WHERE slug || ':' || lang NOT IN ('chekalo:en', 'chekalo:es', 'poschuler-com:en', 'url-shortener:en', 'url-shortener:es');
