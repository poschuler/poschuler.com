import { describe, expect, it } from "vitest";

import {
  isMalformedVocabulary,
  tagError,
  tagVocabularyFrom,
  type TagVocabulary,
  TAG_VOCABULARY_FILE,
} from "../../../seed/d1/tag-vocabulary";

/**
 * The vocabulary is what stops one subject acquiring a second word. A rule about
 * shape cannot do it — `architecture` and `software-architecture` are both
 * well-formed slugs — so the set itself is declared, and everything below is the
 * build refusing what the declaration does not hold.
 */

const vocabularyOf = (entries: string[]): TagVocabulary => {
  const result = tagVocabularyFrom(entries);

  if (isMalformedVocabulary(result)) {
    throw new Error(result.error);
  }

  return result.vocabulary;
};

describe("tagVocabularyFrom", () => {
  it("reads a well-formed declaration into the set the checks are made against", () => {
    const result = tagVocabularyFrom(["backend", "error-handling", "nodejs"]);

    expect(isMalformedVocabulary(result)).toBe(false);
    expect([...(result as { vocabulary: TagVocabulary }).vocabulary]).toEqual([
      "backend",
      "error-handling",
      "nodejs",
    ]);
  });

  it("fails a declaration that is not a list at all", () => {
    const result = tagVocabularyFrom({ nodejs: true });

    expect(isMalformedVocabulary(result)).toBe(true);
    expect((result as { error: string }).error).toContain(TAG_VOCABULARY_FILE);
  });

  /**
   * The declaration is held to the rule it exists to enforce. A `Nodejs` in
   * there would declare the mistake rather than catch it.
   */
  it.each(["Nodejs", "error handling", "-leading", "trailing-", "double--hyphen", ""])(
    "fails a declaration holding '%s', which is not a slug",
    (entry) => {
      const result = tagVocabularyFrom(["backend", entry]);

      expect(isMalformedVocabulary(result)).toBe(true);
      expect((result as { error: string }).error).toMatch(/is not a slug/);
    },
  );

  it("fails a declaration that is not a list of strings", () => {
    const result = tagVocabularyFrom(["backend", 7]);

    expect(isMalformedVocabulary(result)).toBe(true);
  });

  /**
   * A duplicate is harmless to the Set and dishonest to the reader: the file is
   * how the author decides what may be written, and one holding a Tag twice has
   * already stopped being a decision.
   */
  it("fails a declaration holding the same Tag twice", () => {
    const result = tagVocabularyFrom(["backend", "nodejs", "backend"]);

    expect(isMalformedVocabulary(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/twice/);
  });
});

describe("tagError", () => {
  const vocabulary = vocabularyOf(["backend", "nodejs", "software-architecture"]);

  it("passes a file whose Tags are all declared", () => {
    expect(tagError("blog/a/a.en.md", ["nodejs", "backend"], vocabulary)).toBeNull();
  });

  it("passes a file carrying no Tags at all", () => {
    expect(tagError("blog/a/a.en.md", undefined, vocabulary)).toBeNull();
  });

  it("names the file, the Tag and where to declare it", () => {
    const error = tagError("blog/a/a.en.md", ["nodejs", "architecture"], vocabulary);

    expect(error).toContain("blog/a/a.en.md");
    expect(error).toContain("architecture");
    expect(error).toContain(TAG_VOCABULARY_FILE);
  });

  /**
   * The two mistakes are different, and so are the messages: one is fixed by
   * rewriting the Tag, the other by deciding this site writes about a new
   * subject. Telling them apart is the whole reason there are two checks.
   */
  it("reports a Tag that is not a slug differently from one that is merely undeclared", () => {
    const notASlug = tagError("blog/a/a.en.md", ["Software Architecture"], vocabulary);
    const undeclared = tagError("blog/a/a.en.md", ["architecture"], vocabulary);

    expect(notASlug).toMatch(/is not a slug/);
    expect(undeclared).toMatch(/does not declare/);
    expect(notASlug).not.toBe(undeclared);
  });

  /** Subsumed by the vocabulary check, and reported first so the message fits the mistake. */
  it("reports the shape before the vocabulary, so 'Nodejs' is not called undeclared", () => {
    expect(tagError("blog/a/a.en.md", ["Nodejs"], vocabulary)).toMatch(/is not a slug/);
  });

  it("fails Tags written as anything but a list", () => {
    expect(tagError("blog/a/a.en.md", "nodejs", vocabulary)).toMatch(/a list of Tags/);
  });
});
