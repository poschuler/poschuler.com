import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loader as blogLoader } from "~/routes/blog/_blog";
import { loader as blogSlugLoader } from "~/routes/blog-slug/_$blog-slug";
import { loader as projectNoteLoader } from "~/routes/project-note/_$project-note";
import { loader as projectLandingLoader } from "~/routes/project-slug/_$project-slug";

import { findLoosePosts } from "~/models/content.server";
import { findProjectNotes, findProjectsWithNotes } from "~/models/project.server";

import { kvKeyFor } from "../../seed/kv/kv-keys";
import { openTestPlatform, routeArgs, type TestPlatform } from "../setup/platform";

/**
 * No Field Note is published in the fixtures — the first one, Chekalo's
 * product matching, enters as a Draft (`evolution-plan/14-phase-1b-field-notes.md`
 * Part 13), so `seed/d1/seed.sql` seeds none. The tests below insert Content
 * Item rows and their `blog:` payloads directly, the way `content.test.ts`
 * already inserts rows to exercise a constraint, and remove them again in
 * `afterAll` — the test state directory is shared for the whole run, and a
 * leftover row would move the counts `content.test.ts` and `series.test.ts`
 * assert.
 *
 * Two notes, not one: the landing's index and a note's sibling list both need
 * a manifest with more than one entry to prove they order it rather than just
 * showing whatever they are handed.
 */

const NOTE_SLUG = "test-field-note";
const NOTE_SLUG_2 = "test-field-note-two";
const PROJECT_SLUG = "chekalo";

let platform: TestPlatform;

type ArgsOf<Loader> = Loader extends (args: infer A) => unknown ? A : never;

const get = (path: string) => new Request(`https://poschuler.com${path}`);

async function insertNote(
  slug: string,
  {
    title,
    summary,
    order,
    projectSlug = PROJECT_SLUG,
  }: { title: string; summary: string; order: number; projectSlug?: string },
) {
  await platform.env.POSCHULER_BD.prepare(
    `insert into content
      (slug, lang, type, title, description, published_at, project_slug, container_order)
      values (?, 'en', 'post', ?, ?, ?, ?, ?)`,
  )
    .bind(slug, title, summary, `2026-08-0${order + 1}`, projectSlug, order)
    .run();

  const key = kvKeyFor(`blog/${slug}.en.json`);

  if (!key) {
    throw new Error(`could not derive a KV key for ${slug}`);
  }

  await platform.env.BLOG_KV.put(
    key,
    JSON.stringify({
      attributes: {
        title,
        description: summary,
        publishedAt: `2026-08-0${order + 1}`,
        tags: ["nodejs"],
      },
      html: "<p>Body.</p>",
    }),
  );
}

async function deleteNote(slug: string) {
  await platform.env.POSCHULER_BD.prepare("delete from content where slug = ? and lang = 'en'")
    .bind(slug)
    .run();

  const key = kvKeyFor(`blog/${slug}.en.json`);

  if (key) {
    await platform.env.BLOG_KV.delete(key);
  }
}

beforeAll(async () => {
  platform = await openTestPlatform();

  await insertNote(NOTE_SLUG, { title: "A Field Note for testing", summary: "About something.", order: 0 });
  await insertNote(NOTE_SLUG_2, {
    title: "A second Field Note for testing",
    summary: "About something else.",
    order: 1,
  });
});

afterAll(async () => {
  await deleteNote(NOTE_SLUG);
  await deleteNote(NOTE_SLUG_2);

  await platform?.dispose();
});

describe("findLoosePosts — excludes a Field Note", () => {
  it("excludes a Post whose Container is a Project, the same as one whose Container is a Series", async () => {
    const loose = await findLoosePosts(platform.env.POSCHULER_BD, "en");

    expect(loose.some((post) => post.slug === NOTE_SLUG)).toBe(false);
  });
});

/**
 * The read the landing's index and a note's sibling list share (Part 11 of
 * `evolution-plan/14-phase-1b-field-notes.md`).
 */
describe("findProjectNotes", () => {
  it("returns a Project's published notes in manifest order, each with its summary", async () => {
    const notes = await findProjectNotes(platform.env.POSCHULER_BD, PROJECT_SLUG, "en");
    const slugs = notes.map((note) => note.slug);

    expect(slugs.indexOf(NOTE_SLUG)).toBeGreaterThanOrEqual(0);
    expect(slugs.indexOf(NOTE_SLUG)).toBeLessThan(slugs.indexOf(NOTE_SLUG_2));
    expect(notes.find((note) => note.slug === NOTE_SLUG)?.summary).toBe("About something.");
  });

  it("returns nothing for a Project with no published notes", async () => {
    expect(await findProjectNotes(platform.env.POSCHULER_BD, "poschuler-com", "en")).toEqual([]);
  });
});

/**
 * The read `/blog` needs to list a Project with Field Notes as a single entry
 * (Part 10 of `evolution-plan/14-phase-1b-field-notes.md`).
 */
