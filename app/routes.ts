import { type RouteConfig, layout, route } from "@react-router/dev/routes";

export default [
    route("/set-theme", "routes/set-theme.ts"),
    route("/resume.pdf", "routes/resume-pdf/_resume-pdf.tsx"),
    route("/robots.txt", "routes/robots.ts"),
    route("/sitemap.xml", "routes/sitemap.ts"),

    layout("routes/layouts/_layout.tsx", [
        route("/", "routes/home/_home.tsx"),
        route("/bookmarks", "routes/bookmarks/_bookmarks.tsx"),
        route("/timeline", "routes/timeline/_timeline.tsx"),
        route("/blog", "routes/blog/_blog.tsx"),
        route("/resume", "routes/resume/_resume.tsx"),
        route("/blog/:blogSlug", "routes/blog-slug/_$blog-slug.tsx"),
        route("/projects", "routes/projects/_projects.tsx"),
        route("/projects/:project", "routes/projects/_$project.tsx"),

        // Inside the layout on purpose: a visitor who lands here still gets the
        // header, and a way out.
        route("*", "routes/$.tsx"),
    ]),
] satisfies RouteConfig;
