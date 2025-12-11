import { BookmarkCheck, PenLine } from "lucide-react";
import { useLoaderData, type MetaFunction } from "react-router";
import { findAllPosts, type ContentRowType } from "~/models/content.server";
import type { Route } from "./+types/_blog";

export async function loader({ context }: Route.LoaderArgs) {
  const posts = await findAllPosts(context.cloudflare.env.POSCHULER_BD);

  return { posts };
}

export const meta: MetaFunction = () => {
  return [
    { title: "Paul Osorio Schuler's Blog | Software Architecture, Node.js & Azure" },
    { name: "description", content: "Advanced technical articles and insights by Software Architect Paul Osorio Schuler on Domain-Driven Design (DDD), scalable backend systems, Node.js, and Azure cloud best practices." },
    { tagName: "link", rel: "canonical", href: "https://poschuler.com/blog" },
    { name: "og:title", content: "Technical Insights from a Software Architect: Azure, Node.js & DDD" },
    { name: "og:description", content: "Explore advanced articles on Domain-Driven Design (DDD), scalable backend systems, and Azure cloud practices. Essential reading for developers and architects." },
    { name: "og:image", content: "https://avatars.githubusercontent.com/u/1238212?v=4" },
    { name: "og:type", content: "website" },
    { name: "og:url", content: "https://poschuler.com/cv" },
  ];
};

export default function Blog() {
  const { posts } = useLoaderData<typeof loader>();

  return (
    <main className="flex flex-col min-h-[calc(100vh_-_theme(spacing.16))] flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="w-full">

        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            Articles & Insights
          </h1>
        </div>

        <div className="max-w-[450px] mx-auto">
          <blockquote className="text-center mt-2 italic text-muted-foreground text-lg">
            My articles on topics I care about
          </blockquote>
        </div>
      </section>
      {/* <Separator className="mx-auto w-28" /> */}

      <section className="lg:max-w-4xl xl:max-w-5xl 2xl:max-w-7xl mx-auto">
        {posts &&
          posts.map((post) => {
            return <Post key={post.idContent} post={post} />;
          })}
      </section>
    </main>
  );
}

type PostProps = {
  post: ContentRowType;
};

function Post({ post }: PostProps) {
  return (
    <div className="my-4 py-4 px-4 border-default border-l-2">
      <small className="text-base font-medium leading-none">
        {post.publishedStringDate}
      </small>

      <div className="flex gap-2 mt-2 text-low">
        <PenLine className="h-6 w-6" />
        <a className="text-low" href={`/blog/${post.slug}`}>
          {post.title}
        </a>
      </div>
    </div>
  );
}
