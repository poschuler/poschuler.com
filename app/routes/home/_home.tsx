import { BookmarkCheck, PenLine } from "lucide-react";
import { useLoaderData, type MetaFunction } from "react-router";
import { findAll, type ContentRowType } from "~/models/content.server";
import type { Route } from "./+types/_home";

export async function loader({ context }: Route.LoaderArgs) {
  const contentItems = await findAll(context.cloudflare.env.POSCHULER_BD);

  return { contentItems };
}

export const meta: MetaFunction = () => {
  return [
    { title: "Paul Osorio Schuler | Software Engineer (Node.js, Azure) & MBA" },
    { name: "description", content: "Software Engineer specializing in highly-scalable backend systems. Expertise in Node.js, TypeScript, Azure, and Domain-Driven Design (DDD). View my full resume, blog and bookmarks." },
    { tagName: "link", rel: "canonical", href: "https://poschuler.com" },
    { name: "og:title", content: "Paul Osorio Schuler | Software Engineer (Node.js, Azure) & MBA" },
    { name: "og:description", content: "Software Engineer specializing in highly-scalable backend systems. Expertise in Node.js, TypeScript, Azure, and Domain-Driven Design (DDD)." },
    { name: "og:image", content: "https://avatars.githubusercontent.com/u/1238212?v=4" },
    { name: "og:type", content: "website" },
    { name: "og:url", content: "https://poschuler.com" },
  ];
};

export default function Home() {
  const { contentItems } = useLoaderData<typeof loader>();

  return (
    <main className="flex flex-col min-h-[calc(100vh_-_theme(spacing.16))] flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="w-full">
        <div className="mx-auto relative flex size-28 overflow-hidden rounded-full">
          <img
            src={"https://avatars.githubusercontent.com/u/1238212?v=4"}
            alt={"github avatar"}
            className="aspect-auto h-full w-full"
          />
        </div>

        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            Paul Osorio Schuler
          </h1>
        </div>

        <div className="max-w-[650px] mx-auto">
          <blockquote className="text-center mt-2 italic text-muted-foreground text-lg">
            &lt;&lt; Software Engineer & MBA from Peru | 12+ Years Experience &gt;&gt;
          </blockquote>
          <blockquote className="pt-1 text-center mt-2 italic text-muted-foreground text-lg">
            Currently working as Software Architect, focusing on building client-centric solutions that drive measurable business value.
          </blockquote>
        </div>
      </section>

      <section className="pt-4 lg:max-w-4xl xl:max-w-5xl 2xl:max-w-7xl mx-auto">
        {contentItems &&
          contentItems.map((item) => {
            return <ContentItem key={item.idContent} item={item} />;
          })}
      </section>
    </main>
  );
}

type ContentItemProps = {
  item: ContentRowType;
};

function ContentItem({ item }: ContentItemProps) {
  return (
    <div className="my-4 p-4 border-default border-l-2">
      <small className="text-base font-medium leading-none">
        {item.publishedStringDate}
      </small>

      <div className="flex gap-2 mt-2 text-low">
        {item.type === "link" &&
          <>
            <BookmarkCheck className="h-6 w-6" />
            <a className="text-low" href={item.externalUrl} target="_blank" rel="noreferrer">
              I read, "{item.title}" by {item.source}
            </a>
          </>
        }

        {item.type === "post" &&
          <>
            <PenLine className="h-6 w-6" />
            <a className="text-low" href={`/blog/${item.slug}`}>
              I wrote, {item.title}
            </a>
          </>
        }
      </div>
    </div>
  );
}
