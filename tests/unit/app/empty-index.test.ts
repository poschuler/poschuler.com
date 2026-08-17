import { describe, expect, it } from "vitest";

import { meta as blogMeta } from "~/routes/blog/_blog";
import { meta as projectsMeta } from "~/routes/projects/_projects";
import { meta as seriesMeta } from "~/routes/series/_series";
import { meta as tagsMeta } from "~/routes/tags/_tags";

/**
 * The robots directive an index's own `meta` adds when its list is empty
 * (Part 6 of `evolution-plan/15-phase-3-spanish.md`), pinned against synthetic
 * `loaderData` rather than a real query — `spanish-branch.test.ts` is where
 * this same rule is checked against D1 for real.
 *
 * Every index defaults to *indexable*: the directive is additive, only present
 * when the list is empty, so a query that starts returning rows again has to
 * stop adding it without anyone touching this file.
 */

const ROBOTS_NOINDEX_FOLLOW = { name: "robots", content: "noindex, follow" };

describe("an index's own meta, empty vs. not", () => {
  it("/blog adds noindex, follow only when entries is empty", () => {
    const empty = blogMeta({ loaderData: { entries: [], locale: "es" } } as never);
    const full = blogMeta({ loaderData: { entries: [{}], locale: "en" } } as never);

    expect(empty).toContainEqual(ROBOTS_NOINDEX_FOLLOW);
    expect(full).not.toContainEqual(expect.objectContaining({ name: "robots" }));
  });

  it("/projects adds noindex, follow only when projects is empty", () => {
    const empty = projectsMeta({ loaderData: { projects: [], locale: "es" } } as never);
    const full = projectsMeta({ loaderData: { projects: [{}], locale: "en" } } as never);

    expect(empty).toContainEqual(ROBOTS_NOINDEX_FOLLOW);
    expect(full).not.toContainEqual(expect.objectContaining({ name: "robots" }));
  });

  it("/series adds noindex, follow only when series is empty", () => {
    const empty = seriesMeta({ loaderData: { series: [], locale: "es" } } as never);
    const full = seriesMeta({ loaderData: { series: [{}], locale: "en" } } as never);

    expect(empty).toContainEqual(ROBOTS_NOINDEX_FOLLOW);
    expect(full).not.toContainEqual(expect.objectContaining({ name: "robots" }));
  });

  /**
   * `/tags` is the one index that otherwise carries **no** robots directive at
   * all when it has something to say (`tags.test.ts`) — this is the one case
   * where emptiness has to add a directive that is not there the rest of the
   * time, rather than swap one directive for another.
   */
  it("/tags adds noindex, follow only when tags is empty", () => {
    const empty = tagsMeta({ loaderData: { tags: [], locale: "es" } } as never);
    const full = tagsMeta({ loaderData: { tags: [{ tag: "nodejs", posts: 3 }], locale: "en" } } as never);

    expect(empty).toContainEqual(ROBOTS_NOINDEX_FOLLOW);
    expect(full).not.toContainEqual(expect.objectContaining({ name: "robots" }));
  });
});
