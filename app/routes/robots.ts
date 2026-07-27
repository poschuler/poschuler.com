import { generateRobotsTxt } from "@forge42/seo-tools/robots";
import { type LoaderFunctionArgs } from "react-router";
import { cloudflareContext } from "~/context";

export async function loader({ context }: LoaderFunctionArgs) {
  const { env } = context.get(cloudflareContext);
  const isProduction = env.DEPLOYMENT_ENV === "production";

  if (typeof env.PUBLIC_HOST !== "string") {
    throw new Error("Missing env: PUBLIC_HOST");
  }

  const baseUrl = new URL(env.PUBLIC_HOST);

  //console.log(baseUrl.origin);

  const robotsArr = isProduction
    ? [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [],
        sitemap: [`${baseUrl.origin}/sitemap.xml`],
      },
    ]
    : [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [],
        sitemap: [`${baseUrl.origin}/sitemap.xml`],
      },
    ];

  const robotsTxt = generateRobotsTxt(robotsArr);

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
