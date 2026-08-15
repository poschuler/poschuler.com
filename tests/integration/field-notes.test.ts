import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loader as blogSlugLoader } from "~/routes/blog-slug/_$blog-slug";
import { loader as projectNoteLoader } from "~/routes/project-note/_$project-note";

import { findLoosePosts } from "~/models/content.server";

import { kvKeyFor } from "../../seed/kv/kv-keys";
import { openTestPlatform, routeArgs, type TestPlatform } from "../setup/platform";

/**
 * No Field Note is published in the fixtures — the first one, Chekalo's
 * product matching, enters as a Draft (`evolution-plan/14-phase-1b-field-notes.md`
 * Part 13), so `seed/d1/seed.sql` seeds none. The tests below insert a
 * Content Item row and its `blog:` payload directly, the way `content.test.ts`
 * already inserts rows to exercise a constraint, and remove them again in
 * `afterAll` — the test state directory is shared for the whole run, and a
 * leftover row would move the counts `content.test.ts` and `series.test.ts`
 * assert.
 */

const NOTE_SLUG = "test-field-note";
const PROJECT_SLUG = "chekalo";

let platform: TestPlatform;

type ArgsOf<Loader> = Loader extends (args: infer A) => unknown ? A : never;

const get = (path: string) => new Request(`https://poschuler.com${path}`);

beforeAll(async () => {
  platform = await openTestPlatform();

  await platform.env.POSCHULER_BD.prepare(
    `insert into content
      (slug, lang, type, title, description, published_at, project_slug, section_order, container_order)
      values (?, 'en', 'post', 'A Field Note for testing', 'About something.', '2026-08-01', ?, 0, 0)`,
  )
    .bind(NOTE_SLUG, PROJECT_SLUG)
    .run();

  const key = kvKeyFor(`blog/${NOTE_SLUG}.en.json`);

  if (!key) {
    throw new Error(`could not derive a KV key for ${NOTE_SLUG}`);
  }

  await platform.env.BLOG_KV.put(
    key,
    JSON.stringify({
      attributes: {
        title: "A Field Note for testing",
        description: "About something.",
        publishedAt: "2026-08-01",
        tags: ["nodejs"],
      },
      html: "<p>Body.</p>",
    }),
  );
});

afterAll(async () => {
  await platform.env.POSCHULER_BD.prepare("delete from content where slug = ? and lang = 'en'")
    .bind(NOTE_SLUG)
    .run();

  const key = kvKeyFor(`blog/${NOTE_SLUG}.en.json`);

  if (key) {
    await platform.env.BLOG_KV.delete(key);
  }

  await platform?.dispose();
});

describe("findLoosePosts — excludes a Field Note", () => {
  it("excludes a Post whose Container is a Project, the same as one whose Container is a Series", async () => {
    const loose = await findLoosePosts(platform.env.POSCHULER_BD);

    expect(loose.some((post) => post.slug === NOTE_SLUG)).toBe(false);
  });
});

describe("/projects/:projectSlug/:noteSlug — a Field Note", () => {
  const args = (project: string, note: string) =>
    routeArgs<ArgsOf<typeof projectNoteLoader>>(platform, get(`/projects/${project}/${note}`), {
      projectSlug: project,
      noteSlug: note,
    });

  it("resolves a published note, with the Project named above its title", async () => {
    const payload = await projectNoteLoader(args(PROJECT_SLUG, NOTE_SLUG));

    expect(payload.title).toBe("A Field Note for testing");
    expect(payload.projectSlug).toBe(PROJECT_SLUG);
    expect(payload.projectTitle).toBeTruthy();
    expect(payload.html).toContain("<");
  });

  it("404s on a Slug with nothing behind it", async () => {
    await expect(projectNoteLoader(args(PROJECT_SLUG, "no-such-note"))).rejects.toMatchObject({
      status: 404,
    });
  });

  /**
   * A Draft produces no row at all (Part 3 of the field notes), so it reads
   * exactly like an unknown Slug from this route's point of view — there is
   * nothing in D1 to distinguish "never written" from "written, not yet
   * published".
   */
  it("404s on a note that is a Draft, the same way it 404s on an unknown one", async () => {
    await expect(
      projectNoteLoader(args(PROJECT_SLUG, "an-unpublished-draft")),
    ).rejects.toMatchObject({ status: 404 });
  });

  /**
   * The Project decides. A Slug some other Project's manifest lists is a 404
   * rather than an article inside somebody else's frame — the same rule
   * `/series/:seriesSlug/:partSlug` already applies to a Part.
   */
  it("404s on a note that belongs to a different Project", async () => {
    await expect(
      projectNoteLoader(args("poschuler-com", NOTE_SLUG)),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("404s on a Project that does not exist", async () => {
    await expect(
      projectNoteLoader(args("no-such-project", NOTE_SLUG)),
    ).rejects.toMatchObject({ status: 404 });
  });
});

/**
 * A Field Note's payload sits under the same `blog:` key as any other Post —
 * the prefix says what kind of payload it is, not which URL serves it — so KV
 * alone would answer `/blog/:slug` with a page that also exists under
 * `/projects/…`. One article at two addresses is a canonical nobody declared.
 */
describe("/blog/:blogSlug — sends a Field Note to its Project", () => {
  it("redirects rather than serving it a second time", async () => {
    const args = routeArgs<ArgsOf<typeof blogSlugLoader>>(platform, get(`/blog/${NOTE_SLUG}`), {
      blogSlug: NOTE_SLUG,
    });

    const response: Response = await blogSlugLoader(args).then(
      () => {
        throw new Error(`/blog/${NOTE_SLUG} served a Field Note instead of redirecting`);
      },
      (thrown) => thrown,
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(`/projects/${PROJECT_SLUG}/${NOTE_SLUG}`);
  });
});
