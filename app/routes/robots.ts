import { generateRobotsTxt } from "~/lib/seo/robots";
import { type LoaderFunctionArgs } from "react-router";
import { cloudflareContext } from "~/context";

export async function loader({ context }: LoaderFunctionArgs) {
  const { env } = context.get(cloudflareContext);

  if (typeof env.PUBLIC_HOST !== "string") {
    throw new Error("Missing env: PUBLIC_HOST");
  }

  const baseUrl = new URL(env.PUBLIC_HOST);

  // Every environment advertises itself as fully indexable. That is fine while
  // `workers_dev` is off and production is the only deployed origin; a preview
  // origin would need a `Disallow: /` branch on `DEPLOYMENT_ENV`.
  const robotsTxt = generateRobotsTxt([
    {
      userAgent: "*",
      allow: ["/"],
      disallow: [],
      sitemap: [`${baseUrl.origin}/sitemap.xml`],
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
