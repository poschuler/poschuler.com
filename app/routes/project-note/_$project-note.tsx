import { useLoaderData } from "react-router";
import { PostArticle } from "~/components/post-article";
import { cloudflareContext } from "~/context";
import { skipRevalidationOnThemeChange } from "~/lib/revalidation";
import { validateRevisions } from "~/lib/revisions";
import { findPostBySlug } from "~/models/content.server";
import { findProjectBySlug } from "~/models/project.server";
import type { Route } from "./+types/_$project-note";
import { ProjectBreadcrumb } from "./orientation";

const SITE = "https://poschuler.com";

interface NoteAttributes {
  title: string;
  description: string;
  publishedAt: string;
  /** The subjects, as written. A Field Note's Tags are its own, not the Project's. */
  tags?: string[];
  repository?: string;
  /** Front matter as written; `validateRevisions` is what turns it into a list. */
  updates?: unknown;
}

interface NotePayload {
  attributes: NoteAttributes;
  html: string;
}

/**
 * A Field Note: a Post whose Container is a Project (Part 2 of
 * `evolution-plan/14-phase-1b-field-notes.md`).
 *
 * The body comes from the **`blog:` key space**, the same as any other Post —
 * the prefix says what kind of payload it is, not which URL serves it. What
 * this route adds is the frame: the note is only reachable through the
 * Project the manifest says it belongs to, so a Slug this Project does not
 * hold is a 404 rather than an article inside somebody else's frame — the
 * same rule `/series/:seriesSlug/:partSlug` already applies to a Part. A
 * Draft produces no row at all, so it 404s the same way.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const project = await findProjectBySlug(env.POSCHULER_BD, params.projectSlug);

  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }

  const post = await findPostBySlug(env.POSCHULER_BD, params.noteSlug, project.lang);

  if (!post || post.projectSlug !== project.slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const payload = await env.BLOG_KV.get<NotePayload>(
    `blog:${params.noteSlug}:${project.lang}`,
    {
      type: "json",
      // A Post body only changes when the seed pipeline runs, so let the colo
      // answer from its own cache instead of reaching KV's central store.
      cacheTtl: 3600,
    },
  );

  if (!payload) {
    throw new Response("Not Found", { status: 404 });
  }

  const { attributes, html } = payload;
  const revisions = validateRevisions(attributes.updates);

  return {
    slug: params.noteSlug,
    projectSlug: project.slug,
    projectTitle: project.title,
    title: attributes.title,
    description: attributes.description,
    tags: attributes.tags ?? [],
    publishedAt: new Date(attributes.publishedAt).toLocaleDateString(),
    // The same date, unformatted. What a reader sees is written for their
    // locale; what a crawler is told has to stay `YYYY-MM-DD`.
    datePublished: attributes.publishedAt,
    repository: attributes.repository,
    html,
    // A malformed list is caught at build time; a page is better off without
    // its revision line than not rendering at all.
    revisions: "revisions" in revisions ? revisions.revisions : [],
  };
}

export const shouldRevalidate = skipRevalidationOnThemeChange;

export function meta({ loaderData }: Route.MetaArgs) {
  const { title, description, projectSlug, slug } = loaderData;
  const path = `/projects/${projectSlug}/${slug}`;
  const url = `${SITE}${path}`;

  return [
    { title: `${title} | Paul Osorio Schuler` },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: `${SITE}/og.png` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Paul Osorio Schuler — Senior Backend Engineer" },
    { property: "og:type", content: "article" },
    { property: "og:url", content: url },
  ];
}

export default function ProjectNote() {
  const {
    projectSlug,
    projectTitle,
    title,
    publishedAt,
    tags,
    repository,
    revisions,
    html,
  } = useLoaderData<typeof loader>();

  return (
    <main className="flex-1 gap-4 bg-ui p-4 font-mono md:gap-8 md:p-10">
      {/* Above the article, exactly as a Part names its Series above its own
        * title: the reader who arrived from a search engine has to learn what
        * this is about before reading it, not twenty minutes later. */}
      <div className="mx-auto w-full max-w-measure pt-8">
        <ProjectBreadcrumb projectSlug={projectSlug} projectTitle={projectTitle} />
      </div>

      <PostArticle
        title={title}
        publishedAt={publishedAt}
        tags={tags}
        repository={repository}
        revisions={revisions}
        html={html}
      />

      {/* No sibling notes and no link back to the Project here — that index
        * is 1b/5 (`evolution-plan/14-phase-1b-field-notes.md` Part 11). No
        * previous/next, ever: a Project promises no reading order. */}
    </main>
  );
}
