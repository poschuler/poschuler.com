import { Link } from "react-router";
import { RevisionHistory, RevisionLine } from "~/components/revisions";
import { GitHubIcon } from "~/components/ui/brand-icons";
import type { Revision } from "~/lib/revisions";

/**
 * A Post, rendered.
 *
 * The same article whether it is served from `/blog` or as a Part of a Series:
 * a Part is an ordinary Post that happens to have a Container, and nothing
 * about the writing changes because of it. What changes is what surrounds the
 * article, and that stays in the routes.
 *
 * `html` reaches here as text out of KV and goes straight into
 * `dangerouslySetInnerHTML`. It is sanitised once, at build time, by
 * `seed/kv/markdown.ts` — that module is the site's XSS boundary and nothing
 * here re-checks it.
 */
export function PostArticle({
  title,
  publishedAt,
  repository,
  revisions,
  html,
}: {
  title: string;
  publishedAt: string;
  repository?: string;
  revisions: Revision[];
  html: string;
}) {
  return (
    <article className="prose mx-auto py-8">
      <h1>{title}</h1>

      {repository && (
        <p className="flex items-center gap-2">
          <GitHubIcon className="size-6" />
          <Link
            to={repository}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-lg text-low no-underline transition-colors duration-200 hover:text-default"
          >
            View Github Repository
          </Link>
        </p>
      )}

      <div className="not-prose my-4">
        <RevisionLine publishedAt={publishedAt} revisions={revisions} />
      </div>

      <hr className="mt-7 mb-7" />
      <div dangerouslySetInnerHTML={{ __html: html }} />

      <div className="not-prose">
        <RevisionHistory revisions={revisions} />
      </div>
    </article>
  );
}
