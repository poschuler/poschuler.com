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
    <main className="flex min-h-[calc(100vh_-_theme(spacing.16))] w-full flex-col items-center justify-center gap-5 bg-ui p-4 font-mono text-xl font-medium leading-none">
      <Unplug className="h-14 w-14" />
      <h1>404 - Not Found</h1>
      <Link
        to="/"
        className="text-base text-low underline-offset-4 hover:underline"
      >
        Back to the timeline
      </Link>
    </main>
  );
}
