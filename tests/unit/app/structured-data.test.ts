import { describe, expect, it } from "vitest";

import { PERSON_CORE, PERSON_ID } from "~/lib/seo/person";
import {
  blogPosting,
  breadcrumbList,
  creativeWorkSeries,
  HOME_CRUMB,
  seriesId,
} from "~/lib/seo/structured-data";

/**
 * What a crawler is told, which nothing on the rendered page reveals.
 *
 * These objects are the one part of the site no reader will ever catch being
 * wrong. A date that disagrees with the article, or four Persons where there is
 * one, is invisible until it has been indexed that way for months.
 */

const PART = {
  path: "/series/pragmatic-nodejs-api/project-setup",
  title: "Project setup",
  description: "Where a Node.js project's structure comes from.",
  datePublished: "2025-12-25",
  seriesSlug: "pragmatic-nodejs-api",
};

describe("blogPosting", () => {
  it("dates an unrevised article by its publication rather than leaving it open", () => {
    const article = blogPosting({ ...PART, seriesSlug: null });

    expect(article.datePublished).toBe("2025-12-25");
    expect(article.dateModified).toBe("2025-12-25");
  });

  it("dates a revised article by its most recent Revision", () => {
    const article = blogPosting({ ...PART, dateRevised: "2026-06-01" });

    expect(article.datePublished).toBe("2025-12-25");
    expect(article.dateModified).toBe("2026-06-01");
  });

  /**
   * Named *and* identified. The `@id` merges this with the full `Person` on the
   * home page and the Resume; the name is there because Google's Article
   * requirements ask for `author.name` on the page and do not follow an `@id`
   * into another document — an article carrying the identifier alone is an
   * article with an anonymous author as far as a rich result is concerned.
   */
  it("credits a named author that is the same entity as the Person", () => {
    const article = blogPosting(PART) as {
      author: { "@id": string; name: string };
      publisher: { "@id": string; name: string };
    };

    expect(article.author["@id"]).toBe(PERSON_ID);
    expect(article.author.name).toBe(PERSON_CORE.name);
    expect(article.publisher["@id"]).toBe(PERSON_ID);
    expect(article.publisher.name).toBe(PERSON_CORE.name);
  });

  /** Named, not described again: the credentials stay where they live. */
  it("does not restate the rest of him on every article", () => {
    expect(JSON.stringify(blogPosting(PART))).not.toContain("PostalAddress");
    expect(JSON.stringify(blogPosting(PART))).not.toContain("hasCredential");
  });

  it("attaches a Part to its Series by the identifier the landing declares", () => {
    const article = blogPosting(PART);

    expect(article.isPartOf).toEqual({ "@id": seriesId("pragmatic-nodejs-api") });
  });

  /**
   * A chronological relationship between unrelated Posts is invented
   * navigation, and `isPartOf` pointing nowhere would be the same claim in
   * a machine-readable form.
   */
  it("says nothing about containment for a Post that has no Container", () => {
    expect(blogPosting({ ...PART, seriesSlug: null })).not.toHaveProperty("isPartOf");
    expect(blogPosting({ ...PART, seriesSlug: undefined })).not.toHaveProperty("isPartOf");
  });
});

describe("breadcrumbList", () => {
  it("numbers the trail from one, in the order given", () => {
    const list = breadcrumbList([
      HOME_CRUMB,
      { name: "Series", path: "/series" },
      { name: "Pragmatic Node.js API", path: "/series/pragmatic-nodejs-api" },
    ]) as { itemListElement: Array<{ position: number; name: string; item: string }> };

    expect(list.itemListElement.map((entry) => entry.position)).toEqual([1, 2, 3]);
    expect(list.itemListElement[0].item).toBe("https://poschuler.com/");
    expect(list.itemListElement[2].name).toBe("Pragmatic Node.js API");
  });

  it("gives every step an absolute URL, because a step is a page", () => {
    const list = breadcrumbList([HOME_CRUMB, { name: "Series", path: "/series" }]) as {
      itemListElement: Array<{ item: string }>;
    };

    for (const entry of list.itemListElement) {
      expect(entry.item.startsWith("https://poschuler.com/")).toBe(true);
    }
  });
});

describe("creativeWorkSeries", () => {
  const SERIES = {
    slug: "pragmatic-nodejs-api",
    title: "Pragmatic Node.js API",
    description: "A monolithic API you can defend.",
    parts: [
      { slug: "project-setup", title: "Project setup" },
      { slug: "schema-validation", title: "Schema validation" },
    ],
  };

  it("declares the identifier its Parts point back at", () => {
    expect(creativeWorkSeries(SERIES)["@id"]).toBe(seriesId("pragmatic-nodejs-api"));
  });

  it("lists its Parts in reading order", () => {
    const series = creativeWorkSeries(SERIES) as {
      hasPart: Array<{ position: number; url: string }>;
    };

    expect(series.hasPart.map((part) => part.position)).toEqual([1, 2]);
    expect(series.hasPart[0].url).toBe(
      "https://poschuler.com/series/pragmatic-nodejs-api/project-setup",
    );
  });

  /**
   * The published Parts and nothing else. A planned Section has no URL and no
   * title, and announcing one here would be the claim about the future the
   * pages themselves refuse to make.
   */
  it("announces nothing when a Series has published nothing yet", () => {
    const series = creativeWorkSeries({ ...SERIES, parts: [] }) as { hasPart: unknown[] };

    expect(series.hasPart).toEqual([]);
  });

  it("matches the identifier a Part uses for its Container", () => {
    const series = creativeWorkSeries(SERIES);
    const part = blogPosting(PART);

    expect(part.isPartOf).toEqual({ "@id": series["@id"] });
  });
});

describe("the Person every page shares", () => {
  it("is one entity, addressed by a fragment on the origin", () => {
    expect(PERSON_CORE["@id"]).toBe(PERSON_ID);
    expect(PERSON_ID).toBe("https://poschuler.com/#paul");
  });

  /** A mailto: is a way to reach him, not a profile that identifies him. */
  it("lists only profiles in sameAs", () => {
    expect(PERSON_CORE.sameAs.length).toBeGreaterThan(0);
    expect(PERSON_CORE.sameAs.some((href) => href.startsWith("mailto:"))).toBe(false);
  });
});
