// services/byom/consentPage.js — ⭐ D86 · THE CONSENT SCREEN, where "sign in" really happens.
//
// Claude or ChatGPT sends the person here; this is draft's own page on draft's own session, so no password
// ever goes to the host. It says, on the screen: who is signed in (and "Not you?"), exactly what the app may
// do, what it NEVER sees, and where the résumé content goes. ⛔ When the user's switch is off it says so and
// offers to turn it on — it never fails silently. When draft or this host is switched off, it says that and
// offers only "Not now".
//
// Server-rendered and script-free (the route sends a CSP with no script-src). Colours come from the
// client's token file, both themes, so the page is the site's palette and not a second copy of it.
// No pills (D60): boxes are radius 6.
import { C_LIGHT, C_DARK } from "../../client/src/styles/colorTokens.js";

export const NEVER_LIST = Object.freeze(["your contact details", "your passwords", "your applications", "your other jobs"]);
export const PRIVACY_SENTENCE = (host) =>
  `If you use draft through ${host}, your résumé content and the job's details (its title, company, level, location and the keywords your résumé matched) are processed by ${host} under your own account and its terms.`;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const vars = (c) => `--canvas:${c.CANVAS};--surface:${c.SURFACE_SOLID};--ink:${c.INK};--muted:${c.INK_MUTED};--border:${c.BORDER};` +
  `--control:${c.BORDER_CONTROL};--accent:${c.ACCENT};--on-accent:${c.ON_ACCENT};--accent-ink:${c.ACCENT_INK};--warn:${c.WARNING};`;

function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · draft</title><style>
:root{${vars(C_LIGHT)}color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{${vars(C_DARK)}}}
*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:480px;margin:48px auto;padding:0 16px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:24px}
.mark{font-weight:800;font-style:italic;font-size:22px;letter-spacing:-.02em;margin:0 0 20px}.mark b{color:var(--accent-ink)}
h1{font-size:20px;margin:0 0 8px}.who{color:var(--muted);font-size:14px;margin:0 0 20px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.who form{display:inline}.link{background:none;border:0;padding:0;color:var(--accent-ink);font:inherit;text-decoration:underline;cursor:pointer}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:20px 0 8px}
label.scope{display:flex;gap:10px;align-items:flex-start;padding:8px 0}label.scope small{display:block;color:var(--muted)}
ul.never{margin:0;padding-left:20px;color:var(--muted)}
.note{border-left:3px solid var(--warn);padding:8px 12px;margin:16px 0;border-radius:6px;background:var(--canvas)}
.privacy{font-size:14px;color:var(--muted);margin:16px 0 0}
.actions{display:flex;gap:12px;margin-top:24px;flex-wrap:wrap}
button.btn{font:inherit;font-weight:600;padding:10px 18px;border-radius:6px;cursor:pointer;border:1px solid var(--control);background:transparent;color:var(--ink)}
button.primary{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
button:focus-visible,input:focus-visible{outline:2px solid var(--accent-ink);outline-offset:2px}
</style></head><body><main><p class="mark"><b>/</b>draft</p><div class="card">${body}</div></main></body></html>`;
}

/** A plain message page — an invalid link, an expired screen. */
export function renderConsentMessage({ title, body }) {
  return shell(title, `<h1>${esc(title)}</h1><p>${esc(body)}</p>`);
}

/**
 * @param {{ hostLabel, username, scopes: string[], userOn: boolean, unavailable: string|null, nonce }} p
 */
export function renderConsentPage({ hostLabel, username, scopes = [], userOn, unavailable = null, nonce }) {
  const deny = `<form method="post" action="/oauth/authorize"><input type="hidden" name="nonce" value="${esc(nonce)}">
<input type="hidden" name="decision" value="deny"><button class="btn" type="submit">Not now</button></form>`;
  const who = `<p class="who">Signed in to draft as <strong>${esc(username)}</strong> ·
<form method="post" action="/oauth/switch-account"><button class="link" type="submit">Not you?</button></form></p>`;
  if (unavailable) {
    return shell("Not available", `<h1>${esc(hostLabel)} cannot connect right now</h1>${who}
<p class="note">${esc(unavailable)}</p><div class="actions">${deny}</div>`);
  }
  const wantsWrite = scopes.includes("resume:write");
  const body = `<h1>${esc(hostLabel)} wants to connect to your draft account</h1>${who}
<form method="post" action="/oauth/authorize" id="allow">
<input type="hidden" name="nonce" value="${esc(nonce)}"><input type="hidden" name="decision" value="allow">
<h2>It will be able to</h2>
<label class="scope"><input type="checkbox" checked disabled><span>Read your base résumé and the skills you have claimed<small>Required — this is what your own model writes from.</small></span></label>
${wantsWrite ? `<label class="scope"><input type="checkbox" name="allow_write" value="1" checked><span>Save résumés to your draft account<small>Each one is checked first: nothing you never stated is added.</small></span></label>` : ""}
<h2>It never sees</h2>
<ul class="never">${NEVER_LIST.map(n => `<li>${esc(n)}</li>`).join("")}</ul>
${userOn ? "" : `<div class="note"><p style="margin:0 0 8px">Writing résumés in ChatGPT or Claude is <strong>off</strong> in your draft settings.</p>
<label class="scope"><input type="checkbox" name="turn_on" value="1" required><span>Turn it on</span></label></div>`}
<p class="privacy">${esc(PRIVACY_SENTENCE(hostLabel))} draft makes no model call for these résumés.</p>
</form>
<div class="actions"><button class="btn primary" type="submit" form="allow">Allow</button>${deny}</div>`;
  return shell(`Connect ${hostLabel}`, body);
}
