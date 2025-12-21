import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

// export default [index("routes/home.tsx")] satisfies RouteConfig;

export default [
    route("/action/set-theme", "routes/action.set-theme.ts"),
    route("/resume.pdf", "routes/resume-pdf/_resume-pdf.tsx"),
    route("/robots.txt", "routes/robots.ts"),
    route("/sitemap.xml", "routes/sitemap.ts"),

    layout("routes/layouts/_layout.tsx", [
        route("/", "routes/home/_home.tsx"),
        route("/bookmarks", "routes/bookmarks/_bookmarks.tsx"),
        route("/blog", "routes/blog/_blog.tsx"),
        route("/resume", "routes/resume/_resume.tsx"),
        route("/blog/:blogSlug", "routes/blog-slug/_$blog-slug.tsx"),
    ]),

    route("*", "routes/$.tsx"),
] satisfies RouteConfig;
