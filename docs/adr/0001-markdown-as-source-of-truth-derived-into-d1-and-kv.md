# Markdown as source of truth, derived into D1 and KV at seed time

Content is authored as Markdown files under `app/content/` and versioned in git, but the Worker never reads or parses them. A build-time pipeline splits each file in two — front matter becomes a row in D1 (`content`), the body is rendered to HTML by `marked` and stored in KV under `blog:<slug>:<locale>` — so serving a Post is one KV read and listing Content Items is one indexed D1 query, with no Markdown parsing on the request path.

## Considered Options

- **Read the Markdown at runtime.** The files are already in the bundle, so this is the obvious thing to try. Rejected: it puts a Markdown parse on every request, and there is no cheap way to answer "give me everything published, newest first" without opening every file.
- **Store everything in D1, body included.** One store instead of two. Rejected: KV is the cheaper and lower-latency read for a large immutable blob served by exact key, which is precisely the Post-body access pattern.
- **Author directly in D1/KV, drop the Markdown.** Rejected: it gives up git as the editing and history mechanism for content.

## Consequences

- **D1 must be seeded before KV.** `seed/kv/generate-kv-json.ts` queries the seeded `content` table to decide which Posts to render. Running `kv:seed` against an empty D1 silently produces nothing.
- **Publishing is a deploy-time act, not a runtime one.** Merging a `.md` file changes nothing until the seed scripts run; the content stores are not self-updating.
- `front-matter`, `marked` and `@forge42/seo-tools` are runtime dependencies of the seed scripts only — they never appear in a Worker import, which looks like dead weight in `package.json` until you know why.
- The same Post exists in three places (Markdown, D1 row, KV value). Markdown wins every disagreement; the other two are regenerated wholesale, never patched.
