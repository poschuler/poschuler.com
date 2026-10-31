import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loader as blogSlugLoader } from "~/routes/blog-slug/_$blog-slug";
import { loader as blogLoader } from "~/routes/blog/_blog";
import { loader as bookmarksLoader } from "~/routes/bookmarks/_bookmarks";
import { loader as homeLoader } from "~/routes/home/_home";
import { loader as projectLoader } from "~/routes/project-slug/_$project-slug";
import { loader as projectsLoader } from "~/routes/projects/_projects";
import { loader as tagLoader } from "~/routes/tag/_$tag";
import { loader as tagsLoader } from "~/routes/tags/_tags";
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
/** A Post that belongs to no Series — the only kind `/blog/:slug` still serves. */
let postSlug: string;
/** Some Project — the two-store shape is the same whichever one it is. */
let projectSlug: string;
/** The Project the home page is supposed to single out, read from the store. */
let flagshipSlug: string;

type ArgsOf<Loader> = Loader extends (args: infer A) => unknown ? A : never;

const get = (path: string) => new Request(`https://poschuler.com${path}`);

beforeAll(async () => {
  platform = await openTestPlatform();

  const { contentItems } = await timelineLoader(
    routeArgs<ArgsOf<typeof timelineLoader>>(platform, get("/timeline")),
  );

  postSlug = contentItems.find((item) => item.type === "post" && item.seriesSlug === null)!.slug;

  const { projects } = await projectsLoader(
    routeArgs<ArgsOf<typeof projectsLoader>>(platform, get("/projects")),
  );

  projectSlug = projects[0]!.slug;

  // From the store, not from the index above: the home page picking the
  // flagship out of that same list is the thing the block's test asserts, and
  // a comparison between two callers of `findAllProjects` would agree with
  // itself whatever the query returned.
  const { results } = await platform.env.POSCHULER_BD.prepare(
    `select slug from project where lang = 'en' and tier = 'flagship' order by slug asc`,
  ).all<{ slug: string }>();

  flagshipSlug = results[0]!.slug;
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

/**
 * `/blog` changed unit: loose Posts plus each Project with Field Notes
 * as a single entry. A Part or a Field Note appearing here individually would
 * mean publishing part nine, or a new note, lengthens the page, which is
 * exactly what the change exists to prevent. The fixtures carry no published
 * Field Note (`field-notes.test.ts` covers a Project that has one), so this
 * file only asserts a loose Post has no Container at all.
 */
describe("/blog", () => {
  const load = () => blogLoader(routeArgs<ArgsOf<typeof blogLoader>>(platform, get("/blog")));

  it("lists Posts and Projects with Field Notes, and nothing else", async () => {
    const { entries } = await load();

    expect(entries.length).toBeGreaterThan(0);
    expect([...new Set(entries.map((entry) => entry.kind))].sort()).toEqual(
      expect.arrayContaining(["post"]),
    );

    for (const entry of entries) {
      expect(["post", "project"]).toContain(entry.kind);
    }
  });

  it("lists loose Posts, and no Part on its own", async () => {
    const { entries } = await load();

    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      if (entry.kind === "post") {
        expect(entry.post.type).toBe("post");
        expect(entry.post.seriesSlug).toBeNull();
        expect(entry.post.projectSlug).toBeNull();
      }
    }
  });

  it("orders every unit by date, newest first — a Container by its most recent child", async () => {
    const { entries } = await load();
    const dates = entries.map((entry) => {
      if (entry.kind === "post") return entry.post.publishedAt;
      return entry.project.publishedAt;
    });

    expect(dates.every(Boolean)).toBe(true);
    expect(dates).toEqual([...dates].sort().reverse());
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
   * **A reversal, rewritten rather than deleted.** This assertion used to read
   * `not.toHaveProperty("tags")`, and the reason was sound: a loader's return
   * value ships twice — once in the rendered HTML, once again in the hydration
   * payload beneath it — and nothing rendered Tags, so shipping them cost every
   * visitor bytes for nothing.
   *
   * The cost has not changed and the argument was never wrong. What changed is
   * the other side of it: a Tag now has a page, so the chips are a way out
   * sideways for a reader who just finished the article. This payload is also
   * the cheapest place to take them from — the front matter travelled here
   * verbatim in KV, so neither Post route pays a query for them.
   *
   * `attributes` stays out: what the page renders are the fields picked out of
   * the front matter, never the raw block.
   */
  it("returns the front matter the page renders, Tags now included", async () => {
    const payload = await blogSlugLoader(args(postSlug));

    expect(payload.tags.length).toBeGreaterThan(0);
    expect(payload).not.toHaveProperty("attributes");
  });

  /**
   * The KV read is keyed off the resolved row's own Locale, not the request's
   * — the same rule every sibling Post route already follows. `postSlug` is
   * English-only in the fixtures, so the key still reads `:en` here; a Spanish
   * fixture would read `:es` without this test changing at all.
   */
  it("reads the KV body at the resolved row's own Locale", async () => {
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

    // Heaviest first is the claim, so the tier is what to assert — naming the
    // Project would pin which one is flagship today rather than the ordering,
    // and the ordering is what a supporting Project sorted above it would break.
    expect(projects[0].tier).toBe("flagship");
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
    routeArgs<ArgsOf<typeof projectLoader>>(on, get(`/projects/${slug}`), { projectSlug: slug });

  it("returns the row and the body together", async () => {
    const payload = await projectLoader(args(projectSlug));

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
    const payload = await projectLoader(args(projectSlug));

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

    await projectLoader(args(projectSlug, spy));

    expect(keys).toEqual([`project:${projectSlug}:en`]);
  });
});

/**
 * The index closes the namespace: the bare path was a 404 in the middle of a
 * live address space, which is the first place a crawler goes after a Tag page.
 */
describe("/tags — the index", () => {
  const load = () => tagsLoader(routeArgs<ArgsOf<typeof tagsLoader>>(platform, get("/tags")));

  it("returns every Tag some Post carries, heaviest first", async () => {
    const { tags } = await load();

    expect(tags.length).toBeGreaterThan(1);

    const counts = tags.map((tag) => tag.posts);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  /**
   * The one defect an index of links can have. Every entry is followed through
   * the loader that serves it, which throws a 404 for a Tag no Post carries —
   * so a stale or over-generous list fails here rather than in production.
   */
  it("offers no entry that leads to a 404", async () => {
    const { tags } = await load();

    for (const { tag, posts } of tags) {
      const page = await tagLoader(
        routeArgs<ArgsOf<typeof tagLoader>>(platform, get(`/tags/${tag}`), { tag }),
      );

      expect(page.posts.length).toBe(posts);
    }
  });
});

/**
 * The other half of the namespace, and the destination every entry above leads
 * to. It was reachable by URL alone before the index existed: destinations
 * first, then the page that links to them.
 */
describe("/tags/:tag", () => {
  const args = (tag: string) =>
    routeArgs<ArgsOf<typeof tagLoader>>(platform, get(`/tags/${tag}`), { tag });

  it("returns the Posts carrying the Tag, newest first", async () => {
    const { tag, posts } = await tagLoader(args("nodejs"));

    expect(tag).toBe("nodejs");
    expect(posts.length).toBeGreaterThan(1);
    expect(posts.every((post) => post.type === "post")).toBe(true);

    const dates = posts.map((post) => post.publishedAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  /**
   * The vocabulary declares what may be written; the content decides what
   * exists. `webdev` is declared and carried by Bookmarks alone, so its page
   * does not exist — an empty list rendered inside a frame would be a page
   * pretending to be a result.
   */
  it("404s on a declared Tag that only Bookmarks carry", async () => {
    await expect(tagLoader(args("webdev"))).rejects.toMatchObject({ status: 404 });
  });

  it("404s on a Tag that was never declared", async () => {
    await expect(tagLoader(args("no-such-tag"))).rejects.toMatchObject({ status: 404 });
  });

  /**
   * What makes a chip on a Post a link worth rendering: every Tag a Post
   * returns has a page, and that page lists the Post the chip was clicked from.
   *
   * It holds by construction — a Tag a Post carries is carried by at least that
   * Post — which is exactly why it is worth pinning. The two sides read from
   * different stores: the chips come from the front matter in KV and the page
   * from `content_tag` in D1, so the day one narrows without the other, a Post
   * starts offering links to a 404.
   *
   */
  it("lists the Post behind every chip its route renders", async () => {
    const post = await blogSlugLoader(
      routeArgs<ArgsOf<typeof blogSlugLoader>>(platform, get(`/blog/${postSlug}`), {
        blogSlug: postSlug,
      }),
    );

    expect(post.tags.length).toBeGreaterThan(0);

    for (const tag of post.tags) {
      const page = await tagLoader(args(tag));

      expect(page.posts.some((listed) => listed.slug === postSlug)).toBe(true);
    }
  });
});

describe("/ — the flagship block", () => {
  it("carries the flagship Project and nothing else from the index", async () => {
    const { flagship } = await homeLoader(routeArgs<ArgsOf<typeof homeLoader>>(platform, get("/")));

    expect(flagship?.slug).toBe(flagshipSlug);
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
