// crawler/lib/html.js — reading a page without executing it: every link, script and iframe URL, absolute.
// Deliberately a small regex reader, not a DOM: the worker only needs URLs and link text.
const ATTR = /<(a|link|script|iframe|form)\b([^>]*)>([\s\S]{0,200}?)(?=<\/\1>|<)/gi;
function attr(tag, name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : null;
}
const decode = (s) => String(s).replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&quot;/g, '"');

/** @returns {{ how: "link"|"script"|"iframe"|"form", url: string, text: string }[]} */
export function extractRefs(html, baseUrl) {
  const out = [];
  for (const m of String(html || "").matchAll(ATTR)) {
    const tag = m[1].toLowerCase(), attrs = m[2];
    const text = (m[3] || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const raw = tag === "a" || tag === "link" ? attr(attrs, "href") : tag === "form" ? attr(attrs, "action") : attr(attrs, "src");
    if (!raw || /^(javascript|mailto|tel|data):/i.test(raw) || raw.startsWith("#")) continue;
    let url; try { url = new URL(decode(raw), baseUrl).href; } catch { continue; }
    out.push({ how: tag === "a" || tag === "link" ? "link" : tag, url, text });
  }
  return out;
}
/** A client-rendered shell: almost no links, at least one script. */
export function looksClientRendered(html) {
  const s = String(html || "");
  return /<script\b/i.test(s) && (s.match(/<a\s/gi) || []).length <= 2;
}
export function hasForm(html) { return /<form\b[\s\S]*?<(input|textarea|select)\b/i.test(String(html || "")); }
export function hasPasswordField(html) { return /<input\b[^>]*type\s*=\s*["']?password/i.test(String(html || "")); }
export function looksLikeAccountWall(html) { return /\b(create (an )?account|sign up|register to apply|sign in to apply)\b/i.test(String(html || "")); }
