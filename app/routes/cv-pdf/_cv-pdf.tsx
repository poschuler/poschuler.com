export async function loader() {
  let response = await fetch("https://cdn.poschuler.dev/cv.pdf");
  let data = await response.arrayBuffer();

  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=poschuler.pdf`,
    },
  });
}
