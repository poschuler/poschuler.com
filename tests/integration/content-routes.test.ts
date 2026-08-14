import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loader as blogSlugLoader } from "~/routes/blog-slug/_$blog-slug";
import { loader as blogLoader } from "~/routes/blog/_blog";
import { loader as bookmarksLoader } from "~/routes/bookmarks/_bookmarks";
import { loader as homeLoader } from "~/routes/home/_home";
import { loader as projectLoader } from "~/routes/projects/_$project";
import { loader as projectsLoader } from "~/routes/projects/_projects";
import { loader as timelineLoader } from "~/routes/timeline/_timeline";

import {
  openTestPlatform,
  platformWith,
  routeArgs,
  type TestPlatform,
} from "../setup/platform";

/**
 * The five routes that read a store. These modules also export a React
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

  const { contentItems } = await timelineLoader(
    routeArgs<ArgsOf<typeof timelineLoader>>(platform, get("/timeline")),
  );
  postSlug = contentItems.find((item) => item.type === "post")!.slug;
});

afterAll(async () => {
  await platform?.dispose();
});

describe("/timeline — the Timeline", () => {
  it("interleaves Posts and Bookmarks, newest first", async () => {
    const { contentItems } = await timelineLoader(
      routeArgs<ArgsOf<typeof timelineLoader>>(platform, get("/timeline")),
    );

    expect(contentItems.length).toBeGreaterThan(0);
    expect(contentItems.some((item) => item.type === "post")).toBe(true);
    expect(contentItems.some((item) => item.type === "link")).toBe(true);

    const dates = contentItems.map((item) => item.publishedAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

/**
 * The home page is a landing page, not an index: it carries a short, Post-only
 * excerpt. A Bookmark reaching it means the Timeline has leaked back in.
 */
describe("/ — the landing page", () => {
  it("returns the newest Posts only, and no more than three", async () => {
    const { recentPosts } = await homeLoader(
      routeArgs<ArgsOf<typeof homeLoader>>(platform, get("/")),
    );

    expect(recentPosts.length).toBeGreaterThan(0);
    expect(recentPosts.length).toBeLessThanOrEqual(3);
    expect(recentPosts.every((post) => post.type === "post")).toBe(true);

    const dates = recentPosts.map((post) => post.publishedAt);
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

/**
 * A Project is not a Content Item, so none of the Timeline's rules apply to it.
 * What it does share with a Post is the two-store shape: the row frames the
 * page, KV carries the body.
 */
describe("/projects — the index", () => {
  it("returns every Project, heaviest first", async () => {
    const { projects } = await projectsLoader(
      routeArgs<ArgsOf<typeof projectsLoader>>(platform, get("/projects")),
    );

    expect(projects.length).toBeGreaterThan(0);
    expect(projects.filter((project) => project.tier === "flagship")).toHaveLength(1);

    const order = projects.map((project) => project.slug);
    expect(order[0]).toBe("chekalo");
  });

  /** Every tier the schema accepts must be one the index knows how to render. */
  it("returns no tier the index cannot place", async () => {
    const { projects } = await projectsLoader(
      routeArgs<ArgsOf<typeof projectsLoader>>(platform, get("/projects")),
    );

    expect(projects.every((project) => ["flagship", "supporting"].includes(project.tier))).toBe(
      true,
    );
  });
});

describe("/projects/:project", () => {
  const args = (slug: string, on: Pick<TestPlatform, "env" | "ctx"> = platform) =>
    routeArgs<ArgsOf<typeof projectLoader>>(on, get(`/projects/${slug}`), { project: slug });

  it("returns the row and the body together", async () => {
    const payload = await projectLoader(args("chekalo"));

    expect(payload.title).toBeTruthy();
    expect(payload.summary).toBeTruthy();
    expect(payload.html).toContain("<");
  });

  it("404s on a Slug with nothing behind it", async () => {
    await expect(projectLoader(args("no-such-project"))).rejects.toMatchObject({ status: 404 });
  });

  /**
   * A Project has no Published At — its most recent revision is the only date
   * it has, and the sitemap depends on there being one.
   */
  it("carries at least one revision, parsed out of the column", async () => {
    const payload = await projectLoader(args("chekalo"));

    expect(payload.revisions.length).toBeGreaterThan(0);
    expect(payload.revisions[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  /** The prefix follows the kind of payload, not the URL that serves it. */
  it("reads the body from the project: key space", async () => {
    const keys: string[] = [];
    const spy = platformWith(platform, {
      BLOG_KV: {
        get: async (key: string) => {
          keys.push(key);
          return { html: "<p>x</p>" };
        },
      },
    });

    await projectLoader(args("chekalo", spy));

    expect(keys).toEqual(["project:chekalo:en"]);
  });
});

describe("/ — the flagship block", () => {
  it("carries the flagship Project and nothing else from the index", async () => {
    const { flagship } = await homeLoader(routeArgs<ArgsOf<typeof homeLoader>>(platform, get("/")));

    expect(flagship?.slug).toBe("chekalo");
  });

  /**
   * A loader's return value ships twice. The home page frames the flagship in
   * four fields; the rest of the row is weight nobody renders.
   */
  it("sends only the fields the block renders", async () => {
    const { flagship } = await homeLoader(routeArgs<ArgsOf<typeof homeLoader>>(platform, get("/")));

    expect(Object.keys(flagship ?? {}).sort()).toEqual(["liveUrl", "slug", "summary", "title"]);
  });
});
