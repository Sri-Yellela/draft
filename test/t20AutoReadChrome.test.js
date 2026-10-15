// ⭐ T20 · IN A REAL CHROME — consent reads the tab ALREADY OPEN, with no press; a new tab reads on load; a single-page
// step change reads ONCE; the embedded ATS frame of a company's own careers page is read; the kill switch stops it; and
// a grant Chrome never gives reads nothing.
//
// The real extension (test build), the real popup (chrome.action.openPopup), real clicks (trusted input — the user
// gesture chrome.permissions.request needs), an HTTPS fixture serving three hosts (a throwaway self-signed certificate
// made with openssl; Chrome resolves the hosts to this machine — t11EmbeddedChrome's pattern).
//
// WHAT IS REAL AND WHAT STANDS IN (said plainly):
//   · (a) and (b): a headless Chrome cannot answer Chrome's own permission prompt, so the TEST BUILD lists the hosts in
//     host_permissions (the harness's convention for a grant): the request resolves with no prompt and the popup lives
//     to send its consent. Everything after — the consent handler, the registration, the injection into the open tab,
//     the watcher, the pass, the read, the dock — is the shipped code.
//   · (c) is the REAL request with NO grant: Chrome opens its prompt (invisible, headless), the popup closes at once —
//     the measured cause of T20 — and nobody answers. The click is recorded (AUTO_READ_PENDING reached the worker before
//     the popup died) and nothing is turned on or read.
//   · The real prompt ANSWERED (Allow and Deny) was walked in a headed Chrome through Windows UI Automation —
//     scripts/t20RealPromptWalk.mjs (Windows only, opens a visible window; not part of `npm test`).
// Skips, with its reason, where there is no Chrome or no openssl. Synthetic people and companies only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { findChrome, launchExtensionBrowser, waitUntil, sleep, BUSY_MS } from "../test-support/extensionBrowser.mjs";
import { OPTIONAL_ORIGINS } from "../extension/autoRead.js";

const chrome = await findChrome();
const opensslSkip = (() => { try { execFileSync("openssl", ["version"], { stdio: "ignore" }); return false; } catch { return "no openssl to make the fixture's test certificate"; } })();
const skip = chrome.skip || opensslSkip || false;

const CAREERS = "careers.acme.test";
const GH_HOST = "job-boards.greenhouse.io";
const WD_HOST = "acme.wd1.myworkdayjobs.com";
const GH_APPLY = `https://${GH_HOST}/acme/jobs/8198280`;
const GH_APPLY_2 = `https://${GH_HOST}/acme/jobs/8198281`;
const GH_APPLY_3 = `https://${GH_HOST}/acme/jobs/8198282`;
const WD_APPLY = `https://${WD_HOST}/en-US/Acme/job/Remote/Software-Engineer_R100/apply/applyManually`;
const CAREERS_APPLY = `https://${CAREERS}/jobs/search?gh_jid=8198280`;
const FRAME = `https://${GH_HOST}/embed/job_app?for=acme&token=8198280`;
/** "No step change has happened": the watcher's 800 ms trailing debounce (3 s at most) and a pass, with room. */
const QUIET_MS = 5000;

const FORM = `<form id="application_form" action="/submit" method="post">
  <label for="first_name">First Name *</label><input id="first_name" type="text">
  <label for="last_name">Last Name *</label><input id="last_name" type="text">
  <label for="email">Email *</label><input id="email" type="email">
  <label for="phone">Phone</label><input id="phone" type="tel">
</form>`;
// A Workday-shaped single-page application: the step changes WITHOUT the address changing, in a burst of re-renders.
const WD_BODY = `<div data-automation-id="applyFlowPage">
  <div data-automation-id="progressBarActiveStep" id="active">My Information</div>
  <div id="step"></div>
</div>
<script>
  const STEPS = { "My Information": ["Legal First Name", "Legal Last Name", "Email Address"],
    "My Experience": ["Job Title", "Company", "School or University", "Degree"],
    "Application Questions": ["Are you legally able to work here?", "How did you hear about us?"] };
  const draw = (name, k = STEPS[name].length) => {
    document.getElementById("active").textContent = name;
    document.getElementById("step").innerHTML = STEPS[name].slice(0, k).map((l, i) => '<label for="q' + i + '">' + l + '</label><input id="q' + i + '" type="text">').join("");
  };
  draw("My Information");
  // a step change: ten re-renders in one burst, the step's questions arriving one by one (as a single-page portal
  // renders them) — every intermediate render is a DIFFERENT signature, so only the debounce makes it one read
  window.__go = (name) => { for (let i = 0; i < 10; i++) setTimeout(() => draw(name, i + 1), i * 40); };
  // re-renders that change nothing the watcher signs (the same step, the same controls)
  window.__rerender = () => { const n = document.getElementById("active").textContent; for (let i = 0; i < 10; i++) setTimeout(() => draw(n), i * 40); };
</script>`;
const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;

