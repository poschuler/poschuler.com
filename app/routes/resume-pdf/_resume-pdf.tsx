/**
 * **No `/es/cv.pdf` (Part 8 of `evolution-plan/15-phase-3-spanish.md`, #48's
 * open question, answered).** `/cv` renders from `resume.json` at request
 * time, so once that document carried Spanish text (#48) the Spanish page
 * followed with no extra work. This route does the opposite: it proxies one
 * hand-produced static file from a CDN — nothing here renders a PDF from
 * `resume.json` — so a Spanish download would be a second file, authored and
 * uploaded by hand, kept in step with the English one forever. That is the
 * same failure mode Part 8 rejected `resume.es.json` for, transposed to a
 * binary this codebase cannot generate. `/cv`'s own download button
 * (`routes/resume/hero.tsx`) therefore still points at this one URL from
 * both Locales, and `app/routes.ts` mounts it once, outside `contentRoutes`.
 */
const PDF_URL = "https://cdn.poschuler.dev/Paul_Osorio_Schuler_Resume.pdf";
const FILENAME = "Paul_Osorio_Schuler_Resume.pdf";

export async function loader() {
  const upstream = await fetch(PDF_URL, {
    // Cache the origin fetch at the colo too, so a hot Worker is not re-fetching
    // an unchanged PDF from the CDN on every download.
    cf: { cacheTtl: 86400, cacheEverything: true },
  });

  // Without this an upstream 404 was served as a 200 `application/pdf` holding
  // an error page — a download that opens as a corrupt file.
  if (!upstream.ok) {
    throw new Response("Not Found", { status: 404 });
  }

  // Stream the body straight through rather than buffering the whole PDF into
  // the Worker's memory before the first byte reaches the client.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${FILENAME}`,
      "Cache-Control": "public, max-age=86400",
      // The download serves a visitor who is already on `/cv`. Indexed, it
      // would compete with that page for the same queries and win nothing —
      // a PDF is a worse landing than the page that links to it.
      //
      // A `Disallow` in `robots.txt` would not do this: the crawler would never
      // fetch the file, never see this header, and could list the URL anyway
      // with nothing behind it.
      "X-Robots-Tag": "noindex",
    },
  });
}
