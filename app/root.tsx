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
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from "remix-themes";
import { getThemeResolver } from "./sessions/theme-session.server";
import { getToast } from "remix-toast";
import { useToast } from "./components/ui/use-toast";
import { useServerLayoutEffect } from "./utils/use-server-layout-effect";
import clsx from "clsx";
//import favicon16 from "~/favicon/favicon-16x16.png";
//import favicon32 from "~/favicon/favicon-32x32.png";
import { Toaster } from "./components/ui/toaster";

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


export async function loader({ request, context }: Route.LoaderArgs) {
  const themeSessionResolver = getThemeResolver(context.cloudflare.env);
  const { getTheme } = await themeSessionResolver(request);
  const { toast, headers } = await getToast(request);

  return data(
    {
      theme: getTheme(),
      toast,
    },
    {
      headers: {
        "Set-Cookie": [headers.get("Set-Cookie")].filter(Boolean).join(","),
      },
    }
  );
}

export default function AppWithProviders({ loaderData }: Route.ComponentProps) {
  const { theme: loaderTheme } = loaderData;

  return (
    <ThemeProvider
      specifiedTheme={loaderTheme}
      themeAction="/action/set-theme"
      disableTransitionOnThemeChange={true}
    >
      <App />
    </ThemeProvider>
  );
}

function App() {
  const { theme: loaderTheme, toast: loaderToast } =
    useLoaderData<typeof loader>();

  const [theme] = useTheme();
  const { toast } = useToast();

  useServerLayoutEffect(() => {
    if (loaderToast) {
      let title = "";
      switch (loaderToast.type) {
        case "info":
          title = "Info.";
          break;
        case "success":
          title = "Mensaje";
          break;
        case "error":
          title = "Error";
          break;
        case "warning":
          title = "Alerta";
          break;
      }

      toast({
        variant: loaderToast.type === "error" ? "destructive" : "default",
        title: title,
        description: loaderToast.message,
      });
    }
  }, [loaderToast]);

  return (
    <html lang="en" className={clsx(theme)}>
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
        <PreventFlashOnWrongTheme ssrTheme={Boolean(loaderTheme)} />
        <Links />
      </head>
      <body>
        <Outlet />
        <Toaster />
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
