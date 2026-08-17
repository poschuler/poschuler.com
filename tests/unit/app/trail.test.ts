import { describe, expect, it } from "vitest";

import { documentAddresses } from "~/lib/seo/alternates";
import { indexCrumb, indexHref } from "~/lib/trail";

describe("indexCrumb", () => {
  it("addresses the Locale's own branch, not the English one", () => {
    expect(indexCrumb("series", "en").path).toBe("/series");
    expect(indexCrumb("series", "es").path).toBe("/es/series");
    expect(indexCrumb("home", "es").path).toBe("/es");
  });

  /**
   * The defect this function replaced a constant to close: `/es/series` and
   * `/es/tags` emitted the English trail verbatim, so the page emitting the
   * `BreadcrumbList` was not among its own steps.
   */
  it("names a section the way that section titles itself, in that Locale", () => {
    expect(indexCrumb("tags", "en").name).toBe("Tags");
    expect(indexCrumb("tags", "es").name).toBe("Etiquetas");
    expect(indexCrumb("projects", "es").name).toBe("Proyectos");
    expect(indexCrumb("home", "en").name).toBe("Home");
    expect(indexCrumb("home", "es").name).toBe("Inicio");
  });

  /** The trail said "Blog" while the page it names has always been titled "Articles". */
  it("calls the blog what the blog calls itself", () => {
    expect(indexCrumb("blog", "en").name).toBe("Articles");
    expect(indexCrumb("blog", "es").name).toBe("Artículos");
  });

  /**
   * Character for character what `documentAddresses` returns for the home page,
   * so one document never carries two URLs for one page.
   */
  it("matches the home page's own canonical, trailing slash and all", () => {
    const { canonical } = documentAddresses({ kind: "index", path: "/" }, "en", ["en"]);

    expect(`https://poschuler.com${indexCrumb("home", "en").path}`).toBe(canonical);
  });
});

describe("indexHref", () => {
  it("addresses every Index in both Locales, the router-safe way", () => {
    expect(indexHref("home", "en")).toBe("/");
    expect(indexHref("home", "es")).toBe("/es");
    expect(indexHref("blog", "en")).toBe("/blog");
    expect(indexHref("blog", "es")).toBe("/es/blog");
    expect(indexHref("projects", "en")).toBe("/projects");
    expect(indexHref("projects", "es")).toBe("/es/projects");
    expect(indexHref("series", "en")).toBe("/series");
    expect(indexHref("series", "es")).toBe("/es/series");
    expect(indexHref("tags", "en")).toBe("/tags");
    expect(indexHref("tags", "es")).toBe("/es/tags");
  });

  /**
   * The one Index where the two outputs disagree, and the whole reason there
   * are two functions rather than one: `indexCrumb("home", "en").path` is the
   * empty string, which is exactly right for `${SITE}${path}` and exactly
   * wrong for `<Link to>`, where an empty relative path resolves to the
   * current location rather than the root.
   */
  it("differs from indexCrumb only for the English home page — why the two functions are not one", () => {
    expect(indexCrumb("home", "en").path).toBe("");
    expect(indexHref("home", "en")).toBe("/");
  });
});
