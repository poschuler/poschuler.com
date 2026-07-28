import { describe, expect, it } from "vitest";

import { skipRevalidationOnThemeChange } from "~/lib/revalidation";

/**
 * Small, but it is what keeps a theme toggle from costing a D1 query or a KV
 * read on every click. The suppression has to stay narrow: widen it and a real
 * action stops refreshing the page it just changed.
 */

type Args = Parameters<typeof skipRevalidationOnThemeChange>[0];

const args = (overrides: Partial<Args>): Args =>
  ({ defaultShouldRevalidate: true, ...overrides } as Args);

describe("skipRevalidationOnThemeChange", () => {
  it("suppresses revalidation for the theme endpoint", () => {
    expect(skipRevalidationOnThemeChange(args({ formAction: "/set-theme" }))).toBe(false);
  });

  it("defers to the default for any other action", () => {
    expect(skipRevalidationOnThemeChange(args({ formAction: "/subscribe" }))).toBe(true);
    expect(
      skipRevalidationOnThemeChange(args({ formAction: "/subscribe", defaultShouldRevalidate: false })),
    ).toBe(false);
  });

  it("defers to the default for a plain navigation", () => {
    expect(skipRevalidationOnThemeChange(args({ formAction: undefined }))).toBe(true);
  });
});
