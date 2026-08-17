import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LOCALES } from "~/context";
import { alternateLinks, documentAddresses } from "~/lib/seo/alternates";
import { breadcrumbList, siteCrumb } from "~/lib/seo/structured-data";

import { loader as blogLoader, meta as blogMeta } from "~/routes/blog/_blog";
import { loader as blogSlugLoader } from "~/routes/blog-slug/_$blog-slug";
import { loader as bookmarksLoader } from "~/routes/bookmarks/_bookmarks";
import { loader as homeLoader } from "~/routes/home/_home";
import { loader as projectNoteLoader } from "~/routes/project-note/_$project-note";
import { loader as projectLoader } from "~/routes/project-slug/_$project-slug";
import { loader as projectsLoader, meta as projectsMeta } from "~/routes/projects/_projects";
import { loader as seriesPartLoader } from "~/routes/series-part/_$series-part";
import { loader as seriesLandingLoader } from "~/routes/series-slug/_$series-slug";
import { loader as seriesLoader, meta as seriesMeta } from "~/routes/series/_series";
import { loader as tagLoader } from "~/routes/tag/_$tag";
import { loader as tagsLoader, meta as tagsMeta } from "~/routes/tags/_tags";
import { loader as timelineLoader } from "~/routes/timeline/_timeline";

import { openTestPlatform, routeArgs, type TestPlatform } from "../setup/platform";

/**
 * What `/es` answers today, with no Spanish content seeded anywhere — the
 * state Part 6 of `evolution-plan/15-phase-3-spanish.md` exists to make safe:
 * every document below is English-only, so every one of these is the
 * no-Translation and empty-index case, exercised for real rather than assumed.
 *
 * `en` fixtures throughout — this file adds no `.es.md`, because the floor
 * that reveals `/es` (Part 13) is content, not code, and is deliberately not
 * this ticket's job.
 */

let platform: TestPlatform;
/** A Post that belongs to no Series or Project — English-only in the fixtures. */
let postSlug: string;
/** A Part, and the Series it belongs to — both English-only in the fixtures. */
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

/**
 * A document with no Translation is a 404 — the leaf half of Part 6's split.
 * Every fixture here is English-only, so the Spanish address of each is
 * exactly this case, not a stand-in for it.
 */
