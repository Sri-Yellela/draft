import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { signUp, classify } from "../apply-worker/lib/accounts.js";
import { requestAccount, STOP_REASONS } from "../services/applyWorker.js";

// ⭐ 43s · what the attended Amazon run (D100 P5, 10-30) found, pinned. The page shapes are the ones Amazon served
// (passport.amazon.jobs → idprism), reduced to their fields and words; no personal data.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const f = (type, extra = {}) => ({ aw: String(Math.random()).slice(2, 8), tag: "input", type, name: "", autocomplete: "", label: "", required: false, checked: false, ...extra });
const page = (inputs, text = "", url = "https://passport.amazon.jobs/", links = []) => ({ inputs, text, captcha: false, url, links });

const START = page([f("email", { name: "email", label: "Email*" })], "Log in or create account Email* Continue");
const NEW_HERE = page([], "Create an account Looks like you're new here. Let's create an account using your email. Proceed to create account", "https://passport.amazon.jobs/unknownEmail", ["Proceed to create account"]);
const SIGNUP = page([f("email"), f("password", { autocomplete: "new-password" }), f("password", { autocomplete: "new-password" })], "Create account");
const EXISTING = page([f("text", { name: "username", autocomplete: "username" }), f("password", { name: "password", autocomplete: "current-password", label: "Password" })],
  "Enter your password Not you? Change user Password Forgot Password Continue", "https://atozpublic.idprism-auth.amazon.com/", ["Forgot Password"]);
const FORGOT = page([f("email", { name: "email" })], "Reset your password Email Send code");
const CODE = page([f("text", { name: "code", label: "Verification code" })], "Enter the code we sent");
const NEW_PW = page([f("password", { autocomplete: "new-password" }), f("password", { autocomplete: "new-password" })], "Create a new password");
const DONE = page([], "Your password has been reset. Welcome.", "https://account.amazon.jobs/en-US");
const BLOCKED = page([], "403 Forbidden", "https://atozpublic.api.cupid-na.idprism-auth.amazon.dev/");

/** A page that shows the queued forms in order: the page changes only on a press or a followed link, as a real one does. */
function fakePage(forms) {
  const typed = [];
  let i = 0;
  const next = () => { i = Math.min(i + 1, forms.length - 1); };
  return {
    typed,
    async goto() {}, async click() {}, async type(_sel, v) { typed.push(v); },
    keyboard: { async press() { next(); } },
    async waitForNavigation() {}, async waitForNetworkIdle() {}, async waitForSelector() {},
    async evaluate(fn, arg) {
      const src = String(fn);
      if (src.includes('querySelectorAll("input, select, textarea")')) return forms[i];
      if (arg !== undefined) {   // follow(page, re): a link or button whose words match
        const re = new RegExp(arg, "i");
        if ((forms[i].links || []).some(t => re.test(t))) { next(); return "clicked"; }
        return null;
      }
      next(); return true;       // submit's button press
    },
  };
}
const who = { email: "candidate@example.test", firstName: "Dana", lastName: "Example" };

test("43s · a NEW email: Amazon's 'Proceed to create account' (a button, no fields) is pressed, then the sign-up form", async () => {
  const p = fakePage([START, NEW_HERE, SIGNUP, DONE]);
  const r = await signUp(p, "https://account.amazon.jobs/en-US", who, "Gen3rated!pw", {});
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(p.typed.includes("candidate@example.test") && p.typed.includes("Gen3rated!pw"));
});

test("43s · a KNOWN email asks for its password: account_exists unless the user chose a reset", async () => {
  const r = await signUp(fakePage([START, EXISTING]), "https://account.amazon.jobs/en-US", who, "x", {});
  assert.deepEqual(r, { ok: false, reason: "account_exists" }, "never 'signup_failed', never a guessed password");
  assert.equal(STOP_REASONS.account_exists, "account_exists");
});

test("43s · resetExisting: Forgot password → the code ONLY from getCode → a new generated password", async () => {
  const p = fakePage([START, EXISTING, FORGOT, CODE, NEW_PW, DONE]);
  let asked = 0;
  const r = await signUp(p, "https://account.amazon.jobs/en-US", who, "N3w!generated", { resetExisting: true, getCode: async () => { asked++; return "481516"; } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.existing, true);
  assert.equal(asked, 1);
  assert.deepEqual(p.typed.filter(v => v === "N3w!generated").length, 2, "new password and its confirmation");
  assert.ok(p.typed.includes("481516"));
  // No code → the stop stands.
  const none = await signUp(fakePage([START, EXISTING, FORGOT, CODE]), "u", who, "x", { resetExisting: true, getCode: async () => null });
  assert.deepEqual(none, { ok: false, reason: "email_verification" });
});

test("43s · Amazon's 403 to the automated browser is a STOP (portal_blocked) — never worked around", async () => {
  assert.equal(classify(BLOCKED).kind, "blocked");
  assert.equal(classify(page([f("email")], "403 Forbidden is not the whole page")).kind, "email_only", "a field on the page: not a block page");
  const r = await signUp(fakePage([START, BLOCKED]), "u", who, "x", {});
  assert.deepEqual(r, { ok: false, reason: "portal_blocked" });
  assert.equal(STOP_REASONS.portal_blocked, "portal_blocked");
  const src = read("apply-worker/lib/accounts.js") + read("apply-worker/worker.js");
  assert.doesNotMatch(src, /setUserAgent|userAgent\s*:|stealth/i, "the worker does not disguise its browser");
});

test("43s · a single-page sign-in is read after it settles (Amazon's form renders after domcontentloaded)", () => {
  const src = read("apply-worker/lib/accounts.js");
  const signUpSrc = src.slice(at(src, "export async function signUp", 0, "signUp"));
  assert.ok(at(signUpSrc, "await settle(page);", 0, "signUp settles") < at(signUpSrc, "readForm", 0, "signUp reads"));
  assert.match(src, /async function submit[\s\S]*?await settle\(page\);/);
});

test("43s · a portal outside v1's providers that the user connected goes to the WORKER, not a review hold", () => {
  const src = read("routes/apply.js");
  const from = at(src, "const detectedProvider = detectPlatformFromUrl(jobUrl);", 0, "the provider gate");
  const gate = src.slice(from, at(src, "not supported for full-auto in v1", from, "the review hold"));
  assert.match(gate, /sessionForHost\(db, userId, portalHost\) \|\| accountForHost\(db, userId, portalHost\)/);
  assert.match(gate, /setJobStatus\("held_gate", "login_required"/);
  assert.match(gate, /parkEarlyHandoff\("login_required"\)/, "the packet is made and the remote run queued as at a sign-in wall");
});

test("43s · migration 182: resetExisting is the user's explicit choice, stored per account, carried by the lease", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'dana', 'x')").run();
  const a = requestAccount(db, 1, { portalFamily: "amazon", originHost: "amazon.jobs", consent: true });
  assert.equal(db.prepare("SELECT reset_existing FROM portal_accounts WHERE id = ?").pluck().get(a.id), 0, "off unless asked");
  requestAccount(db, 1, { portalFamily: "amazon", originHost: "amazon.jobs", consent: true, resetExisting: true });
  assert.equal(db.prepare("SELECT reset_existing FROM portal_accounts WHERE id = ?").pluck().get(a.id), 1);
  assert.match(read("services/applyWorker.js"), /resetExisting: account\.reset_existing === 1/);
  assert.match(read("apply-worker/lib/accounts.js"), /resetExisting: acct\.resetExisting === true/);
});
