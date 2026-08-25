import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LOCALES } from "~/context";
import { alternateLinks, documentAddresses } from "~/lib/seo/alternates";
import { breadcrumbList } from "~/lib/seo/structured-data";
import { indexCrumb } from "~/lib/trail";

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
 * What `/es` answers, held against the two rules that make a half-translated
 * site safe: a document with no Translation is a 404, and an index with
 * nothing behind it answers 200 and keeps itself out of the search index.
 *
 * **Nothing here names a document or counts a corpus.** The stores are filled
 * from the real content fixtures, so what is seeded moves every time a `.md` is
 * written. Each case finds its own subject at run time — a Project with no
 * Spanish row, a Tag no Spanish Post carries — and asserts the rule against it.
 * The first version of this file asserted the census instead (`projects` is
 * `[]`, `flagship` is null) and went red the day the first `.es.md` was
 * written: a fact about the writing, not about the code.
 */

let platform: TestPlatform;
/** A Post that belongs to no Series or Project, and has no Spanish Translation. */
let postSlug: string;
/** A Part, and the Series it belongs to — a Series with no Spanish row. */
let partSlug: string;
let seriesSlug: string;
/** A Project with no Spanish row, and a Tag no Spanish Post carries. */
let projectSlug: string;
let tagName: string;

type ArgsOf<Loader> = Loader extends (args: infer A) => unknown ? A : never;

const get = (path: string) => new Request(`https://poschuler.com${path}`);

/**
 * What the store holds in Spanish, keyed by the column each case needs to check
 * a subject against. Written as whole statements rather than an interpolated
 * table name: the queries are constants here, and none of them takes a value.
 */
const SPANISH = {
  documents: `select slug as "key" from content where lang = 'es'`,
  projects: `select slug as "key" from project where lang = 'es'`,
  series: `select slug as "key" from series where lang = 'es'`,
  tags: `select distinct content_tag.tag as "key" from content_tag where lang = 'es'`,
} as const;

/** The keys one of those queries returns, as a set to test membership against. */
async function spanishKeys(sql: string): Promise<Set<string>> {
  const { results } = await platform.env.POSCHULER_BD.prepare(sql).all<{ key: string }>();

  return new Set(results.map((row) => row.key));
}

/**
 * Picks the subjects out of what is actually seeded.
 *
 * Each `find` is the case's own precondition written as code: the 404 rules are
 * about documents with no Translation, so a subject that has one would make the
 * case assert nothing. The `!` is deliberate — if the day comes when every
 * Project is translated, this throws here and names the file to move the case
 * out of, which beats a green test that stopped meaning anything.
 */
beforeAll(async () => {
  platform = await openTestPlatform();

  const [translatedDocuments, translatedProjects, translatedSeries, translatedTags] =
    await Promise.all([
      spanishKeys(SPANISH.documents),
      spanishKeys(SPANISH.projects),
      spanishKeys(SPANISH.series),
      spanishKeys(SPANISH.tags),
    ]);

  const [{ contentItems }, { projects }, { tags }] = await Promise.all([
    timelineLoader(routeArgs<ArgsOf<typeof timelineLoader>>(platform, get("/timeline"))),
    projectsLoader(routeArgs<ArgsOf<typeof projectsLoader>>(platform, get("/projects"))),
    tagsLoader(routeArgs<ArgsOf<typeof tagsLoader>>(platform, get("/tags"))),
  ]);

  postSlug = contentItems.find(
    (item) =>
      item.type === "post" && item.seriesSlug === null && !translatedDocuments.has(item.slug),
  )!.slug;

  const part = contentItems.find(
    (item) =>
      item.type === "post" && item.seriesSlug !== null && !translatedSeries.has(item.seriesSlug),
  )!;

  partSlug = part.slug;
  seriesSlug = part.seriesSlug!;

  projectSlug = projects.find((project) => !translatedProjects.has(project.slug))!.slug;
  tagName = tags.find((one) => !translatedTags.has(one.tag))!.tag;
});

afterAll(async () => {
  await platform?.dispose();
});

