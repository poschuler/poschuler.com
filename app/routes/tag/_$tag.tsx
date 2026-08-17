import { isRouteErrorResponse, useLoaderData } from "react-router";
import { ContentItem } from "~/components/content-item";
import { NotFound } from "~/components/not-found";
import { cloudflareContext, localeContext } from "~/context";
import { useStrings } from "~/lib/catalog";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { findPostsByTag } from "~/models/tag.server";
import type { Route } from "./+types/_$tag";

/**
 * The Posts carrying one Tag, newest first.
 *
 * A Tag is its Slug: the segment in the URL is the string the front matter
 * carries and the label rendered below, with nothing derived in between — which
 * is what `app/content/tags.json` declares and the seed generator enforces. So
 * the parameter needs no lookup table: it is either a Tag some Post carries or
 * it is nothing.
 *
 * **A Tag no Post carries is a 404**, not an empty page. The vocabulary declares
 * what may be written; the content decides what exists. Twelve declared Tags sit
 * on Bookmarks alone today and have no page for that reason, and the day a Post
 * carries one of them its page begins to exist with nothing declared anywhere.
 * What that 404 looks like is the boundary below.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const locale = context.get(localeContext);
  const posts = await findPostsByTag(env.POSCHULER_BD, params.tag, locale);

  if (posts.length === 0) {
    throw new Response("Not Found", { status: 404 });
  }

  return { tag: params.tag, posts };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

/**
 * The site's own 404, inside the layout.
 *
 * Without this the `Response` above reaches the root boundary, which sits
 * outside the layout and answers with a bare `404` on an empty document — a
 * reader who edited the URL by hand would be stranded with no header and no
 * link anywhere. Rendered here it lands in the layout's `Outlet` and keeps
 * both.
 *
 * Anything that is not a 404 is a real failure and is rethrown, so it reaches
 * the root boundary as before rather than being disguised as a Tag nobody
 * writes about.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (!isRouteErrorResponse(error) || error.status !== 404) {
    throw error;
  }

  return <NotFound />;
}

/**
 * `noindex, follow`.
 *
 * This page exists for the reader and for internal linking, not to compete in
 * search with the Posts it points at — five of these hold a single Post, which
 * as an indexable document is one link arguing against the article it links to.
 * `follow` is the half that does the work the phase was justified by: every
 * link out of here is crawled and the authority reaches the Posts.
 *
 * One rule for every Tag page rather than a threshold on the count, which would
 * be a state that changes on its own and in silence. It reverses in this line
 * the day a Tag page holds enough to earn the index.
 *
 * No canonical and no Open Graph block: both exist to win a placement this page
 * has just asked not to have.
 */
export function meta({ loaderData }: Route.MetaArgs) {
  // `meta` still runs when the boundary above renders in place of the page, and
  // there is no Tag to describe then. What the document is at that point is the
  // site's 404, and it says so — written out rather than imported, because
  // every route on this site supplies its own descriptors and there is
  // deliberately no shared `meta` helper to inherit them from.
  if (!loaderData) {
    return [
      { title: "404 — Not Found | Paul Osorio Schuler" },
      { name: "robots", content: "noindex" },
    ];
  }

  const { tag, posts } = loaderData;

  return [
    { title: `${tag} | Paul Osorio Schuler` },
    {
      name: "description",
      content: `Everything Paul Osorio Schuler has written on ${tag}: ${posts.length} article${posts.length === 1 ? "" : "s"}, newest first.`,
    },
    { name: "robots", content: "noindex, follow" },
  ];
}

export default function Tag() {
  const { tag, posts } = useLoaderData<typeof loader>();
  const strings = useStrings();

  return (
    <main className="flex flex-1 flex-col gap-4 bg-ui p-4 font-mono md:gap-8 md:p-10">
      <section className="w-full">
        <div className="text-center">
          <h1 className="mt-8 scroll-m-20 font-semibold text-3xl tracking-tight lg:text-4xl">
            {tag}
          </h1>
        </div>

        <div className="mx-auto max-w-[450px]">
          <blockquote className="mt-2 text-center text-lg text-low italic">
            {strings.tag.subtitle}
          </blockquote>
        </div>
      </section>

      {/* The site's own listing row, unchanged. A Tag page that invented its
        * own layout would be a fourth copy of this markup and the first list
        * here a reader has to learn to read. No `showKind`: every row is a
        * Post, and the heading above has said so. */}
      <section className="mx-auto w-full max-w-measure">
        {posts.map((post) => (
          <ContentItem key={post.idContent} item={post} />
        ))}
      </section>
    </main>
  );
}
