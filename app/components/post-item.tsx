import { PenLine } from "lucide-react";
import { Link } from "react-router";
import type { PostRowType } from "~/models/content.server";

/**
 * One Post in a list: the date, the icon, the title, nothing else.
 *
 * Shared by `/blog` and the home page rather than copied, because the two
 * lists are the same list — the home page just shows fewer of them.
 *
 * `headingLevel` exists because the same item sits at two depths: on `/blog`
 * the titles are the page's only second level, and on the home page they are
 * under a "Recent writing" heading that is already an `<h2>`. A list item
 * cannot know which, and rendering `<h2>` in both places would put a heading
 * beside its own parent.
 */
export function PostItem({
  post,
  headingLevel = "h2",
}: {
  post: PostRowType;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;

  return (
    <article className="my-4 border-default border-l-2 py-4 pl-4">
      {/* The title leads and the date follows it. They were the other way
        * round — the date at `text-base font-medium` in the default colour,
        * the title a size smaller in `text-low` — which put the loudest thing
        * in the list on the one word that tells a reader nothing. */}
      <Heading className="font-semibold text-lg">
        <Link
          to={`/blog/${post.slug}`}
          className="transition-colors duration-200 hover:text-low"
        >
          {post.title}
        </Link>
      </Heading>

      <p className="mt-2 flex items-center gap-2 text-low text-sm">
        <PenLine className="size-4 shrink-0" aria-hidden />
        <time dateTime={post.publishedStringDate}>
          {post.publishedStringDate}
        </time>
      </p>
    </article>
  );
}
