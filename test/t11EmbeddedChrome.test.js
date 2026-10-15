// ⭐ T11 · THE EMBEDDED APPLICATION FORM, IN A REAL CHROME — the shape measured on Stripe's live page (10-14): an
// employer's careers page whose application is an iframe from https://job-boards.greenhouse.io/embed/job_app?…&token=<id>.
//
// The real extension (test build), the real routes, and an HTTPS fixture serving BOTH hosts (the ATS families'
// origins are https, so the fixture must be too): a throwaway self-signed certificate is made with openssl in a temp
// directory and Chrome is told to accept it and to resolve both hosts to this machine. Two cases:
//   (a) the test build carries the Greenhouse host permission → the fill lands INSIDE the frame, the review panel draws
//       there, nothing is submitted, the employer's own newsletter box is untouched;
//   (b) it does not → "Allow draft on Greenhouse", nothing filled and NOTHING RELEASED (no mint, no exchange).
// Skips, with its reason, where there is no Chrome or no openssl. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { findChrome, launchExtensionBrowser, defaultSeed, waitUntil, sleep } from "../test-support/extensionBrowser.mjs";

const chrome = await findChrome();
const opensslSkip = (() => { try { execFileSync("openssl", ["version"], { stdio: "ignore" }); return false; } catch { return "no openssl to make the fixture's test certificate"; } })();
const skip = chrome.skip || opensslSkip || false;

const CAREERS = "careers.acme.test";
const GH_HOST = "job-boards.greenhouse.io";
const JOB = "greenhouse::8198280";
const POSTING = `https://${CAREERS}/jobs/search?gh_jid=8198280`;     // the board's stored URL — and the page that embeds the form
const FRAME = `https://${GH_HOST}/embed/job_app?for=acme&token=8198280`;

const TOP_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Software Engineer, Backend — Acme</title></head><body>
<h1>Software Engineer, Backend</h1><p>Acme · Remote (US)</p>
<form id="newsletter" action="/subscribe" method="post"><label for="news">Email me new jobs</label><input id="news" name="email" type="email"></form>
<iframe id="grnhse_iframe" src="${FRAME}" width="100%" height="900" style="border:0"></iframe>
</body></html>`;
const FRAME_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Apply</title></head><body>
<form id="application_form" action="/embed/job_app/submit" method="post">
  <label for="first_name">First Name *</label><input id="first_name" name="job_application[first_name]" type="text" required>
  <label for="last_name">Last Name *</label><input id="last_name" name="job_application[last_name]" type="text" required>
  <label for="email">Email *</label><input id="email" name="job_application[email]" type="email" required>
  <label for="phone">Phone</label><input id="phone" name="job_application[phone]" type="tel">
  <button type="submit" id="submit_app">Submit application</button>
</form></body></html>`;

/** One HTTPS server for both hosts, dispatching on Host. Records every POST (a submission must never happen). */
async function startFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "t11-cert-"));
  const key = path.join(dir, "key.pem"), cert = path.join(dir, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1",
    "-subj", "/CN=t11-fixture", "-addext", `subjectAltName=DNS:${CAREERS},DNS:${GH_HOST}`], { stdio: "ignore" });
  const posts = [];
  const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (req, res) => {
    const host = String(req.headers.host || "").split(":")[0];
    if (req.method === "POST") { posts.push(`${host}${req.url}`); res.writeHead(200); return res.end("recorded"); }
    // ?tall=1: the real shape — Greenhouse sizes its iframe to the WHOLE form, so the frame is as tall as the page.
    const tall = /[?&]tall=1/.test(req.url);
    if (host === CAREERS && req.url.startsWith("/jobs/search")) {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(tall ? TOP_HTML.replace(`src="${FRAME}" width="100%" height="900"`, `src="${FRAME}&amp;tall=1" width="100%" height="4000"`) : TOP_HTML);
    }
    if (host === GH_HOST && req.url.startsWith("/embed/job_app")) {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(tall ? FRAME_HTML.replace("</form>", "</form><div style=\"height:3600px\">More questions below…</div>") : FRAME_HTML);
    }
    res.writeHead(404); res.end("not found");
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  return { port: server.address().port, posts, stop: () => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

const seed = (db) => {
  defaultSeed(db);
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
    VALUES (?,?,?,?,?,?,'t','h-t11',unixepoch()-86400)`).run(JOB, "Software Engineer, Backend", "Acme", "Remote (US)", POSTING, POSTING);
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, ?, 1)").run(JOB);
};
const PAYLOAD = { field_map: { first_name: "Ada", last_name: "Example", email: "ada@example.test", phone: "555-0100" }, handler_map: {}, custom_answers: {} };

async function launch(fx, { greenhouse }) {
  return launchExtensionBrowser({
    api: { seed, payload: PAYLOAD },
    insecureCerts: true,
    resolverRules: [`MAP ${CAREERS} 127.0.0.1:${fx.port}`, `MAP ${GH_HOST} 127.0.0.1:${fx.port}`],
    // The careers host stands in for the user's activeTab grant (the harness's convention); Greenhouse is the optional
    // permission the user grants — present in (a), absent in (b).
    hosts: [`https://${CAREERS}/*`, ...(greenhouse ? [`https://${GH_HOST}/*`, "https://boards.greenhouse.io/*"] : [])],
  });
}
const frameValues = (h) => h.frame(u => u.startsWith(`https://${GH_HOST}/`))?.evaluate(() =>
  Object.fromEntries([...document.querySelectorAll("#application_form input")].map(i => [i.id, i.value])));

