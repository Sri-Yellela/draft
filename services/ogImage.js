// services/ogImage.js — ⭐ D179 (45n, owner 11-08 decision (7): "the OG image dependency: the agent's proposed one") ·
// THE SHARE PICTURE for draft's public pages — the 1200 × 630 PNG that link previews (LinkedIn, X, Slack, iMessage) show.
//
// The dependency: @resvg/resvg-js, PINNED at 2.6.2 (released 2024 — well past the two-week rule), prebuilt binaries, no
// build step; it rasterises an SVG we write here. The font: DM Sans (assets/fonts/DMSans.ttf, SIL OFL 1.1 — the licence
// beside it), loaded explicitly so a container with no system fonts still draws text.
// ⛔ No personal data, ever: a card carries only what the public page already shows — a role, a company, a count, a
// place. Never a person's name (no card for /in/<handle>), never a résumé fact.
// Cached in memory by (kind, title, line) — the card is the same until its words change; ≤ CACHE_MAX entries.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONT = path.join(ROOT, "assets", "fonts", "DMSans.ttf");
const CACHE_MAX = 500;
const cache = new Map();
let Resvg = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Greedy wrap by an approximate character width — enough for a headline (no measuring API in SVG-to-PNG). */
export function wrapLines(text, maxChars, maxLines) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; if (lines.length === maxLines) break; }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  return lines;
}

/** Pure: the card's SVG. `eyebrow` (e.g. "Jobs" / "Company"), `title` (the headline), `line` (one fact). */
export function cardSvg({ eyebrow = "", title = "", line = "" }) {
  const t = wrapLines(title, 26, 3);
  const size = t.length === 3 ? 64 : 76;
  const top = 250 - (t.length - 1) * (size * 0.6);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#141414"/>
<rect x="0" y="0" width="1200" height="8" fill="#d9f26b"/>
<text x="80" y="120" font-family="DM Sans" font-size="34" font-weight="700" fill="#d9f26b">${esc(eyebrow)}</text>
${t.map((l, i) => `<text x="80" y="${Math.round(top + i * size * 1.15)}" font-family="DM Sans" font-size="${size}" font-weight="700" fill="#f4f4f0">${esc(l)}</text>`).join("\n")}
<text x="80" y="520" font-family="DM Sans" font-size="34" fill="#b8b8b0">${esc(wrapLines(line, 56, 1)[0] || "")}</text>
<text x="1120" y="570" text-anchor="end" font-family="DM Sans" font-size="40" font-weight="700" fill="#f4f4f0">/draft</text>
</svg>`;
}

/** The PNG for a card (Buffer), or null when the rasteriser is unavailable (the page then simply has no og:image). */
export async function ogPng(card) {
  const key = JSON.stringify([card.eyebrow, card.title, card.line]);
  if (cache.has(key)) return cache.get(key);
  if (!Resvg) {
    try { ({ Resvg } = await import("@resvg/resvg-js")); } catch (e) { console.warn("[og] @resvg/resvg-js unavailable:", e.message); return null; }
  }
  const png = new Resvg(cardSvg(card), { fitTo: { mode: "width", value: 1200 },
    font: { fontFiles: fs.existsSync(FONT) ? [FONT] : [], loadSystemFonts: !fs.existsSync(FONT), defaultFontFamily: "DM Sans" } }).render().asPng();
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, png);
  return png;
}

// ⛔ The image URL carries its own words, SIGNED (HMAC-SHA256 over the payload, 16 bytes) — so nobody can mint a
// draft-branded card with words of their choosing; GET /og.png refuses anything unsigned.
const secret = () => process.env.OG_IMAGE_SECRET || process.env.SESSION_SECRET || "dev-og-secret";
const sig = (d) => crypto.createHmac("sha256", secret()).update(d).digest("base64url").slice(0, 22);
export function ogUrl(origin, card) {
  const d = Buffer.from(JSON.stringify({ e: String(card.eyebrow || "").slice(0, 40), t: String(card.title || "").slice(0, 120), l: String(card.line || "").slice(0, 120) })).toString("base64url");
  return `${String(origin).replace(/\/$/, "")}/og.png?d=${d}&s=${sig(d)}`;
}
/** The card a signed request names, or null when the signature does not match. */
export function cardFromQuery(d, s) {
  if (typeof d !== "string" || typeof s !== "string" || d.length > 800) return null;
  const want = sig(d);
  if (s.length !== want.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want))) return null;
  try { const j = JSON.parse(Buffer.from(d, "base64url").toString("utf8")); return { eyebrow: j.e, title: j.t, line: j.l }; } catch { return null; }
}

/** The <meta> tags for a page whose card is served at `imageUrl` (absolute). */
export function ogImageMeta(imageUrl, alt) {
  return `<meta property="og:image" content="${esc(imageUrl)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`
    + `<meta property="og:image:alt" content="${esc(alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(imageUrl)}">`;
}
