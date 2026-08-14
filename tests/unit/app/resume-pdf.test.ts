import { afterEach, describe, expect, it, vi } from "vitest";

import { loader as resumePdfLoader } from "~/routes/resume-pdf/_resume-pdf";

/**
 * The only route that proxies something. It has no loader arguments and reads
 * no binding — it calls `fetch` — so the upstream is stubbed rather than
 * reached: a test that downloads a real PDF from a CDN would fail on a plane
 * and pass for the wrong reason everywhere else.
 *
 * The response this returns is also what taught `workers/app.ts` to rebuild
 * headers instead of mutating them, a proxied response carrying immutable ones.
 */

const PDF_URL = "https://cdn.poschuler.dev/Paul_Osorio_Schuler_Resume.pdf";

function stubUpstream(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/resume.pdf", () => {
  it("serves the PDF as a download rather than inline", async () => {
    stubUpstream(new Response("%PDF-1.7", { status: 200 }));

    const response = await resumePdfLoader();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      "attachment; filename=Paul_Osorio_Schuler_Resume.pdf",
    );
  });

  /**
   * The PDF is for a visitor who is already on `/resume`; it has nothing to
   * gain from ranking on its own, and every reason not to — a PDF result
   * competes with `/resume` for the same queries and lands the reader on a
   * document with no navigation out of it.
   *
   * `noindex` rather than a `Disallow` in `robots.txt`: a disallowed URL is
   * never fetched, so the crawler never sees this header, and the URL can end
   * up listed anyway with no content behind it. The two cancel out.
   */
  it("keeps the PDF out of the index", async () => {
    stubUpstream(new Response("%PDF-1.7", { status: 200 }));

    const response = await resumePdfLoader();

    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("caches for a day — the file changes only when the CDN copy does", async () => {
    stubUpstream(new Response("%PDF-1.7", { status: 200 }));

    const response = await resumePdfLoader();

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  it("asks the colo to cache the origin fetch too", async () => {
    const fetchMock = stubUpstream(new Response("%PDF-1.7", { status: 200 }));

    await resumePdfLoader();

    expect(fetchMock).toHaveBeenCalledWith(PDF_URL, {
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
  });

  /**
   * Without the upstream check an error page was served as a 200
   * `application/pdf` — a download that opens as a corrupt file.
   */
  it.each([404, 500, 403])("404s rather than wrapping an upstream %i in a PDF", async (status) => {
    stubUpstream(new Response("Not the PDF", { status }));

    await expect(resumePdfLoader()).rejects.toMatchObject({ status: 404 });
  });

  /**
   * The body is handed through untouched rather than buffered: a Worker that
   * reads the whole PDF into memory before the first byte leaves pays for it in
   * both latency and memory.
   */
  it("streams the upstream body instead of buffering it", async () => {
    const upstream = new Response("%PDF-1.7", { status: 200 });
    stubUpstream(upstream);

    const response = await resumePdfLoader();

    expect(response.body).toBe(upstream.body);
  });
});
