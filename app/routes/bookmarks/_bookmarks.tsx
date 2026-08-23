import { useLoaderData } from "react-router";
import { ContentItem } from "~/components/content-item";
import { findAllBookmarks } from "~/models/content.server";
import type { Route } from "./+types/_bookmarks";
import { cloudflareContext, localeContext, LOCALES } from "~/context";
import { useStrings } from "~/lib/catalog";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { alternateLinks, documentAddresses } from "~/lib/seo/alternates";

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const bookmarks = await findAllBookmarks(env.POSCHULER_BD);
  // A Bookmark has no Locale (`CONTEXT.md`) — this page's own does, for the
  // canonical below, which is what `localeContext` is read for here.
  const locale = context.get(localeContext);

  return { bookmarks, locale };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const addresses = documentAddresses(
    { kind: "index", path: "/bookmarks" },
    loaderData.locale,
    LOCALES,
  );
  const { canonical } = addresses;

  return [
    { title: `Bookmarks | Paul Osorio Schuler` },
    { name: "description", content: `External articles Paul Osorio Schuler has read and kept, on TypeScript, web development, auth and security, accessibility and performance.` },
    { tagName: "link", rel: "canonical", href: canonical },
    ...alternateLinks(addresses),
    { property: "og:title", content: `Bookmarks | Paul Osorio Schuler` },
    { property: "og:description", content: `External articles Paul Osorio Schuler has read and kept, on TypeScript, web development, auth and security, accessibility and performance.` },
    { property: "og:image", content: "https://poschuler.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
};

export default function Bookmarks() {
  const { bookmarks } = useLoaderData<typeof loader>();
  const strings = useStrings();

  return (
    <main className="flex flex-col flex-1 gap-4 p-4 md:gap-8 md:p-10 font-mono bg-ui">
      <section className="w-full">

        <div className="text-center">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight lg:text-4xl mt-8">
            {strings.bookmarks.heading}
          </h1>
        </div>

        <div className="max-w-[450px] mx-auto">
          <blockquote className="text-center mt-2 italic text-low text-lg">
            {strings.bookmarks.subtitle}
          </blockquote>
        </div>
      </section>

      <section className="mx-auto w-full max-w-measure">
        {bookmarks.map((bookmark) => (
          <ContentItem key={bookmark.idContent} item={bookmark} />
        ))}
      </section>
    </main>
  );
}
