import { describe, expect, it } from "vitest";

import { PERSON_CORE, PERSON_ID } from "~/lib/seo/person";
import {
  blogPosting,
  breadcrumbList,
  projectId,
} from "~/lib/seo/structured-data";
import { indexCrumb } from "~/lib/trail";

/**
 * What a crawler is told, which nothing on the rendered page reveals.
 *
 * These objects are the one part of the site no reader will ever catch being
 * wrong. A date that disagrees with the article, or four Persons where there is
 * one, is invisible until it has been indexed that way for months.
 */

const ARTICLE = {
  url: "https://poschuler.com/blog/implementing-value-objects",
  title: "Implementing value objects",
  description: "Where a value object's invariants live.",
  datePublished: "2025-12-25",
  locale: "en" as const,
};

const NOTE = {
  url: "https://poschuler.com/projects/chekalo/product-matching",
  title: "Matching products across retailers without a shared id",
  description: "The problem, and the shape of the solution.",
  datePublished: "2026-08-15",
  projectSlug: "chekalo",
  locale: "en" as const,
};

describe("blogPosting", () => {
  it("dates an unrevised article by its publication rather than leaving it open", () => {
    const article = blogPosting(ARTICLE);

    expect(article.datePublished).toBe("2025-12-25");
    expect(article.dateModified).toBe("2025-12-25");
  });

  it("dates a revised article by its most recent Revision", () => {
    const article = blogPosting({ ...ARTICLE, dateRevised: "2026-06-01" });

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
    const article = blogPosting(ARTICLE) as {
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
    expect(JSON.stringify(blogPosting(ARTICLE))).not.toContain("PostalAddress");
    expect(JSON.stringify(blogPosting(ARTICLE))).not.toContain("hasCredential");
  });

  /**
   * A chronological relationship between unrelated Posts is invented
   * navigation, and `isPartOf` pointing nowhere would be the same claim in
   * a machine-readable form.
   */
  it("says nothing about containment for a Post that has no Container", () => {
    expect(blogPosting(ARTICLE)).not.toHaveProperty("isPartOf");
  });

  it("attaches a Field Note to its Project by the identifier the landing declares", () => {
    const article = blogPosting(NOTE);

    expect(article.isPartOf).toEqual({ "@id": projectId("chekalo", "en") });
  });

  it("says nothing about containment for a Field Note with no projectSlug given", () => {
    expect(blogPosting({ ...NOTE, projectSlug: null })).not.toHaveProperty("isPartOf");
    expect(blogPosting({ ...NOTE, projectSlug: undefined })).not.toHaveProperty("isPartOf");
  });

  /** The claim follows the article, not the default. */
  it("states its own Locale rather than always English", () => {
    expect(blogPosting(ARTICLE).inLanguage).toBe("en");
    expect(blogPosting({ ...ARTICLE, locale: "es" }).inLanguage).toBe("es");
  });
});

describe("breadcrumbList", () => {
  it("numbers the trail from one, in the order given", () => {
    const list = breadcrumbList([
      indexCrumb("home", "en"),
      indexCrumb("projects", "en"),
      { name: "Chekalo", path: "/projects/chekalo" },
    ]) as { itemListElement: Array<{ position: number; name: string; item: string }> };

    expect(list.itemListElement.map((entry) => entry.position)).toEqual([1, 2, 3]);
    expect(list.itemListElement[0].item).toBe("https://poschuler.com");
    expect(list.itemListElement[2].name).toBe("Chekalo");
  });

  it("gives every step an absolute URL, because a step is a page", () => {
    const list = breadcrumbList([indexCrumb("home", "en"), indexCrumb("blog", "en")]) as {
      itemListElement: Array<{ item: string }>;
    };

    for (const entry of list.itemListElement) {
      expect(entry.item.startsWith("https://poschuler.com")).toBe(true);
    }
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
