import { Link } from "react-router";
import { chip } from "~/components/chip";
import { RevisionHistory, RevisionLine } from "~/components/revisions";
import { GitHubIcon } from "~/components/ui/brand-icons";
import type { Locale } from "~/context";
import { tagHref } from "~/lib/hrefs";
import type { Revision } from "~/lib/revisions";
import { cn } from "~/lib/utils";

/**
 * What a link rendered in the low tone does under the cursor.
 *
 * Both links in this article are one — the repository link and each Tag chip —
 * and the listing rows make the same one-step move from where they start. A
 * chip is inert everywhere else on the site and is a link here, so it says so
 * in the site's own interaction language rather than in a new one.
 */
const lowToneLink = "transition-colors duration-200 hover:text-default";

/** The Post's Tags, each a link to its page. */
function TagChips({ tags, locale }: { tags: string[]; locale: Locale }) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag}>
          <Link to={tagHref(tag, locale)} className={cn(chip, lowToneLink)}>
            {tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}

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
  tags,
  locale,
  repository,
  revisions,
  html,
}: {
  title: string;
  publishedAt: string;
  /**
   * The subjects this Post covers, from the front matter that travels in KV.
   * Both Post routes have that payload in hand already — the Series Part route
   * never fetches the content row at all, so reading them from D1 there would
   * mean a new query for something the reader has already been sent.
   */
  tags: string[];
  /** This Post's own Locale, for the Tag chips below — a link built at any other would 404. */
  locale: Locale;
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
            className={cn("flex items-center gap-2 text-lg text-low no-underline", lowToneLink)}
          >
            View Github Repository
          </Link>
        </p>
      )}

      {/* Above the rule, beside the date, and inside the block that already
        * opts out of the prose styles — a Tag is metadata of subject the way the
        * date is metadata of time, so they read as one line of metadata rather
        * than as two things stacked.
        *
        * Not below the body, where the general argument would put them: three of
        * the site's four Posts are Parts of a Series, and below a Part sit its
        * revision history and the link to the next Part. Losing a reader to a
        * Tag before they have read anything is the risk; competing with the arc
        * on the majority of the site's pages is the larger one.
        *
        * Aligned on the baseline rather than centred, because *beside the date*
        * has to keep meaning that. The revision line is one line only while no
        * Post carries an `updates:` block; the first one that does makes it two
        * or three, and centring would drift the chips down the middle of it. */}
      <div className="not-prose my-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <RevisionLine publishedAt={publishedAt} revisions={revisions} />
        <TagChips tags={tags} locale={locale} />
      </div>

      <hr className="mt-7 mb-7" />
      <div dangerouslySetInnerHTML={{ __html: html }} />

      <div className="not-prose">
        <RevisionHistory revisions={revisions} />
      </div>
    </article>
  );
}
