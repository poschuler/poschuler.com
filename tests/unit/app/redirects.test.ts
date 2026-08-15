import { describe, expect, it } from "vitest";

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
    expect(at("/series/pragmatic-nodejs-api")).toBeNull();
    expect(at("/")).toBeNull();
  });

  it("sends every published address to its replacement", () => {
    for (const [from, to] of Object.entries(PERMANENT_REDIRECTS)) {
      expect(at(from)).toBe(to);
    }
  });

  it("moves the three Series Parts to their new home", () => {
    expect(at("/blog/pragmatic-nodejs-api-setup-nodejs-express-typescript-project")).toBe(
      "/series/pragmatic-nodejs-api/project-setup",
    );
  });

  /**
   * A campaign parameter is how the author finds out the redirect is carrying
   * traffic at all. Dropping it makes the move invisible in analytics.
   */
  it("carries the query string to the destination", () => {
    expect(
      at("/blog/pragmatic-nodejs-api-setup-nodejs-express-typescript-project?utm_source=linkedin"),
    ).toBe("/series/pragmatic-nodejs-api/project-setup?utm_source=linkedin");
  });

  /**
   * A link written by hand, or one a mail client normalised. It is the same
   * document either way, and answering 404 to it would waste the redirect.
   */
  it("matches a path that arrived with a trailing slash", () => {
    expect(at("/blog/pragmatic-nodejs-api-vertical-slices-and-domain-logic/")).toBe(
      "/series/pragmatic-nodejs-api/vertical-slices-and-domain-logic",
    );
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
