workspace "poschuler.com" "The personal site of Paul Osorio Schuler, modelled in the two tenses it lives in: the request it serves, and the build that produces what it serves." {

    !identifiers hierarchical

    model {
        reader = person "Reader" "Arrives from a search result or a link, and reads in English at / or in Spanish at /es." "Human"
        paul = person "Paul" "Writes the Markdown, regenerates the committed fixtures, and merges to main." "Human"

        crawlers = softwareSystem "Search and social crawlers" "Read the sitemap, robots.txt, the hreflang set, the JSON-LD and the Open Graph tags." "External"
        github = softwareSystem "GitHub" "Holds the repository and runs the workflow that publishes it." "External"
        cdn = softwareSystem "cdn.poschuler.dev" "Hosts the one published file this site does not build: the Resume PDF." "External"
        zone = softwareSystem "Cloudflare zone services" "Bot Fight Mode, AI Crawl Control's managed robots.txt, and the Insights beacon." "External"

        site = softwareSystem "poschuler.com" "Serves every page in both Locales from stores derived from Markdown in git."
    }

    views {
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
}
