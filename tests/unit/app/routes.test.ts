import { describe, expect, it } from "vitest";
import type { RouteConfigEntry } from "@react-router/dev/routes";

import routes from "~/routes";
import { ES_PREFIX } from "~/context";

/**
 * Two branches over one route list (ADR 0010, `evolution-plan/15-phase-3-spanish.md`
 * Part 2 and Part 4). This is the test both promise: a page added to one call
 * of `contentRoutes()` and forgotten in the other is a failing assertion here,
 * rather than a page silently published in one Locale only.
 *
 * `path` is compared by segment rather than by string. `prefix()` joins the
 * home route's `/` onto `es` as the literal string `"es/"` — a trailing slash
 * that the generated route registry itself normalises away (confirmed by
 * running `react-router typegen` against this file) — so a string-equality
 * assertion would be pinning an implementation detail of `prefix()` rather
 * than the address a reader actually sees.
 */

function flatten(list: RouteConfigEntry[]): RouteConfigEntry[] {
  return list.flatMap((entry) => [entry, ...(entry.children ? flatten(entry.children) : [])]);
}

function segmentsOf(path: string | undefined): string[] {
  return (path ?? "").split("/").filter(Boolean);
}

const all = flatten(routes as RouteConfigEntry[]);

function byId(id: string): RouteConfigEntry {
  const found = all.find((entry) => entry.id === id);

  if (!found) {
    throw new Error(`No route in app/routes.ts carries the id "${id}"`);
  }

  return found;
}

const english = byId("layout");
const spanish = byId("layout-es");

describe("the two route branches", () => {
  it("mount the same modules, in the same order", () => {
    expect(spanish.children?.map((route) => route.file)).toEqual(
      english.children?.map((route) => route.file),
    );
  });

  it("give every Spanish route the English one's id with -es appended", () => {
    const englishIds = english.children?.map((route) => route.id) ?? [];
    const spanishIds = spanish.children?.map((route) => route.id) ?? [];

    expect(spanishIds).toEqual(englishIds.map((id) => `${id}-es`));
  });

  it("mount every Spanish path at the English one's segment, under /es", () => {
    english.children?.forEach((route, i) => {
      const counterpart = spanish.children?.[i];

      expect(segmentsOf(counterpart?.path)).toEqual([
        ES_PREFIX.slice(1),
        ...segmentsOf(route.path),
      ]);
    });
  });

  /**
   * The one segment ADR 0010 renames: `resume` is the third person singular of
   * *resumir*, so `/es/resume` would read as a conjugated verb rather than as
   * a CV. Every other segment is the same string in both branches — the
   * assertion above already covers that; this pins the one exception.
   */
  it("renames only the Resume's segment, to cv, in both branches", () => {
    const resume = english.children?.find((route) => route.id === "resume");
    const resumeEs = spanish.children?.find((route) => route.id === "resume-es");

    expect(resume?.path).toBe("/cv");
    expect(segmentsOf(resumeEs?.path)).toEqual(["es", "cv"]);
  });

  it("carry the catch-all in both branches, so a lost visitor stays in their own", () => {
    expect(english.children?.at(-1)?.file).toBe("routes/$.tsx");
    expect(english.children?.at(-1)?.id).toBe("catchall");
    expect(spanish.children?.at(-1)?.file).toBe("routes/$.tsx");
    expect(spanish.children?.at(-1)?.id).toBe("catchall-es");
  });
});

describe("the routes with no Spanish form", () => {
  const nonPageFiles = ["routes/set-theme.ts", "routes/robots.ts", "routes/sitemap.ts"];

  it("mount the theme endpoint, robots.txt and sitemap.xml exactly once each", () => {
    for (const file of nonPageFiles) {
      expect(all.filter((route) => route.file === file)).toHaveLength(1);
    }
  });

  it("give none of them a path under /es", () => {
    for (const file of nonPageFiles) {
      const entry = all.find((route) => route.file === file);

      expect(segmentsOf(entry?.path)[0]).not.toBe("es");
    }
  });
});

/**
 * `app/lib/redirects.ts` covers the *response* to `/en/…` (`resolveRedirect`
 * returns `null` for it, so the router is what answers). This covers the
 * other half: there is no route anywhere that would let it answer with
 * anything but the English catch-all.
 */
describe("the unpublished /en namespace", () => {
  it("is not a path segment any route declares", () => {
    for (const route of all) {
      expect(segmentsOf(route.path)[0]).not.toBe("en");
    }
  });
});