test("⭐ (a) with Greenhouse allowed: the fill lands INSIDE the embedded frame and the panel draws there; nothing submitted",
  { skip, timeout: 180000 }, async (t) => {
    const fx = await startFixture();
    t.after(() => fx.stop());
    const h = await launch(fx, { greenhouse: true });
    t.after(() => h.close());
    await h.open(POSTING, { settle: 1200 });
    await waitUntil(() => h.frame(u => u.startsWith(`https://${GH_HOST}/`)), 10000);
    const r = await h.prepare({ timeoutMs: 30000 });
    assert.equal(r.pending, undefined, "a single-page form does not wait");
    assert.equal(r.ok, true, `${r.reason}: ${r.message}`);
    const v = await frameValues(h);
    assert.deepEqual(v, { first_name: "Ada", last_name: "Example", email: "ada@example.test", phone: "555-0100" });
    const news = await h.page.evaluate(() => document.getElementById("news").value);
    assert.equal(news, "", "the employer's own newsletter box is not the application");
    const panel = await waitUntil(() => h.readPanelInFrame(u => u.startsWith(`https://${GH_HOST}/`)), 15000);
    assert.ok(panel, "the review panel is drawn in the form's frame");
    assert.ok(panel.rows.some(x => /^First Name/.test(x.label) && x.value === "Ada"), JSON.stringify(panel.rows));
    assert.equal(await h.readPanel(), null, "and not over the employer's page");
    const mint = h.api.requests.find(q => /\/gate-packets\/\d+\/token$/.test(q.path));
    assert.equal(mint?.body?.frameUrl, FRAME, "the mint named the frame it would fill");
    await sleep(1500);   // the panel animates in; the screenshot is for a person to look at
    await h.screenshot("t11-embedded-filled");
    assert.deepEqual(fx.posts, [], "draft never submits");
  });

test("⭐ (c) a frame as tall as the form (Greenhouse's real shape): the panel and the badge stay ON SCREEN as the page scrolls",
  { skip, timeout: 180000 }, async (t) => {
    const fx = await startFixture();
    t.after(() => fx.stop());
    const h = await launch(fx, { greenhouse: true });
    t.after(() => h.close());
    await h.open(`${POSTING}&tall=1`, { settle: 1200 });
    const gh = (u) => u.startsWith(`https://${GH_HOST}/`);
    await waitUntil(() => h.frame(gh), 10000);
    const r = await h.prepare({ timeoutMs: 30000 });
    assert.equal(r.ok, true, `${r.reason}: ${r.message}`);
    await waitUntil(() => h.readPanelInFrame(gh), 15000);
    // Where an element of the frame sits in the TOP-LEVEL viewport: the iframe's box plus the element's box in the frame.
    const onScreen = async (id) => {
      const frameBox = await h.page.evaluate(() => { const b = document.getElementById("grnhse_iframe").getBoundingClientRect(); return { top: b.top, vh: innerHeight }; });
      const el = await h.frame(gh).evaluate((x) => { const n = document.getElementById(x); if (!n) return null; const b = n.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; }, id);
      return el && { top: frameBox.top + el.top, bottom: frameBox.top + el.bottom, vh: frameBox.vh };
    };
    for (const y of [1600, 3000]) {
      await h.page.evaluate((to) => window.scrollTo(0, to), y);
      // the panel follows within a frame or two of the scroll; give it a moment
      const placed = await waitUntil(async () => {
        const p = await onScreen("rm-gate-review-overlay");
        return p && p.top >= 0 && p.top < p.vh - 100 ? p : null;
      }, 5000);
      assert.ok(placed, `the panel is on screen after scrolling to ${y}: ${JSON.stringify(await onScreen("rm-gate-review-overlay"))}`);
      const badge = await onScreen("rm-draft-autofill-badge");
      assert.ok(badge && badge.top >= 0 && badge.bottom <= badge.vh, `the badge is on screen after scrolling to ${y}: ${JSON.stringify(badge)}`);
    }
    await sleep(800);
    await h.screenshot("t11-tall-frame-scrolled");
    assert.deepEqual(fx.posts, [], "draft never submits");
  });

test("⭐ (b) without Greenhouse: 'Allow draft on Greenhouse' — nothing filled, nothing released",
  { skip, timeout: 180000 }, async (t) => {
    const fx = await startFixture();
    t.after(() => fx.stop());
    const h = await launch(fx, { greenhouse: false });
    t.after(() => h.close());
    await h.open(POSTING, { settle: 1200 });
    const r = await h.prepare({ timeoutMs: 30000 });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "frame_needs_permission", r.message);
    assert.equal(r.message, "This application form is inside a Greenhouse frame. Allow draft on Greenhouse to fill it.");
    assert.equal(r.site?.name, "Greenhouse");
    assert.equal(await h.page.evaluate(() => document.getElementById("news").value), "", "the page's own small form was not filled instead");
    assert.equal(h.api.requests.filter(q => /\/gate-packets\/\d+\/token$|\/gate-packet\/exchange$/.test(q.path)).length, 0,
      "no token was minted and nothing was exchanged");
    assert.deepEqual(fx.posts, []);
  });
