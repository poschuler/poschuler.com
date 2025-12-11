import { Link, useLoaderData, type MetaFunction } from "react-router";
import type { Route } from "./+types/_$blog-slug";
// import path from "node:path";
// import fs from "node:fs";
// import fm from "front-matter";
// import { marked } from "marked";
import { GitHubLogoIcon } from "@radix-ui/react-icons";


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

interface LoaderData {
    title: string;
    description: string;
    tags: string[];
    publishedAt: string;
    html: string;
    slug: string;
    repository?: string;
}

export async function loader({ params, context }: Route.LoaderArgs) {

    const blogSlug = params.blogSlug;

    //const postsPath = path.join(process.cwd(), "app", "content", "blog");
    //const filePath = path.join(postsPath, blogSlug, `${blogSlug}.en.md`);

    const BLOG_KV = context.cloudflare.env.BLOG_KV;
    const kv_key = `blog:${blogSlug}:en`;
    const contentPayload = await BLOG_KV.get(kv_key, "json");

    if (!contentPayload) {
        throw new Response("Not Found", { status: 404 });
    }

    const { attributes, html } = contentPayload as BlogContentPayload;

    // try {
        //const fileContent = fs.readFileSync(filePath, "utf-8");

        //const { attributes, body } = fm<PostAttributes>(fileContent);
        // const html = marked(body);

        return {
            title: attributes.title,
            tags: attributes.tags,
            description: attributes.description,
            publishedAt: new Date(attributes.publishedAt).toLocaleDateString(),
            html,
            slug: blogSlug,
            repository: attributes.repository,
        };
    // } catch (error) {
    //     // If the file doesn't exist, throw a 404 response
    //     throw new Response("Not Found", { status: 404 });
    // }
}

export const meta: MetaFunction = ({ data }) => {

    const { title, description, slug } = data as LoaderData;

    return [
        { title: `${title} | Paul Osorio Schuler` },
        { name: "description", content: `${description}` },
        { tagName: "link", rel: "canonical", href: `https://poschuler.com/blog/${slug}` },
        { name: "og:title", content: `${title}` },
        { name: "og:description", content: `${description}` },
        { name: "og:image", content: "https://avatars.githubusercontent.com/u/1238212?v=4" },
        { name: "og:type", content: "article" },
        { name: "og:url", content: `https://poschuler.com/blog/${slug}` },
    ];
};

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
                        <GitHubLogoIcon className="size-6" />
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