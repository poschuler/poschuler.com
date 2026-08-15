import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loader as blogSlugLoader } from "~/routes/blog-slug/_$blog-slug";
import { loader as blogLoader } from "~/routes/blog/_blog";
import { loader as bookmarksLoader } from "~/routes/bookmarks/_bookmarks";
import { loader as homeLoader } from "~/routes/home/_home";
import { loader as projectLoader } from "~/routes/project-slug/_$project-slug";
import { loader as projectsLoader } from "~/routes/projects/_projects";
import { loader as seriesPartLoader } from "~/routes/series-part/_$series-part";
import { loader as seriesLandingLoader } from "~/routes/series-slug/_$series-slug";
import { loader as seriesLoader } from "~/routes/series/_series";
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
/** A Post with a Container, and the Series it belongs to. */
let partSlug: string;
let seriesSlug: string;

type ArgsOf<Loader> = Loader extends (args: infer A) => unknown ? A : never;

const get = (path: string) => new Request(`https://poschuler.com${path}`);

beforeAll(async () => {
  platform = await openTestPlatform();

  const { contentItems } = await timelineLoader(
    routeArgs<ArgsOf<typeof timelineLoader>>(platform, get("/timeline")),
  );

  postSlug = contentItems.find((item) => item.type === "post" && item.seriesSlug === null)!.slug;

  const part = contentItems.find((item) => item.type === "post" && item.seriesSlug !== null)!;
  partSlug = part.slug;
  seriesSlug = part.seriesSlug!;
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
 * `/blog` changed unit: loose Posts plus each Series as a single entry. A Part
 * appearing here individually would mean publishing part nine lengthens the
 * page, which is exactly what the change exists to prevent.
 */
describe("/blog", () => {
  const load = () => blogLoader(routeArgs<ArgsOf<typeof blogLoader>>(platform, get("/blog")));

  it("lists loose Posts and Series, and no Part on its own", async () => {
    const { entries } = await load();

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.kind === "series")).toBe(true);

    for (const entry of entries) {
      if (entry.kind === "post") {
        expect(entry.post.type).toBe("post");
        expect(entry.post.seriesSlug).toBeNull();
      }
    }
  });

  it("orders both units by date, newest first — a Series by its most recent Part", async () => {
    const { entries } = await load();
    const dates = entries.map((entry) =>
      entry.kind === "post" ? entry.post.publishedAt : entry.series.publishedAt,
    );

    expect(dates.every(Boolean)).toBe(true);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("carries the size of each Series, which is not a position", async () => {
    const { entries } = await load();
    const series = entries.find((entry) => entry.kind === "series");

    expect(series?.kind === "series" && series.series.partCount).toBeGreaterThan(0);
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
   * A Part's body sits under the same `blog:` key as any other Post — the
   * prefix says what kind of payload it is, not which URL serves it — so KV
   * alone would answer here with a page that also exists under `/series`. One
   * article at two addresses is a canonical nobody declared.
   */
  it("sends a Part to its Series rather than serving it a second time", async () => {
    // A loader signals a redirect by throwing one, so the assertion has to
    // catch it: resolving here is itself the failure.
    const response: Response = await blogSlugLoader(args(partSlug)).then(
      () => {
        throw new Error(`/blog/${partSlug} served a Part instead of redirecting`);
      },
      (thrown) => thrown,
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(`/series/${seriesSlug}/${partSlug}`);
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
    routeArgs<ArgsOf<typeof projectLoader>>(on, get(`/projects/${slug}`), { projectSlug: slug });

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

/**
 * A Series is not a Content Item: no Published At, never in the Timeline,
 * revised in place. What it has instead is an arc, and these assert that the
 * arc reaches the pages that render it.
 */
describe("/series — the index", () => {
  it("returns every Series with its contract and its size", async () => {
    const { series } = await seriesLoader(
      routeArgs<ArgsOf<typeof seriesLoader>>(platform, get("/series")),
    );

    expect(series.length).toBeGreaterThan(0);

    for (const one of series) {
      expect(one.destination).toBeTruthy();
      expect(one.outOfScope.length).toBeGreaterThan(0);
      expect(["ongoing", "complete"]).toContain(one.status);
    }
  });

  it("dates each Series by its most recent Part", async () => {
    const { series } = await seriesLoader(
      routeArgs<ArgsOf<typeof seriesLoader>>(platform, get("/series")),
    );
    const [first] = series;

    expect(first.partCount).toBeGreaterThan(0);
    expect(first.publishedStringDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("/series/:seriesSlug — the landing", () => {
  const args = (slug: string, on: Pick<TestPlatform, "env" | "ctx"> = platform) =>
    routeArgs<ArgsOf<typeof seriesLandingLoader>>(on, get(`/series/${slug}`), {
      seriesSlug: slug,
    });

  it("returns the contract, the arc and the body together", async () => {
    const payload = await seriesLandingLoader(args(seriesSlug));

    expect(payload.startingPoint).toBeTruthy();
    expect(payload.destination).toBeTruthy();
    expect(payload.audience).toBeTruthy();
    expect(payload.outOfScope.length).toBeGreaterThan(0);
    expect(payload.sections.length).toBeGreaterThan(0);
    expect(payload.html).toContain("<");
  });

  /**
   * A section with no Parts is *planned* and still belongs on the landing: it
   * says what will be covered in a sentence, and enumerates nothing. That is
   * what keeps the arc visible without the empty checkboxes.
   */
  it("keeps a section with no Parts, carrying its summary", async () => {
    const { sections } = await seriesLandingLoader(args(seriesSlug));
    const planned = sections.filter((section) => section.parts.length === 0);

    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((section) => section.summary.trim() !== "")).toBe(true);
  });

  /**
   * Reading order, which is the opposite of every index on the site: those
   * answer *what is new*, an arc answers *where do I start*. The dates come out
   * ascending here only because these Parts were written in order — what the
   * assertion pins is that nothing re-sorted them by `published_at desc` on the
   * way through.
   */
  it("lists the Parts of a section in reading order, not newest first", async () => {
    const { sections } = await seriesLandingLoader(args(seriesSlug));
    const dates = sections[0].parts.map((part) => part.publishedStringDate);

    expect(dates.length).toBeGreaterThan(1);
    expect(dates).toEqual([...dates].sort());
  });

  it("404s on a Slug with nothing behind it", async () => {
    await expect(seriesLandingLoader(args("no-such-series"))).rejects.toMatchObject({
      status: 404,
    });
  });

  /** The landing takes its own prefix, because it is not a Post. */
  it("reads the body from the series: key space", async () => {
    const keys: string[] = [];
    const spy = platformWith(platform, {
      BLOG_KV: {
        get: async (key: string) => {
          keys.push(key);
          return { html: "<p>x</p>" };
        },
      },
    });

    await seriesLandingLoader(args(seriesSlug, spy));

    expect(keys).toEqual([`series:${seriesSlug}:en`]);
  });
});

describe("/series/:seriesSlug/:partSlug — a Part", () => {
  const args = (series: string, part: string, on: Pick<TestPlatform, "env" | "ctx"> = platform) =>
    routeArgs<ArgsOf<typeof seriesPartLoader>>(on, get(`/series/${series}/${part}`), {
      seriesSlug: series,
      partSlug: part,
    });

  it("returns the article and the orientation around it", async () => {
    const payload = await seriesPartLoader(args(seriesSlug, partSlug));

    expect(payload.title).toBeTruthy();
    expect(payload.html).toContain("<");
    expect(payload.seriesTitle).toBeTruthy();
    expect(payload.orientation.section.title).toBeTruthy();
    expect(payload.orientation.section.parts.some((part) => part.slug === partSlug)).toBe(true);
  });

  /** The body is an ordinary Post's, under the prefix every Post body uses. */
  it("reads the body from the blog: key space", async () => {
    const keys: string[] = [];
    const spy = platformWith(platform, {
      BLOG_KV: {
        get: async (key: string) => {
          keys.push(key);
          return { attributes: { title: "x", publishedAt: "2026-01-01" }, html: "<p>x</p>" };
        },
      },
    });

    await seriesPartLoader(args(seriesSlug, partSlug, spy));

    expect(keys).toEqual([`blog:${partSlug}:en`]);
  });

  it("404s on a Series that does not exist", async () => {
    await expect(seriesPartLoader(args("no-such-series", partSlug))).rejects.toMatchObject({
      status: 404,
    });
  });

  /**
   * The arc decides. A Slug this Series does not hold is a 404 rather than an
   * article inside somebody else's frame — which is what would happen if the
   * route trusted the URL and read KV straight away.
   */
  it("404s on a Part the Series does not hold", async () => {
    await expect(seriesPartLoader(args(seriesSlug, postSlug))).rejects.toMatchObject({
      status: 404,
    });
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
