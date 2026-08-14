import { useLoaderData, type MetaFunction } from "react-router";
import { findAllPosts } from "~/models/content.server";
import { PostItem } from "~/components/post-item";
import type { Route } from "./+types/_blog";
import { cloudflareContext } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const posts = await findAllPosts(env.POSCHULER_BD);

  return { posts };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export const meta: MetaFunction = () => {
  return [
    { title: "Blog | Paul Osorio Schuler" },
    { name: "description", content: "Long-form articles by Paul Osorio Schuler on building backend systems with Node.js and TypeScript: API structure, domain-driven design and software architecture." },
    { tagName: "link", rel: "canonical", href: "https://poschuler.com/blog" },
    { property: "og:title", content: "Blog | Paul Osorio Schuler" },
    { property: "og:description", content: "Long-form articles by Paul Osorio Schuler on building backend systems with Node.js and TypeScript: API structure, domain-driven design and software architecture." },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://poschuler.com/blog" },
  ];
};

export default function Blog() {
  const { posts } = useLoaderData<typeof loader>();

  return (
    <main className="flex flex-col min-h-[calc(100vh_-_theme(spacing.16))] flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="w-full">

        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            Articles
          </h1>
        </div>

        <div className="max-w-[450px] mx-auto">
          <blockquote className="text-center mt-2 italic text-low text-lg">
            My articles on topics I care about
          </blockquote>
        </div>
      </section>
      {/* <Separator className="mx-auto w-28" /> */}

      <section className="lg:max-w-4xl xl:max-w-5xl 2xl:max-w-7xl mx-auto">
        {posts &&
          posts.map((post) => {
            return <PostItem key={post.idContent} post={post} />;
          })}
      </section>
    </main>
  );
}
