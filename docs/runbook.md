# Runbook

What to do when something is wrong with what production is serving. This file is procedure only — **why** any of it is shaped this way is in [`architecture.md`](./architecture.md), and the decisions behind it are in [`docs/adr/`](./adr/README.md).

Everything here assumes wrangler authenticated against the account, with the three permissions the CI token has and no more: `D1:Edit`, `Workers KV Storage:Edit`, `Workers Scripts:Edit`.

## First: what is actually serving

```bash
pnpm exec wrangler deployments status    # the active version, and its share of traffic
pnpm exec wrangler versions list         # the ten most recent
```

`scripts/verify-deployment.sh <version-id>` is the same read as an assertion, and it refuses anything that is not that version at 100% — including a traffic split nobody meant to configure.

**None of this proves the site works.** It proves which code is live. Nothing in this repository makes a request to `poschuler.com`, because Bot Fight Mode challenges datacentre clients and a check that cannot fail reads like cover — see Known defects. To know the site serves, open it.

## The publication, step by step, and what a failure leaves behind

One CI job owns the whole sequence (ADR 0003). What matters when it goes red is **where** it stopped, because that decides what has already been written:

| # | Step | Written by the time it fails | If it fails here |
|---|---|---|---|
| 1 | `d1:migrate:remote` | the deployed schema may have moved | Safe to re-run — applied migrations are skipped. Fix forward; there is no down migration, by design |
| 2 | `verify:schema:remote` | nothing | The deployed shape is not what `schema.sql` declares. **Do not seed.** Diagnose first — this step exists to stop exactly here |
| 3 | Seed D1 | rows, upserted and pruned | Safe to re-run |
| 4 | Seed KV | payloads, written before anything is deleted | Safe to re-run |
| 5 | `verify:stores:remote` | nothing | A store does not hold what the repo says. Re-run the seed, then this |
| 6 | `pnpm run deploy` | **the stores have already moved** | The one that leaves a mismatch — see below |
| 7 | `verify-deployment.sh` | nothing | The upload was accepted but is not serving. Read the version ids it printed |

**Steps 1, 3 and 4 are idempotent and none of them empties anything first**, which is what makes the first response almost always the right one: re-run the job. A publication carrying no schema change is a no-op at step 1, the seeds upsert, and no request ever lands on a half-empty store.

## Old code is serving new content

The state step 6 leaves. It is the failure mode this order deliberately chose: seeding first means a failed deploy leaves the stores ahead of the code, and the reverse — new code over old content — 404s a Post that was just published.

Usually harmless, because the common change is adding content and old code lists it fine. **The case that is not** is a commit that changed the *shape* of a KV payload: that page is broken until the deploy lands. Nothing enforces it, but the way to avoid it is to split such a change across two merges.

Fix forward. Merge the fix, or re-run the failed job — do not roll the stores back to match the old code.

## Rolling back the Worker

```bash
pnpm exec wrangler rollback <version-id> -m "why"
```

**It rolls back the Worker and nothing else.** D1 and KV stay where they are, because they were seeded before the deploy — so a rollback deliberately produces the same state as a failed deploy: old code over new content, with the same caveat about payload shape.

**It cannot undo a migration, and does not need to.** There are no down migrations here, which is a decision rather than an omission: migrations are DDL and never a backfill, and a column is dropped a *publication later* than its last reader (ADR 0006 and both its amendments). That expand-and-contract discipline is what makes the previous version of the Worker still run against the migrated schema — the rename that cost two publications bought exactly this.

## Reverting content

There is no such thing as rolling a store back. D1 and KV are a complete projection of the Markdown in this repository (ADR 0001), so reverting content means reverting the commit and publishing again.

By hand, from a checkout of the commit you want served:

```bash
pnpm run d1:seed:remote        # front matter → seed.sql → deployed D1
pnpm run kv:seed:remote        # bodies → payloads → deployed KV
pnpm run verify:stores:remote  # read both back and compare against the Markdown
```

**D1 before KV, always** — the KV generator reads the seeded D1 to decide what to render. And note what these seed *from*: the working tree, not the deployed commit. Check out what you mean to serve before running them.

## Symptoms with a known cause

| Symptom | Cause | What to check |
|---|---|---|
| A var in `wrangler.jsonc` appears to have no effect | a secret of the same name shadows it in production | `pnpm exec wrangler secret list`, before anything else |
| `robots.txt` lost its `Sitemap:` line | Cloudflare's managed robots.txt merges with the Worker's only when the origin answers **200**; while the route was throwing, Cloudflare's block was served alone and the failure was invisible | Request `/robots.txt` directly before suspecting the dashboard |
| Every route returns 1101 | a module reading configuration at evaluation time, throwing on a missing value | `pnpm run smoke` reproduces it locally in the one environment that shows it — an empty one |
| A visitor's theme is frozen while each click writes a new value | two cookies of the same name, one host-only and one with a `Domain` | Cannot recur — the cookie is `__Host-` prefixed, which forbids `Domain` — but it is the precedent for why |

## What nobody is watching

**Nothing checks that production actually serves.** The publication proves the stores hold the right content and that the uploaded version is live; the cold start proves the built Worker boots with nothing configured. Neither makes a request to the site. A missing secret, or a binding pointing at the wrong resource, passes every check in this repository. Closing it needs continuous monitoring from a client Bot Fight Mode does not challenge.

Worth remembering when triaging: the two incidents this would have caught — the 1101 and the `robots.txt` 500 — both lasted far longer than a deploy.
