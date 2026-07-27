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
    },
  });
}
