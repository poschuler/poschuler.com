import { describe, expect, it } from "vitest";

import { meta as resumeMeta } from "~/routes/resume/_resume";

/**
 * `/cv` has no loader (`_resume.tsx`'s own note explains why), so `meta()` is
 * the one piece of request-time behaviour this route has — reading the
 * Locale off `root`'s loader data through `matches` rather than a loader of
 * its own (Part 8 of `evolution-plan/15-phase-3-spanish.md`, #48). What
 * matters here is exactly what broke before this ticket: the canonical, the
 * `og:url` and the structured data's `mainEntityOfPage` all have to follow
 * the Locale the page was actually served under, rather than always reading
 * English.
 */

const metaArgs = (rootLoaderData: unknown) =>
  ({ matches: [{ id: "root", loaderData: rootLoaderData }] }) as never;

describe("the Resume's meta", () => {
  it("canonicalises at the bare path in English", () => {
    expect(resumeMeta(metaArgs({ locale: "en" }))).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://poschuler.com/cv",
    });
  });

  it("canonicalises at /es/cv in Spanish — each Locale to itself", () => {
    expect(resumeMeta(metaArgs({ locale: "es" }))).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://poschuler.com/es/cv",
    });
  });

  it("defaults to English when the root match carries no Locale yet", () => {
    expect(resumeMeta(metaArgs(undefined))).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://poschuler.com/cv",
    });
  });

  it("gives og:url the same address as the canonical", () => {
    const tags = resumeMeta(metaArgs({ locale: "es" }));

    expect(tags).toContainEqual({ property: "og:url", content: "https://poschuler.com/es/cv" });
  });

  /**
   * `mainEntityOfPage` used to be a module-level constant fixed at `/cv` —
   * exactly the bug this ticket closes: the Person the JSON-LD describes has
   * to say which page describes them, and a Spanish page claiming the
   * English URL is the site contradicting its own canonical.
   */
  it("points the structured data's mainEntityOfPage at this Locale's own address", () => {
    const tags = resumeMeta(metaArgs({ locale: "es" })) ?? [];
    const [jsonLd] = tags
      .filter((tag): tag is { "script:ld+json": Record<string, unknown> } => "script:ld+json" in tag)
      .map((tag) => tag["script:ld+json"]);

    expect(jsonLd?.mainEntityOfPage).toBe("https://poschuler.com/es/cv");
  });
});
