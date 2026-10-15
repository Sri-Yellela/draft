// ⭐ D97 REVISED + T12 · IN A REAL CHROME — the one-time card, then automatic reading on a preset host; then "Always read
// here" on an employer's careers origin whose application is an embedded Greenhouse frame (the Stripe shape, T11).
//
// The real extension (test build), the real popup (chrome.action.openPopup), real clicks (trusted input — the user
// gesture chrome.permissions.request needs), and an HTTPS fixture serving BOTH hosts (a throwaway self-signed certificate
// made with openssl; Chrome resolves both hosts to this machine and accepts the certificate — t11EmbeddedChrome's
// pattern). ⚠ A headless Chrome cannot answer Chrome's own permission prompt, so the TEST BUILD lists the preset hosts
// and the careers origin in host_permissions (the harness's convention for standing in for a grant): the request then
// resolves without a prompt, and every other step — the card, the click, the consent, the registration, the watcher,
// the pass, the frame pass, the popup's line — is the shipped code. The shipped manifest is untouched.
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
const GH_APPLY = `https://${GH_HOST}/acme/jobs/8198280`;                       // a preset host's own application page
const CAREERS_APPLY = `https://${CAREERS}/jobs/search?gh_jid=8198280`;        // the employer's page, embedding the form
const FRAME = `https://${GH_HOST}/embed/job_app?for=acme&token=8198280`;

const FORM = `<form id="application_form" action="/submit" method="post">
  <label for="first_name">First Name *</label><input id="first_name" name="first_name" type="text" required>
  <label for="last_name">Last Name *</label><input id="last_name" name="last_name" type="text" required>
  <label for="email">Email *</label><input id="email" name="email" type="email" required>
  <label for="phone">Phone</label><input id="phone" name="phone" type="tel">
  <button type="submit">Submit application</button>
</form>`;
const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;

