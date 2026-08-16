import { type RouteConfig, layout, prefix, route } from "@react-router/dev/routes";
import { ES_PREFIX } from "./context";

/**
 * The site's pages, called once per Locale (ADR 0010, `evolution-plan/15-phase-3-spanish.md`
 * Part 2 and Part 4). English is mounted at the root with no prefix; Spanish is
 * the same function mounted under `/es`. The path segment after the prefix is
 * the same string in both branches, with one exception: `resume` is the third
 * person singular of *resumir*, so `/es/resume` would read as a conjugated verb
 * rather than as a CV — it is `cv` in both Locales, and the visible navigation
 * label stays *resume* in English, because the label and the path are
 * independent.
 *
 * `suffix` gives every route an explicit id, because the default id is the
 * file path and a module cannot be mounted twice without one. The apparent
 * duplication is not one: this is one function, called twice below — what
 * would be real is a page added to one call and forgotten in the other, which
 * is why the two branches are asserted to have the same shape in
 * `tests/unit/app/routes.test.ts`.
 */
const contentRoutes = (suffix: string) => [
  layout("routes/layouts/_layout.tsx", { id: `layout${suffix}` }, [
    route("/", "routes/home/_home.tsx", { id: `home${suffix}` }),
    route("/bookmarks", "routes/bookmarks/_bookmarks.tsx", { id: `bookmarks${suffix}` }),
    route("/timeline", "routes/timeline/_timeline.tsx", { id: `timeline${suffix}` }),
    route("/blog", "routes/blog/_blog.tsx", { id: `blog${suffix}` }),
    route("/cv", "routes/resume/_resume.tsx", { id: `resume${suffix}` }),
    route("/blog/:blogSlug", "routes/blog-slug/_$blog-slug.tsx", { id: `blog-slug${suffix}` }),
    route("/projects", "routes/projects/_projects.tsx", { id: `projects${suffix}` }),
    route("/projects/:projectSlug", "routes/project-slug/_$project-slug.tsx", {
      id: `project-slug${suffix}`,
    }),
    route("/projects/:projectSlug/:noteSlug", "routes/project-note/_$project-note.tsx", {
      id: `project-note${suffix}`,
    }),

    // The whole `/series` namespace at once. An index of one entry earns
    // its place by closing the namespace: the alternative was a temporary
    // redirect with an expiry date nobody would remember.
    route("/series", "routes/series/_series.tsx", { id: `series${suffix}` }),
    route("/series/:seriesSlug", "routes/series-slug/_$series-slug.tsx", {
      id: `series-slug${suffix}`,
    }),
    route("/series/:seriesSlug/:partSlug", "routes/series-part/_$series-part.tsx", {
      id: `series-part${suffix}`,
    }),

    // The whole `/tags` namespace, closed the way `/series` is: the index
    // lists every Tag some Post carries, and a Tag no Post carries is a 404
    // one level down rather than an entry here that leads to one.
    route("/tags", "routes/tags/_tags.tsx", { id: `tags${suffix}` }),
    route("/tags/:tag", "routes/tag/_$tag.tsx", { id: `tag${suffix}` }),

    // Inside the layout on purpose: a visitor who lands here still gets the
    // header, and a way out. Present in both branches, so a lost visitor in
    // the Spanish branch stays there rather than surrendering in English.
    route("*", "routes/$.tsx", { id: `catchall${suffix}` }),
  ]),
];

export default [
  // Not pages, so each exists once: a theme cookie, a crawler's rulebook and
  // the sitemap it points at are facts about the whole site, not about a
  // Locale (ADR 0010).
  route("/set-theme", "routes/set-theme.ts"),
  route("/cv.pdf", "routes/resume-pdf/_resume-pdf.tsx"),
  route("/robots.txt", "routes/robots.ts"),
  route("/sitemap.xml", "routes/sitemap.ts"),

  ...contentRoutes(""),
  // `ES_PREFIX` carries the leading slash `deriveLocale` and `withLocale` need
  // to read a pathname; `prefix()` wants the bare segment, so it is stripped
  // here rather than declared a second time. There is no `/en/` branch — the
  // absence of this prefix is what English means, so `/en/…` answers 404 with
  // no redirect (ADR 0010).
  ...prefix(ES_PREFIX.slice(1), contentRoutes("-es")),
] satisfies RouteConfig;
