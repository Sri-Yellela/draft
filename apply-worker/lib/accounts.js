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
  // ⭐ 43s (the Amazon run): the portal REFUSED the automated browser ("403 Forbidden" from Amazon's sign-in service).
  // A stop like a human check — never worked around (no disguised browser); the user's own sign-in (connect) is the path.
  if (!form.inputs.length && /^\s*(403 forbidden|access denied|request blocked|forbidden)\b/i.test(form.text || "")) return { kind: "blocked" };
  if (code) return { kind: "email_verification", codeField: code };
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

// ⭐ 43s (the Amazon run): a portal's sign-in is often a single-page app — at domcontentloaded passport.amazon.jobs has
// NO fields yet, so the first read saw nothing and every Amazon sign-up stopped. Wait for the network to go quiet (short)
// and for a field or a button to exist before a page is read.
async function settle(page) {
  await page.waitForNetworkIdle?.({ idleTime: 500, timeout: 8_000 }).catch(() => {});
  await page.waitForSelector('input:not([type="hidden"]), button', { visible: true, timeout: 8_000 }).catch(() => {});
}

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
  await settle(page);
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
  if (href) await settle(page);
  return !!href;
}

const stop = (reason) => ({ ok: false, reason });

// A page that still shows no field after it settled is read once more, after a pause — a redirect chain across hosts
// (passport.amazon.jobs → idprism) can land before its form renders.
async function readSettled(page) {
  let form = await page.evaluate(readForm);
  for (let i = 0; i < 3 && !form.inputs.length; i++) {
    await new Promise(r => setTimeout(r, 2_000));
    await settle(page);
    form = await page.evaluate(readForm);
  }
  return form;
}

// ⭐ 43s (the Amazon run): after the email step, a portal that KNOWS the email asks for its existing password ("Enter
// your password" · a current-password field · "Forgot password") — that is an existing account, not a sign-up.
const EXISTING = /(enter your password|forgot (your )?password|welcome back)/i;
function isExistingAccount(form, c) {
  if (c.kind !== "signin" && c.kind !== "password_only") return false;
  return form.inputs.some(f => f.type === "password" && f.autocomplete === "current-password") || EXISTING.test(form.text);
}
// "Looks like you're new here … Proceed to create account" — a button, no inputs (passport.amazon.jobs/unknownEmail).
const PROCEED = /proceed to create (an )?account|create (an |your )?account|continue to create/;
const step = (name, form) => console.log(`[apply-worker] account step: ${name} — ${new URL(form.url).hostname}${form.inputs.length ? "" : ` · page: "${String(form.text || "").replace(/\s+/g, " ").slice(0, 120)}"`}`);

/**
 * ⭐ 43s (owner, the Amazon run): "try to log into it, try resetting the password". When the email already has an account
 * and the user chose `resetExisting`, the portal's own Forgot password sets a NEW generated password: the code the portal
 * emails comes only through `getCode` (the user's opt-in, D103 P5), never typed by guess. Returns { ok } or a stop.
 */
export async function resetPassword(page, who, password, getCode) {
  if (!(await follow(page, /forgot (your )?password|reset (your )?password|trouble signing in/))) return stop("reset_not_found");
  let form = await page.evaluate(readForm); step("forgot password", form);
  let c = classify(form);
  if (c.kind === "human_check") return stop(c.kind);
  if (c.kind === "email_only") { await fill(page, c.email, who.email); await submit(page); form = await page.evaluate(readForm); step("reset email sent", form); c = classify(form); }
  else if (c.kind === "none") { await submit(page); form = await page.evaluate(readForm); step("reset requested", form); c = classify(form); }
  if (c.kind === "human_check") return stop(c.kind);
  if (c.kind === "email_verification") {
    const code = getCode ? await getCode() : null;
    if (!code) return stop("email_verification");
    await fill(page, c.codeField, code);
    await submit(page);
    form = await page.evaluate(readForm); step("reset code entered", form); c = classify(form);
  }
  if (c.kind === "email_verification") return stop("email_verification");
  const pw = form.inputs.filter(f => f.type === "password");
  if (!pw.length) return stop("reset_failed");
  for (const f of pw) await fill(page, f, password);
  await submit(page);
  form = await page.evaluate(readForm); step("new password set", form);
  const after = classify(form);
  if (after.kind === "human_check" || after.kind === "email_verification") return stop(after.kind);
  if (after.kind === "blocked") return stop("portal_blocked");
  if (after.kind === "signin") return { ok: true, signInNext: true };
  if (form.inputs.some(f => f.type === "password")) return stop("reset_failed");
  return { ok: true };
}

