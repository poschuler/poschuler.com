import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/_$blog-slug";
import { cloudflareContext } from "~/context";
import { GitHubIcon } from "~/components/ui/brand-icons";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";


interface PostAttributes {
    title: string;
    description: string;
    tags: string[];
    publishedAt: string;
    repository?: string;
}

interface BlogContentPayload {
    attributes: PostAttributes;
    html: string;
}

export async function loader({ params, context }: Route.LoaderArgs) {

    const blogSlug = params.blogSlug;

    const { env } = context.get(cloudflareContext);
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

    // Deliberately not returning `attributes.tags`: nothing renders them, and a
    // loader's return value ships twice — once in the HTML, once in hydration.
    return {
        title: attributes.title,
        description: attributes.description,
        publishedAt: new Date(attributes.publishedAt).toLocaleDateString(),
        html,
        slug: blogSlug,
        repository: attributes.repository,
    };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export function meta({ loaderData }: Route.MetaArgs) {

    const { title, description, slug } = loaderData;

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
    ];
}

export default function BlogSlug() {
    const { html, publishedAt, title, repository } = useLoaderData<typeof loader>();

    return (
        <main className="min-h-[calc(100vh_-_theme(spacing.16))] flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
            {/* <article className="prose py-8 mx-auto lg:max-w-4xl xl:max-w-5xl 2xl:max-w-7xl"> */}
            <article className="prose py-8 mx-auto lg:max-w-4xl">
                <h1>{title}</h1>

                {/* show fancy repository design  flex items-center gap-2 text-muted-foreground transition-colors duration-200 hover:text-default*/}
                {repository && (
                    <p className="flex items-center gap-2">
                        <GitHubIcon className="size-6" />
                        <Link
                            to={repository}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-lg no-underline text-low flex items-center gap-2 transition-colors duration-200 hover:text-default"
                        >
                            View Github Repository
                        </Link>
                    </p>
                )}

                <p>Published on: {publishedAt}</p>
                <hr className="mt-7 mb-7" />
                <div dangerouslySetInnerHTML={{ __html: html }} />
            </article>
        </main>
    )
}