describe("a document with no Spanish Translation", () => {
  it("404s a Post at its Spanish address", async () => {
    await expect(
      blogSlugLoader(
        routeArgs<ArgsOf<typeof blogSlugLoader>>(platform, get(`/es/blog/${postSlug}`), {
          blogSlug: postSlug,
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("404s a Project at its Spanish address", async () => {
    await expect(
      projectLoader(
        routeArgs<ArgsOf<typeof projectLoader>>(platform, get("/es/projects/chekalo"), {
          projectSlug: "chekalo",
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("404s a Series landing at its Spanish address", async () => {
    await expect(
      seriesLandingLoader(
        routeArgs<ArgsOf<typeof seriesLandingLoader>>(platform, get(`/es/series/${seriesSlug}`), {
          seriesSlug,
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  /** The arc lookup 404s before the Part is ever checked — the Series itself has no Spanish row. */
  it("404s a Part at its Spanish address", async () => {
    await expect(
      seriesPartLoader(
        routeArgs<ArgsOf<typeof seriesPartLoader>>(
          platform,
          get(`/es/series/${seriesSlug}/${partSlug}`),
          { seriesSlug, partSlug },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  /** Same reason: the Project itself has no Spanish row, so the note never gets read. */
  it("404s a Field Note at its Spanish address", async () => {
    await expect(
      projectNoteLoader(
        routeArgs<ArgsOf<typeof projectNoteLoader>>(
          platform,
          get("/es/projects/chekalo/anything"),
          { projectSlug: "chekalo", noteSlug: "anything" },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  /** The precedent Part 6 generalises from, checked at the Locale that has nothing behind it. */
  it("404s a Tag some Post carries in English but not in Spanish", async () => {
    await expect(
      tagLoader(routeArgs<ArgsOf<typeof tagLoader>>(platform, get("/es/tags/nodejs"), { tag: "nodejs" })),
    ).rejects.toMatchObject({ status: 404 });
  });
});

/**
 * An index whose list is empty still exists — the skeleton half of Part 6's
 * split. It answers 200 with an empty list rather than a 404, and its own
 * `meta` is what keeps it out of the index while it has nothing to show.
 */
describe("an index with nothing behind it in Spanish", () => {
  it("/es/blog answers 200 with an empty list", async () => {
    const { entries } = await blogLoader(routeArgs<ArgsOf<typeof blogLoader>>(platform, get("/es/blog")));

    expect(entries).toEqual([]);
  });

  it("/es/projects answers 200 with an empty list", async () => {
    const { projects } = await projectsLoader(
      routeArgs<ArgsOf<typeof projectsLoader>>(platform, get("/es/projects")),
    );

    expect(projects).toEqual([]);
  });

  it("/es/series answers 200 with an empty list", async () => {
    const { series } = await seriesLoader(
      routeArgs<ArgsOf<typeof seriesLoader>>(platform, get("/es/series")),
    );

    expect(series).toEqual([]);
  });

  it("/es/tags answers 200 with an empty list", async () => {
    const { tags } = await tagsLoader(routeArgs<ArgsOf<typeof tagsLoader>>(platform, get("/es/tags")));

    expect(tags).toEqual([]);
  });

  /**
   * Every empty index declares `noindex, follow` rather than entering the
   * index thin — checked against the real loader output, not a synthetic
   * stand-in, so a query that stops returning an empty array here would also
   * be caught by the assertions above before this one could go stale.
   */
  it("declares noindex, follow on every index the queries above found empty", async () => {
    const [blogData, projectsData, seriesData, tagsData] = await Promise.all([
      blogLoader(routeArgs<ArgsOf<typeof blogLoader>>(platform, get("/es/blog"))),
      projectsLoader(routeArgs<ArgsOf<typeof projectsLoader>>(platform, get("/es/projects"))),
      seriesLoader(routeArgs<ArgsOf<typeof seriesLoader>>(platform, get("/es/series"))),
      tagsLoader(routeArgs<ArgsOf<typeof tagsLoader>>(platform, get("/es/tags"))),
    ]);

    const robots = { name: "robots", content: "noindex, follow" };

    expect(blogMeta({ loaderData: blogData } as never)).toContainEqual(robots);
    expect(projectsMeta({ loaderData: projectsData } as never)).toContainEqual(robots);
    expect(seriesMeta({ loaderData: seriesData } as never)).toContainEqual(robots);
    expect(tagsMeta({ loaderData: tagsData } as never)).toContainEqual(robots);
  });

  /**
   * The other half of what an empty index says about itself. `noindex` keeps
   * it out of the index; the `hreflang` pair is what tells a crawler the
   * English address is the same page in another language — and the sitemap
   * has always declared that pair, so a head that declared nothing left the
   * two halves disagreeing. Asserted through the real `meta()` for the same
   * reason the robots check above is: the descriptor a route actually returns.
   */
  it("declares its reciprocal hreflang, matching what the sitemap says about it", async () => {
    const blogData = await blogLoader(
      routeArgs<ArgsOf<typeof blogLoader>>(platform, get("/es/blog")),
    );

    const expected = alternateLinks(
      documentAddresses({ kind: "index", path: "/blog" }, "es", LOCALES),
    );

    expect(expected).toHaveLength(3);

    for (const link of expected) {
      expect(blogMeta({ loaderData: blogData } as never)).toContainEqual(link);
    }
  });

  /**
   * The trail a Spanish index publishes about itself. It used to be the English
   * one verbatim — *Home* and *Tags* pointing at `poschuler.com/` and
   * `/tags` — so the page emitting the `BreadcrumbList` was not among its own
   * steps, three lines under a canonical that said `/es/tags`. Read out of the
   * real `meta()` and matched whole, because the defect was not one wrong field
   * but a trail belonging to the other branch.
   */
  it("names itself in its own trail, in its own Locale and its own branch", async () => {
    const tagsData = await tagsLoader(
      routeArgs<ArgsOf<typeof tagsLoader>>(platform, get("/es/tags")),
    );

    expect(tagsMeta({ loaderData: tagsData } as never)).toContainEqual({
      "script:ld+json": breadcrumbList([siteCrumb("home", "es"), siteCrumb("tags", "es")]),
    });

    const trail = breadcrumbList([siteCrumb("home", "es"), siteCrumb("tags", "es")]) as {
      itemListElement: Array<{ name: string; item: string }>;
    };

    expect(trail.itemListElement.map((step) => step.name)).toEqual(["Inicio", "Etiquetas"]);
    expect(trail.itemListElement.map((step) => step.item)).toEqual([
      "https://poschuler.com/es",
      "https://poschuler.com/es/tags",
    ]);
  });

  /**
   * Bookmarks belong to both Locales (Part 7): a Bookmark has no Locale, so
   * `/es/bookmarks` and `/es/timeline` are full from day one and never reach
   * the empty branch above — checked here so a regression that broke the
   * `lang is null` filter would fail loudly rather than silently emptying the
   * one section this phase promised would never be.
   */
  it("/es/bookmarks and /es/timeline stay full — a Bookmark has no Locale", async () => {
    const [{ bookmarks }, { contentItems }] = await Promise.all([
      bookmarksLoader(routeArgs<ArgsOf<typeof bookmarksLoader>>(platform, get("/es/bookmarks"))),
      timelineLoader(routeArgs<ArgsOf<typeof timelineLoader>>(platform, get("/es/timeline"))),
    ]);

    expect(bookmarks.length).toBeGreaterThan(0);
    expect(contentItems.length).toBeGreaterThan(0);
    expect(contentItems.every((item) => item.type === "link")).toBe(true);
  });
});

/**
 * `findAllProjects` used to carry no Locale filter at all — invisible while
 * every Project was English, and exactly the defect Part 6's second rule
 * exists to catch: a Spanish address rendering an English Project verbatim,
 * on `/es/projects` and on the home page's flagship block alike.
 */
describe("findAllProjects, now Locale-filtered", () => {
  it("lists the English Projects at the English address", async () => {
    const { projects } = await projectsLoader(
      routeArgs<ArgsOf<typeof projectsLoader>>(platform, get("/projects")),
    );

    expect(projects.length).toBeGreaterThan(0);
  });

  it("carries no English Project onto the Spanish home page's flagship block", async () => {
    const { flagship, recentPosts } = await homeLoader(
      routeArgs<ArgsOf<typeof homeLoader>>(platform, get("/es")),
    );

    expect(flagship).toBeNull();
    expect(recentPosts).toEqual([]);
  });
});