async function startFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "t20-cert-"));
  const key = path.join(dir, "key.pem"), cert = path.join(dir, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1",
    "-subj", "/CN=t20-fixture", "-addext", `subjectAltName=DNS:${CAREERS},DNS:${GH_HOST},DNS:${WD_HOST}`], { stdio: "ignore" });
  const posts = [];
  const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (req, res) => {
    const host = String(req.headers.host || "").split(":")[0];
    if (req.method === "POST") { posts.push(`${host}${req.url}`); res.writeHead(200); return res.end("recorded"); }
    const html = (body) => { res.writeHead(200, { "content-type": "text/html" }); res.end(body); };
    if (host === GH_HOST && req.url.startsWith("/embed/job_app")) return html(page("Apply", FORM));
    if (host === GH_HOST && req.url.startsWith("/acme/jobs/")) return html(page("Software Engineer — Acme", `<h1>Software Engineer</h1>${FORM}`));
    if (host === WD_HOST && req.url.startsWith("/en-US/Acme/")) return html(page("Apply — Acme", WD_BODY));
    if (host === CAREERS && req.url.startsWith("/jobs/search")) {
      return html(page("Software Engineer — Acme careers", `<h1>Software Engineer</h1>
        <form id="newsletter"><label for="news">Email me new jobs</label><input id="news" type="email"></form>
        <iframe id="grnhse_iframe" src="${FRAME}" width="100%" height="700" style="border:0"></iframe>`));
    }
    res.writeHead(404); res.end("not found");
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  return { port: server.address().port, posts, stop: () => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
const rules = (fx) => [CAREERS, GH_HOST, WD_HOST].map(h => `MAP ${h} 127.0.0.1:${fx.port}`);

async function openPopup(h) {
  const opened = await h.control.evaluate(() => chrome.action.openPopup().then(() => "ok", e => `ERR ${e.message}`));
  if (opened !== "ok") return { popup: null, why: opened };
  const t = await h.browser.waitForTarget(x => x.url().endsWith("/popup.html"), { timeout: 8000 }).catch(() => null);
  return { popup: t ? await t.asPage() : null, why: t ? null : "no popup target", target: t };
}
const settings = async (h) => (await h.storage.local()).autoRead || {};
const registered = (h) => h.control.evaluate(() => chrome.scripting.getRegisteredContentScripts());
const readsOf = async (h, host) => ((await settings(h)).reads || []).filter(r => r.host === host);
/** The dock in a page's top frame: present? collapsed? (⭐ T17: a dock opened by the status line alone starts collapsed.) */
const dockOf = (p) => p.evaluate(() => { const d = document.getElementById("rm-draft-dock"); return d ? { collapsed: d.dataset.collapsed === "true" } : null; });

test("⭐ (a) consent reads the tabs ALREADY OPEN with no press · a new tab reads on load · a single-page step change reads ONCE · the kill switch stops it",
  { skip, timeout: 300000 }, async (t) => {
    const fx = await startFixture();
    t.after(() => fx.stop());
    const h = await launchExtensionBrowser({ insecureCerts: true, resolverRules: rules(fx), hosts: [...OPTIONAL_ORIGINS] });
    t.after(() => h.close());

    // 1 · two application pages are OPEN before the consent: Greenhouse (the active tab) and a Workday step (another tab)
    const wd = await h.browser.newPage();
    await wd.goto(WD_APPLY, { waitUntil: "domcontentloaded" });
    await h.open(GH_APPLY, { settle: 1500 });
    assert.deepEqual((await settings(h)).reads || [], [], "nothing read before consent");
    assert.equal((await registered(h)).length, 0, "nothing registered before consent");

    // 2 · the card's click, in the real popup
    const { popup, why } = await openPopup(h);
    assert.ok(popup, `the real popup opened: ${why}`);
    await popup.waitForSelector("#auto-card:not([hidden])", { timeout: 10000 });
    await popup.click("#auto-allow");
    assert.ok(await waitUntil(async () => (await settings(h)).consent2?.at, 15000), "the consent is recorded");
    await popup.close().catch(() => {});

    // 3 · ⭐ THE DEFECT: the open tabs are read with NO reload and NO press
    const gh = await waitUntil(async () => (await readsOf(h, GH_HOST))[0] || null, BUSY_MS);
    assert.ok(gh, "the Greenhouse tab open at the consent was read — no reload, no press");
    assert.ok(gh.total >= 4 && gh.labels.some(l => /First Name/.test(l)), JSON.stringify(gh));
    const wd1 = await waitUntil(async () => (await readsOf(h, WD_HOST))[0] || null, BUSY_MS);
    assert.ok(wd1, "the Workday tab open in the background was read too");
    assert.equal(wd1.step, "My Information");
    // ⭐ T17 (owner-approved): a read on its own never draws an EXPANDED dock
    const dock = await waitUntil(() => dockOf(h.page), 15000);
    assert.deepEqual(dock, { collapsed: true }, "the read's line is the dock's slim bar, collapsed");

    // 4 · a NEW tab reads on load (the registration)
    const ghBefore = (await readsOf(h, GH_HOST)).length;
    const fresh = await h.browser.newPage();
    await fresh.goto(GH_APPLY_2, { waitUntil: "domcontentloaded" });
    assert.ok(await waitUntil(async () => (await readsOf(h, GH_HOST)).length > ghBefore, BUSY_MS), "a new tab is read on load");
    await fresh.close();

    // 5 · a single-page STEP CHANGE (no new address, ten re-renders) → exactly ONE read
    await wd.evaluate(() => window.__go("My Experience"));
    const step2 = await waitUntil(async () => (await readsOf(h, WD_HOST)).find(r => r.step === "My Experience") || null, BUSY_MS);
    assert.ok(step2, "the new step is read");
    assert.ok(step2.labels.some(l => /Job Title/.test(l)), JSON.stringify(step2.labels));
    assert.equal(step2.total, 4, "read once the burst settled — the whole step, not a half-drawn one");
    await sleep(QUIET_MS);
    assert.equal((await readsOf(h, WD_HOST)).length, 2, "ONE read for the step change — not one per re-render, not a loop");
    // re-renders that change no step: no read at all
    await wd.evaluate(() => window.__rerender());
    await sleep(QUIET_MS);
    assert.equal((await readsOf(h, WD_HOST)).length, 2, "a re-render without a step change reads nothing");

    // 6 · ⛔ the kill switch: the watchers already in the tabs are ignored, nothing registers, a new tab is not read
    const killed = await h.send({ type: "AUTO_READ_KILL" });
    assert.equal(killed?.ok, true);
    assert.equal((await registered(h)).length, 0, "every watcher unregistered");
    await wd.evaluate(() => window.__go("Application Questions"));
    const ghAfterKill = (await readsOf(h, GH_HOST)).length;
    const late = await h.browser.newPage();
    await late.goto(GH_APPLY_3, { waitUntil: "domcontentloaded" });
    await sleep(QUIET_MS);
    assert.equal((await readsOf(h, WD_HOST)).length, 2, "the kill switch stops the step-change read");
    assert.equal((await readsOf(h, GH_HOST)).length, ghAfterKill, "and the new tab's");
    assert.deepEqual(fx.posts, [], "draft never submits");
  });

test("⭐ (b) 'Always read here' on a company's careers page reads its EMBEDDED Greenhouse frame at once — no reload; the dock stays collapsed in the TOP frame",
  { skip, timeout: 240000 }, async (t) => {
    const fx = await startFixture();
    t.after(() => fx.stop());
    // the careers host stands in for the user's grant of THIS origin (the click's request then resolves without a prompt)
    const h = await launchExtensionBrowser({ insecureCerts: true, resolverRules: rules(fx), hosts: [`https://${CAREERS}/*`, `https://${GH_HOST}/*`, "https://boards.greenhouse.io/*"] });
    t.after(() => h.close());
    await h.open(CAREERS_APPLY, { settle: 1500 });
    await waitUntil(() => h.frame(u => u.startsWith(`https://${GH_HOST}/`)), 10000);
    assert.deepEqual((await settings(h)).reads || [], [], "nothing read before the click");

    const { popup, why } = await openPopup(h);
    assert.ok(popup, `the real popup opened: ${why}`);
    await popup.waitForSelector("#auto-here:not([hidden])", { timeout: 10000 });
    await popup.click("#auto-here-box");
    const custom = await waitUntil(async () => (await settings(h)).custom?.[`https://${CAREERS}`] || null, 15000);
    assert.ok(custom, "the careers origin is allowed");
    assert.deepEqual(custom.frames, ["greenhouse"]);
    await popup.close().catch(() => {});

    const read = await waitUntil(async () => (await readsOf(h, CAREERS))[0] || null, BUSY_MS);
    assert.ok(read, "the careers page open at the click was read — in its Greenhouse frame, with no reload");
    assert.ok(read.total >= 4 && read.labels.some(l => /First Name/.test(l)), JSON.stringify(read));
    assert.ok(!read.labels.some(l => /new jobs/i.test(l)), "the employer's own newsletter box is not the application");
    assert.deepEqual(await waitUntil(() => dockOf(h.page), 15000), { collapsed: true }, "the dock is collapsed, in the top frame");
    const frame = h.frame(u => u.startsWith(`https://${GH_HOST}/`));
    assert.equal(await frame.evaluate(() => !!document.getElementById("rm-draft-dock")), false, "never inside the form's frame");
    assert.deepEqual(fx.posts, [], "draft never submits");
  });

test("⛔ (c) the REAL request with no grant (Chrome's prompt, never answered): the popup closes, the click is recorded, NOTHING is turned on or read",
  { skip, timeout: 180000 }, async (t) => {
    const fx = await startFixture();
    t.after(() => fx.stop());
    const h = await launchExtensionBrowser({ insecureCerts: true, resolverRules: rules(fx), hosts: [] });
    t.after(() => h.close());
    await h.open(GH_APPLY, { settle: 1500 });
    const { popup, why, target } = await openPopup(h);
    assert.ok(popup, `the real popup opened: ${why}`);
    await popup.waitForSelector("#auto-card:not([hidden])", { timeout: 10000 });
    let closed = false;
    h.browser.on("targetdestroyed", (x) => { if (x === target) closed = true; });
    await popup.click("#auto-allow");
    // MEASURED: the popup closes as Chrome's prompt opens — the reason the worker, not the popup, must finish a grant
    assert.ok(await waitUntil(() => closed, 10000), "the popup closed at the prompt");
    const pending = await waitUntil(async () => (await h.send({ type: "AUTO_READ_STATE" }))?.pending || null, 10000);
    assert.equal(pending, "all", "the click reached the worker before the popup died");
    assert.equal((await h.storage.session()).autoReadPending, undefined, "held in the worker's memory - no new storage key (D23)");
    await sleep(QUIET_MS);
    const granted = await h.control.evaluate(() => chrome.permissions.getAll());
    assert.ok(!granted.origins.some(o => /greenhouse/.test(o)), JSON.stringify(granted.origins));
    const s = await settings(h);
    assert.ok(!s.consent2, "no consent without Chrome's grant");
    assert.equal((await registered(h)).length, 0, "nothing registered");
    assert.deepEqual(s.reads || [], [], "the open tab is not read");
    await h.reload({ settle: QUIET_MS });
    assert.deepEqual((await settings(h)).reads || [], [], "nor after a reload");
  });
