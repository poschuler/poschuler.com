import fs from "node:fs/promises";
import path from "node:path";

import fm from "front-matter";
import { describe, expect, it } from "vitest";

import { renderPostHtml } from "../../../seed/kv/markdown";

/**
 * `seed/kv/markdown.ts` is the only thing standing between a Markdown body and
 * `dangerouslySetInnerHTML`. The Worker reads what this produces out of KV and
 * injects it without looking at it again, so every assertion below is the site's
 * actual XSS boundary rather than a formatting preference.
 *
 * The tests go through `renderPostHtml` and read its output. `escapeHtml` and
 * `isSafeUrl` are not exported, and testing them directly would assert the
 * shape of the implementation instead of the guarantee.
 */

const UNSAFE_SCHEMES = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "  javascript:alert(1)",
  "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  "vbscript:msgbox(1)",
];

describe("link URLs", () => {
  it.each(UNSAFE_SCHEMES)("drops the link but keeps the text for %s", async (href) => {
    const html = await renderPostHtml(`[click me](${href})`);

    expect(html).not.toContain("<a");
    expect(html).not.toMatch(/javascript:|vbscript:|data:/i);
    expect(html).toContain("click me");
  });

  /**
   * Browsers ignore control characters inside an attribute, so a tab spliced
   * into `javascript:` still runs for any parser that reads the scheme without
   * stripping them first. This is the case the scheme check exists for.
   */
  it.each([
    ["tab", "java\tscript:alert(1)"],
    ["newline", "java\nscript:alert(1)"],
    ["carriage return", "java\rscript:alert(1)"],
    ["null byte", "java\0script:alert(1)"],
  ])("blocks javascript: split by a %s", async (_name, href) => {
    const html = await renderPostHtml(`[click me](<${href}>)`);

    expect(html).not.toContain("<a");
    expect(html).toContain("click me");
  });

  it.each([
    ["https", "https://example.com/post"],
    ["http", "http://example.com/post"],
    ["mailto", "mailto:paul@example.com"],
    ["a relative path", "/blog/some-slug"],
    ["a fragment", "#section"],
  ])("keeps a link to %s", async (_name, href) => {
    const html = await renderPostHtml(`[click me](${href})`);

    expect(html).toContain(`href="${href}"`);
    expect(html).toContain("click me");
  });
});

describe("image URLs", () => {
  it.each(UNSAFE_SCHEMES)("drops the image for %s", async (src) => {
    const html = await renderPostHtml(`![the alt text](${src})`);

    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/javascript:|vbscript:|data:/i);
  });

  it("escapes the alt text it falls back to", async () => {
    const html = await renderPostHtml('![<script>alert(1)</script>](javascript:alert(1))');

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("keeps an image on a safe URL", async () => {
    const html = await renderPostHtml("![the alt text](https://example.com/a.png)");

    expect(html).toContain('src="https://example.com/a.png"');
  });
});

describe("raw HTML in a Markdown body", () => {
  it("escapes a block-level tag rather than passing it through", async () => {
    const html = await renderPostHtml("<script>alert(1)</script>");

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes an inline tag rather than passing it through", async () => {
    const html = await renderPostHtml('Text with <img src="x" onerror="alert(1)"> inside.');

    // The handler's *text* survives — escaped, inside a text node, inert. What
    // must not survive is the tag that would make it an attribute.
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("onerror=&quot;");
  });

  it("escapes an event handler smuggled into a block element", async () => {
    const html = await renderPostHtml('<div onclick="alert(1)">hello</div>');

    expect(html).not.toContain("<div");
    expect(html).toContain("&lt;div");
    expect(html).toContain("hello");
  });
});

describe("ordinary Markdown still renders", () => {
  it("renders headings, emphasis and fenced code", async () => {
    const html = await renderPostHtml("# Title\n\nSome **bold** text.\n\n```ts\nconst a = 1;\n```\n");

    expect(html).toContain("<h1");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code");
  });
});

/**
 * The guarantee this module provides is only as old as the last seed run: the
 * Worker trusts whatever is already in KV. Re-rendering every published Post
 * and comparing it against its committed payload is what says the two are still
 * in step — a payload written by an older pipeline would show up here as a diff
 * rather than as HTML nobody re-reads.
 */
describe("the committed KV payloads match what the pipeline produces today", () => {
  const payloadDir = path.join(process.cwd(), "seed", "kv", "kv_payloads", "blog");
  const contentRoot = path.join(process.cwd(), "app", "content");

  /**
   * Every Markdown file in the repository, by filename.
   *
   * A payload under `blog/` no longer says where its source is: a Part's body
   * belongs to the `blog:` key space, because that is what kind of payload it
   * is, while the file itself lives under its Series. Looking the filename up
   * keeps this test out of the business of rebuilding content paths, which is
   * `generate-kv-json.ts`'s job and only needs doing once.
   */
  async function markdownByFilename(): Promise<Map<string, string>> {
    const entries = await fs.readdir(contentRoot, { withFileTypes: true, recursive: true });

    return new Map(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => [entry.name, path.join(entry.parentPath, entry.name)]),
    );
  }

  it("re-renders every published Post byte for byte", async () => {
    const files = (await fs.readdir(payloadDir)).filter((file) => file.endsWith(".json"));
    const sources = await markdownByFilename();

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const payload = JSON.parse(await fs.readFile(path.join(payloadDir, file), "utf-8")) as { html: string };
      const sourcePath = sources.get(file.replace(/\.json$/, ".md"));

      expect(sourcePath, `${file} has no Markdown file behind it`).toBeDefined();

      const markdown = await fs.readFile(sourcePath as string, "utf-8");
      const rendered = await renderPostHtml(fm<unknown>(markdown).body);

      expect(rendered, `${file} is out of step with its Markdown source`).toBe(payload.html);
    }
  });

  it("leaves no executable HTML in any published Post", async () => {
    const files = (await fs.readdir(payloadDir)).filter((file) => file.endsWith(".json"));

    for (const file of files) {
      const { html } = JSON.parse(await fs.readFile(path.join(payloadDir, file), "utf-8")) as { html: string };

      expect(html, `${file} carries a script tag`).not.toMatch(/<script/i);
      expect(html, `${file} carries an inline event handler`).not.toMatch(/\son[a-z]+\s*=/i);
      expect(html, `${file} carries a javascript: URL`).not.toMatch(/javascript:/i);
    }
  });
});