/**
 * A document with no Translation is a 404 — the leaf half of that pair.
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
        routeArgs<ArgsOf<typeof projectLoader>>(platform, get(`/es/projects/${projectSlug}`), {
          projectSlug,
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

  /**
   * Same reason: the Project itself has no Spanish row, so the note never gets
   * read. Which is why the subject is the untranslated Project and not any
   * Project — against one that *is* translated this would still pass, on the
   * unrelated ground that no note is called `anything`.
   */
  it("404s a Field Note at its Spanish address", async () => {
    await expect(
      projectNoteLoader(
        routeArgs<ArgsOf<typeof projectNoteLoader>>(
          platform,
          get(`/es/projects/${projectSlug}/anything`),
          { projectSlug, noteSlug: "anything" },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  /** The precedent the empty-index rule generalises from, checked at the Locale that has nothing behind it. */
  it("404s a Tag some Post carries in English but not in Spanish", async () => {
    await expect(
      tagLoader(
        routeArgs<ArgsOf<typeof tagLoader>>(platform, get(`/es/tags/${tagName}`), { tag: tagName }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

/**
 * An index exists at both Locales whether or not it has anything to list — the
 * skeleton half of that same pair. It answers 200 with a list rather than a
 * 404, it shows nothing that belongs to the other branch, and its own `meta` is
 * what keeps it out of the search index while it has nothing to show.
 */
describe("a Spanish index, with or without anything behind it", () => {
  it("answers 200 with a list on every Spanish index, empty or not", async () => {
    const [{ entries }, { projects }, { series }, { tags }] = await Promise.all([
      blogLoader(routeArgs<ArgsOf<typeof blogLoader>>(platform, get("/es/blog"))),
      projectsLoader(routeArgs<ArgsOf<typeof projectsLoader>>(platform, get("/es/projects"))),
      seriesLoader(routeArgs<ArgsOf<typeof seriesLoader>>(platform, get("/es/series"))),
      tagsLoader(routeArgs<ArgsOf<typeof tagsLoader>>(platform, get("/es/tags"))),
    ]);

    for (const list of [entries, projects, series, tags]) {
      expect(Array.isArray(list)).toBe(true);
    }
  });

  /**
   * What the emptiness assertions used to catch by accident, stated on purpose.
   * While `/es` had nothing, `toEqual([])` failed the moment a Locale filter
   * broke and let an English row through — and stopped being able to say that
   * the moment Spanish content arrived. Membership in the store's own `es` rows
   * is the same guarantee, and it survives everything written from here on.
   */
  it("lists only Spanish rows — no English document reaches a Spanish index", async () => {
    const [documents, projectSlugs, seriesSlugs, tagKeys] = await Promise.all([
      spanishKeys(SPANISH.documents),
      spanishKeys(SPANISH.projects),
      spanishKeys(SPANISH.series),
      spanishKeys(SPANISH.tags),
    ]);

    const [{ entries }, { projects }, { series }, { tags }] = await Promise.all([
      blogLoader(routeArgs<ArgsOf<typeof blogLoader>>(platform, get("/es/blog"))),
      projectsLoader(routeArgs<ArgsOf<typeof projectsLoader>>(platform, get("/es/projects"))),
      seriesLoader(routeArgs<ArgsOf<typeof seriesLoader>>(platform, get("/es/series"))),
      tagsLoader(routeArgs<ArgsOf<typeof tagsLoader>>(platform, get("/es/tags"))),
    ]);

    for (const entry of entries) {
      if (entry.kind === "post") expect(documents).toContain(entry.post.slug);
      if (entry.kind === "series") expect(seriesSlugs).toContain(entry.series.slug);
      if (entry.kind === "project") expect(projectSlugs).toContain(entry.project.slug);
    }

    for (const project of projects) {
      expect(project.lang).toBe("es");
      expect(projectSlugs).toContain(project.slug);
    }

    for (const one of series) {
      expect(seriesSlugs).toContain(one.slug);
    }

    for (const one of tags) {
      expect(tagKeys).toContain(one.tag);
    }
  });

  /**
   * An index declares `noindex, follow` exactly when its own list came back
   * empty, and drops it the moment it has something to show — both directions,
   * off the same payload the head was built from. Asserted as the rule rather
   * than as a list of empty indexes, because which ones are empty is a fact
   * about what has been written and changes without any code changing.
   */
  it("declares noindex, follow on exactly the indexes that came back empty", async () => {
    const [blogData, projectsData, seriesData, tagsData] = await Promise.all([
      blogLoader(routeArgs<ArgsOf<typeof blogLoader>>(platform, get("/es/blog"))),
      projectsLoader(routeArgs<ArgsOf<typeof projectsLoader>>(platform, get("/es/projects"))),
      seriesLoader(routeArgs<ArgsOf<typeof seriesLoader>>(platform, get("/es/series"))),
      tagsLoader(routeArgs<ArgsOf<typeof tagsLoader>>(platform, get("/es/tags"))),
    ]);

    const robots = { name: "robots", content: "noindex, follow" };

    const indexes = [
      { at: "/es/blog", list: blogData.entries, head: blogMeta({ loaderData: blogData } as never) },
      {
        at: "/es/projects",
        list: projectsData.projects,
        head: projectsMeta({ loaderData: projectsData } as never),
      },
      {
        at: "/es/series",
        list: seriesData.series,
        head: seriesMeta({ loaderData: seriesData } as never),
      },
      { at: "/es/tags", list: tagsData.tags, head: tagsMeta({ loaderData: tagsData } as never) },
    ];

    for (const index of indexes) {
      if (index.list.length === 0) {
        expect(index.head, index.at).toContainEqual(robots);
      } else {
        expect(index.head, index.at).not.toContainEqual(robots);
      }
    }
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
      "script:ld+json": breadcrumbList([indexCrumb("home", "es"), indexCrumb("tags", "es")]),
    });

    const trail = breadcrumbList([indexCrumb("home", "es"), indexCrumb("tags", "es")]) as {
      itemListElement: Array<{ name: string; item: string }>;
    };

    expect(trail.itemListElement.map((step) => step.name)).toEqual(["Inicio", "Etiquetas"]);
    expect(trail.itemListElement.map((step) => step.item)).toEqual([
      "https://poschuler.com/es",
      "https://poschuler.com/es/tags",
    ]);
  });

  /**
   * Bookmarks belong to both Locales: a Bookmark has no Locale, so
   * `/es/bookmarks` and `/es/timeline` are full from day one and never reach
   * the empty branch above — checked here so a regression that broke the
   * `lang is null` filter would fail loudly rather than silently emptying the
   * one section of the Spanish branch that can never legitimately be empty.
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
 * every Project was English, and exactly the defect those rules exist to
 * catch: a Spanish address rendering an English Project verbatim,
 * on `/es/projects` and on the home page's flagship block alike.
 */
describe("findAllProjects, now Locale-filtered", () => {
  it("lists the English Projects at the English address", async () => {
    const { projects } = await projectsLoader(
      routeArgs<ArgsOf<typeof projectsLoader>>(platform, get("/projects")),
    );

    expect(projects.length).toBeGreaterThan(0);
  });

  /**
   * The flagship block, which is where the missing filter showed the same
   * Project at both addresses. Read out of the store rather than out of a
   * second `findAllProjects` call: both blocks go through that one function, so
   * comparing them to each other would agree with itself while the filter was
   * broken. The row is the independent side of the comparison.
   *
   * The summary is asserted alongside the slug because the prose is the half a
   * slug cannot prove — an English row rendered at a Spanish address carries
   * the right slug and the wrong summary. When nothing is translated yet, both
   * sides are null, which is the assertion the first version of this made.
   */
  it("takes the Spanish home page's flagship from the Spanish Project rows, prose and all", async () => {
    const { flagship } = await homeLoader(
      routeArgs<ArgsOf<typeof homeLoader>>(platform, get("/es")),
    );

    const { results } = await platform.env.POSCHULER_BD.prepare(
      `select slug, summary
        from project
        where lang = 'es' and tier = 'flagship'
        order by sort_order asc, slug asc`,
    ).all<{ slug: string; summary: string }>();

    const spanish = results[0] ?? null;

    expect(flagship?.slug ?? null).toBe(spanish?.slug ?? null);
    expect(flagship?.summary ?? null).toBe(spanish?.summary ?? null);
  });

  /** The other block on the same page, held to the same rule. */
  it("shows only Spanish Posts in the Spanish home page's recent block", async () => {
    const { recentPosts } = await homeLoader(
      routeArgs<ArgsOf<typeof homeLoader>>(platform, get("/es")),
    );

    const documents = await spanishKeys(SPANISH.documents);

    for (const post of recentPosts) {
      expect(documents).toContain(post.slug);
    }
  });
});