async function startFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d97r-cert-"));
  const key = path.join(dir, "key.pem"), cert = path.join(dir, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1",
    "-subj", "/CN=d97r-fixture", "-addext", `subjectAltName=DNS:${CAREERS},DNS:${GH_HOST}`], { stdio: "ignore" });
  const posts = [];
  const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (req, res) => {
    const host = String(req.headers.host || "").split(":")[0];
    if (req.method === "POST") { posts.push(`${host}${req.url}`); res.writeHead(200); return res.end("recorded"); }
    const html = (body) => { res.writeHead(200, { "content-type": "text/html" }); res.end(body); };
    if (host === GH_HOST && req.url.startsWith("/embed/job_app")) return html(page("Apply", FORM));
    if (host === GH_HOST && req.url.startsWith("/acme/jobs/")) return html(page("Software Engineer — Acme", `<h1>Software Engineer</h1>${FORM}`));
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

/** Open the REAL popup on the active tab; returns its page, or null with the reason. */
async function openPopup(h) {
  const opened = await h.control.evaluate(() => chrome.action.openPopup().then(() => "ok", e => `ERR ${e.message}`));
  if (opened !== "ok") return { popup: null, why: opened };
  const t = await h.browser.waitForTarget(x => x.url().endsWith("/popup.html"), { timeout: 8000 }).catch(() => null);
  return { popup: t ? await t.asPage() : null, why: t ? null : "no popup target" };
}
const settings = async (h) => (await h.storage.local()).autoRead || {};
const registered = (h) => h.control.evaluate(() => chrome.scripting.getRegisteredContentScripts());

test("⭐ the one-time card → ONE grant → a preset host is read automatically; then 'Always read here' on the careers origin reads its Greenhouse frame",
  { skip, timeout: 240000 }, async (t) => {
    const fx = await startFixture();
    t.after(() => fx.stop());
    const h = await launchExtensionBrowser({
      insecureCerts: true,
      resolverRules: [`MAP ${CAREERS} 127.0.0.1:${fx.port}`, `MAP ${GH_HOST} 127.0.0.1:${fx.port}`],
      hosts: [...OPTIONAL_ORIGINS, `https://${CAREERS}/*`],
    });
    t.after(() => h.close());

    // 1 · before consent: a preset host's application page is NOT read
    await h.open(GH_APPLY, { settle: 2500 });
    assert.equal((await registered(h)).length, 0, "nothing registered before consent");
    assert.deepEqual((await settings(h)).reads || [], [], "nothing read before consent");

    // 2 · the card, in the real popup, and the click
    let { popup, why } = await openPopup(h);
    assert.ok(popup, `the real popup opened: ${why}`);
    await popup.waitForSelector("#auto-card:not([hidden])", { timeout: 10000 });
    assert.match(await popup.$eval("#auto-card", el => el.textContent), /Allow it on these sites[\s\S]*SmartRecruiters/);
    await popup.screenshot({ path: path.join(h.outDir, "d97r-popup-card.png") }).catch(() => {});
    await popup.click("#auto-allow");
    const agreed = await waitUntil(async () => ((await settings(h)).consent2?.at ? await settings(h) : null), 15000);
    assert.ok(agreed, "the consent is recorded");
    for (const id of ["workday", "greenhouse", "lever", "ashby", "workable", "smartrecruiters"]) {
      assert.deepEqual(agreed.sites[id], { read: true, prepare: true, capture: false, fill: false }, id);
    }
    const regs = (await registered(h)).map(r => r.id).sort();
    assert.ok(regs.includes("draft-auto-read-greenhouse"), JSON.stringify(regs));
    await popup.close().catch(() => {});

    // 3 · the preset host, read with no click
    await h.open(GH_APPLY, { settle: 300 });
    const ghRead = await waitUntil(async () => ((await settings(h)).reads || []).find(r => r.host === GH_HOST) || null, BUSY_MS);
    assert.ok(ghRead, "the Greenhouse application page was read automatically");
    assert.ok(ghRead.total >= 4, JSON.stringify(ghRead));
    assert.ok(ghRead.labels.some(l => /First Name/.test(l)), JSON.stringify(ghRead.labels));

    // 4 · "Always read here" on the employer's origin — offered at once, with Greenhouse named (gh_jid=, no frame read)
    await h.open(CAREERS_APPLY, { settle: 1200 });
    ({ popup, why } = await openPopup(h));
    assert.ok(popup, `the real popup opened on the careers page: ${why}`);
    await popup.waitForSelector("#auto-here:not([hidden])", { timeout: 10000 });
    assert.match(await popup.$eval("#auto-here-hint", el => el.textContent), /careers\.acme\.test and Greenhouse/);
    await popup.click("#auto-here-box");
    const custom = await waitUntil(async () => (await settings(h)).custom?.[`https://${CAREERS}`] || null, 15000);
    assert.ok(custom, "the careers origin is allowed");
    assert.deepEqual([custom.read, custom.prepare, custom.capture, custom.fill], [true, true, false, false]);
    assert.deepEqual(custom.frames, ["greenhouse"]);
    const reg = (await registered(h)).find(r => r.id === `draft-auto-read-c-${CAREERS}`);
    assert.ok(reg, "registered for the careers origin");
    assert.equal(reg.allFrames, true);
    assert.ok(reg.matches.includes(`https://${CAREERS}/*`) && reg.matches.includes(`https://${GH_HOST}/*`), JSON.stringify(reg.matches));
    await popup.close().catch(() => {});

    // 5 · the careers page, reloaded: its Greenhouse frame is read — the form's four questions, not the newsletter box
    await h.reload({ settle: 300 });
    const acmeRead = await waitUntil(async () => ((await settings(h)).reads || []).find(r => r.host === CAREERS) || null, BUSY_MS);
    assert.ok(acmeRead, "the careers page's form was read automatically, in its frame");
    assert.ok(acmeRead.total >= 4 && acmeRead.labels.some(l => /First Name/.test(l)), JSON.stringify(acmeRead));
    assert.ok(!acmeRead.labels.some(l => /new jobs/i.test(l)), "the employer's own newsletter box is not the application");

    // 6 · the popup says so, instead of "Nothing on this page is read until you press it"
    ({ popup, why } = await openPopup(h));
    assert.ok(popup, why);
    const line = await waitUntil(() => popup.$eval("#read-hint", el => (/Reading automatically/.test(el.textContent) ? el.textContent : null)), 10000);
    assert.match(line || "", /^Reading automatically on this site · last read \d\d:\d\d$/);
    await sleep(300);
    await popup.screenshot({ path: path.join(h.outDir, "d97r-popup-reading.png") }).catch(() => {});
    await popup.close().catch(() => {});
    assert.deepEqual(fx.posts, [], "draft never submits");
  });
