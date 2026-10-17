// ⭐ T11 · THE EMBEDDED APPLICATION FORM, IN A REAL CHROME — the shape measured on Stripe's live page (10-14): an
// employer's careers page whose application is an iframe from https://job-boards.greenhouse.io/embed/job_app?…&token=<id>.
//
// The real extension (test build), the real routes, and an HTTPS fixture serving BOTH hosts (the ATS families'
// origins are https, so the fixture must be too): a throwaway self-signed certificate is made with openssl in a temp
// directory and Chrome is told to accept it and to resolve both hosts to this machine. Two cases:
//   (a) the test build carries the Greenhouse host permission → the fill lands INSIDE the frame, the review panel draws
//       on the DOCK in the TOP frame (⭐ T17 — never inside the form's frame), nothing is submitted, the employer's own
//       newsletter box is untouched; (c) the dock stays on screen however the page scrolls; (d) dragged across the
//       form's frame it keeps following the pointer, and it is remembered for the careers SITE;
//   (b) it does not → "Allow draft on Greenhouse", nothing filled and NOTHING RELEASED (no mint, no exchange).
// Skips, with its reason, where there is no Chrome or no openssl. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { findChrome, launchExtensionBrowser, defaultSeed, waitUntil, sleep, BUSY_MS } from "../test-support/extensionBrowser.mjs";

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

/**
 * ⭐ (open item 2) The embedded form is READY — its document parsed, its fields there — not merely "a frame at that address
 * exists". puppeteer lists a frame the moment its navigation starts; a Prepare pressed then (under load the frame's
 * document took seconds) read a frame with no form yet. Bounded by BUSY_MS; asserted, so a frame that never came says so.
 */
async function formFrameReady(h) {
  const ready = await waitUntil(async () => {
    const f = h.frame(u => u.startsWith(`https://${GH_HOST}/`));
    return f ? f.evaluate(() => document.readyState !== "loading" && document.querySelectorAll("#application_form input").length >= 4).catch(() => false) : false;
  }, BUSY_MS);
  assert.ok(ready, `the embedded Greenhouse form loaded in its frame (${BUSY_MS} ms)`);
}
/**
 * ⭐ (open item 2) Prepare, and wait for what IT did: its own reply, or the wizard's own "waiting for you" (the status line
 * in state "required") — h.untilAnswerOrWaiting. The old check gave the reply 30 s and called anything later "the form
 * waits", which under a full run's load is also what a slow fill looks like ("a single-page form does not wait" failed
 * with the fill merely slow).
 */
async function prepare(h) {
  const r = await h.untilAnswerOrWaiting({ type: "PREPARE_ACTIVE_TAB" });
  assert.equal(r.waitingForYou, false, "a single-page form does not wait for the candidate");
  assert.equal(r.answered, true, `the Prepare answered (${BUSY_MS} ms)`);
  return r.reply;
}

/** ⭐ T17: is anything of draft's drawn in a frame? (a child frame holds only the extractor and the filler) */
const drawnIn = (f) => f.evaluate(() => [...document.querySelectorAll("[data-draft-dock], [data-draft-view], #rm-gate-review-overlay, #rm-draft-autofill-badge, [data-draft-viewport]")].map(e => e.id || e.tagName));

