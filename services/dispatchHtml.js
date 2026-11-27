// services/dispatchHtml.js — ⭐ D197 Wave 2 #18 · M5 (47m, lane outside) · DISPATCHES: the HTML part of draft's email.
//
// docs/revamp/emails.md is the brief, client/src/pages/dev/platePages/Dispatches.jsx the approved mock and
// client/src/plate/Dispatch.jsx the drawing this file follows (the gallery piece reads `var(--pl-*)`; a mail client reads no
// custom property, so this file writes the token VALUES — PLATE_EMAIL below, pinned to client/src/styles/plate.css by
// test/dispatchHtml47m.test.js, one map, so a token change reaches the email or fails the suite).
//
// The email-safe rules (emails.md "M5 must keep them"):
//  • TWO PARTS, ALWAYS — this is only the html part. Every caller keeps sending today's plain text word for word as `text`;
//    nothing a text-only client or a screen reader got before is lost. The HTML carries the same words (plus a heading).
//  • A 600 px `role="presentation"` table, every style inline; the one <style> block only adds the phone rule (100 % under
//    620 px) and Outlook's 2 px border — enhancements, never relied on.
//  • No web font required (the faces carry their fallbacks), no SVG, no script. The header PLATE (dispatch · run report ·
//    digest — DrawingsPublic's Drawing 23) is a hosted PNG with alt text (client/public/email/, drawn by
//    scripts/buildEmailPlates.mjs); a client that blocks images shows the alt and loses nothing — the words are in the HTML.
//  • The hard shadow is ink table cells 4 px right / below the card (Outlook drops box-shadow); radii are a nicety Outlook
//    ignores; ⛔ no capsule anywhere (D60) — the button is a bulletproof clay cell ≥ 44 px tall, square-cornered in Outlook.
//  • color-scheme: light — the paper stays paper (no dark plate yet).
// ⛔ D190: nothing here calls a model. ⛔ D100 P4 privacy is the caller's: this renders the words it is handed.

// the token values and the three plates live in shared/emailPlates.js (pure — the PNG build and the F5 fixture read them too)
import { PLATE_EMAIL, PLATE_EMAIL_VARS, EMAIL_PLATES } from "../shared/emailPlates.js";
export { PLATE_EMAIL, PLATE_EMAIL_VARS, EMAIL_PLATES };
const T = PLATE_EMAIL;
export const FACES = Object.freeze({
  serif: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  sans: "'Inter Tight', Arial, Helvetica, sans-serif",
  mono: "'JetBrains Mono', Menlo, Consolas, monospace",
});

