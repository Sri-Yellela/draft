// services/resumePreviewSanitiser.js — ⛔ D98 P1: the résumé HTML the extension previews, and the server prints.
//
// A generated résumé is OUR formatter's HTML, but it is still model-written text inside markup, and the extension
// renders it inside someone else's page (a shadow DOM on Workday). So the preview is an ALLOW-LIST, not a block-list:
// a tag or attribute this file does not name is gone. What survives:
//   · structure and text tags (div, p, ul, li, table, strong, …) — unknown tags are UNWRAPPED (their text stays);
//   · <style> blocks and style="" attributes, with every url(), @import, expression() and binding removed — so
//     nothing in the preview can load anything from anywhere;
//   · <a href> only for http(s) and mailto links (a link is not a resource load; javascript:, data: and the rest
//     are dropped);
//   · class / id / title / colspan / rowspan.
// Dropped WITH their content: script, iframe, object, embed, svg, math, template, noscript, form controls, title;
// dropped as void tags: img, link, meta, base, source, input — the external image and the stylesheet link included.
// Comments and doctypes are removed; <html>/<head>/<body> are unwrapped (a shadow root has no document).
//
// No dependency: the repository carries no HTML sanitiser, and this input is one formatter's output, not the web.
// The PDF the server prints is printed FROM THIS OUTPUT, so the server's Chromium never fetches what a document names.

const KEEP = new Set(["div", "span", "p", "br", "hr", "ul", "ol", "li", "strong", "b", "em", "i", "u", "small", "sup", "sub",
  "h1", "h2", "h3", "h4", "h5", "h6", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "colgroup", "col",
  "section", "header", "footer", "article", "main", "blockquote", "a", "style", "dl", "dt", "dd", "abbr", "code", "pre"]);
const VOID = new Set(["br", "hr", "col", "img", "link", "meta", "base", "source", "input", "wbr", "area", "track", "embed", "param", "keygen"]);
/** Removed together with everything inside them. */
const DROP_WITH_CONTENT = new Set(["script", "iframe", "object", "embed", "svg", "math", "template", "noscript", "title",
  "form", "button", "select", "textarea", "video", "audio", "canvas", "frameset", "frame", "noembed", "noframes", "xmp", "applet", "portal"]);
/** Raw-text elements: their content is not markup, so it is skipped to the end tag, never parsed. */
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript"]);
const KEEP_ATTRS = new Set(["class", "id", "title", "colspan", "rowspan", "style"]);

const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) || 0))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d) || 0))
    .replace(/&colon;/gi, ":").replace(/&tab;/gi, "\t").replace(/&newline;/gi, "\n").replace(/&amp;/gi, "&");
}

/** CSS with nothing that loads: no url(), no @import, no expression(), no behavior / -moz-binding. */
export function sanitiseCss(css, counts = { urls: 0 }) {
  let out = String(css ?? "");
  out = out.replace(/\/\*[\s\S]*?\*\//g, "");
  out = out.replace(/@import[^;]*;?/gi, () => { counts.urls++; return ""; });
  out = out.replace(/url\s*\([^)]*\)/gi, () => { counts.urls++; return "none"; });
  out = out.replace(/expression\s*\(/gi, () => { counts.urls++; return "("; });
  out = out.replace(/(-moz-binding|behavior)\s*:[^;}]*/gi, () => { counts.urls++; return ""; });
  out = out.replace(/<\/?\s*style/gi, "");
  return out;
}

function safeHref(raw) {
  const v = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, "");
  return /^(https?:|mailto:)/i.test(v) ? v : null;
}

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/y;
const ATTR_RE = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/**
 * @returns {{ html: string, removed: { tags: number, attributes: number, urls: number } }}
 */
export function sanitiseResumeHtml(input) {
  const src = String(input ?? "");
  const removed = { tags: 0, attributes: 0, urls: 0 };
  let out = "";
  let i = 0;
  let skip = null;            // { name, depth } while inside a DROP_WITH_CONTENT element that is not raw text
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt === -1) { if (!skip) out += src.slice(i).replace(/>/g, "&gt;"); break; }
    if (!skip) out += src.slice(i, lt).replace(/>/g, "&gt;");
    // comments and declarations
    if (src.startsWith("<!--", lt)) { const e = src.indexOf("-->", lt + 4); i = e === -1 ? n : e + 3; continue; }
    if (src[lt + 1] === "!" || src[lt + 1] === "?") { const e = src.indexOf(">", lt); i = e === -1 ? n : e + 1; continue; }
    TAG_RE.lastIndex = lt;
    const m = TAG_RE.exec(src);
    if (!m) { if (!skip) out += "&lt;"; i = lt + 1; continue; }
    const [whole, slash, rawName, rawAttrs] = m;
    const name = rawName.toLowerCase();
    i = lt + whole.length;
    if (skip) {
      if (name === skip.name) skip.depth += slash ? -1 : (/\/\s*$/.test(rawAttrs) ? 0 : 1);
      if (skip.depth <= 0) skip = null;
      continue;
    }
    if (slash) {
      if (KEEP.has(name) && !VOID.has(name)) out += `</${name}>`;
      continue;
    }
    if (RAW_TEXT.has(name)) {
      const close = new RegExp(`</${name}\\s*>`, "i").exec(src.slice(i));
      const body = close ? src.slice(i, i + close.index) : src.slice(i);
      i = close ? i + close.index + close[0].length : n;
      if (name === "style") { out += `<style>${sanitiseCss(body, removed)}</style>`; continue; }
      removed.tags++;
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      removed.tags++;
      if (!VOID.has(name) && !/\/\s*$/.test(rawAttrs)) skip = { name, depth: 1 };
      continue;
    }
    if (!KEEP.has(name)) { if (!["html", "head", "body"].includes(name)) removed.tags++; continue; }
    let attrs = "";
    ATTR_RE.lastIndex = 0;
    let a;
    while ((a = ATTR_RE.exec(rawAttrs))) {
      const an = a[1].toLowerCase();
      const av = a[2] ?? a[3] ?? a[4] ?? "";
      if (an === "/") continue;
      if (an === "href" && name === "a") {
        const h = safeHref(av);
        if (h) attrs += ` href="${escapeAttr(h)}" rel="noopener noreferrer"`; else { removed.attributes++; removed.urls++; }
        continue;
      }
      if (!KEEP_ATTRS.has(an)) { removed.attributes++; continue; }
      if (an === "style") { const css = sanitiseCss(decodeEntities(av), removed).trim(); if (css) attrs += ` style="${escapeAttr(css)}"`; continue; }
      attrs += ` ${an}="${escapeAttr(decodeEntities(av))}"`;
    }
    out += `<${name}${attrs}>`;
  }
  return { html: out.trim(), removed };
}
