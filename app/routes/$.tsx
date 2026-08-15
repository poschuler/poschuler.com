import { data, type MetaFunction } from "react-router";
import { NotFound } from "~/components/not-found";

export async function loader() {
  return data(null, { status: 404 });
}

export const meta: MetaFunction = () => [
  { title: "404 — Not Found | Paul Osorio Schuler" },
  { name: "robots", content: "noindex" },
];

/**
 * The page itself lives in `~/components/not-found`, because a route that
 * matches and then finds nothing behind the address renders the same page from
 * its own `ErrorBoundary` rather than reaching this route at all.
 */
export default function Component() {
  return <NotFound />;
}
