import { BookmarkCheck, PenLine } from "lucide-react";
import { Link, useLoaderData, type MetaFunction } from "react-router";
import { findAll, type ContentRowType } from "~/models/content.server";
import type { Route } from "./+types/_timeline";
import { cloudflareContext } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const contentItems = await findAll(env.POSCHULER_BD);

  return { contentItems };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

const TIMELINE_TITLE = "Timeline | Paul Osorio Schuler";
const TIMELINE_DESCRIPTION =
  "Everything Paul Osorio Schuler writes and reads, interleaved and newest first: articles on backend systems and the links worth keeping.";

export const meta: MetaFunction = () => {
  return [
    { title: TIMELINE_TITLE },
    { name: "description", content: TIMELINE_DESCRIPTION },
    { tagName: "link", rel: "canonical", href: "https://poschuler.com/timeline" },
    { property: "og:title", content: TIMELINE_TITLE },
    { property: "og:description", content: TIMELINE_DESCRIPTION },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://poschuler.com/timeline" },
  ];
};

export default function Timeline() {
  const { contentItems } = useLoaderData<typeof loader>();

  return (
    <main className="flex flex-col min-h-[calc(100vh_-_theme(spacing.16))] flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="w-full">
        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            Timeline
          </h1>
        </div>

        <div className="max-w-[450px] mx-auto">
          <blockquote className="text-center mt-2 italic text-muted-foreground text-lg">
            What I write and what I read, in the order it happened
          </blockquote>
        </div>
      </section>

      <section className="lg:max-w-4xl xl:max-w-5xl 2xl:max-w-7xl mx-auto">
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