export const EMAIL_PLATE_PATH = "/email/";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** An admin's or a person's own words: escaped, their line breaks kept (no reformatting of what they wrote). */
export const escLines = (s) => esc(String(s ?? "")).replace(/\r?\n/g, "<br>");
/** Only http(s) links are written into an href; anything else becomes "#". */
const href = (u) => (/^https?:\/\//i.test(String(u || "")) ? esc(u) : "#");

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
/** The kicker's date: `NOV 27` (UTC — the same for every reader of one send). */
export const kickerDate = (d = new Date()) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;

const mono = (size = 11, color = T.ink) =>
  `font-family:${FACES.mono};font-size:${size}px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${color};`;
const LINE = `1.5px solid ${T.ink}`;

/** The one action: a bulletproof clay link cell (≥ 44 px). */
export function buttonHtml({ label, url }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>`
    + `<td class="dx-b" bgcolor="${T.clay}" style="background:${T.clay};border:${LINE};border-radius:12px;mso-padding-alt:14px 22px;">`
    + `<a href="${href(url)}" style="display:inline-block;padding:14px 22px;font-family:${FACES.sans};font-size:16px;font-weight:800;line-height:20px;color:${T.onClay};text-decoration:none;">${esc(label)}</a>`
    + `</td></tr></table>`;
}

/** An ink text link (a per-entry link — never clay). */
const inkLink = (l) => `<a href="${href(l.url)}" style="font-family:${FACES.sans};font-size:14px;font-weight:700;color:${T.ink};text-decoration:underline;">${esc(l.label)}</a>`;

/** The skill squares as table cells (`asks for 4 of your 5 top skills` → five 10 px cells, 4 green). */
function squaresHtml({ of, lit }) {
  const n = Math.max(0, Math.min(10, Number(of) || 0)), k = Math.max(0, Math.min(n, Number(lit) || 0));
  if (!n) return "";
  const cells = Array.from({ length: n }, (_, i) =>
    `<td width="10" height="10" bgcolor="${i < k ? T.lit : T.card}" style="width:10px;height:10px;border:1px solid ${T.ink};background:${i < k ? T.lit : T.card};font-size:0;line-height:0;">&nbsp;</td>`
    + (i < n - 1 ? `<td width="3" style="width:3px;font-size:0;line-height:0;">&nbsp;</td>` : "")).join("");
  return `<table role="img" aria-label="${k} of your ${n} top skills" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;border-collapse:collapse;"><tr>${cells}</tr></table>`;
}

/**
 * One entry: a ruled row — the region number tag, the serif title, the company, a mono facts line, the skill squares, its
 * links (ink). `lines` = extra plain lines (a pick's line, a question).
 */
export function entryHtml({ n, title, company = null, facts = [], squares = null, lines = [], links = [] }) {
  const tag = n == null ? "" : `<span style="${mono(10, T.r4)}display:inline-block;padding:3px 6px;border:1.5px solid ${T.r4};background:${T.r4Tint};border-radius:8px;">${esc(String(n).padStart(2, "0"))}</span>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid ${T.rule};"><tr>`
    + `<td valign="top" width="44" style="width:44px;padding:16px 0 0;">${tag}</td>`
    + `<td valign="top" style="padding:14px 0 16px;">`
    + `<div style="font-family:${FACES.serif};font-size:22px;line-height:1.15;color:${T.ink};">${esc(title)}</div>`
    + (company ? `<div style="font-family:${FACES.sans};font-size:14px;font-weight:700;color:${T.inkSoft};margin-top:4px;">${esc(company)}</div>` : "")
    + (facts.length ? `<div style="${mono(11, T.muted)}margin-top:8px;line-height:1.6;">${facts.map(esc).join(" · ")}</div>` : "")
    + (squares ? squaresHtml(squares) : "")
    + lines.map((l) => `<div style="font-family:${FACES.sans};font-size:14px;line-height:1.5;color:${T.inkSoft};margin-top:6px;">${esc(l)}</div>`).join("")
    + (links.length ? `<div style="margin-top:10px;">${links.map(inkLink).join(`<span style="color:${T.muted};">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`)}</div>` : "")
    + `</td></tr></table>`;
}

/** The stats strip: a 3–4-cell table, serif numbers, mono labels; `tone: "lit"` only for proven (Sent). */
function statsHtml(stats) {
  const cells = stats.map((c, i) => {
    const color = c.tone === "lit" ? T.lit : T.ink;
    const v = c.value == null ? "—" : Number(c.value).toLocaleString("en-US");
    return `<td valign="top" style="padding:10px 12px;${i ? `border-left:${LINE};` : ""}">`
      + `<div style="font-family:${FACES.serif};font-size:30px;line-height:1;color:${color};">${esc(v)}</div>`
      + `<div style="${mono(11, c.tone === "lit" ? T.lit : T.muted)}margin-top:6px;">${esc(c.label)}</div></td>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dx-b" style="margin-top:18px;border-collapse:separate;border:${LINE};border-radius:14px;"><tr>${cells}</tr></table>`;
}

/** A code (a one-time code): large, mono, letter-spaced, in a ruled cell. */
export function codeHtml(code) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="dx-b" style="margin-top:18px;border-collapse:separate;border:${LINE};border-radius:12px;background:${T.paperWarm};"><tr>`
    + `<td style="padding:14px 20px;font-family:${FACES.mono};font-size:28px;font-weight:700;letter-spacing:.24em;color:${T.ink};">${esc(code)}</td></tr></table>`;
}

/**
 * THE DISPATCH. Everything optional but `title`:
 *   kind ("ALERT" · "PICKS" · "RUN SUMMARY" · "QUESTION" · "DIGEST" · "ACCOUNT" · "NOTICE"), date, plate (a key of
 *   EMAIL_PLATES) + appUrl (the image is absolute or absent), title (serif), lead, paragraphs (strings, escaped; or
 *   { lines } — someone's own words, line breaks kept), stats, entries (entryHtml args), code, action ({ label, url } — the one clay
 *   point), smallPrint, foot, preheader (the inbox preview line; defaults to the lead).
 */
export function renderDispatch({ kind = "ALERT", date = new Date(), plate = null, appUrl = "", title, lead = null, paragraphs = [],
                                 stats = [], entries = [], code = null, action = null, smallPrint = [], foot = [], preheader = null }) {
  const base = String(appUrl || "").replace(/\/$/, "");
  const p = plate && EMAIL_PLATES[plate] && /^https?:\/\//i.test(base) ? EMAIL_PLATES[plate] : null;
  const kicker = `DISPATCH · ${kind} · ${kickerDate(date instanceof Date ? date : new Date(date))}`;
  // a paragraph: a string (escaped), or { lines } — a person's / an admin's own words, escaped with their line breaks kept
  const para = (x) => `<p style="margin:12px 0 0;font-family:${FACES.sans};font-size:16px;line-height:1.55;color:${T.inkSoft};">${
    x && typeof x === "object" && "lines" in x ? escLines(x.lines) : esc(x)}</p>`;
  const small = (s) => `<p style="margin:0 0 6px;font-family:${FACES.sans};font-size:12px;line-height:1.5;color:${T.muted};">${esc(s)}</p>`;
  const pre = preheader ?? lead ?? "";
  const card = `<td class="dx-b" bgcolor="${T.card}" style="background:${T.card};border:${LINE};border-radius:18px;padding:24px 24px 22px;">`
    + `<h1 style="margin:0;font-family:${FACES.serif};font-weight:400;font-size:36px;line-height:1.05;color:${T.ink};">${esc(title)}<span style="color:${T.clay};">.</span></h1>`
    + (lead ? `<p style="margin:12px 0 0;font-family:${FACES.sans};font-size:16px;line-height:1.55;color:${T.inkSoft};">${esc(lead)}</p>` : "")
    + paragraphs.map(para).join("")
    + (code ? codeHtml(code) : "")
    + (stats.length ? statsHtml(stats) : "")
    + (entries.length ? `<div style="margin-top:18px;">${entries.map(entryHtml).join("")}</div>` : "")
    + (action ? `<div style="margin-top:22px;">${buttonHtml(action)}</div>` : "")
    + (smallPrint.length ? `<div style="margin-top:18px;padding-top:12px;border-top:2px dashed ${T.rule};">${smallPrint.map(small).join("")}</div>` : "")
    + `</td>`;
  // the hard shadow: ink cells 4 px right of and below the card, offset 4 px (Outlook drops box-shadow)
  const shadowed = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">`
    + `<tr>${card}<td width="4" valign="top" style="width:4px;padding:0;"><table role="presentation" width="4" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;height:100%;">`
    + `<tr><td height="4" style="height:4px;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td bgcolor="${T.ink}" style="background:${T.ink};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`
    + `<tr><td style="padding:0 0 0 4px;font-size:0;line-height:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td height="4" bgcolor="${T.ink}" style="height:4px;background:${T.ink};font-size:0;line-height:0;">&nbsp;</td></tr></table></td>`
    + `<td width="4" height="4" bgcolor="${T.ink}" style="width:4px;height:4px;background:${T.ink};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
  // the ruled edge: the 1.5 px rule + a 6 px tick strip drawn with table cells (one tick every 16 px)
  const ticks = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:${LINE};"><tr>`
    + Array.from({ length: 37 }, () => `<td width="1" height="6" bgcolor="${T.ink}" style="width:1px;height:6px;background:${T.ink};font-size:0;line-height:0;">&nbsp;</td><td width="15" style="width:15px;font-size:0;line-height:0;">&nbsp;</td>`).join("")
    + `</tr></table>`;
  const masthead = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td class="dx-b" width="28" height="28" bgcolor="${T.card}" align="center" style="width:28px;height:28px;border:${LINE};border-radius:8px;background:${T.card};font-family:${FACES.serif};font-size:20px;line-height:26px;color:${T.ink};"><span style="color:${T.clay};">/</span>d</td>`
    + `<td style="padding-left:10px;font-family:${FACES.serif};font-size:22px;color:${T.ink};">draft</td></tr></table>`;
  const plateRow = p ? `<tr><td style="padding:0 0 12px;"><img src="${esc(base + EMAIL_PLATE_PATH + p.file)}" width="560" height="140" alt="${esc(p.alt)}" `
    + `style="display:block;width:100%;max-width:560px;height:auto;border:${LINE};border-radius:14px;background:${T.paperWarm};"></td></tr>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(title)}</title>`
    + `<style>:root{color-scheme:light;supported-color-schemes:light}@media (max-width:620px){.dx-w{width:100%!important}}</style>`
    + `<!--[if mso]><style>.dx-b{border-width:2px!important}</style><![endif]--></head>`
    + `<body style="margin:0;padding:0;background:${T.paper};">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(pre)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.paper}" style="border-collapse:collapse;background:${T.paper};"><tr><td align="center" style="padding:24px 12px;">`
    + `<table role="presentation" class="dx-w" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;border-collapse:separate;text-align:left;">`
    + `<tr><td style="padding:0 0 10px;">${masthead}</td></tr>`
    + `<tr><td style="padding:0;">${ticks}</td></tr>`
    + `<tr><td style="padding:16px 0 12px;"><div style="${mono(12)}">${esc(kicker)}</div></td></tr>`
    + plateRow
    + `<tr><td style="padding:0;">${shadowed}</td></tr>`
    + `<tr><td style="padding:16px 4px 0;">${foot.map(small).join("")}</td></tr>`
    + `</table></td></tr></table></body></html>`;
}

/** The notify foot (every notify dispatch). */
export const NOTIFY_FOOT = "You chose to get this by email. Change it in draft → Account → Notifications.";
