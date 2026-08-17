import { useLoaderData } from "react-router";
import { ContentItem } from "~/components/content-item";
import { findAllBookmarks, findAllPosts, mergeTimeline } from "~/models/content.server";
import type { Route } from "./+types/_timeline";
import { cloudflareContext, localeContext, LOCALES } from "~/context";
import { useStrings } from "~/lib/catalog";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { alternateLinks, documentAddresses } from "~/lib/seo/alternates";

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const locale = context.get(localeContext);

  // This Locale's Posts, and every Bookmark regardless of Locale — see
  // `mergeTimeline` for why the two are fetched apart and merged rather than
  // answered by one query.
  const [posts, bookmarks] = await Promise.all([
    findAllPosts(env.POSCHULER_BD, locale),
    findAllBookmarks(env.POSCHULER_BD),
  ]);

  return { contentItems: mergeTimeline(posts, bookmarks), locale };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

const TIMELINE_TITLE = "Timeline | Paul Osorio Schuler";
const TIMELINE_DESCRIPTION =
  "Everything Paul Osorio Schuler writes and reads, interleaved and newest first: articles on backend systems and the links worth keeping.";

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const addresses = documentAddresses(
    { kind: "index", path: "/timeline" },
    loaderData.locale,
    LOCALES,
  );
  const { canonical } = addresses;

  return [
    { title: TIMELINE_TITLE },
    { name: "description", content: TIMELINE_DESCRIPTION },
    { tagName: "link", rel: "canonical", href: canonical },
    ...alternateLinks(addresses),
    { property: "og:title", content: TIMELINE_TITLE },
    { property: "og:description", content: TIMELINE_DESCRIPTION },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
};

export default function Timeline() {
  const { contentItems } = useLoaderData<typeof loader>();
  const strings = useStrings();

  return (
    <main className="flex flex-col flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="w-full">
        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            {strings.timeline.heading}
          </h1>
        </div>

        <div className="max-w-[450px] mx-auto">
          <blockquote className="text-center mt-2 italic text-low text-lg">
            {strings.timeline.subtitle}
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
