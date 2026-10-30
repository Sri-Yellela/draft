import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import portalRoutes, { createApplyWorkerRouter } from "../routes/applyWorker.js";
import { enqueueRemoteRun, requestAccount, listAccounts } from "../services/applyWorker.js";
import { createKeyStore, aadFor } from "../apply-worker/lib/keys.js";
import { classify, generatePassword, signUp, signIn, ADAPTERS } from "../apply-worker/lib/accounts.js";
import { createWorker } from "../apply-worker/worker.js";
import { resolveBrowserExecutable, launchBrowser } from "../services/browserLauncher.js";

// ⭐ D100 (a), owner 10-30: "yes we are creating portal accounts … test it on amazon." The worker creates the account
// with the user's own email and a password it generates and seals; draft holds ciphertext only. A terms box, a human
// check and an emailed code are NEVER answered — the run stops, Needs you. Synthetic people; a LOCAL fixture portal.

// ── pure ─────────────────────────────────────────────────────────────────────────────────────

test("D100 (a) · a generated password: 20 characters, every class, never the same twice", () => {
  const a = generatePassword(), b = generatePassword();
  assert.equal(a.length, 20);
  assert.match(a, /[A-Z]/); assert.match(a, /[a-z]/); assert.match(a, /[0-9]/); assert.match(a, /[!#%+\-=?@^_]/);
  assert.notEqual(a, b);
});

test("D100 (a) · forms are classified by what they are; a human check or a code is never a form to fill", () => {
  const f = (inputs, extra = {}) => classify({ inputs, text: "", captcha: false, ...extra });
  const email = { aw: "0", type: "email", name: "email", autocomplete: "", label: "Email" };
  const pw = (n) => ({ aw: String(n), type: "password", name: `p${n}`, autocomplete: "", label: "Password" });
  assert.equal(f([email, pw(1), pw(2)]).kind, "signup");
  assert.equal(f([email, pw(1)]).kind, "signin");
  assert.equal(f([email]).kind, "email_only");
  assert.equal(f([email, pw(1)], { captcha: true }).kind, "human_check");
  assert.equal(f([email], { text: "Type the characters you see" }).kind, "human_check");
  assert.equal(f([{ aw: "0", type: "text", name: "otp", autocomplete: "one-time-code", label: "Enter the verification code" }]).kind, "email_verification");
  const consent = { aw: "3", type: "checkbox", name: "tos", autocomplete: "", label: "I agree to the Terms", required: true };
  assert.deepEqual(f([email, pw(1), pw(2), consent]).consent.map(c => c.name), ["tos"]);
  assert.equal(ADAPTERS.amazon.verified, false, "Amazon's entry point is confirmed by the owner's run, not assumed");
});

test("D100 (a) · draft's side: consent first, one account per portal, never the ciphertext in a read", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x')").run();
  assert.throws(() => requestAccount(db, 1, { portalFamily: "amazon", originHost: "amazon.jobs", consent: false }), /Consent/);
  const a = requestAccount(db, 1, { portalFamily: "amazon", originHost: "amazon.jobs", consent: true });
  assert.equal(requestAccount(db, 1, { portalFamily: "amazon", originHost: "amazon.jobs", consent: true }).id, a.id);
  db.prepare("UPDATE portal_accounts SET ciphertext='v1.secret' WHERE id=?").run(a.id);
  assert.doesNotMatch(JSON.stringify(listAccounts(db, 1)), /v1\.secret/);
  assert.equal(listAccounts(db, 1)[0].status, "requested");
});

// ── a real Chrome on a local fixture portal ──────────────────────────────────────────────────

function fixturePortal() {
  const users = new Map();
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  const page = (body) => `<!doctype html><html><body>${body}</body></html>`;
  app.get("/", (_q, r) => r.send(page(`<a href="/signup">Create account</a> <a href="/login">Sign in</a>`)));
  app.get("/signup", (q, r) => r.send(page(`<form method="post" action="/signup">
    <label for="fn">First name</label><input id="fn" name="first">
    <label for="ln">Last name</label><input id="ln" name="last">
    <label for="em">Email</label><input id="em" type="email" name="email">
    <label for="p1">Password</label><input id="p1" type="password" name="p1">
    <label for="p2">Confirm password</label><input id="p2" type="password" name="p2">
    ${q.query.tos ? `<label><input type="checkbox" name="tos" required> I agree to the Terms of Use</label>` : ""}
    <button type="submit">Create account</button></form>`)));
  app.post("/signup", (q, r) => {
    if (!q.body.email || q.body.p1 !== q.body.p2) return r.redirect("/signup");
    users.set(q.body.email, { password: q.body.p1, first: q.body.first });
    r.setHeader("set-cookie", `sid=${crypto.randomBytes(8).toString("hex")}; Path=/; HttpOnly`);
    r.redirect("/home");
  });
  app.get("/login", (_q, r) => r.send(page(`<form method="post" action="/login">
    <label for="em">Email</label><input id="em" type="email" name="email">
    <label for="pw">Password</label><input id="pw" type="password" name="pw"><button type="submit">Sign in</button></form>`)));
  app.post("/login", (q, r) => {
    if (users.get(q.body.email)?.password !== q.body.pw) return r.redirect("/login");
    r.setHeader("set-cookie", "sid=signed-in; Path=/; HttpOnly");
    r.redirect("/home");
  });
  app.get("/home", (_q, r) => r.send(page(`<h1>Welcome</h1>`)));
  app.get("/captcha", (_q, r) => r.send(page(`<form><input type="email" name="email"><div class="g-recaptcha" data-sitekey="x"></div></form>`)));
  app.get("/verify", (_q, r) => r.send(page(`<form><label for="c">Enter the verification code we emailed you</label><input id="c" name="code"></form>`)));
  const server = app.listen(0);
  return { base: `http://127.0.0.1:${server.address().port}`, users, stop: () => server.close() };
}

const chrome = await resolveBrowserExecutable().catch(() => null);
const skip = chrome ? false : "no Chrome on this machine";

test("D100 (a) · in a real Chrome: sign up, sign in; a terms box, a CAPTCHA and an emailed code each STOP the run", { skip }, async () => {
  const portal = fixturePortal();
  const browser = await launchBrowser({ headless: "new", mode: "auto" });
  const who = { email: "dana@example.test", firstName: "Dana", lastName: "Example" };
  try {
    const page = await browser.newPage();
    const pw = generatePassword();
    assert.deepEqual(await signUp(page, portal.base + "/", who, pw), { ok: true }, "followed Create account, filled, submitted");
    assert.equal(portal.users.get(who.email).password, pw);
    assert.equal(portal.users.get(who.email).first, "Dana");
    assert.ok((await page.cookies()).some(c => c.name === "sid"));

    const p2 = await browser.newPage();
    assert.deepEqual(await signIn(p2, portal.base + "/login", { email: who.email, password: pw }), { ok: true });
    assert.deepEqual(await signIn(await browser.newPage(), portal.base + "/login", { email: who.email, password: "wrong-Password-1!" }),
      { ok: false, reason: "signin_failed" });

    // ⛔ D100: never ticked, never answered
    assert.deepEqual(await signUp(await browser.newPage(), portal.base + "/signup?tos=1", { ...who, email: "eli@example.test" }, pw),
      { ok: false, reason: "consent_required" });
    assert.equal(portal.users.has("eli@example.test"), false, "nothing was submitted");
    assert.deepEqual(await signIn(await browser.newPage(), portal.base + "/captcha", { email: who.email, password: pw }),
      { ok: false, reason: "human_check" });
    assert.deepEqual(await signIn(await browser.newPage(), portal.base + "/verify", { email: who.email, password: pw }),
      { ok: false, reason: "email_verification" });
  } finally { await browser.close(); portal.stop(); }
});

test("D100 (a) · end to end: the worker CREATES the account (draft stores ciphertext only), applies, then SIGNS IN for the next job", { skip }, async () => {
  const portal = fixturePortal();
  const host = new URL(portal.base).hostname; // 127.0.0.1
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x')").run();
  const TOKEN = "a".repeat(40);
  const keys = createKeyStore({ dir: fs.mkdtempSync(path.join(os.tmpdir(), "awacct-")), master: crypto.randomBytes(32) });
  const app = express();
  app.use("/api/worker", createApplyWorkerRouter(db, { env: { APPLY_WORKER_TOKEN: TOKEN },
    payloadFor: () => ({ email: "dana@example.test", first_name: "Dana", last_name: "Example" }) }));
  app.use(express.json());
  app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
  portalRoutes(app, db, (_q, _r, n) => n(), { client: { destroyKey: async (k) => keys.destroy(k), mintKey: async (f) => keys.mint(f) } });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser({ headless: "new", mode: "auto" });
  try {
    // the user's consent for this portal (the fixture stands in for Amazon; its start page is its root)
    const consent = await fetch(base + "/api/portals/accounts", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ portalFamily: "fixtureportal", originHost: host, consent: true }) });
    assert.equal(consent.status, 201);
    const gated = (job) => {
      const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',1,'required')").run().lastInsertRowid;
      const rj = Number(db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code) VALUES (?,1,?,'held_gate','login_required')").run(run, job).lastInsertRowid);
      const pk = Number(db.prepare(`INSERT INTO apply_gate_packets (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason, answers_json, token_hash, expires_at)
        VALUES (1,?,?,?,?,?,'login_required','{"answers":[]}',?,0)`).run(run, rj, job, `${portal.base}/apply/${job}`, portal.base, `h-${job}`).lastInsertRowid);
      return enqueueRemoteRun(db, { userId: 1, runJobId: rj, packetId: pk, applyUrl: `${portal.base}/apply/${job}`, approvalMode: "required" });
    };
    assert.ok(gated("acct-1"), "a gated job on a portal with account consent goes to the worker");

    const seen = [];
    const autoApply = async (_url, _data, opts) => {
      seen.push(opts.storageState.cookies.map(c => `${c.name}=${c.value.length}`));
      return { status: "preview_ready", answers: [{ field_id: "fn", label: "First name", value: "Dana", provenance: "handler_exact" }] };
    };
    // Each run its own context — nothing carried between runs, as the worker's fresh browser per run.
    const openPage = async () => { const ctx = await browser.createBrowserContext(); return { page: await ctx.newPage(), close: () => ctx.close() }; };
    const worker = createWorker({ base, token: TOKEN, keys, autoApply, openPage, workerId: "w-acct", log: () => {} });
    const t1 = await worker.tick();
    assert.equal(t1.report.outcome, "filled", JSON.stringify(t1.report));
    const acct = db.prepare("SELECT * FROM portal_accounts").get();
    assert.equal(acct.status, "created");
    const pw = portal.users.get("dana@example.test").password;
    assert.ok(pw, "the account exists at the portal, with the user's own email");
    assert.doesNotMatch(JSON.stringify(db.prepare("SELECT * FROM portal_accounts").all()), new RegExp(pw.replace(/[^A-Za-z0-9]/g, "")),
      "draft never holds the password");
    assert.equal(JSON.parse(keys.unseal({ keyId: acct.key_id, sealed: acct.ciphertext, aad: aadFor({ userId: 1, portalFamily: "fixtureportal" }) })).password, pw,
      "only the worker's key opens it");
    assert.ok(seen[0].some(c => c.startsWith("sid=")), "the signed-in cookies reached the engine");

    // the next job on the same portal signs IN with the stored account — no second account
    assert.ok(gated("acct-2"));
    const t2 = await worker.tick();
    assert.equal(t2.report.outcome, "filled");
    assert.equal(portal.users.size, 1);
    assert.ok(seen[1].includes("sid=9"), "signed in (the fixture's sign-in cookie, sid=signed-in) — not a cookie left over");

    // Remove: the key is destroyed; the ciphertext is gone from draft; the account at the portal stays the user's
    assert.equal((await (await fetch(`${base}/api/portals/accounts/${acct.id}`, { method: "DELETE" })).json()).keyDestroyed, true);
    assert.equal(db.prepare("SELECT ciphertext FROM portal_accounts").pluck().get(), null);
    assert.throws(() => keys.unseal({ keyId: acct.key_id, sealed: acct.ciphertext, aad: aadFor({ userId: 1, portalFamily: "fixtureportal" }) }), /destroyed/);
  } finally { await browser.close(); server.close(); portal.stop(); }
});