test("⭐ (a) with Greenhouse allowed: the fill lands INSIDE the embedded frame; the panel is the DOCK in the TOP frame (T17), never in the form's frame; nothing submitted",
  { skip, timeout: 180000 }, async (t) => {
    const fx = await startFixture();
    t.after(() => fx.stop());
    const h = await launch(fx, { greenhouse: true });
    t.after(() => h.close());
    await h.open(POSTING, { settle: 1200 });
    await formFrameReady(h);
    const r = await prepare(h);
    assert.equal(r.ok, true, `${r.reason}: ${r.message}`);
    const v = await frameValues(h);
    assert.deepEqual(v, { first_name: "Ada", last_name: "Example", email: "ada@example.test", phone: "555-0100" });
    const news = await h.page.evaluate(() => document.getElementById("news").value);
    assert.equal(news, "", "the employer's own newsletter box is not the application");
    // ⛔ T17 (owner 10-15 (a)): the panel was baked into the form's iframe — cut off by its edge, or covering the form.
    const panel = await h.waitForPanel();
    assert.ok(panel, "the review panel is drawn in the TOP frame");
    assert.ok(panel.rows.some(x => /^First Name/.test(x.label) && x.value === "Ada"), JSON.stringify(panel.rows));
    const top = await h.page.evaluate(() => ({ dock: document.getElementById("rm-draft-dock")?.getAttribute("data-draft-dock"),
      parent: document.getElementById("rm-gate-review-overlay")?.parentElement?.id, badge: document.getElementById("rm-draft-autofill-badge")?.slot }));
    assert.deepEqual(top, { dock: "dock", parent: "rm-draft-dock", badge: "status" }, "the panel is the dock's Fill tab, the badge its status line");
    const gh = h.frame(u => u.startsWith(`https://${GH_HOST}/`));
    assert.deepEqual(await drawnIn(gh), [], "⛔ nothing of draft's is drawn inside the form's frame");
    assert.equal(await h.readPanelInFrame(u => u.startsWith(`https://${GH_HOST}/`)), null);
    // the live check reads the FORM's frame through the service worker: a field answered there moves its row
    const phoneBefore = panel.rows.find(x => /^Phone/.test(x.label));
    assert.ok(phoneBefore, "Phone is listed");
    const mint = h.api.requests.find(q => /\/gate-packets\/\d+\/token$/.test(q.path));
    assert.equal(mint?.body?.frameUrl, FRAME, "the mint named the frame it would fill");
    await sleep(1500);   // the dock animates in; the screenshot is for a person to look at
    await h.screenshot("t17-embedded-filled-dock-top-frame");
    assert.deepEqual(fx.posts, [], "draft never submits");
  });

test("⭐ (c) a frame as tall as the form (Greenhouse's real shape): the dock — in the TOP frame — stays ON SCREEN as the page scrolls, never past the viewport",
  { skip, timeout: 180000 }, async (t) => {
    const fx = await startFixture();
    t.after(() => fx.stop());
    const h = await launch(fx, { greenhouse: true });
    t.after(() => h.close());
    await h.open(`${POSTING}&tall=1`, { settle: 1200 });
    const gh = (u) => u.startsWith(`https://${GH_HOST}/`);
    await formFrameReady(h);
    const r = await prepare(h);
    assert.equal(r.ok, true, `${r.reason}: ${r.message}`);
    assert.ok(await h.waitForPanel(), "the review panel is drawn in the TOP frame");
    const onScreen = (id) => h.page.evaluate((x) => { const b = document.getElementById(x)?.getBoundingClientRect(); return b && { top: b.top, bottom: b.bottom, left: b.left, right: b.right, vh: innerHeight, vw: document.documentElement.clientWidth }; }, id);
    for (const y of [0, 1600, 3000]) {
      await h.page.evaluate((to) => window.scrollTo(0, to), y);
      await sleep(100);
      const d = await onScreen("rm-draft-dock");
      assert.ok(d && d.top >= 0 && d.bottom <= d.vh && d.left >= 0 && d.right <= d.vw, `the dock is on screen, whole, after scrolling to ${y}: ${JSON.stringify(d)}`);
      const badge = await onScreen("rm-draft-autofill-badge");
      assert.ok(badge && badge.top >= 0 && badge.bottom <= badge.vh, `the status line is on screen after scrolling to ${y}: ${JSON.stringify(badge)}`);
    }
    assert.deepEqual(await drawnIn(h.frame(gh)), [], "⛔ nothing of draft's is drawn inside the tall frame");
    await sleep(800);
    await h.screenshot("t17-tall-frame-scrolled");
    assert.deepEqual(fx.posts, [], "draft never submits");
  });

