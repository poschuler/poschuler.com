import { generateRobotsTxt } from "~/lib/seo/robots";
import { type LoaderFunctionArgs } from "react-router";
import { cloudflareContext } from "~/context";

/**
 * The canonical origin, or the one this request arrived on.
 *
 * `PUBLIC_HOST` used to be required, and throwing when it was unset meant this
 * route answered 500 on every request — invisibly, because Cloudflare's managed
 * robots.txt filled the gap and looked like a working answer. A robots.txt can
 * always name its own origin, so there is no reason for it to have a failure
 * mode at all.
 */
function resolveOrigin(configured: string | undefined, requestUrl: string): string {
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // A value without a scheme — "poschuler.com" — is not a URL. Say so, and
      // carry on rather than taking the route down over it.
      console.error(`Ignoring malformed PUBLIC_HOST: ${configured}`);
    }
  }

  return new URL(requestUrl).origin;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.get(cloudflareContext);
  const origin = resolveOrigin(env.PUBLIC_HOST, request.url);

  // Every environment advertises itself as fully indexable. That is fine while
  // `workers_dev` is off and production is the only deployed origin; a preview
  // origin would need a `Disallow: /` branch on `DEPLOYMENT_ENV`.
  const robotsTxt = generateRobotsTxt([
    {
      userAgent: "*",
      allow: ["/"],
      disallow: [],
      sitemap: [`${origin}/sitemap.xml`],
    },
  ]);

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain",
      // Derived from one env var, identical for every visitor.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