describe("findProjectsWithNotes", () => {
  it("returns a Project with at least one published note, dated by the most recent", async () => {
    const projects = await findProjectsWithNotes(platform.env.POSCHULER_BD, "en");
    const chekalo = projects.find((project) => project.slug === PROJECT_SLUG);

    expect(chekalo?.publishedStringDate).toBe("2026-08-02");
  });

  it("omits a Project with no published notes", async () => {
    const projects = await findProjectsWithNotes(platform.env.POSCHULER_BD, "en");

    expect(projects.some((project) => project.slug === "poschuler-com")).toBe(false);
  });
});

/**
 * `/blog` changes unit: a Project with Field Notes appears as one entry, not
 * one per note (1b/6, Part 10).
 */
describe("/blog — a Project with Field Notes is one entry", () => {
  const load = () => blogLoader(routeArgs<ArgsOf<typeof blogLoader>>(platform, get("/blog")));

  it("appears exactly once, dated by its most recent note", async () => {
    const { entries } = await load();
    const projectEntries = entries.filter(
      (entry) => entry.kind === "project" && entry.project.slug === PROJECT_SLUG,
    );

    expect(projectEntries).toHaveLength(1);
    expect(
      projectEntries[0]!.kind === "project" && projectEntries[0]!.project.publishedStringDate,
    ).toBe("2026-08-02");
  });

  it("does not list either of its notes individually", async () => {
    const { entries } = await load();
    const postSlugs = entries
      .filter((entry) => entry.kind === "post")
      .map((entry) => entry.kind === "post" && entry.post.slug);

    expect(postSlugs).not.toContain(NOTE_SLUG);
    expect(postSlugs).not.toContain(NOTE_SLUG_2);
  });

  it("links to the Project landing", async () => {
    const { entries } = await load();
    const projectEntry = entries.find(
      (entry) => entry.kind === "project" && entry.project.slug === PROJECT_SLUG,
    );

    expect(projectEntry?.kind === "project" && projectEntry.project.slug).toBe(PROJECT_SLUG);
  });

  it("leaves out a Project with no published notes", async () => {
    const { entries } = await load();

    expect(
      entries.some((entry) => entry.kind === "project" && entry.project.slug === "poschuler-com"),
    ).toBe(false);
  });
});

describe("/projects/:project — the notes index", () => {
  const args = (project: string) =>
    routeArgs<ArgsOf<typeof projectLandingLoader>>(platform, get(`/projects/${project}`), {
      projectSlug: project,
    });

  it("lists its published notes in manifest order, each with its summary", async () => {
    const payload = await projectLandingLoader(args(PROJECT_SLUG));
    const slugs = payload.notes.map((note) => note.slug);

    expect(slugs).toContain(NOTE_SLUG);
    expect(slugs).toContain(NOTE_SLUG_2);
    expect(slugs.indexOf(NOTE_SLUG)).toBeLessThan(slugs.indexOf(NOTE_SLUG_2));
    expect(payload.notes.find((note) => note.slug === NOTE_SLUG)?.summary).toBe(
      "About something.",
    );
  });

  /** The index has nothing to render — the block is absent, not empty. */
  it("holds no notes for a Project that has published none", async () => {
    const payload = await projectLandingLoader(args("poschuler-com"));

    expect(payload.notes).toEqual([]);
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

  /**
   * The sibling list at the foot: the Project's other published notes, this
   * one's own Slug still in the set the loader hands the route — `NoteSiblings`
   * is what filters it out, so this is what it filters (Part 11).
   */
  it("hands the route every published note of the Project, siblings included", async () => {
    const payload = await projectNoteLoader(args(PROJECT_SLUG, NOTE_SLUG));
    const slugs = payload.notes.map((note) => note.slug);

    expect(slugs).toContain(NOTE_SLUG);
    expect(slugs).toContain(NOTE_SLUG_2);
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
 * The Project this note belongs to holds no other published note, so
 * `NoteSiblings` (`project-note/orientation.tsx`) has nothing to list — its
 * own manifest of one. A separate Project and note, isolated with its own
 * setup and teardown, because `PROJECT_SLUG` above deliberately carries two.
 */
describe("/projects/:project/:note — a lone published note", () => {
  const LONE_PROJECT_SLUG = "pragmatic-nodejs-api";
  const LONE_NOTE_SLUG = "test-lone-field-note";

  beforeAll(() =>
    insertNote(LONE_NOTE_SLUG, {
      title: "The only Field Note here",
      summary: "About the only thing.",
      order: 0,
      projectSlug: LONE_PROJECT_SLUG,
    }),
  );

  afterAll(() => deleteNote(LONE_NOTE_SLUG));

  it("hands the route exactly one note — itself, with no sibling", async () => {
    const payload = await projectNoteLoader(
      routeArgs<ArgsOf<typeof projectNoteLoader>>(
        platform,
        get(`/projects/${LONE_PROJECT_SLUG}/${LONE_NOTE_SLUG}`),
        { projectSlug: LONE_PROJECT_SLUG, noteSlug: LONE_NOTE_SLUG },
      ),
    );

    expect(payload.notes.map((note) => note.slug)).toEqual([LONE_NOTE_SLUG]);
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
