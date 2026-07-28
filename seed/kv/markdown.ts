import { marked } from "marked";

/**
 * Markdown → HTML for Post bodies.
 *
 * The output of this module is what ends up in KV, and the Post route injects
 * it with `dangerouslySetInnerHTML` without looking at it again. So this is the
 * one place where the HTML is made safe: sanitising here costs nothing per
 * visit, and the only process that writes to KV is this pipeline.
 *
 * `marked` on its own does none of this. It passes raw HTML through verbatim,
 * and its URL handling only runs `encodeURI`, so a link written as
 * `[x](javascript:alert(1))` renders as a live `href`.
 */

const HTML_ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * Relative URLs, fragments and the three schemes above are allowed; every other
 * scheme — `javascript:`, `data:`, `vbscript:` — is not.
 *
 * Control characters are dropped before the scheme is read, because browsers
 * ignore them inside an attribute: a tab spliced into `javascript:` still runs
 * for a parser that has not dropped the tab.
 */
function isSafeUrl(href: string): boolean {
    const cleaned = Array.from(href.trim())
        .filter((character) => {
            const code = character.charCodeAt(0);
            return code > 0x20 && code !== 0x7f;
        })
        .join("");

    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);

    return !scheme || SAFE_SCHEMES.has(scheme[1].toLowerCase() + ":");
}

/**
 * Returning `false` from a renderer override hands the token back to marked's
 * own renderer, so the safe path stays exactly what marked would have produced.
 */
marked.use({
    renderer: {
        // Covers block-level and inline HTML: the parser routes both here.
        html({ text }) {
            return escapeHtml(text);
        },

        link(token) {
            if (isSafeUrl(token.href)) {
                return false;
            }

            // The text survives, the link does not.
            return this.parser.parseInline(token.tokens);
        },

        image(token) {
            if (isSafeUrl(token.href)) {
                return false;
            }

            return escapeHtml(token.text);
        },
    },
});

export function renderPostHtml(markdown: string): Promise<string> {
    return marked.parse(markdown, { async: true });
}
