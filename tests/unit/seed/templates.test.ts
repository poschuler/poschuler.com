import { readFileSync } from "node:fs";
import path from "node:path";

import fm from "front-matter";
import { describe, expect, it } from "vitest";

import {
  contentRowFor,
  isInvalid,
  isSkipped,
  type FrontMatterAttributes,
} from "../../../seed/d1/seed-sql";
import {
  isInvalidProject,
  projectRowFor,
  type ProjectFrontMatter,
} from "../../../seed/d1/project-sql";
import {
  seriesRowsFor,
  type SeriesFrontMatter,
  type SeriesPartFile,
} from "../../../seed/d1/series-sql";
import { tagVocabularyFrom, type TagVocabulary } from "../../../seed/d1/tag-vocabulary";

/**
 * `docs/templates/` is a second description of the front matter every kind of
 * document carries, and a second description drifts — silently, because nothing
 * reads those files. A template that has stopped being valid does not fail
 * anything; it produces a document that fails, in the hands of whoever copied
 * it, at a moment when they are writing rather than debugging.
 *
 * So each one is run through the same functions the generator calls for a real
 * file, under the path `docs/authoring.md` tells the reader to copy it to. The
 * bar is the one a published document meets: a row, not an error and not a skip.
 *
 * The Tag vocabulary comes off the disk rather than being stubbed here — unlike
 * every other suite in this directory, where what a Tag is measured against is
 * `tag-vocabulary.test.ts`'s business. The point of this file is that a
 * template a reader copies today produces a document that seeds today, and a
 * Tag dropped from `app/content/tags.json` breaks exactly that.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

function templateAt(filename: string): { attributes: unknown; body: string } {
  const source = readFileSync(path.join(REPO_ROOT, "docs/templates", filename), "utf8");
  const parsed = fm(source);

  return { attributes: parsed.attributes, body: parsed.body };
}

const VOCABULARY: TagVocabulary = (() => {
  const declared = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "app/content/tags.json"), "utf8"),
  );
  const result = tagVocabularyFrom(declared);

  if ("error" in result) {
    throw new Error(result.error);
  }

  return result.vocabulary;
})();

describe("docs/templates/post.en.md", () => {
  it("seeds a Post when copied to blog/<slug>/<slug>.en.md", () => {
    const { attributes } = templateAt("post.en.md");

    const result = contentRowFor(
      "blog/a-new-post/a-new-post.en.md",
      attributes as FrontMatterAttributes,
      VOCABULARY,
    );

    expect(isInvalid(result) ? result.error : null).toBeNull();
    expect(isSkipped(result)).toBe(false);
  });
});

describe("docs/templates/field-note.en.md", () => {
  /**
   * Both, from one template, because that is what the template claims: a Part
   * and a Field Note carry the same front matter and differ only in which
   * manifest lists them. If that ever stops being true, one of these two goes
   * red and the template needs splitting.
   */
  it("seeds a Field Note when copied under a Project", () => {
    const { attributes } = templateAt("field-note.en.md");

    const result = contentRowFor(
      "projects/a-project/a-note/a-note.en.md",
      attributes as FrontMatterAttributes,
      VOCABULARY,
      { projectSlug: "a-project", order: 0 },
    );

    expect(isInvalid(result) ? result.error : null).toBeNull();
    expect(isSkipped(result)).toBe(false);
  });

  it("seeds a Part when copied under a Series", () => {
    const { attributes } = templateAt("field-note.en.md");

    const result = contentRowFor(
      "series/a-series/a-part/a-part.en.md",
      attributes as FrontMatterAttributes,
      VOCABULARY,
      { seriesSlug: "a-series", section: "a-section", order: 0 },
    );

    expect(isInvalid(result) ? result.error : null).toBeNull();
    expect(isSkipped(result)).toBe(false);
  });
});

describe("docs/templates/bookmark.md", () => {
  it("seeds a Bookmark when copied to bookmarks/<slug>.md", () => {
    const { attributes } = templateAt("bookmark.md");

    const result = contentRowFor(
      "bookmarks/a-bookmark.md",
      attributes as FrontMatterAttributes,
      VOCABULARY,
    );

    expect(isInvalid(result) ? result.error : null).toBeNull();
    expect(isSkipped(result)).toBe(false);
  });

  it("carries no Locale suffix in the filename it is copied to", () => {
    /**
     * The template is named `bookmark.md`, not `bookmark.en.md`, and that is
     * the rule rather than a naming preference: a Bookmark has no Locale, and
     * one copied to `.en.md` fails the build. Asserting it here is what keeps
     * a well-meaning rename from breaking the tree.
     */
    const { attributes } = templateAt("bookmark.md");

    const result = contentRowFor(
      "bookmarks/a-bookmark.en.md",
      attributes as FrontMatterAttributes,
      VOCABULARY,
    );

    expect(isInvalid(result) && result.error).toContain("has no Locale to translate");
  });
});

describe("docs/templates/project.en.md", () => {
  it("seeds a Project when copied to projects/<slug>/<slug>.en.md", () => {
    const { attributes } = templateAt("project.en.md");

    const result = projectRowFor(
      "projects/a-project/a-project.en.md",
      attributes as ProjectFrontMatter,
      [],
    );

    expect(isInvalidProject(result) ? result.error : null).toBeNull();
  });
});

describe("docs/templates/series.en.md", () => {
  it("seeds a Series when copied to series/<slug>/<slug>.en.md", () => {
    const { attributes, body } = templateAt("series.en.md");
    const manifest = attributes as SeriesFrontMatter;

    /**
     * The Part files are derived from the manifest's own lists rather than
     * hardcoded, so this stays true if the template's example slugs change.
     * What is under test here is that the manifest is internally valid — the
     * contract fields, the section rules, the body — not the reconciliation
     * between a manifest and a directory, which `series-sql.test.ts` owns.
     */
    const partFiles: SeriesPartFile[] = (
      manifest.sections as { parts?: string[] }[]
    ).flatMap((section) =>
      (section.parts ?? []).map((slug) => ({
        slug,
        lang: "en",
        folder: slug,
        relativePath: `series/a-series/${slug}/${slug}.en.md`,
        draft: false,
      })),
    );

    const result = seriesRowsFor(
      "series/a-series/a-series.en.md",
      manifest,
      body,
      partFiles,
    );

    expect("error" in result ? result.error : null).toBeNull();
  });
});
