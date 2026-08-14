import { BookmarkCheck } from "lucide-react";
import { useLoaderData, type MetaFunction } from "react-router";
import { findAllBookmarks, type BookmarkRowType } from "~/models/content.server";
import type { Route } from "./+types/_bookmarks";
import { cloudflareContext } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";


// type LoaderData = {
//   feeds: Array<FeedRowType>;
// };

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const bookmarks = await findAllBookmarks(env.POSCHULER_BD);

  return { bookmarks };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export const meta: MetaFunction = () => {

  return [
    { title: `Bookmarks | Paul Osorio Schuler` },
    { name: "description", content: `External articles Paul Osorio Schuler has read and kept, on TypeScript, web development, auth and security, accessibility and performance.` },
    { tagName: "link", rel: "canonical", href: `https://poschuler.com/bookmarks` },
    { property: "og:title", content: `Bookmarks | Paul Osorio Schuler` },
    { property: "og:description", content: `External articles Paul Osorio Schuler has read and kept, on TypeScript, web development, auth and security, accessibility and performance.` },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: `https://poschuler.com/bookmarks` },
  ];
};

export default function Bookmarks() {
  const { bookmarks } = useLoaderData<typeof loader>();

  return (
    <main className="flex flex-col min-h-[calc(100vh_-_theme(spacing.16))] flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="w-full">

        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            Bookmarks
          </h1>
        </div>

        <div className="max-w-[450px] mx-auto">
          <blockquote className="text-center mt-2 italic text-muted-foreground text-lg">
            Links I've bookmarked and learned from
          </blockquote>
        </div>
      </section>
      {/* <Separator className="mx-auto w-28" /> */}

      <section className="lg:max-w-4xl xl:max-w-5xl 2xl:max-w-7xl mx-auto">
        {bookmarks &&
          bookmarks.map((bookmark) => {
            return <Bookmark key={bookmark.idContent} bookmark={bookmark} />;
          })}
      </section>
    </main>
  );
}

type BookmarkProps = {
  bookmark: BookmarkRowType;
};

function Bookmark({ bookmark }: BookmarkProps) {
  return (
    <div className="my-4 py-4 px-4 border-default border-l-2">
      <small className="text-base font-medium leading-none">
        {bookmark.publishedStringDate}
      </small>

      <div className="flex gap-2 mt-2 text-low">
        <BookmarkCheck className="h-6 w-6" />
        <a className="text-low" href={bookmark.externalUrl} target="_blank" rel="noreferrer">
          "{bookmark.title}" by {bookmark.source}
        </a>
      </div>
    </div>
  );
}
