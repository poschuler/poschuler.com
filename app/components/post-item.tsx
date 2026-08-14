import { PenLine } from "lucide-react";
import { Link } from "react-router";
import type { PostRowType } from "~/models/content.server";

/**
 * One Post in a list: the date, the icon, the title, nothing else.
 *
 * Shared by `/blog` and the home page rather than copied, because the two
 * lists are the same list — the home page just shows fewer of them.
 */
export function PostItem({ post }: { post: PostRowType }) {
  return (
    <div className="my-4 py-4 px-4 border-default border-l-2">
      <small className="text-base font-medium leading-none">
        {post.publishedStringDate}
      </small>

      <div className="flex gap-2 mt-2 text-low">
        <PenLine className="h-6 w-6" />
        <Link className="text-low" to={`/blog/${post.slug}`}>
          {post.title}
        </Link>
      </div>
    </div>
  );
}
