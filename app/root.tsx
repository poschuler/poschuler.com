import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { getColorScheme } from "./color-scheme-cookie";
import { cloudflareContext } from "./context";

// Imported for their hashed build URLs. The `@font-face` rules live in
// `app/styles/fonts.css`; these two are the latin faces every page needs — the
// interface is `font-sans` and every content page is `font-mono` — and without
// a preload the browser cannot discover either until the stylesheet has parsed.
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import monoLatin from "@fontsource-variable/intel-one-mono/files/intel-one-mono-latin-wght-normal.woff2?url";

const preloadFont = (href: string) => ({
  rel: "preload",
  as: "font",
  type: "font/woff2",
  crossOrigin: "anonymous" as const,
  href,
});

export const links: Route.LinksFunction = () => [
  preloadFont(interLatin),
  preloadFont(monoLatin),
];

// No `meta` here on purpose: a route that forgets its own `meta` should render
// with none at all, rather than silently inheriting the home page's title.

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);

  return { colorScheme: await getColorScheme(request, env) };
}

/**
 * The document shell. React Router renders `ErrorBoundary` in place of the
 * route tree but *inside* this component, so a failing loader still yields a
 * complete page — head, stylesheet and all. Anything moved out of here and into
 * `App` would vanish exactly when it is most needed.
 *
 * The theme is read with `useRouteLoaderData` rather than `useLoaderData`
 * because the root loader is what may have failed.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  const rootData = useRouteLoaderData<typeof loader>("root");
  const colorScheme = rootData?.colorScheme ?? "system";

  return (
    <html lang="en" className={colorScheme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        {/* <!-- Cloudflare Web Analytics -->
            Manual, not automatic: this Worker generates the response itself, with
            no origin fetch for Cloudflare's edge to rewrite, so the dashboard's
            automatic-injection option is a no-op here — verified against
            production, where nothing appeared until this went back in. */}
        <script
          type="module"
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "502dbbed6f8448b4ac3841afa524b219"}'
        />
        {/* <!-- End Cloudflare Web Analytics --> */}
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
