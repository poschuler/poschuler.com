import { useLoaderData, type MetaFunction } from "react-router";
import { ContentItem } from "~/components/content-item";
import { findAll } from "~/models/content.server";
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
    <main className="flex flex-col flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="w-full">
        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            Timeline
          </h1>
        </div>

        <div className="max-w-[450px] mx-auto">
          <blockquote className="text-center mt-2 italic text-low text-lg">
            What I write and what I read, in the order it happened
          </blockquote>
        </div>
      </section>

      {/* `showKind` only here: this is the one list that interleaves the two,
        * so a row has to say which it is. Blog and Bookmarks have said it in
        * their heading already. */}
      <section className="mx-auto w-full max-w-measure">
        {contentItems.map((item) => (
          <ContentItem key={item.idContent} item={item} showKind />
        ))}
      </section>
    </main>
  );
}
