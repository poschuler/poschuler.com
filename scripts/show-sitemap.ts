/**
 * Prints the sitemap as a table, because a browser no longer can.
 *
 * The document declares `hreflang` alternates, and `hreflang` in a sitemap
 * exists only as `<xhtml:link rel="alternate">` — an element in the XHTML
 * namespace. A browser shows its collapsible XML tree only for a document it
 * considers plain XML; one XHTML element and it assumes the document is meant
 * to be rendered, drawing sitemap elements it does not know as `display:
 * inline` and running every text node together into one paragraph.
 *
 * The usual answer is an XSLT stylesheet named from the document. That answer
 * is expiring: Chrome deprecated XSLT in 143 and removes it in 158
 * (17 November 2026), with Firefox and WebKit stating the same intent — the
 * engine behind it has been unmaintained for years. A tool that reads the
 * document here has no such date on it.
 *
 *   pnpm sitemap:show                          the committed payload
 *   pnpm sitemap:show https://poschuler.com/sitemap.xml   what a host serves
 *
 * The second form is the one worth running before and after a Publication: the
 * body lives in KV, so a deploy that skips the seed leaves the previous
 * sitemap serving while the committed fixture says otherwise.
 */
import fs from "node:fs/promises";
import path from "node:path";

const PAYLOAD = path.join(process.cwd(), "seed", "kv", "kv_payloads", "sitemap.json");

type Entry = {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
  alternates: { hreflang: string; href: string }[];
};

/**
 * Parsed with regular expressions rather than a parser, and that is a decision
 * rather than a shortcut: the input is the output of `generateSitemap` two
 * directories away, which emits one shape and no whitespace. A dependency to
 * read our own generator's output would be the larger commitment. The one
 * thing this cannot do is tell a malformed document from an empty one — so it
 * says how many entries it found, and zero against a non-empty file is the
 * signal.
 */
function parse(xml: string): Entry[] {
  const tag = (block: string, name: string) =>
    block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? "";

  return [...xml.matchAll(/<url>(.*?)<\/url>/g)].map(([, block]) => ({
    loc: tag(block, "loc"),
    lastmod: tag(block, "lastmod"),
    changefreq: tag(block, "changefreq"),
    priority: tag(block, "priority"),
    alternates: [...block.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(([, hreflang, href]) => ({
      hreflang,
      href,
    })),
  }));
}

async function read(source: string | undefined): Promise<{ label: string; xml: string }> {
  if (!source) {
    const { sitemap } = JSON.parse(await fs.readFile(PAYLOAD, "utf8"));

    return { label: "seed/kv/kv_payloads/sitemap.json", xml: sitemap };
  }

  const response = await fetch(source);

  if (!response.ok) {
    throw new Error(`${source} answered ${response.status}`);
  }

  return { label: `${source} (${response.headers.get("Content-Type")})`, xml: await response.text() };
}

/** Padded to the widest value in its own column, so nothing is truncated. */
function column(values: string[]): (value: string) => string {
  const width = Math.max(...values.map((value) => value.length));

  return (value) => value.padEnd(width);
}

const { label, xml } = await read(process.argv[2]);
const entries = parse(xml);

console.log(`\n${label}`);
console.log(`${entries.length} addresses, ${xml.length} bytes\n`);

const loc = column(entries.map((entry) => entry.loc));
const lastmod = column(entries.map((entry) => entry.lastmod));
const changefreq = column(entries.map((entry) => entry.changefreq));

for (const entry of entries) {
  const languages =
    entry.alternates.length > 0
      ? entry.alternates.map((alternate) => alternate.hreflang).join(" ")
      : "—";

  console.log(
    `  ${loc(entry.loc)}  ${lastmod(entry.lastmod)}  ${changefreq(entry.changefreq)}  ${entry.priority.padStart(3)}  ${languages}`,
  );
}

console.log();

/**
 * The check the eye misses on a list this long: a `<loc>` that is not among
 * its own alternates declares a pair no crawler can complete. It is how the
 * home page read for one publication — `https://poschuler.com/` in the `<loc>`
 * against `https://poschuler.com` in both of its alternates.
 */
const unpaired = entries.filter(
  (entry) =>
    entry.alternates.length > 0 &&
    !entry.alternates.some((alternate) => alternate.href === entry.loc),
);

const duplicates = entries.length - new Set(entries.map((entry) => entry.loc)).size;

if (duplicates > 0) {
  console.log(`  ${duplicates} duplicate address(es)\n`);
}

if (unpaired.length > 0) {
  console.log("  addresses whose <loc> is not among their own alternates:");
  for (const entry of unpaired) {
    console.log(`    ${entry.loc}`);
  }
  console.log();
}
