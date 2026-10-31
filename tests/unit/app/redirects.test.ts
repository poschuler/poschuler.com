import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PERMANENT_REDIRECTS, resolveRedirect } from "~/lib/redirects";

/**
 * The map of URLs that no longer exist.
 *
 * Two kinds of assertion live here and they are not the same thing. The first
 * is that each entry resolves — table stakes. The second is the set of
 * properties the map has to keep as it grows: no chains, absolute
 * destinations, the query string carried through. Those are what break silently
 * when someone adds the fourth entry in a year, and none of them is visible by
 * reading one row.
 */

const at = (path: string) => resolveRedirect(new URL(`https://poschuler.com${path}`));

describe("resolveRedirect", () => {
  it("leaves a URL that still exists alone", () => {
    expect(at("/blog/implementing-value-objects-in-nodejs")).toBeNull();
    expect(at("/")).toBeNull();
  });

  /**
   * An address that was retired is not an address that moved: a redirect to a
   * retired destination is worse than none (see `redirects.ts`), so the three
   * original Part addresses fall through to the router's 404.
   */
  it("leaves a retired address alone", () => {
    expect(at("/blog/pragmatic-nodejs-api-setup-nodejs-express-typescript-project")).toBeNull();
    expect(at("/blog/pragmatic-nodejs-api-schema-validation-and-global-error-handling")).toBeNull();
    expect(at("/blog/pragmatic-nodejs-api-vertical-slices-and-domain-logic")).toBeNull();
  });

  /**
   * `/en/…` is not a namespace this site claims (ADR 0010): nothing was ever
   * published there, so there is no link to protect and no entry to invent —
   * it falls straight through to the router's own 404.
   */
  it("does not redirect an unpublished Locale prefix", () => {
    expect(at("/en")).toBeNull();
    expect(at("/en/blog")).toBeNull();
    expect(at("/en/blog/implementing-value-objects-in-nodejs")).toBeNull();
  });

  it("sends every published address to its replacement", () => {
    for (const [from, to] of Object.entries(PERMANENT_REDIRECTS)) {
      expect(at(from)).toBe(to);
    }
  });

  /**
   * The rules below hold whatever the table holds, so they are asserted
   * against an entry this test adds and takes away again: the table itself is
   * empty, and a rule checked over zero entries is checked against nothing.
   */
  describe("with an entry in the table", () => {
    const FROM = "/blog/moved-post";
    const TO = "/blog/where-it-went";

    beforeEach(() => {
      PERMANENT_REDIRECTS[FROM] = TO;
    });

    afterEach(() => {
      delete PERMANENT_REDIRECTS[FROM];
    });

    it("moves the address to its destination", () => {
      expect(at(FROM)).toBe(TO);
    });

    /**
     * A campaign parameter is how the author finds out the redirect is carrying
     * traffic at all. Dropping it makes the move invisible in analytics.
     */
    it("carries the query string to the destination", () => {
      expect(at(`${FROM}?utm_source=linkedin`)).toBe(`${TO}?utm_source=linkedin`);
    });

    /**
     * A link written by hand, or one a mail client normalised. It is the same
     * document either way, and answering 404 to it would waste the redirect.
     */
    it("matches a path that arrived with a trailing slash", () => {
      expect(at(`${FROM}/`)).toBe(TO);
    });
  });
});

describe("the map itself", () => {
  it("never chains: no destination is also a source", () => {
    for (const to of Object.values(PERMANENT_REDIRECTS)) {
      expect(PERMANENT_REDIRECTS[to.split("?")[0]]).toBeUndefined();
    }
  });

  it("only holds absolute paths, on both sides", () => {
    for (const [from, to] of Object.entries(PERMANENT_REDIRECTS)) {
      expect(from.startsWith("/")).toBe(true);
      expect(to.startsWith("/")).toBe(true);
      expect(from.endsWith("/")).toBe(false);
    }
  });

  it("never sends a URL to itself", () => {
    for (const [from, to] of Object.entries(PERMANENT_REDIRECTS)) {
      expect(to).not.toBe(from);
    }
  });
});
