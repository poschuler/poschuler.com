import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/_$blog-slug";
import { cloudflareContext } from "~/context";
import { PostArticle } from "~/components/post-article";
import { postHref } from "~/lib/hrefs";
import { blogPosting, breadcrumbList, HOME_CRUMB } from "~/lib/seo/structured-data";
import { validateRevisions } from "~/lib/revisions";
import { findPostBySlug } from "~/models/content.server";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";


interface PostAttributes {
    title: string;
    description: string;
    tags: string[];
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

    /**
     * The row before the body, for one reason: a Part is served under its
     * Series, and its payload sits under the same `blog:` key as any other Post
     * — the prefix says what kind of payload it is, not which URL serves it. So
     * KV alone would answer this URL with a page that also exists at
     * `/series/…`, and two addresses for one article is a canonical nobody
     * declared.
     *
     * Not the historical redirects: those are a table of URLs that no longer
     * exist and belong in `app/lib/redirects.ts`, consulted in the Worker. This
     * is derived from the row itself.
     */
    const post = await findPostBySlug(env.POSCHULER_BD, blogSlug);

    if (!post) {
        throw new Response("Not Found", { status: 404 });
    }

    if (post.seriesSlug) {
        // The query string travels, for the reason `app/lib/redirects.ts`
        // states for the hop before this one: it is what tells the author the
        // redirect is being used at all. The two land on the same page, so
        // they cannot behave differently.
        throw redirect(postHref(post) + new URL(request.url).search, 301);
    }

    const BLOG_KV = env.BLOG_KV;
    const kv_key = `blog:${blogSlug}:en`;
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

    // Deliberately not returning `attributes.tags`: nothing renders them, and a
    // loader's return value ships twice — once in the HTML, once in hydration.
    return {
        title: attributes.title,
        description: attributes.description,
        publishedAt: new Date(attributes.publishedAt).toLocaleDateString(),
        // The same date, unformatted. What a reader sees is written for their
        // locale; what a crawler is told has to stay `YYYY-MM-DD`.
        datePublished: attributes.publishedAt,
        html,
        slug: blogSlug,
        repository: attributes.repository,
        // A malformed list is caught at build time; a page is better off
        // without its revision line than not rendering at all.
        revisions: "revisions" in revisions ? revisions.revisions : [],
    };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export function meta({ loaderData }: Route.MetaArgs) {

    const { title, description, slug, datePublished, revisions } = loaderData;
    const path = `/blog/${slug}`;

    return [
        { title: `${title} | Paul Osorio Schuler` },
        { name: "description", content: `${description}` },
        { tagName: "link", rel: "canonical", href: `https://poschuler.com/blog/${slug}` },
        { property: "og:title", content: `${title}` },
        { property: "og:description", content: `${description}` },
        { property: "og:image", content: "https://poschuler.com/og.png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `https://poschuler.com/blog/${slug}` },
        {
            "script:ld+json": blogPosting({
                path,
                title,
                description,
                datePublished,
                // Newest first, guaranteed by `validateRevisions`.
                dateRevised: revisions[0]?.date,
                // A standalone Post has no Container, and saying otherwise
                // would invent a continuity that does not exist.
                seriesSlug: null,
            }),
        },
        {
            "script:ld+json": breadcrumbList([
                HOME_CRUMB,
                { name: "Blog", path: "/blog" },
                { name: title, path },
            ]),
        },
    ];
}

export default function BlogSlug() {
    const { html, publishedAt, title, repository, revisions } = useLoaderData<typeof loader>();

    return (
        <main className="flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
            <PostArticle
                title={title}
                publishedAt={publishedAt}
                repository={repository}
                revisions={revisions}
                html={html}
            />
        </main>
    )
}
