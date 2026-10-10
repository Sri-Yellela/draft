// services/byom/consentPage.js — ⭐ D86 · THE CONSENT SCREEN, where "sign in" really happens.
//
// Built to the owner's sketch (plugin-ui.html, tab 4). Claude or ChatGPT sends the person here; this is
// draft's own page on draft's own session, so no password ever goes to the host. On the screen: the host →
// draft tiles, who is signed in (and "Not you?"), each scope as a ✓ row — reading required, saving a choice —
// the NEVER row as a ✕, the privacy sentence naming the provider, and Not now / Allow. ⛔ When the user's
// switch is off it says so and offers to turn it on — it never fails silently. When draft or this host is
// switched off, it says that and offers only "Not now".
//
// Server-rendered and script-free (the route sends a CSP with no script-src). Colours come from the
// client's token file, both themes, so the page is the site's palette and not a second copy of it. The
// sketch's Google Fonts link is not followed — draft self-hosts its fonts (09-15), and this page names the
// families with system fallbacks. No pills (D60): every box is a rectangle.
import { C_LIGHT, C_DARK } from "../../client/src/styles/colorTokens.js";

export const NEVER_LIST = Object.freeze(["your contact details", "passwords", "applications", "other jobs"]);
export const PROVIDERS = Object.freeze({
  claude: { provider: "Anthropic", product: "Claude", letter: "C" },
  chatgpt: { provider: "OpenAI", product: "ChatGPT", letter: "G" },
  local: { provider: "the app's maker", product: "test", letter: "?" },
});
export const PRIVACY_SENTENCE = (host) => {
  const p = PROVIDERS[host] || PROVIDERS.local;
  return `Your résumé content and the job's details (its title, company, level, location and the keywords your résumé matched) ` +
    `are processed by ${p.provider} under your own ${p.product} account and its terms.`;
};

// ⛔ D86 DR-13 — the AI-assistance notice, on the screen where the user agrees (and in tools.js AI_NOTICE).
export const CONSENT_AI_NOTICE = "Résumés written this way are AI-assisted. Some employers restrict AI-assisted applications — check theirs before you apply.";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const vars = (c) => `--canvas:${c.CANVAS};--surface:${c.SURFACE_SOLID};--ink:${c.INK};--muted:${c.INK_MUTED};--border:${c.BORDER};` +
  `--control:${c.BORDER_CONTROL};--accent:${c.ACCENT};--on-accent:${c.ON_ACCENT};--accent-ink:${c.ACCENT_INK};--warn:${c.WARNING};` +
  `--ok:${c.SUCCESS};--no:${c.DANGER};`;