/**
 * ⭐ D103 P5: a code the portal emailed, typed in — ONLY when `getCode` gives one (the user opted in for this portal and
 * the code arrived in their draft inbox within 10 minutes; services/inbox.js codeForWorker). No code → the stop stands.
 */
export async function enterCode(page, getCode) {
  const c = classify(await page.evaluate(readForm));
  if (c.kind !== "email_verification") return { ok: true };
  const code = getCode ? await getCode() : null;
  if (!code) return stop("email_verification");
  await fill(page, c.codeField, code);
  await submit(page);
  const after = classify(await page.evaluate(readForm));
  if (after.kind === "human_check") return stop("human_check");
  if (after.kind === "email_verification") return stop("email_verification");
  return { ok: true };
}

/**
 * Create the account. `who` = { email, firstName, lastName }. Returns { ok: true } (signed in) or { ok: false, reason }.
 * ⛔ A required consent box stops it — never ticked. A human check or an emailed code stops it — never answered.
 */
export async function signUp(page, startUrl, who, password, { tickConsent = false, resetExisting = false, getCode = null } = {}) {
  await page.goto(startUrl, { waitUntil: "domcontentloaded" });
  await settle(page);
  let first = await page.evaluate(readForm);
  let c = classify(first);
  step(`start (${c.kind}, ${first.inputs.length} field(s))`, first);
  if (c.kind !== "signup") { await follow(page, /create (an )?account|sign ?up|register|new user/); first = await page.evaluate(readForm); c = classify(first); step(`after follow (${c.kind})`, first); }
  if (c.kind === "human_check" || c.kind === "email_verification") return stop(c.kind);
  if (c.kind === "blocked") return stop("portal_blocked");
  // Some portals ask for the email first, then the passwords.
  if (c.kind === "email_only") {
    await fill(page, c.email, who.email); await submit(page);
    let form = await readSettled(page); c = classify(form);
    step(`email entered (${c.kind}; ${form.inputs.map(f => f.type).join(",") || "no fields"})`, form);
    if (c.kind === "blocked") return stop("portal_blocked");
    // A new email: a "Proceed to create account" button and no inputs.
    if (c.kind === "none" && await follow(page, PROCEED)) { form = await page.evaluate(readForm); step("proceed to create", form); c = classify(form); }
    // A known email: its password is asked for — an EXISTING account.
    if (isExistingAccount(form, c)) {
      if (!resetExisting) return stop("account_exists");
      const r = await resetPassword(page, who, password, getCode);
      if (!r.ok) return r;
      return { ok: true, existing: true, signInNext: !!r.signInNext };
    }
  }
  if (c.kind === "human_check" || c.kind === "email_verification") return stop(c.kind);
  if (c.kind === "blocked") return stop("portal_blocked");
  if (c.kind !== "signup" && c.kind !== "password_only") return stop("signup_failed");
  // ⭐ 10-30 (owner): a required terms / privacy box is ticked ONLY when the user chose it (Auto settings agreeToTerms →
  // the lease's rules.tickConsent) — never a signature or an attestation of truth. Off: the run stops, Needs you.
  const mustTick = (c.consent || []).filter(f => f.required && !f.checked);
  if (mustTick.length && !tickConsent) return stop("consent_required");
  if (mustTick.some(f => /signature|e-?sign|certif|attest|declare|true and (?:correct|complete)/i.test(`${f.label} ${f.name}`))) return stop("consent_required");
  for (const f of mustTick) await page.click(`[data-aw="${f.aw}"]`);
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
  if (after.kind === "blocked") return stop("portal_blocked");
  if (after.kind === "signup" || after.kind === "password_only") return stop("signup_failed");
  return { ok: true };
}

