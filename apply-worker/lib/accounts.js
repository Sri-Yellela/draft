// apply-worker/lib/accounts.js — ⭐ D100 (a), owner 10-30: "yes we are creating portal accounts … test it on amazon."
//
// The worker creates a portal account FOR the user, then signs in with it to apply. What holds while it does:
//   • the email is the user's OWN (no alias addresses, D100);
//   • the password is generated HERE and sealed to a key minted for this account — draft stores ciphertext and never
//     sees it; the user can always take the account over with the portal's own "forgot password";
//   • a terms / privacy box on the sign-up form is NEVER ticked by draft (D100) — the run stops, Needs you, the box named;
//   • a CAPTCHA, "type the word" or a code sent to the email is NEVER answered (D100) — the run stops, Needs you.
// The cookies a successful sign-in leaves are handed to the fill engine in memory (lib/run.js), like an uploaded session.
//
// Forms are found by what they ARE (input types, autocomplete, labels), not by a portal's CSS. A portal ADAPTER only
// says where to start. ⚠ ADAPTERS are UNVERIFIED until the owner's attended run (D100 P5): the Amazon entry point is the
// account site the D56 two-origin case recorded; the run is what confirms or corrects it.
import crypto from "node:crypto";
import { seal, aadFor } from "./keys.js";

export const ADAPTERS = Object.freeze({
  amazon: { family: "amazon", start: "https://account.amazon.jobs/en-US", verified: false },
});

/** A password the portal will accept and nobody chose: 20 characters, every class present. */
export function generatePassword(length = 20) {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!#%+-=?@^_"];
  const all = sets.join("");
  const pick = (s) => s[crypto.randomInt(s.length)];
  const chars = sets.map(pick);
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

// What the page holds, read in the page — inputs with their type, name, autocomplete and visible label.
/* c8 ignore next */
function readForm() {
  const labelOf = (el) => {
    const byFor = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    return (byFor?.innerText || el.closest("label")?.innerText || el.getAttribute("aria-label") || el.placeholder || "").trim();
  };
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const inputs = [...document.querySelectorAll("input, select, textarea")].filter(visible).map((el, i) => {
    el.setAttribute("data-aw", String(i));
    return { aw: String(i), tag: el.tagName.toLowerCase(), type: (el.type || "").toLowerCase(), name: el.name || el.id || "",
      autocomplete: el.autocomplete || "", label: labelOf(el), required: !!el.required, checked: !!el.checked };
  });
  const text = document.body?.innerText?.slice(0, 4000) || "";
  const captcha = !!document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="captcha"], .g-recaptcha, .h-captcha, [data-sitekey]');
  return { inputs, text, captcha, url: location.href };
}

const has = (f, re) => re.test(`${f.name} ${f.autocomplete} ${f.label}`);
const CONSENT = /agree|consent|terms|privacy|accept|acknowledge/i;
const CODE = /\b(code|otp|one[- ]time|verification|verify)\b/i;

/** Classify a page: what kind of form, and whether something on it is only the person's to answer. Pure. */
export function classify(form) {
  const pw = form.inputs.filter(f => f.type === "password");
  const email = form.inputs.find(f => f.type === "email" || has(f, /e-?mail|username/i));
  const consent = form.inputs.filter(f => f.type === "checkbox" && has(f, CONSENT));
  const code = form.inputs.find(f => f.type !== "password" && f.type !== "email" && has(f, CODE));
  if (form.captcha || /\b(captcha|i'?m not a robot|type the (word|characters))\b/i.test(form.text)) return { kind: "human_check" };
  if (code) return { kind: "email_verification" };
  if (pw.length >= 2 && email) return { kind: "signup", email, password: pw[0], confirm: pw[1], consent };
  if (pw.length === 1 && email) return { kind: "signin", email, password: pw[0] };
  if (pw.length === 1) return { kind: "password_only", password: pw[0] };
  if (email) return { kind: "email_only", email };
  return { kind: "none" };
}

const nameFields = (form) => ({
  first: form.inputs.find(f => has(f, /first|given/i) && f.type !== "password"),
  last: form.inputs.find(f => has(f, /last|family|surname/i) && f.type !== "password"),
  full: form.inputs.find(f => /^(name|full ?name|your name)$/i.test(f.label || f.name) || f.autocomplete === "name"),
});

async function fill(page, field, value) {
  const sel = `[data-aw="${field.aw}"]`;
  await page.click(sel, { clickCount: 3 }).catch(() => {});
  await page.type(sel, String(value), { delay: 20 });
}
async function submit(page) {
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, input[type="submit"]')]
      .find(x => /create|sign ?up|register|continue|next|sign ?in|log ?in|submit/i.test(x.innerText || x.value || ""));
    if (b) { b.click(); return true; }
    return false;
  });
  if (!clicked) await page.keyboard.press("Enter");
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
}
/** A link to the sign-up / sign-in form when the start page is neither. */
async function follow(page, re) {
  const href = await page.evaluate((src) => {
    const r = new RegExp(src, "i");
    const a = [...document.querySelectorAll("a, button")].find(x => r.test(x.innerText || ""));
    if (!a) return null;
    if (a.href) return a.href;
    a.click(); return "clicked";
  }, re.source);
  if (href && href !== "clicked") await page.goto(href, { waitUntil: "domcontentloaded" });
  else if (href) await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10_000 }).catch(() => {});
  return !!href;
}