function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · draft</title><style>
:root{${vars(C_LIGHT)}color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{${vars(C_DARK)}}}
*{box-sizing:border-box;margin:0}body{background:var(--canvas);color:var(--ink);font:13px/1.5 "DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:462px;margin:48px auto;padding:0 16px}
.cons{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:22px}
.logo{font-family:Poppins,system-ui,sans-serif;font-weight:800;font-style:italic}
.tiles{display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:6px}
.tile{width:40px;height:40px;border-radius:6px;background:${C_LIGHT.SURFACE_SOLID};display:grid;place-items:center;font-size:17px;border:1px solid var(--border)}
.tile.host{color:${C_LIGHT.INK}}.tile.d{color:${C_LIGHT.ACCENT_INK}}.tiles i{font-style:normal;color:var(--muted);font-size:18px}
h1{font-size:18px;line-height:1.2;text-align:center;margin:12px 0 4px}
.sub{font-size:12.5px;color:var(--muted);margin-bottom:12px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;align-items:baseline}
.sub b{color:var(--ink)}.sub form{display:inline}
.link{background:none;border:0;padding:0;color:var(--accent-ink);font:inherit;font-weight:700;cursor:pointer}
.scope{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:start;padding:9px 0;border-top:1px solid var(--border);font-size:12.5px;color:var(--muted)}
.scope b{color:var(--ink)}.scope label{display:contents;cursor:pointer}
.ck{width:22px;height:22px;border-radius:6px;border:1px solid var(--ok);color:var(--ok);display:grid;place-items:center;font-weight:800;font-size:12px}
.ck.n{border-color:var(--no);color:var(--no)}
input.ck{appearance:none;margin:0;cursor:pointer;border-color:var(--control)}input.ck:checked{border-color:var(--ok)}input.ck:checked::after{content:"✓"}
.seal{font-size:12.3px;line-height:1.5;color:var(--muted);background:var(--canvas);border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin:10px 0}
.seal b{color:var(--ink)}
.note{border-left:3px solid var(--warn);padding:8px 12px;margin:12px 0;border-radius:6px;background:var(--canvas)}
.actions{display:flex;gap:10px;justify-content:flex-end;margin-top:6px;flex-wrap:wrap}
.btn{font-family:Poppins,system-ui,sans-serif;font-weight:800;font-style:italic;font-size:12px;height:38px;padding:0 16px;border-radius:6px;cursor:pointer;border:1px solid var(--control);background:transparent;color:var(--ink)}
.btn.p{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
button:focus-visible,input:focus-visible{outline:2px solid var(--accent-ink);outline-offset:2px}
</style></head><body><main>${body}</main></body></html>`;
}

/** A plain message page — an invalid link, an expired screen. */
export function renderConsentMessage({ title, body }) {
  return shell(title, `<div class="cons"><p class="logo" style="font-size:20px;margin-bottom:12px"><span style="color:var(--accent-ink)">/</span>draft</p>` +
    `<h1 style="text-align:left">${esc(title)}</h1><p>${esc(body)}</p></div>`);
}

/**
 * @param {{ host, hostLabel, who, username, scopes: string[], userOn: boolean, unavailable: string|null, nonce }} p
 *   who — the signed-in account as shown: the profile's email, else the username
 */
export function renderConsentPage({ host = "local", hostLabel, who = "", username = "", scopes = [], userOn, unavailable = null, nonce }) {
  const p = PROVIDERS[host] || PROVIDERS.local;
  const tiles = `<div class="tiles" aria-hidden="true"><div class="tile host logo">${esc(p.letter)}</div><i>→</i><div class="tile d logo">/d</div></div>`;
  const signedIn = `<div class="sub"><span>Signed in as <b>${esc(who || username)}</b></span><span>·</span>
<form method="post" action="/oauth/switch-account"><button class="link" type="submit">Not you?</button></form></div>`;
  const deny = `<form method="post" action="/oauth/authorize"><input type="hidden" name="nonce" value="${esc(nonce)}">
<input type="hidden" name="decision" value="deny"><button class="btn" type="submit">Not now</button></form>`;
  if (unavailable) {
    return shell("Not available", `<div class="cons">${tiles}<h1 class="logo">${esc(hostLabel)} cannot connect right now</h1>${signedIn}
<p class="note">${esc(unavailable)}</p><div class="actions">${deny}</div></div>`);
  }
  const wantsWrite = scopes.includes("resume:write");
  const body = `<div class="cons">${tiles}
<h1 class="logo">${esc(hostLabel)} wants to connect to your draft account</h1>${signedIn}
<form method="post" action="/oauth/authorize" id="allow">
<input type="hidden" name="nonce" value="${esc(nonce)}"><input type="hidden" name="decision" value="allow">
<div class="scope"><span class="ck">✓</span><span><b>Read your base résumé and claims</b><br>So it can tailor a résumé. <i>Required.</i></span></div>
${wantsWrite ? `<div class="scope"><label><input class="ck" type="checkbox" name="allow_write" value="1" checked aria-label="Save résumés to draft"><span><b>Save résumés to draft</b><br>The finished résumé, after draft's checks. Untick to let it read only.</span></label></div>` : ""}
<div class="scope"><span class="ck n">✕</span><span><b>Never: ${esc(NEVER_LIST.join(", "))}</b></span></div>
${userOn ? "" : `<div class="note"><p style="margin:0 0 6px"><b>Writing résumés in ChatGPT or Claude is off</b> in your draft settings. Turn it on to connect.</p>
<div class="scope" style="border:0;padding:0"><label><input class="ck" type="checkbox" name="turn_on" value="1" required aria-label="Turn it on"><span><b>Turn it on</b></span></label></div></div>`}
<div class="seal">${esc(PRIVACY_SENTENCE(host))} draft makes no model call for these résumés and never uses them to train a model. You can disconnect any time in <b>Settings → Integrations → Connected apps</b>.</div>
<p class="note" data-ai-notice="">${esc(CONSENT_AI_NOTICE)}</p>
</form>
<div class="actions">${deny}<button class="btn p" type="submit" form="allow">Allow</button></div></div>`;
  return shell(`Connect ${hostLabel}`, body);
}
