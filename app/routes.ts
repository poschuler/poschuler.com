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
        route("/projects/:projectSlug", "routes/project-slug/_$project-slug.tsx"),

        // The whole `/series` namespace at once. An index of one entry earns
        // its place by closing the namespace: the alternative was a temporary
        // redirect with an expiry date nobody would remember.
        route("/series", "routes/series/_series.tsx"),
        route("/series/:seriesSlug", "routes/series-slug/_$series-slug.tsx"),
        route("/series/:seriesSlug/:partSlug", "routes/series-part/_$series-part.tsx"),

        // The whole `/tags` namespace, closed the way `/series` is: the index
        // lists every Tag some Post carries, and a Tag no Post carries is a 404
        // one level down rather than an entry here that leads to one.
        route("/tags", "routes/tags/_tags.tsx"),
        route("/tags/:tag", "routes/tag/_$tag.tsx"),

        // Inside the layout on purpose: a visitor who lands here still gets the
        // header, and a way out.
        route("*", "routes/$.tsx"),
    ]),
] satisfies RouteConfig;