test("⭐ T17 (d): the dock dragged ACROSS the embedded form's frame keeps moving, and its rectangle is remembered for the SITE (the careers origin) — a reload opens it there",
  { skip, timeout: 180000 }, async (t) => {
    const fx = await startFixture();
    t.after(() => fx.stop());
    const h = await launch(fx, { greenhouse: true });
    t.after(() => h.close());
    await h.open(POSTING, { settle: 1200 });
    await formFrameReady(h);
    const r = await prepare(h);
    assert.equal(r.ok, true, `${r.reason}: ${r.message}`);
    assert.ok(await h.waitForPanel(), "the review panel is drawn in the TOP frame");
    const rect = () => h.page.evaluate(() => { const b = document.getElementById("rm-draft-dock").getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; });
    const before = await rect();
    const hd = await (await h.page.evaluateHandle(() => document.getElementById("rm-draft-dock").shadowRoot.querySelector(".hd .mk"))).asElement().boundingBox();
    // over the iframe (it starts under the page's heading, at the left) and beyond
    await h.page.mouse.move(hd.x + 5, hd.y + 5);
    await h.page.mouse.down();
    await h.page.mouse.move(300, 300, { steps: 12 });
    await h.page.mouse.move(200, 150, { steps: 6 });   // (a spot where the 680 px dock still fits below — no clamp)
    await h.page.mouse.up();
    const after = await rect();
    assert.ok(Math.abs(after.x - (before.x + (200 - hd.x - 5))) <= 2 && Math.abs(after.y - (before.y + (150 - hd.y - 5))) <= 2,
      `the drag crossed the form's frame and followed the pointer to the end: ${JSON.stringify({ before, after })}`);
    const site = `https://${CAREERS}`;
    const saved = await waitUntil(async () => (await h.storage.local())?.dockPlace?.[site], BUSY_MS);   // saved 200 ms after the drag, by message
    assert.ok(saved, "remembered for the careers site");
    assert.deepEqual([saved.rect.x, saved.rect.y], [after.x, after.y]);
    assert.equal((await h.storage.local())?.dockPlace?.[`https://${GH_HOST}`], undefined, "never for the frame's site — the dock is the top page's");
    // a reload: the panel is opened again (the popup's Open dock) — exactly there
    await h.reload({ settle: 1200 });
    const opened = await h.send({ type: "DOCK_OPEN", tab: "fill" });
    assert.equal(opened?.ok, true, JSON.stringify(opened));
    const again = await waitUntil(async () => (await h.page.$("#rm-draft-dock")) && rect(), BUSY_MS);
    assert.deepEqual([again.x, again.y, again.w], [after.x, after.y, after.w], "the same rectangle, on the same site");
    assert.match(await h.page.evaluate(() => document.getElementById("rm-draft-dock").shadowRoot.querySelector('[data-role="empty"]')?.textContent || ""),
      /Nothing has been filled on this page yet/, "a fresh page's Fill tab says so — and offers Fill this page");
    assert.deepEqual(fx.posts, []);
  });

test("⭐ (b) without Greenhouse: 'Allow draft on Greenhouse' — nothing filled, nothing released",
  { skip, timeout: 180000 }, async (t) => {
    const fx = await startFixture();
    t.after(() => fx.stop());
    const h = await launch(fx, { greenhouse: false });
    t.after(() => h.close());
    await h.open(POSTING, { settle: 1200 });
    await formFrameReady(h);   // the frame is there to be refused — a Prepare before it loaded saw no frame at all
    const r = await prepare(h);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "frame_needs_permission", r.message);
    assert.equal(r.message, "This application form is inside a Greenhouse frame. Allow draft on Greenhouse to fill it.");
    assert.equal(r.site?.name, "Greenhouse");
    assert.equal(await h.page.evaluate(() => document.getElementById("news").value), "", "the page's own small form was not filled instead");
    assert.equal(h.api.requests.filter(q => /\/gate-packets\/\d+\/token$|\/gate-packet\/exchange$/.test(q.path)).length, 0,
      "no token was minted and nothing was exchanged");
    assert.deepEqual(fx.posts, []);
  });