/** Sign in with the account. Returns { ok: true } or { ok: false, reason }. */
export async function signIn(page, startUrl, creds) {
  await page.goto(startUrl, { waitUntil: "domcontentloaded" });
  await settle(page);
  let c = classify(await page.evaluate(readForm));
  if (c.kind !== "signin" && c.kind !== "email_only") { await follow(page, /sign ?in|log ?in/); c = classify(await page.evaluate(readForm)); }
  if (c.kind === "human_check" || c.kind === "email_verification") return stop(c.kind);
  if (c.kind === "blocked") return stop("portal_blocked");
  if (c.kind === "email_only") { await fill(page, c.email, creds.email); await submit(page); c = classify(await page.evaluate(readForm)); }
  if (c.kind === "human_check" || c.kind === "email_verification") return stop(c.kind);
  if (c.kind === "blocked") return stop("portal_blocked");
  if (c.kind !== "signin" && c.kind !== "password_only") return stop("signin_failed");
  if (c.email) await fill(page, c.email, creds.email);
  await fill(page, c.password, creds.password);
  await submit(page);
  const after = classify(await page.evaluate(readForm));
  if (after.kind === "human_check" || after.kind === "email_verification") return stop(after.kind);
  if (after.kind === "blocked") return stop("portal_blocked");
  if (after.kind === "signin" || after.kind === "password_only") return stop("signin_failed");
  return { ok: true };
}

/**
 * The lease's account → a signed-in session (cookies, in memory), creating the account first when asked.
 * deps: { keys, openPage() → { page, close }, postAccount(report) }. Returns { storageState } or { stopped: reason }.
 */
export async function sessionFromAccount(lease, { keys, openPage, postAccount, getCode = null }) {
  const acct = lease.account;
  const adapter = ADAPTERS[acct.portalFamily];
  // Where to start: the adapter's entry point, else the origin the job's own form lives on (the gate packet's).
  const start = adapter?.start || lease.expectedOrigin || `https://${acct.originHost}/`;
  const aad = aadFor({ userId: lease.userId, portalFamily: acct.portalFamily });
  const who = { email: lease.autofillData?.email, firstName: lease.autofillData?.first_name, lastName: lease.autofillData?.last_name };
  // No email to make the account with (the profile has none, or the payload could not be built) — said as itself.
  if (!who.email) { console.log("[apply-worker] account step: no email in the lease's profile payload"); return { stopped: "no_profile_email" }; }
  const { page, close } = await openPage();
  try {
    let creds;
    if (acct.create) {
      const password = generatePassword();
      let r = await signUp(page, start, who, password, { tickConsent: lease.rules?.tickConsent === true,
        resetExisting: acct.resetExisting === true, getCode });
      if (!r.ok && r.reason === "email_verification" && getCode) r = await enterCode(page, getCode);
      if (!r.ok) { await postAccount({ remoteId: lease.id, accountId: acct.id, outcome: "stopped", reason: r.reason }); return { stopped: r.reason }; }
      if (r.signInNext) { const s = await signIn(page, start, { email: who.email, password }); if (!s.ok) return { stopped: s.reason }; }
      const minted = keys.mint(acct.portalFamily);
      const ciphertext = seal({ publicKey: minted.publicKey, keyId: minted.keyId, plaintext: JSON.stringify({ email: who.email, password }), aad });
      const saved = await postAccount({ remoteId: lease.id, accountId: acct.id, outcome: "created", keyId: minted.keyId, ciphertext });
      if (saved?.status !== 200) { keys.destroy(minted.keyId); return { stopped: "signup_failed" }; }
      creds = { email: who.email, password };
    } else {
      try { creds = JSON.parse(keys.unseal({ keyId: acct.keyId, sealed: acct.ciphertext, aad })); }
      catch { return { stopped: "signin_failed" }; }
      let r = await signIn(page, start, creds);
      if (!r.ok && r.reason === "email_verification" && getCode) r = await enterCode(page, getCode);
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
