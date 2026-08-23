import { describe, expect, it } from "vitest";

import { deriveLocale, parseLocaleSet } from "../../../app/context";

/**
 * The one function that reads a path to decide which language a request is in
 * (ADR 0010). Everything downstream — which rows a loader queries, which
 * catalogue the chrome renders from, what `<html lang>` says — follows from
 * its answer, so a path it reads wrongly is not a wrong label but a page
 * served in the wrong language.
 */
describe("deriveLocale", () => {
  const at = (pathname: string) => deriveLocale(new URL(`https://poschuler.com${pathname}`));

  it("reads the root and everything under it as English", () => {
    expect(at("/")).toBe("en");
    expect(at("/blog")).toBe("en");
    expect(at("/blog/implementing-value-objects")).toBe("en");
  });

  it("reads the Spanish branch and everything under it as Spanish", () => {
    expect(at("/es")).toBe("es");
    expect(at("/es/blog")).toBe("es");
    expect(at("/es/blog/implementing-value-objects")).toBe("es");
  });

  /**
   * The regression this file was written for. A client-side navigation asks
   * for `<path>.data`, never the document — so following the language switcher
   * to `/es` fetched `/es.data`, which is neither equal to `/es` nor prefixed
   * by `/es/`. The Spanish home matched its own route and ran under the
   * English Locale: the address changed and nothing else did, which reads as a
   * link that does not work.
   *
   * `/es/blog.data` always passed, which is why the defect reached only the
   * branch's own root — the address the switcher and the wordmark both point
   * at.
   */
  it("reads a data request the same as the document it stands for", () => {
    expect(at("/es.data")).toBe("es");
    expect(at("/es/blog.data")).toBe("es");
    expect(at("/blog.data")).toBe("en");
    expect(at("/_root.data")).toBe("en");
  });

  /**
   * `/espanol` starts with the same three characters and is not the Spanish
   * branch. The prefix is a path segment, not a string.
   */
  it("does not mistake a path that merely starts with the prefix", () => {
    expect(at("/espanol")).toBe("en");
    expect(at("/estimates/2026")).toBe("en");
    expect(at("/esoteric.data")).toBe("en");
  });
});

/**
 * The comma-separated column a correlated subquery hands back beside a row.
 * Filtered against the published Locales rather than trusted, so a stored
 * value cannot forge a Locale this site never published.
 */
describe("parseLocaleSet", () => {
  it("returns the declared Locales in publication order", () => {
    expect(parseLocaleSet("es,en")).toEqual(["en", "es"]);
    expect(parseLocaleSet("en")).toEqual(["en"]);
  });

  it("is empty for nothing stored", () => {
    expect(parseLocaleSet(null)).toEqual([]);
    expect(parseLocaleSet("")).toEqual([]);
  });

  it("drops a value no Locale declares", () => {
    expect(parseLocaleSet("en,fr")).toEqual(["en"]);
  });
});
