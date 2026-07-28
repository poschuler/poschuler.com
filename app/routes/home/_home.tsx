import { BookmarkCheck, PenLine } from "lucide-react";
import { Link, useLoaderData, type MetaFunction } from "react-router";
import { findAll, type ContentRowType } from "~/models/content.server";
import type { Route } from "./+types/_home";
import { cloudflareContext } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const contentItems = await findAll(env.POSCHULER_BD);

  return { contentItems };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export const meta: MetaFunction = () => {
  return [
    { title: "Paul Osorio Schuler | Staff Software Engineer | Backend • TypeScript • Node.js" },
    { name: "description", content: "Writing, bookmarks and resume of Paul Osorio Schuler, a Staff Software Engineer working on backend systems with TypeScript and Node.js." },
    { tagName: "link", rel: "canonical", href: "https://poschuler.com" },
    { property: "og:title", content: "Paul Osorio Schuler | Staff Software Engineer | Backend • TypeScript • Node.js" },
    { property: "og:description", content: "Writing, bookmarks and resume of Paul Osorio Schuler, a Staff Software Engineer working on backend systems with TypeScript and Node.js." },
    { property: "og:image", content: "https://avatars.githubusercontent.com/u/1238212?v=4" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://poschuler.com" },
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
            alt={"Paul Osorio Schuler"}
            width={112}
            height={112}
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
            Staff Software Engineer | Backend • TypeScript • Node.js
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
            <Link className="text-low" to={`/blog/${item.slug}`}>
              I wrote, {item.title}
            </Link>
          </>
        }
      </div>
    </div>
  );
}
