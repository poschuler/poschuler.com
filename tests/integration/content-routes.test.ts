import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loader as blogSlugLoader } from "~/routes/blog-slug/_$blog-slug";
import { loader as blogLoader } from "~/routes/blog/_blog";
import { loader as bookmarksLoader } from "~/routes/bookmarks/_bookmarks";
import { loader as homeLoader } from "~/routes/home/_home";

import {
  openTestPlatform,
  platformWith,
  routeArgs,
  type TestPlatform,
} from "../setup/platform";

/**
 * The four routes that read a store. These modules also export a React
 * component, which is why they are `.tsx` — importing them here evaluates the
 * module, it never renders anything.
 *
 * Each loader is typed by its own generated `Route.LoaderArgs`, so the argument
 * type is taken from the loader itself rather than restated.
 */

let platform: TestPlatform;
let postSlug: string;

type ArgsOf<Loader> = Loader extends (args: infer A) => unknown ? A : never;

const get = (path: string) => new Request(`https://poschuler.com${path}`);

beforeAll(async () => {
  platform = await openTestPlatform();

  const { contentItems } = await homeLoader(routeArgs<ArgsOf<typeof homeLoader>>(platform, get("/")));
  postSlug = contentItems.find((item) => item.type === "post")!.slug;
});

afterAll(async () => {
  await platform?.dispose();
});

describe("/ — the Timeline", () => {
  it("interleaves Posts and Bookmarks, newest first", async () => {
    const { contentItems } = await homeLoader(
      routeArgs<ArgsOf<typeof homeLoader>>(platform, get("/")),
    );

    expect(contentItems.length).toBeGreaterThan(0);
    expect(contentItems.some((item) => item.type === "post")).toBe(true);
    expect(contentItems.some((item) => item.type === "link")).toBe(true);

    const dates = contentItems.map((item) => item.publishedAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe("/blog", () => {
  it("returns Posts and nothing else", async () => {
    const { posts } = await blogLoader(routeArgs<ArgsOf<typeof blogLoader>>(platform, get("/blog")));

    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((post) => post.type === "post")).toBe(true);
  });
});

describe("/bookmarks", () => {
  it("returns Bookmarks and nothing else", async () => {
    const { bookmarks } = await bookmarksLoader(
      routeArgs<ArgsOf<typeof bookmarksLoader>>(platform, get("/bookmarks")),
    );

    expect(bookmarks.length).toBeGreaterThan(0);
    expect(bookmarks.every((bookmark) => bookmark.type === "link")).toBe(true);
  });
});

describe("/blog/:blogSlug", () => {
  const args = (slug: string, platformOverride: Pick<TestPlatform, "env" | "ctx"> = platform) =>
    routeArgs<ArgsOf<typeof blogSlugLoader>>(platformOverride, get(`/blog/${slug}`), {
      blogSlug: slug,
    });

  it("returns the rendered body and its front matter for a published Slug", async () => {
    const payload = await blogSlugLoader(args(postSlug));

    expect(payload.title).toBeTruthy();
    expect(payload.slug).toBe(postSlug);
    expect(payload.html).toContain("<");
  });

  /** A missing key, an unpublished Post and a typo all behave the same way. */
  it("404s on a Slug with nothing behind it", async () => {
    await expect(blogSlugLoader(args("no-such-post"))).rejects.toMatchObject({ status: 404 });
  });

  /**
   * A loader's return value ships twice — once in the rendered HTML, once again
   * in the hydration payload beneath it. `tags` is dropped on purpose because
   * nothing renders it; putting it back costs every visitor bytes for nothing.
   */
  it("drops the front matter nothing renders", async () => {
    const payload = await blogSlugLoader(args(postSlug));

    expect(payload).not.toHaveProperty("tags");
    expect(payload).not.toHaveProperty("attributes");
  });

  /**
   * The route hardcodes `:en`. The KV key layout is Locale-aware even though no
   * URL carries one, so this pins the known limitation: whoever serves a second
   * Translation has to change this test on purpose.
   */
  it("reads the en Translation, because no URL carries a Locale yet", async () => {
    const keys: string[] = [];
    const spy = platformWith(platform, {
      BLOG_KV: {
        get: async (key: string) => {
          keys.push(key);
          return { attributes: { title: "x", publishedAt: "2026-01-01" }, html: "<p>x</p>" };
        },
      },
    });

    await blogSlugLoader(args(postSlug, spy));

    expect(keys).toEqual([`blog:${postSlug}:en`]);
  });
});
