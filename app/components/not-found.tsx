import { Unplug } from "lucide-react";
import { Link } from "react-router";
import { useStrings } from "~/lib/catalog";

/**
 * The site's 404 page, as a component rather than only as a route.
 *
 * The catch-all route renders it for an address that matches nothing. A route
 * that matches and then finds nothing behind the address has to render it
 * itself, from its own `ErrorBoundary`: a `Response` thrown by a loader goes to
 * the nearest boundary above it, and the root's is outside the layout — so it
 * answers with a bare `404` on an otherwise empty document, no header and no way
 * out. Rendered from the route's own boundary it lands inside the layout's
 * `Outlet` instead, and the header, the footer and the link below all stay.
 */
export function NotFound() {
  const strings = useStrings();

  return (
    <main className="flex w-full flex-1 flex-col items-center justify-center gap-5 bg-ui p-4 font-mono">
      <Unplug className="size-14" aria-hidden />

      <h1 className="font-semibold text-3xl tracking-tight lg:text-4xl">
        {strings.notFound.title}
      </h1>

      {/* It read "Back to the timeline" until now, from when `/` *was* the
        * Timeline. It has been the landing page since Phase 0, and the Timeline
        * has had its own route ever since — one the header above this offers,
        * along with everywhere else worth going. */}
      <Link
        to="/"
        className="text-low transition-colors duration-200 hover:text-default"
      >
        {strings.notFound.backHome}
      </Link>
    </main>
  );
}
