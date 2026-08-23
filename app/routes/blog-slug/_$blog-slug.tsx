import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/_$blog-slug";
import { cloudflareContext, localeContext } from "~/context";
import { PostArticle } from "~/components/post-article";
import { formatPostDate } from "~/lib/dates";
import { postHref } from "~/lib/hrefs";
import { alternateLinks, documentAddresses } from "~/lib/seo/alternates";
import { blogPosting, breadcrumbList } from "~/lib/seo/structured-data";
import { validateRevisions } from "~/lib/revisions";
import { indexCrumb } from "~/lib/trail";
import { findPostBySlug } from "~/models/content.server";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";


interface PostAttributes {
    title: string;
    description: string;
    /**
     * Optional, because this is front matter as written and a Post is free to
     * carry none. What the build guarantees is that whatever is here is a Tag
     * from the closed vocabulary, written as its own slug — not that there is
     * one.
     */
    tags?: string[];
    publishedAt: string;
    repository?: string;
    /**
     * `unknown` because this is front matter that travelled through KV as
     * written. `validateRevisions` is what turns it into a list — and it is the
     * same function the seed uses, so a payload the build accepted renders and
     * one it did not never reaches here.
     */
    updates?: unknown;
}

interface BlogContentPayload {
    attributes: PostAttributes;
    html: string;
}

export async function loader({ params, request, context }: Route.LoaderArgs) {

    const blogSlug = params.blogSlug;

    const { env } = context.get(cloudflareContext);
    const locale = context.get(localeContext);

    /**
     * The row before the body, for one reason: a Part or a Field Note is
     * served under its Container, and its payload sits under the same `blog:`
     * key as any other Post — the prefix says what kind of payload it is, not
     * which URL serves it. So KV alone would answer this URL with a page that
     * also exists at `/series/…` or `/projects/…`, and two addresses for one
     * article is a canonical nobody declared.
     *
     * Not the historical redirects: those are a table of URLs that no longer
     * exist and belong in `app/lib/redirects.ts`, consulted in the Worker. This
     * is derived from the row itself.
     */
    const post = await findPostBySlug(env.POSCHULER_BD, blogSlug, locale);

    if (!post) {
        throw new Response("Not Found", { status: 404 });
    }

    if (post.seriesSlug || post.projectSlug) {
        // The query string travels, for the reason `app/lib/redirects.ts`
        // states for the hop before this one: it is what tells the author the
        // redirect is being used at all. The two land on the same page, so
        // they cannot behave differently.
        throw redirect(postHref(post, post.lang) + new URL(request.url).search, 301);
    }

    const BLOG_KV = env.BLOG_KV;
    // Keyed off the resolved row's own Locale, the way every sibling route
    // already reads its body (`/projects/:project`, `/series/:seriesSlug`,
    // `/series/:seriesSlug/:partSlug`) — not off the request's, which a Post
    // with no Translation in that Locale would never have found a row for.
    const kv_key = `blog:${blogSlug}:${post.lang}`;
    const contentPayload = await BLOG_KV.get<BlogContentPayload>(kv_key, {
        type: "json",
        // A Post body only changes when the seed pipeline runs, so let the colo
        // answer from its own cache instead of reaching KV's central store.
        cacheTtl: 3600,
    });

    if (!contentPayload) {
        throw new Response("Not Found", { status: 404 });
    }

    const { attributes, html } = contentPayload;

    const revisions = validateRevisions(attributes.updates);

    // `tags` used to be dropped here, and the reason was recorded: a loader's
    // return value ships twice — once in the HTML, once in hydration — and
    // nothing rendered them. That reasoning still holds; what changed is the
    // other side of it. The chips are links to a page that now exists, so the
    // bytes buy the reader a way out sideways, and this is the payload that
    // already carries them: the front matter travelled here verbatim, so
    // returning them costs no second query on either Post route.
    return {
        title: attributes.title,
        description: attributes.description,
        tags: attributes.tags ?? [],
        publishedAt: formatPostDate(attributes.publishedAt, post.lang),
        // The same date, unformatted. What a reader sees is written for their
        // locale; what a crawler is told has to stay `YYYY-MM-DD`.
        datePublished: attributes.publishedAt,
        html,
        slug: blogSlug,
        locale: post.lang,
        // Read off the same row, via the correlated subquery `findPostBySlug`
        // now carries (Part 10 of `evolution-plan/15-phase-3-spanish.md`) — the
        // canonical's alternates, without a second round trip.
        existingLocales: post.locales,
        repository: attributes.repository,
        // A malformed list is caught at build time; a page is better off
        // without its revision line than not rendering at all.
        revisions: "revisions" in revisions ? revisions.revisions : [],
    };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export function meta({ loaderData }: Route.MetaArgs) {

    const { title, description, slug, locale, existingLocales, datePublished, revisions } = loaderData;
    const addresses = documentAddresses(
        { kind: "post", slug, seriesSlug: null },
        locale,
        existingLocales,
    );
    const { canonical } = addresses;
    const path = postHref({ slug, seriesSlug: null }, locale);

    return [
        { title: `${title} | Paul Osorio Schuler` },
        { name: "description", content: `${description}` },
        { tagName: "link", rel: "canonical", href: canonical },
        ...alternateLinks(addresses),
        { property: "og:title", content: `${title}` },
        { property: "og:description", content: `${description}` },
        { property: "og:image", content: "https://poschuler.com/og.png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        {
            "script:ld+json": blogPosting({
                url: canonical,
                title,
                description,
                datePublished,
                // Newest first, guaranteed by `validateRevisions`.
                dateRevised: revisions[0]?.date,
                // A standalone Post has no Container, and saying otherwise
                // would invent a continuity that does not exist.
                seriesSlug: null,
                locale,
            }),
        },
        {
            "script:ld+json": breadcrumbList([
                indexCrumb("home", locale),
                indexCrumb("blog", locale),
                { name: title, path },
            ]),
        },
    ];
}

export default function BlogSlug() {
    const { html, publishedAt, tags, title, repository, revisions } = useLoaderData<typeof loader>();

    return (
        <main className="flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
            <PostArticle
                title={title}
                publishedAt={publishedAt}
                tags={tags}
                repository={repository}
                revisions={revisions}
                html={html}
            />
        </main>
    )
}
