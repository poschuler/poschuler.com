import { describe, expect, it } from "vitest";

import { NotFound } from "~/components/not-found";
import { ErrorBoundary as TagErrorBoundary, meta as tagMeta } from "~/routes/tag/_$tag";
import { meta as tagsMeta } from "~/routes/tags/_tags";

/**
 * A Tag page exists for the reader and for internal linking, not to compete in
 * search with the Posts it points at. That is one line of `meta` and nothing
 * else enforces it, which is why it is asserted the same way the 404 route's
 * `noindex` already is.
 *
 * `follow` is the half that has to survive an edit: dropping it would leave the
 * page unindexed *and* uncrawled, which is the opposite of what the phase was
 * justified by.
 */

const metaArgs = (tag: string, posts: number) =>
  ({ loaderData: { tag, posts: Array.from({ length: posts }, () => ({})) } }) as never;

describe("the Tag page's meta", () => {
  it("asks not to be indexed, and asks to be followed", () => {
    expect(tagMeta(metaArgs("nodejs", 4))).toContainEqual({
      name: "robots",
      content: "noindex, follow",
    });
  });

  it("titles the page with the Tag, which is also its label and its URL", () => {
    expect(tagMeta(metaArgs("nodejs", 4))).toContainEqual({
      title: "nodejs | Paul Osorio Schuler",
    });
  });

  it("counts the articles in the singular when there is one", () => {
    const [, description] = tagMeta(metaArgs("zod", 1));

    expect(description).toEqual({
      name: "description",
      content: "Everything Paul Osorio Schuler has written on zod: 1 article, newest first.",
    });
  });
});

/**
 * The index is the half of the pair that *is* indexed. It is a page of the
 * site's own subjects rather than a list of links to one Post, and it is what
 * the sitemap advertises — so the absence of a robots directive here is as
 * load-bearing as its presence one route over, and just as easy to break with a
 * line copied between two files that look alike.
 */
describe("the Tag index's meta", () => {
  // A non-empty list: the empty case — which does add a robots directive,
  // `empty-index.test.ts` covers — is deliberately not this one.
  const args = { loaderData: { locale: "en" as const, tags: [{ tag: "nodejs", posts: 3 }] } } as never;

  it("carries no robots directive at all", () => {
    expect(tagsMeta(args)).not.toContainEqual(expect.objectContaining({ name: "robots" }));
  });

  it("declares itself canonical at the bare path", () => {
    expect(tagsMeta(args)).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://poschuler.com/tags",
    });
  });

  /** The index is index-constant: both, always (Part 6), regardless of what a query would return. */
  it("declares itself canonical under /es for the Spanish branch", () => {
    expect(
      tagsMeta({ loaderData: { locale: "es", tags: [{ tag: "nodejs", posts: 3 }] } } as never),
    ).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://poschuler.com/es/tags",
    });
  });
});

/**
 * A Tag no Post carries is a 404, and it has to look like this site's 404: the
 * root boundary sits outside the layout, so without this the reader who edited
 * the URL by hand lands on a bare `404` with no header and nothing to click.
 *
 * The error arrives as React Router's `ErrorResponse`, which has no exported
 * constructor — `isRouteErrorResponse` reads the four fields below, so the
 * literal is the thrown shape rather than a stand-in for it.
 */
const routeError = (status: number) => ({
  status,
  statusText: "Not Found",
  internal: false,
  data: null,
});

/** The props React Router hands a boundary, of which only `error` is read. */
const boundaryProps = (error: unknown) => ({ error }) as never;

describe("the Tag page's ErrorBoundary", () => {
  it("renders the site's 404 for a Tag with nothing behind it", () => {
    expect(TagErrorBoundary(boundaryProps(routeError(404)))?.type).toBe(NotFound);
  });

  it("rethrows a real failure rather than calling it a missing Tag", () => {
    expect(() => TagErrorBoundary(boundaryProps(routeError(500)))).toThrow();
    expect(() => TagErrorBoundary(boundaryProps(new Error("D1 is down")))).toThrow("D1 is down");
  });
});
