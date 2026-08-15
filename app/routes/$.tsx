import { Unplug } from "lucide-react";
import { data, Link, type MetaFunction } from "react-router";

export async function loader() {
  return data(null, { status: 404 });
}

export const meta: MetaFunction = () => [
  { title: "404 — Not Found | Paul Osorio Schuler" },
  { name: "robots", content: "noindex" },
];

export default function Component() {
  return (
    <main className="flex w-full flex-1 flex-col items-center justify-center gap-5 bg-ui p-4 font-mono">
      <Unplug className="size-14" aria-hidden />

      <h1 className="font-semibold text-3xl tracking-tight lg:text-4xl">
        404 — Not Found
      </h1>

      {/* It read "Back to the timeline" until now, from when `/` *was* the
        * Timeline. It has been the landing page since Phase 0, and the Timeline
        * has had its own route ever since — one the header above this offers,
        * along with everywhere else worth going. */}
      <Link
        to="/"
        className="text-low transition-colors duration-200 hover:text-default"
      >
        Back to the home page
      </Link>
    </main>
  );
}
