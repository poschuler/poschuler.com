workspace "poschuler.com" "The personal site of Paul Osorio Schuler, modelled in the two tenses it lives in: the request it serves, and the build that produces what it serves." {

    !identifiers hierarchical
    !impliedRelationships true

    model {
        reader = person "Reader" "Arrives from a search result or a link, and reads in English at / or in Spanish at /es." "Human"
        paul = person "Paul" "Writes the Markdown, regenerates the committed fixtures, and merges to main." "Human"

        crawlers = softwareSystem "Search and social crawlers" "Read the sitemap, robots.txt, the hreflang set, the JSON-LD and the Open Graph tags." "External"
        github = softwareSystem "GitHub" "Holds the repository and runs the workflow that publishes it." "External"
        cdn = softwareSystem "cdn.poschuler.dev" "Hosts the one published file this site does not build: the Resume PDF." "External"
        zone = softwareSystem "Cloudflare zone services" "Bot Fight Mode, AI Crawl Control's managed robots.txt, and the Insights beacon." "External"

        site = softwareSystem "poschuler.com" "Serves every page in both Locales from stores derived from Markdown in git." {

            worker = container "Worker" "Serves every page and resource route at the edge." "Cloudflare Workers, React Router v8 framework mode, SSR, nodejs_compat" "Runtime"
            d1 = container "D1 POSCHULER_BD" "Holds Content Item metadata, and is never written by a request." "Cloudflare D1 (SQLite), hand-written SQL, no ORM" "Runtime,Derived store"
            kv = container "KV BLOG_KV" "Holds the rendered body of every published document and the sitemap XML." "Cloudflare KV, read-only at runtime" "Runtime,Derived store"
            assets = container "Static assets" "The client bundle, the self-hosted fonts, og.png and the portrait." "Cloudflare Workers static assets" "Runtime"

            content = container "Content source" "The source of truth, and the arbiter of every disagreement (ADR 0001)." "Markdown in git, app/content/**" "Build,Source of truth"
            d1Generator = container "D1 seed generator" "Turns front matter into rows." "Node, front-matter, seed/d1/generate-seed-sql.ts" "Build"
            kvGenerator = container "KV seed generator" "Renders each published body and the sitemap into payloads." "Node, marked, seed/kv/generate-kv-json.ts" "Build"
            fixtures = container "Committed fixtures" "The interface between the laptop and the runner." "seed/d1/seed.sql, seed/kv/kv_payloads/" "Build"
            publishJob = container "Publish job" "Owns the whole Publication, in order, in one job (ADR 0003)." "GitHub Actions, .github/workflows/ci.yml" "Build"

            schemaVerifier = container "Schema verifier" "Asks whether the migration chain arrives at the shape schema.sql declares (ADR 0006)." "Node, seed/verify-schema.ts" "Build,Verifier"
            storeVerifier = container "Store verifier" "Asks whether the stores hold what the Markdown says (ADR 0012)." "Node, seed/verify-stores.ts" "Build,Verifier"
            fixtureVerifier = container "Fixture verifier" "Asks whether the committed fixtures are what the generators produce today." "Bash, scripts/check-generated-fixtures.sh" "Build,Verifier"
            deploymentVerifier = container "Deployment verifier" "Asks whether the version this run uploaded is the version serving." "Bash, scripts/verify-deployment.sh" "Build,Verifier"
        }

        reader -> site "Reads Posts, Bookmarks, the Series and the Resume, in English at / or in Spanish at /es" "HTTPS"
        crawlers -> site "Fetch the sitemap and robots.txt, and read the hreflang set, the JSON-LD and the Open Graph tags" "HTTPS"
        paul -> site "Writes the Markdown, and regenerates the fixtures beside it" "Markdown in git"
        paul -> github "Merges to main, which is the Publication" "git, gh"
        github -> site "Runs the workflow that publishes it, on a push to main and nowhere else" "GitHub Actions"
        site -> cdn "Proxies the Resume PDF" "HTTPS"
        site -> zone "Embeds the Insights beacon" "script-src"
        zone -> site "Fronts every request, and challenges datacentre clients before one arrives" "Bot Fight Mode"
        zone -> crawlers "Serves a robots.txt merged with the origin's, and only when the origin answers 200" "AI Crawl Control"

        reader -> site.worker "Reads a page" "HTTPS"
        reader -> site.assets "Loads the client bundle, the fonts and the images" "HTTPS"
        crawlers -> site.worker "Fetch /sitemap.xml, /robots.txt and every page's head" "HTTPS"
        zone -> site.worker "Fronts every request, and challenges datacentre clients before one arrives" "Bot Fight Mode"

        site.worker -> site.d1 "One indexed query per listing, one row per document" "SQL over the POSCHULER_BD binding"
        site.worker -> site.kv "One read per body, and one for the sitemap" "KV get, cacheTtl 3600"
        site.worker -> cdn "Proxies and streams the PDF, and 404s rather than serving an upstream error as one" "fetch, cacheTtl 86400"
        site.worker -> zone "Embeds the Insights beacon, the only third-party origin the CSP allows" "script-src"

        paul -> site.content "Writes every Document under app/content/" "Markdown in git"
        site.d1Generator -> site.content "Reads the front matter of every Document" "Node, front-matter"
        site.d1Generator -> site.fixtures "Writes seed.sql, insert before prune, never DELETE first" "Node, fs"
        site.kvGenerator -> site.content "Reads the body of every published Document" "Node, marked"
        site.kvGenerator -> site.d1 "Queries the already-seeded content table to decide what to render, which is why D1 goes first" "wrangler d1 execute --json"
        site.kvGenerator -> site.fixtures "Writes one payload per document, and the sitemap" "Node, fs"

        github -> site.publishJob "Runs it on a push to main, in the production environment" "GitHub Actions"
        github -> site.fixtureVerifier "Runs it on every push and pull request, before anything is published" "GitHub Actions"
        site.publishJob -> site.fixtures "Uploads them exactly as git holds them, and never regenerates them" "actions/checkout"
        site.publishJob -> site.d1 "Applies any new migrations, then upserts seed.sql" "wrangler d1 migrations apply, wrangler d1 execute --remote"
        site.publishJob -> site.kv "Bulk-uploads every payload, put before delete" "wrangler kv bulk"
        site.publishJob -> site.worker "Builds and deploys it, last, after both stores have been read back" "wrangler deploy"
        site.publishJob -> site.assets "Uploads them with the Worker" "wrangler deploy"
        site.publishJob -> site.schemaVerifier "Runs it after the migrations and before the seed" "pnpm run verify:schema:remote"
        site.publishJob -> site.storeVerifier "Runs it after the seed and before the deploy" "pnpm run verify:stores:remote"
        site.publishJob -> site.deploymentVerifier "Runs it after the deploy, on the version id wrangler reported" "bash scripts/verify-deployment.sh"

        site.schemaVerifier -> site.d1 "Reads the shape back" "wrangler d1 execute"
        site.storeVerifier -> site.d1 "Reads every row back and compares it against the Markdown" "wrangler d1 execute"
        site.storeVerifier -> site.kv "Reads every payload back and compares it against the Markdown" "wrangler kv key get"
        site.fixtureVerifier -> site.fixtures "Runs both generators and asks whether git already holds their output" "git status --porcelain"
        site.deploymentVerifier -> site.worker "Reads back which version is live, and refuses anything but this run's at 100%" "Cloudflare API"
    }

    views {
        systemContext site "context" "The four kinds of user this site has, two of which are not people." {
            include *
            autolayout lr
        }

        container site "containers-runtime" "The request path: one Worker, two derived stores, and one file it does not hold." {
            include reader crawlers zone cdn site.worker site.d1 site.kv site.assets
            autolayout lr
        }

        container site "containers-build" "Where the content actually comes from, and the order the stores are moved in." {
            include paul github site.content site.d1Generator site.kvGenerator site.fixtures site.publishJob site.schemaVerifier site.storeVerifier site.fixtureVerifier site.deploymentVerifier site.d1 site.kv site.worker site.assets
            exclude site.worker->site.d1 site.worker->site.kv
            autolayout lr
        }

        styles {
            element "Human" {
                shape Person
                background #1d3c5a
                color #ffffff
            }
            element "Software System" {
                background #2c6494
                color #ffffff
            }
            element "Container" {
                background #3d84bd
                color #ffffff
            }
            element "Component" {
                background #78aed6
                color #000000
            }
            element "External" {
                background #6d7480
                color #ffffff
            }
            element "Runtime" {
                background #2c6494
                color #ffffff
            }
            element "Build" {
                background #6c5091
                color #ffffff
            }
            element "Source of truth" {
                shape Folder
                background #2f7a58
                color #ffffff
            }
            element "Derived store" {
                shape Cylinder
                background #3d84bd
                color #ffffff
            }
            element "Verifier" {
                shape Hexagon
                background #a8571c
                color #ffffff
            }
            element "Extracted for test" {
                stroke #101418
                strokeWidth 8
            }
        }

        theme default
    }

    configuration {
        scope softwaresystem
    }
}
