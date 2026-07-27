import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { getColorScheme } from "./color-scheme-cookie";
import { getToast, type ToastMessage } from "remix-toast";
import { Toast } from "@base-ui/react/toast";
import { useServerLayoutEffect } from "./utils/use-server-layout-effect";
import { Toaster } from "./components/ui/toaster";
import { ToastProvider } from "./components/ui/toast";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

// export const meta: MetaFunction = () => {
//   return [
//     { title: "Paul Osorio Schuler | Software Engineer (Node.js, Azure) & MBA" },
//     { name: "description", content: "Software Engineer specializing in highly-scalable backend systems. Expertise in Node.js, TypeScript, Azure, and Domain-Driven Design (DDD). View my full CV, blog and bookmarks." },
//     { tagName: "link", rel: "canonical", href: "https://poschuler.com" },
//     { name: "og:title", content: "Paul Osorio Schuler | Software Engineer (Node.js, Azure) & MBA" },
//     { name: "og:description", content: "Software Engineer specializing in highly-scalable backend systems. Expertise in Node.js, TypeScript, Azure, and Domain-Driven Design (DDD)." },
//     { name: "og:image", content: "https://avatars.githubusercontent.com/u/1238212?v=4" },
//     { name: "og:type", content: "website" },
//     { name: "og:url", content: "https://poschuler.com" },
//   ];
// };


export async function loader({ request }: Route.LoaderArgs) {
  const [colorScheme, { toast, headers }] = await Promise.all([
    getColorScheme(request),
    getToast(request),
  ]);

  return data(
    {
      colorScheme,
      toast,
    },
    {
      headers: {
        "Set-Cookie": [headers.get("Set-Cookie")].filter(Boolean).join(","),
      },
    }
  );
}

export default function AppWithProviders() {
  return <App />;
}

const toastTitles = {
  info: "Info.",
  success: "Mensaje",
  error: "Error",
  warning: "Alerta",
} as const;

/**
 * Replays a toast handed over by the loader. Lives below `ToastProvider`
 * because `useToastManager` reads that context.
 */
function ServerToast({
  toast: loaderToast,
}: {
  toast: ToastMessage | undefined;
}) {
  const { add } = Toast.useToastManager();

  useServerLayoutEffect(() => {
    if (!loaderToast) {
      return;
    }

    add({
      type: loaderToast.type === "error" ? "destructive" : "default",
      title: toastTitles[loaderToast.type],
      description: loaderToast.message,
    });
  }, [loaderToast]);

  return null;
}

function App() {
  const { colorScheme, toast: loaderToast } = useLoaderData<typeof loader>();

  return (
    <html lang="en" className={colorScheme}>
      <head>
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
        <ToastProvider limit={1}>
          <Outlet />
          <ServerToast toast={loaderToast} />
          <Toaster />
        </ToastProvider>
        <ScrollRestoration />
        <Scripts />
        {/* <!-- Cloudflare Web Analytics --> */}
        <script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "502dbbed6f8448b4ac3841afa524b219"}'></script>
        {/* <!-- End Cloudflare Web Analytics --> */}
      </body>
    </html>
  );
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
