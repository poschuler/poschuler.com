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

            worker = container "Worker" "Serves every page and resource route at the edge." "Cloudflare Workers, React Router v8 framework mode, SSR, nodejs_compat" "Runtime" {
                fetchHandler = component "fetch handler" "The only entry point, and the one place the per-request context is built." "workers/app.ts"
                redirects = component "redirect table" "Answers a retired address with a 301, before the router is given the chance to miss." "app/lib/redirects.ts" "Extracted for test"
                securityHeaders = component "security headers" "Rebuilds every response, and mints the CSP nonce in production." "workers/security-headers.ts" "Extracted for test"
                locale = component "Locale derivation" "Reads the Locale off the path, in exactly one call site." "app/context.ts"
                routes = component "routes" "Mounts every route twice, bare and under /es." "app/routes.ts, app/routes/**"
                models = component "models" "Named domain queries, each one taking the Locale as an argument." "app/models/{content,project,series,tag}.server.ts"
                db = component "db helper" "The only path to D1, and it binds every value rather than interpolating it." "app/db.server.ts"
                addresses = component "address algebra" "Decides what a document's address is in each Locale, and which one is canonical." "app/lib/hrefs.ts, app/lib/seo/{alternates,switcher}.ts"
                seo = component "SEO renderers" "Renders robots.txt, the JSON-LD and the Trail." "app/lib/seo/{robots,structured-data,person}.ts, app/lib/trail.ts"
                catalog = component "Chrome catalogue" "Holds every string the Chrome shows, typed so that a missing Locale is a compile error (ADR 0011)." "app/lib/catalog.ts"
                colorScheme = component "colour-scheme cookie" "Signs the colour-scheme preference, which is why no HTML this Worker serves is publicly cacheable." "app/color-scheme-cookie.ts"
            }
            d1 = container "D1 POSCHULER_BD" "Holds Content Item metadata, and is never written by a request." "Cloudflare D1 (SQLite), hand-written SQL, no ORM" "Runtime,Derived store"
            kv = container "KV BLOG_KV" "Holds the rendered body of every published document and the sitemap XML." "Cloudflare KV, read-only at runtime" "Runtime,Derived store"
            assets = container "Static assets" "The client bundle, the self-hosted fonts, og.png and the portrait." "Cloudflare Workers static assets" "Runtime"

            content = container "Content source" "The source of truth, and the arbiter of every disagreement (ADR 0001)." "Markdown in git, app/content/**" "Build,Source of truth"
            d1Generator = container "D1 seed generator" "Turns front matter into rows." "Node, front-matter, seed/d1/generate-seed-sql.ts" "Build" {
                frontMatter = component "front matter reader" "Reads each file's front matter, checks it against the tree, the Tag vocabulary and the Locale suffix, and writes seed.sql." "seed/d1/generate-seed-sql.ts, front-matter"
                treeWalker = component "content tree walker" "Classifies every file by the tree it sits in and the depth it sits at, never by what its front matter claims (ADR 0004)." "seed/d1/content-tree.ts"
                manifestReader = component "manifest reader" "Reads the Series arc and the Project's flat note list, which is the only place order is declared (ADR 0007)." "seed/d1/manifest.ts"
                sqlEmitter = component "SQL emitter" "Turns a classified file into a row, and emits the upserts before the prune, never a DELETE first." "seed/d1/seed-sql.ts"
                containerSql = component "container SQL" "Emits the Project and Series rows and their sections, reconciling the manifest against the disk." "seed/d1/{project,series}-sql.ts"
                tagVocabulary = component "Tag vocabulary" "Holds the closed set a Tag must belong to, and fails the build for one that is not declared (ADR 0008)." "seed/d1/tag-vocabulary.ts, app/content/tags.json"
            }
            kvGenerator = container "KV seed generator" "Renders each published body and the sitemap into payloads." "Node, marked, seed/kv/generate-kv-json.ts" "Build" {
                payloadWriter = component "payload writer" "Queries the already-seeded content table to decide what exists, and writes one payload per document." "seed/kv/generate-kv-json.ts"
                sanitiser = component "Markdown renderer + sanitiser" "The only place a body can be made safe, because the Worker injects it unexamined and never looks again." "seed/kv/markdown.ts, marked"
                sitemapBuilder = component "sitemap builder" "Decides which addresses the sitemap advertises, and takes the date as an argument so the output is reproducible." "seed/kv/sitemap-routes.ts"
                sitemapRenderer = component "sitemap XML renderer" "Renders the sitemap document, and is the one module under app/lib/seo that the Worker never imports." "app/lib/seo/sitemap.ts"
            }
            kvUploader = container "KV uploader" "Replaces every payload in one pass, put before delete, so no moment exists in which a document is missing." "Node, seed/kv/{kv-bulk-upload,kv-keys,payload-files}.ts" "Build"
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

        reader -> site.worker.fetchHandler "Reads a page" "HTTPS"
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
        site.publishJob -> site.kvUploader "Runs it after the seed and before the store verification" "pnpm run kv:upload:remote"
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


        site.worker.fetchHandler -> site.worker.redirects "Asks it first, because an address that no longer exists has no route to match and no loader to run" "resolveRedirect"
        site.worker.fetchHandler -> site.worker.locale "Derives the Locale once, and sets it on the request context" "deriveLocale"
        site.worker.fetchHandler -> site.worker.routes "Hands the request over with the context already built" "createRequestHandler"
        site.worker.fetchHandler -> site.worker.securityHeaders "Hands every response back through it, the 301 included" "withSecurityHeaders"
        site.worker.routes -> site.worker.models "Asks a loader's question by name" "Node"
        site.worker.routes -> site.worker.addresses "Builds the canonical, the hreflang set and the switcher's destination in meta()" "Node"
        site.worker.routes -> site.worker.seo "Renders robots.txt, the JSON-LD and the Trail" "Node"
        site.worker.routes -> site.worker.catalog "Reads every string the Chrome shows" "Node"
        site.worker.routes -> site.worker.colorScheme "Reads the signed preference, and writes it back" "__Host-poschuler-color-scheme"
        site.worker.routes -> site.kv "Reads one body per document, and the sitemap XML the pipeline rendered" "KV get, cacheTtl 3600"
        site.worker.routes -> cdn "Proxies and streams the PDF, and 404s rather than serving an upstream error as one" "fetch, cacheTtl 86400"
        site.worker.models -> site.worker.db "Every query goes through it, with its values bound" "dbQuery"
        site.worker.db -> site.d1 "One indexed query per listing, one row per document" "SQL over the POSCHULER_BD binding"
        site.worker.seo -> site.worker.addresses "Takes every address from it, and builds none of its own" "Node"
        site.worker.catalog -> site.worker.addresses "Builds the navigation's addresses in the reader's Locale" "Node"

        site.d1Generator.frontMatter -> site.content "Reads the front matter of every file the walker claims" "Node, front-matter"
        site.d1Generator.frontMatter -> site.d1Generator.treeWalker "Asks what each file is, and refuses one no tree claims" "Node"
        site.d1Generator.frontMatter -> site.d1Generator.sqlEmitter "Hands it a validated Content Item to emit" "Node"
        site.d1Generator.frontMatter -> site.d1Generator.containerSql "Hands it the Project and Series manifests, and the documents nested under them" "Node"
        site.d1Generator.frontMatter -> site.fixtures "Writes seed.sql, and treats an empty walk as impossible rather than as empty" "Node, fs"
        site.d1Generator.sqlEmitter -> site.d1Generator.tagVocabulary "Checks every Tag against the closed set (ADR 0008)" "Node"
        site.d1Generator.containerSql -> site.d1Generator.manifestReader "Reads the declared arc, and refuses a manifest that contradicts the disk (ADR 0007)" "Node"
        site.d1Generator.containerSql -> site.d1Generator.treeWalker "Classifies a Container's own file the way a loose one is classified" "Node"

        site.kvGenerator.payloadWriter -> site.content "Reads the body of every published Document, and a Draft produces nothing (ADR 0009)" "Node, front-matter"
        site.kvGenerator.payloadWriter -> site.d1 "Queries the already-seeded content table to decide what to render, which is why D1 goes first" "wrangler d1 execute --json"
        site.kvGenerator.payloadWriter -> site.kvGenerator.sanitiser "Sends every body through it, and renders none itself" "Node"
        site.kvGenerator.payloadWriter -> site.kvGenerator.sitemapBuilder "Asks it which addresses the sitemap advertises" "Node"
        site.kvGenerator.payloadWriter -> site.fixtures "Writes one payload per document, and one for the sitemap" "Node, fs"
        site.kvGenerator.sitemapBuilder -> site.kvGenerator.sitemapRenderer "Hands it the route list, with the date passed in" "Node"
        site.kvGenerator.sitemapBuilder -> site.worker.addresses "Builds every address the sitemap carries with the Worker's own algebra, run as a plain Node script" "Node"

        site.kvUploader -> site.fixtures "Reads every committed payload, and lets the directory it sits in decide its key prefix" "Node, fs"
        site.kvUploader -> site.kv "Replaces every payload in one pass, put before delete" "wrangler kv bulk"
        site.storeVerifier -> site.kvUploader "Shares the key rules and the payload listing, and nothing that builds a row (ADR 0012)" "Node"
        site.storeVerifier -> site.d1Generator.treeWalker "Shares the pure classification rules, and never a row builder (ADR 0012)" "Node"
        production = deploymentEnvironment "Production" {

            cloudflare = deploymentNode "Cloudflare global network" "Every colo that answers for this zone." "Cloudflare" {
                zoneNode = deploymentNode "Zone poschuler.com" "Bot Fight Mode and AI Crawl Control's managed robots.txt both sit in front of the origin." "Cloudflare zone" {
                    isolate = deploymentNode "Worker isolate" "workers_dev is off, so this zone is the only origin that answers." "Cloudflare Workers, compatibility date 2025-04-04, nodejs_compat" {
                        containerInstance site.worker
                        containerInstance site.assets
                    }
                    database = deploymentNode "POSCHULER_BD" "Bound read-only in practice: no request writes to it." "Cloudflare D1" {
                        containerInstance site.d1
                    }
                    namespace = deploymentNode "BLOG_KV" "Bound read-only in practice, and read through the colo's own cache." "Cloudflare KV" {
                        containerInstance site.kv
                    }
                }
            }

            runner = deploymentNode "GitHub-hosted runner" "Exists for the length of one Publication, and is the only place that can write to any of the above." "ubuntu-latest, Node 22, pnpm" {
                productionEnv = deploymentNode "production environment" "Holds CLOUDFLARE_API_TOKEN, scoped to D1:Edit, Workers KV Storage:Edit and Workers Scripts:Edit, and nothing else." "GitHub Environment" {
                    containerInstance site.publishJob
                    containerInstance site.kvUploader
                    containerInstance site.schemaVerifier
                    containerInstance site.storeVerifier
                    containerInstance site.deploymentVerifier
                }
            }

            origin = deploymentNode "cdn.poschuler.dev" "Outside both, and the one file this site publishes without building it." "External origin" {
                softwareSystemInstance cdn
            }
        }
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
            include paul github site.content site.d1Generator site.kvGenerator site.fixtures site.kvUploader site.publishJob site.schemaVerifier site.storeVerifier site.fixtureVerifier site.deploymentVerifier site.d1 site.kv site.worker site.assets
            exclude site.worker->site.d1 site.worker->site.kv site.kvGenerator->site.worker
            autolayout tb
        }

        component site.worker "components-worker" "The request pipeline, and the algebra that decides what every address is." {
            include *
            exclude site.kvGenerator->site.d1
            autolayout lr
        }

        component site.d1Generator "components-pipeline" "How Markdown becomes the two stores: the tree classifies, the vocabulary closes, the sanitiser is the only safe place." {
            include *
            include site.kvGenerator.payloadWriter site.kvGenerator.sanitiser site.kvGenerator.sitemapBuilder site.kvGenerator.sitemapRenderer
            include site.d1 site.kv site.kvUploader
            autolayout tb
        }

        dynamic site.worker "dynamic-request" "A Spanish Post, because it exercises the branch an English one skips." {
            reader -> site.worker.fetchHandler "Asks for a Post under /es"
            site.worker.fetchHandler -> site.worker.redirects "Asks the table first, and misses"
            site.worker.fetchHandler -> site.worker.locale "Derives es from the prefix, once"
            site.worker.fetchHandler -> site.worker.routes "Hands over the request with the Locale and the nonce already set"
            site.worker.routes -> site.worker.models "Asks for the Post by slug, in the derived Locale"
            site.worker.models -> site.worker.db "One query, with the slug bound"
            site.worker.db -> site.d1 "Returns the row, or the Container this Post 301s to instead"
            site.worker.routes -> site.kv "Reads the body, keyed off the resolved row's own Locale rather than the request's"
            site.worker.routes -> site.worker.addresses "Builds the canonical, the hreflang set and the JSON-LD from one set of addresses"
            site.worker.fetchHandler -> site.worker.securityHeaders "Rebuilds the response around the nonce that signed its scripts"
            autolayout lr
        }

        dynamic site "dynamic-publication" "The Publication, in the order the job runs it — and it has no rollback: if the deploy fails after the stores have moved, old code serves new content until someone merges a fix." {
            github -> site.publishJob "Merges to main, which is the only trigger there is"
            site.publishJob -> site.d1 "Applies any new migrations, the one write to production that precedes the seed"
            site.publishJob -> site.schemaVerifier "Asks whether the deployed shape is the declared one, before any row is written"
            site.publishJob -> site.d1 "Upserts seed.sql, and empties nothing first"
            site.publishJob -> site.kvUploader "Replaces every payload, put before delete"
            site.publishJob -> site.storeVerifier "Reads both stores back, before the code that serves them goes live"
            site.publishJob -> site.worker "Builds and deploys, last of all"
            site.publishJob -> site.deploymentVerifier "Asks whether the version just uploaded is the version serving — and there is nothing to undo if it is not"
        }

        deployment site "Production" "deployment-production" "Where each process runs. The point is what the edge does not hold: no generator, no verifier, no Markdown." {
            include *
            exclude site.storeVerifier->site.kvUploader
            autolayout tb
        }

        styles {
            element "Element" {
                shape RoundedBox
            }
            element "Human" {
                shape Person
                background #32669a
                color #ffffff
            }
            element "Software System" {
                background #3476af
                color #ffffff
            }
            element "Container" {
                background #3d84bd
                color #ffffff
            }
            element "Component" {
                background #5699cc
                color #000000
            }
            element "External" {
                background #6d7480
                color #ffffff
            }
            element "Runtime" {
                background #3476af
                color #ffffff
            }
            element "Build" {
                background #7d5ea6
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
    }

    configuration {
        scope softwaresystem
    }
}
