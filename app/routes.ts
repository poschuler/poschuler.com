import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

// export default [index("routes/home.tsx")] satisfies RouteConfig;

export default [
    route("/action/set-theme", "routes/action.set-theme.ts"),
    route("/cv.pdf", "routes/cv-pdf/_cv-pdf.tsx"),
    route("/robots.txt", "routes/robots.ts"),
    route("/sitemap.xml", "routes/sitemap.ts"),

    layout("routes/layouts/_layout.tsx", [
        route("/", "routes/home/_home.tsx"),
        route("/bookmarks", "routes/bookmarks/_bookmarks.tsx"),
        route("/blog", "routes/blog/_blog.tsx"),
        route("/cv", "routes/cv/_cv.tsx"),
        route("/blog/:blogSlug", "routes/blog-slug/_$blog-slug.tsx"),
    ]),

    route("*", "routes/$.tsx"),
] satisfies RouteConfig;
