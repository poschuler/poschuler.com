import { ArrowUpRight } from "lucide-react";

/**
 * A link to something that is actually running, shown as its bare host.
 *
 * The scheme is stripped because it is noise in a place where the point is the
 * name a reader could type — and because the three places this appears, the
 * projects index, a project page and the home page, had each stripped it with
 * their own copy of the same expression.
 */
export function LiveLink({ href, className = "" }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 transition-colors duration-200 hover:text-default ${className}`}
    >
      {href.replace(/^https?:\/\//, "")}
      <ArrowUpRight className="h-3 w-3" />
    </a>
  );
}
