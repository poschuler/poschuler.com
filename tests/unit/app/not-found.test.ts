import { describe, expect, it } from "vitest";

import { loader as notFoundLoader, meta as notFoundMeta } from "~/routes/$";

/**
 * The catch-all. It sits inside the layout on purpose — a lost visitor keeps
 * the header and a way out — which means it renders like an ordinary page and
 * has to say 404 in the status rather than only in the markup.
 */

describe("the 404 route", () => {
  it("answers with a 404 status, not a 200 holding an error page", async () => {
    const result = await notFoundLoader();

    expect(result.init?.status).toBe(404);
  });

  it("asks not to be indexed", () => {
    const descriptors = notFoundMeta({} as never);

    expect(descriptors).toContainEqual({ name: "robots", content: "noindex" });
  });
});