const stop = (reason) => ({ ok: false, reason });

/**
 * Create the account. `who` = { email, firstName, lastName }. Returns { ok: true } (signed in) or { ok: false, reason }.
 * ⛔ A required consent box stops it — never ticked. A human check or an emailed code stops it — never answered.
 */
export async function signUp(page, startUrl, who, password) {
  await page.goto(startUrl, { waitUntil: "domcontentloaded" });
  let c = classify(await page.evaluate(readForm));
  if (c.kind !== "signup") { await follow(page, /create (an )?account|sign ?up|register|new user/); c = classify(await page.evaluate(readForm)); }
  if (c.kind === "human_check" || c.kind === "email_verification") return stop(c.kind);
  // Some portals ask for the email first, then the passwords.
  if (c.kind === "email_only") { await fill(page, c.email, who.email); await submit(page); c = classify(await page.evaluate(readForm)); }
  if (c.kind === "human_check" || c.kind === "email_verification") return stop(c.kind);
  if (c.kind !== "signup" && c.kind !== "password_only") return stop("signup_failed");
  if (c.consent?.some(f => f.required && !f.checked)) return stop("consent_required");
  const form = await page.evaluate(readForm);
  const n = nameFields(form);
  if (n.first) await fill(page, n.first, who.firstName || "");
  if (n.last) await fill(page, n.last, who.lastName || "");
  if (n.full && !n.first) await fill(page, n.full, `${who.firstName || ""} ${who.lastName || ""}`.trim());
  if (c.email) await fill(page, c.email, who.email);
  await fill(page, c.password, password);
  if (c.confirm) await fill(page, c.confirm, password);
  await submit(page);
  const after = classify(await page.evaluate(readForm));
  if (after.kind === "human_check" || after.kind === "email_verification") return stop(after.kind);
  if (after.kind === "signup" || after.kind === "password_only") return stop("signup_failed");
  return { ok: true };
}

/** Sign in with the account. Returns { ok: true } or { ok: false, reason }. */
export async function signIn(page, startUrl, creds) {
  await page.goto(startUrl, { waitUntil: "domcontentloaded" });
  let c = classify(await page.evaluate(readForm));
  if (c.kind !== "signin" && c.kind !== "email_only") { await follow(page, /sign ?in|log ?in/); c = classify(await page.evaluate(readForm)); }
  if (c.kind === "human_check" || c.kind === "email_verification") return stop(c.kind);
  if (c.kind === "email_only") { await fill(page, c.email, creds.email); await submit(page); c = classify(await page.evaluate(readForm)); }
  if (c.kind === "human_check" || c.kind === "email_verification") return stop(c.kind);
  if (c.kind !== "signin" && c.kind !== "password_only") return stop("signin_failed");
  if (c.email) await fill(page, c.email, creds.email);
  await fill(page, c.password, creds.password);
  await submit(page);
  const after = classify(await page.evaluate(readForm));
  if (after.kind === "human_check" || after.kind === "email_verification") return stop(after.kind);
  if (after.kind === "signin" || after.kind === "password_only") return stop("signin_failed");
  return { ok: true };
}

/**
 * The lease's account → a signed-in session (cookies, in memory), creating the account first when asked.
 * deps: { keys, openPage() → { page, close }, postAccount(report) }. Returns { storageState } or { stopped: reason }.
 */
export async function sessionFromAccount(lease, { keys, openPage, postAccount }) {
  const acct = lease.account;
  const adapter = ADAPTERS[acct.portalFamily];
  // Where to start: the adapter's entry point, else the origin the job's own form lives on (the gate packet's).
  const start = adapter?.start || lease.expectedOrigin || `https://${acct.originHost}/`;
  const aad = aadFor({ userId: lease.userId, portalFamily: acct.portalFamily });
  const who = { email: lease.autofillData?.email, firstName: lease.autofillData?.first_name, lastName: lease.autofillData?.last_name };
  if (!who.email) return { stopped: "signup_failed" };
  const { page, close } = await openPage();
  try {
    let creds;
    if (acct.create) {
      const password = generatePassword();
      const r = await signUp(page, start, who, password);
      if (!r.ok) { await postAccount({ remoteId: lease.id, accountId: acct.id, outcome: "stopped", reason: r.reason }); return { stopped: r.reason }; }
      const minted = keys.mint(acct.portalFamily);
      const ciphertext = seal({ publicKey: minted.publicKey, keyId: minted.keyId, plaintext: JSON.stringify({ email: who.email, password }), aad });
      const saved = await postAccount({ remoteId: lease.id, accountId: acct.id, outcome: "created", keyId: minted.keyId, ciphertext });
      if (saved?.status !== 200) { keys.destroy(minted.keyId); return { stopped: "signup_failed" }; }
      creds = { email: who.email, password };
    } else {
      try { creds = JSON.parse(keys.unseal({ keyId: acct.keyId, sealed: acct.ciphertext, aad })); }
      catch { return { stopped: "signin_failed" }; }
      const r = await signIn(page, start, creds);
      if (!r.ok) return { stopped: r.reason };
    }
    creds = null;
    // Every cookie the browser holds — the sign-in may live on the account host and the form on another.
    let cookies;
    try { cookies = (await (await page.createCDPSession()).send("Network.getAllCookies")).cookies; }
    catch { cookies = await page.cookies(); }
    return { storageState: { cookies } };
  } finally {
    await close().catch(() => {});
  }
}
