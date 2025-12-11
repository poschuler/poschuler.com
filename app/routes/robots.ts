import { generateRobotsTxt } from "@forge42/seo-tools/robots";
import { type LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const isProduction = process.env.DEPLOYMENT_ENV === "production";
  //const domain = new URL(request.url).origin;

  if (typeof process.env.PUBLIC_HOST !== "string") {
    throw new Error("Missing env: PUBLIC_HOST");
  }

  const stringUrl = process.env.PUBLIC_HOST;
  const baseUrl = new URL(stringUrl);

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
