// J6 · D98 §4–§5 IN A REAL CHROME. (1) The whole walk — the REAL extension (test build) on the Workday-shaped fixture,
// J3's real routes with the generation stubbed, BOTH THEMES: test-support/walks/resumePanel.mjs. (2) The panel itself,
// drawn on the fixture page: tokens per theme, no capsule, a preview that cannot run a script or load an image even when
// handed raw markup, its own shadow root, a synthetic click that sends nothing, Collapse / Esc / Close, a step change it
// survives while it polls. (3) Attach on a plain input (verified — the browser draws the name), on the fixture's drop
// zone (verified — the page shows the name), on a drop zone that shows nothing (NOT verified → the fallback), and never
// into a cover letter's box. Skips, with its reason, where there is no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { findChrome, freePort, waitUntil, BUSY_MS } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";
import { renderResumePanel, attachResumeFile, resumePanelModel } from "../extension/resumePanel.js";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";

const chrome = await findChrome();
const SKIP = chrome.skip || false;

for (const theme of ["light", "dark"]) {
  test(`⛔ J6 walk (${theme}): generate on the page, survive a step change and a popup close, cancel, refuse, attach on Workday's drop zone, the Copy sheet and the next fill reuse the same file`, { skip: SKIP, timeout: 600000 }, async () => {
    const lines = [];
    const r = await runScenario("resumePanel", { theme, log: (l) => lines.push(l) });
    if (r.skipped) return;
    assert.equal(r.failures, 0, lines.filter(l => /^FAIL/.test(l)).join("\n") || lines.slice(-20).join("\n"));
  });
}

async function fixturePage(t) {
  const port = await freePort();
  const ats = spawn(process.execPath, ["scripts/fakeAts.js"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  t.after(() => ats.kill());
  const stage = `http://localhost:${port}/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin`;
  await waitUntil(() => fetch(stage).then(x => x.ok).catch(() => false), 15000, 100);
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  t.after(() => browser.close());
  return { browser, stage };
}

const JOB = { jobId: "wd-zoom-1", title: "Software Engineer", company: "Zoom" };
const ID = "erg_0123456789abcdef01234567";
// ⛔ RAW hostile markup handed straight to the renderer — past the server's sanitiser and past scrubPreviewHtml — so
// this measures the page's own defence: DOMParser, the drop list, the attribute strip, the CSS clean.
const HOSTILE = `<style>@import "http://tracker.invalid/x.css"; body{font-family:Georgia,serif;background:url(http://tracker.invalid/bg.png)} .name{font-size:28px}</style>
  <div class="name" onclick="window.__ran=1">Ada Example</div><script>window.__ran = 2</script>
  <img src="http://tracker.invalid/pixel.png" onerror="window.__ran=3"><iframe src="http://tracker.invalid/f"></iframe>
  <p style="background:url('http://tracker.invalid/p.png')">Led a team of four building a payments ledger in Go</p>
  <a href="javascript:window.__ran=4">x</a>`;
const readyModel = () => {
  const m = resumePanelModel({ job: JOB, view: { id: ID, status: "ready", job: JOB, allowance: { used: 1, limit: 10, remaining: 9 },
    preview: { html: "<p>placeholder</p>" }, score: { before: 62, after: 81 }, guard: { passed: true, findings: [] },
    changes: { summary: { rewritten: 9, added: 2, removed: 0, termsGained: new Array(16).fill({}), roleChanges: 0 } }, pdf: null, openUrl: "/app/jobs?job=wd-zoom-1" } });
  m.preview = { html: HOSTILE };
  return m;
};
// ⭐ T26: the dock's frame is the surface the view sits on — it is handed the palette, as dockHost.js dockMeta does
const META = { theme: { light: C_LIGHT, dark: C_DARK }, dock: { theme: { light: C_LIGHT, dark: C_DARK } }, paper: { bg: C_LIGHT.SURFACE_SOLID, ink: C_LIGHT.INK }, pollMs: 200,
  regenerateWords: "Generating again uses another of your Draft slots.", editNote: "Opens this job in draft in a new tab.", dragHint: "drag it onto the upload box" };
const stubRuntime = (replies = {}) => `window.chrome = { runtime: { lastError: null, sendMessage(m, cb) {
  (window.__sent = window.__sent || []).push(m);
  const r = (${JSON.stringify(replies)})[m.type] ?? null;
  setTimeout(() => cb && cb(r), 10);
} } };`;
// ⭐ T17: the résumé is a VIEW of the dock — dock.js first (idempotent), as the service worker's drawInDock does
const DOCK_JS = fs.readFileSync("extension/dock.js", "utf8");
const draw = async (page, model, meta = META) => { await page.evaluate(DOCK_JS); return page.evaluate(`(${renderResumePanel.toString()})(${JSON.stringify(model)}, ${JSON.stringify(meta)})`); };
const inPanel = (page, fn) => page.evaluate(`(() => { const root = document.getElementById('rm-resume-panel').shadowRoot; return (${fn.toString()})(root); })()`);

test("⛔ J6: the panel in both themes — the site's tokens, no capsule, the preview isolated in its own shadow root and inert, a synthetic click sends nothing", { skip: SKIP, timeout: 120000 }, async (t) => {
  const { browser, stage } = await fixturePage(t);
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage();
    const external = [];
    await page.setRequestInterception(true);
    page.on("request", (r) => { if (/tracker\.invalid/.test(r.url())) { external.push(r.url()); r.abort(); } else r.continue(); });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
    await page.goto(stage);
    await page.evaluate(stubRuntime({ RESUME_ATTACH: { ok: true, model: null } }));
    await draw(page, readyModel());
    await new Promise(r => setTimeout(r, 500));
    const facts = await inPanel(page, (root) => {
      const p = root.querySelector(".rp");
      const pv = root.querySelector('[data-role="preview"]');
      const radii = [...root.querySelectorAll("button, .mark, .guard, .pvw, .pb")].map(el => parseFloat(getComputedStyle(el).borderTopRightRadius) || 0);
      // ⭐ T26: the dock's frame is the ONE surface; the view paints none of its own
      return { bg: getComputedStyle(document.getElementById("rm-draft-dock").shadowRoot.querySelector(".fr")).backgroundColor, own: getComputedStyle(p).backgroundColor, maxRadius: Math.max(...radii), title: root.querySelector('[data-role="title"]').textContent,
        job: root.querySelector('[data-role="job"]').textContent, score: root.querySelector('[data-role="score"]').textContent,
        changes: root.querySelector('[data-role="changes"]').textContent, guard: root.querySelector('[data-role="guard"]').textContent,
        actions: [...root.querySelectorAll(".acts button")].map(b => b.getAttribute("aria-label") || b.textContent),
        previewShadow: !!pv.shadowRoot, previewText: pv.shadowRoot?.textContent || "",
        previewTags: pv.shadowRoot ? [...pv.shadowRoot.querySelectorAll("*")].map(e => e.tagName.toLowerCase()) : [],
        previewHandlers: pv.shadowRoot ? [...pv.shadowRoot.querySelectorAll("*")].flatMap(e => [...e.attributes].map(a => a.name)).filter(n => /^on|src|href/.test(n)) : [],
        previewCss: pv.shadowRoot?.querySelector("style")?.textContent || "",
        inLightDom: document.body.textContent.includes("Led a team of four") };
    });
    const hex = (rgb) => "#" + rgb.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
    const menu = (scheme === "dark" ? C_DARK : C_LIGHT).SURFACE_MENU;
    if (/^#/.test(menu)) assert.equal(hex(facts.bg), menu.toUpperCase().slice(0, 7), `${scheme}: painted from the ${scheme} tokens`);
    else assert.equal(facts.bg.replace(/\s+/g, "").toLowerCase(), menu.replace(/\s+/g, "").toLowerCase(), `${scheme}: painted from the ${scheme} tokens`);
    assert.ok(facts.maxRadius <= 10, `D60: no capsule (max radius ${facts.maxRadius}px)`);
    assert.equal(facts.title, "Your résumé is ready");
    assert.equal(facts.job, "Software Engineer at Zoom");
    assert.equal(facts.score, "ATS 62 → 81");
    assert.equal(facts.changes, "What we changed — 9 rewritten · 2 added · +16 job terms");
    assert.match(facts.guard, /Checked against your profile/);
    assert.deepEqual(facts.actions, ["Attach", "Download PDF", "Edit in a full page"], "⭐ T22: a view — no Regenerate");
    // ⛔ the preview: its own shadow root, inside the panel's — the page's light DOM never holds it
    assert.equal(facts.previewShadow, true, "the preview is not in a shadow root of its own");
    assert.equal(facts.inLightDom, false);
    assert.match(facts.previewText, /Ada Example/);
    for (const tag of ["script", "img", "iframe", "link"]) assert.ok(!facts.previewTags.includes(tag), `${tag} survived into the preview`);
    assert.deepEqual(facts.previewHandlers, [], "a handler / src / href survived");
    assert.doesNotMatch(facts.previewCss, /url\(|@import|tracker/, "CSS that loads survived");
    assert.match(facts.previewCss, /:host\{font-family:Georgia/, "the résumé's body{} rules are mapped to :host");
    assert.equal(await page.evaluate(() => window.__ran ?? null), null, "a script or handler in the résumé ran");
    assert.deepEqual(external, [], "the preview loaded something from outside");
    // ⛔ a page script's synthetic click is never a press: nothing is sent
    await inPanel(page, (root) => root.querySelector('[data-role="attach"]').click());
    await inPanel(page, (root) => root.querySelector('[data-role="edit"]').click());
    await new Promise(r => setTimeout(r, 150));
    assert.deepEqual(await page.evaluate(() => (window.__sent || []).map(m => m.type)), [], "an untrusted click reached the service worker");
    // ⭐ T22 REVISED: nothing on the tab starts a résumé — no Generate / Regenerate control at all
    assert.equal(await inPanel(page, (root) => root.querySelectorAll('[data-role="generate"], [data-role="regenerate"]').length), 0);
    // a TRUSTED Attach is the person's own press, and asks the service worker to attach — never to generate
    await page.click("#rm-resume-panel >>> [data-role='attach']");
    await waitUntil(() => page.evaluate(() => (window.__sent || []).length > 0), BUSY_MS);
    assert.deepEqual(await page.evaluate(() => window.__sent.map(m => m.type)), ["RESUME_ATTACH"]);
    await new Promise(r => setTimeout(r, 150));   // the reply re-draws the panel
    // Collapse keeps a slim bar; Esc inside closes; Close closes — ⭐ T17: the DOCK's controls, the view's words
    await page.click("#rm-draft-dock >>> [data-role='collapse']");
    assert.match(await page.evaluate(() => document.getElementById("rm-draft-dock").shadowRoot.querySelector('[data-role="slim"]').textContent), /^Résumé · /);
    await page.focus("#rm-draft-dock >>> [data-role='expand']");
    await page.keyboard.press("Escape");
    assert.equal(await page.$("#rm-resume-panel"), null, `${scheme}: Esc closes`);
    await draw(page, readyModel());
    await page.click("#rm-draft-dock >>> [data-role='expand']").catch(() => null);   // the dock remembers it was collapsed
    await page.click("#rm-draft-dock >>> [data-role='close']");
    assert.equal(await page.$("#rm-resume-panel"), null, `${scheme}: Close closes`);
    await page.close();
  }
});

test("⛔ J6: Generating — persistent progress that polls, survives a Workday step change, and lands on Ready", { skip: SKIP, timeout: 60000 }, async (t) => {
  const { browser, stage } = await fixturePage(t);
  const page = await browser.newPage();
  await page.goto(stage);
  const generating = resumePanelModel({ job: JOB, view: { id: ID, status: "generating", job: JOB, createdAt: Math.floor(Date.now() / 1000) } });
  const ready = readyModel();
  ready.preview = { html: "<p>Ada Example</p>" };
  // the first two polls still generating, then ready
  await page.evaluate(`window.__polls = 0; window.chrome = { runtime: { lastError: null, sendMessage(m, cb) {
    (window.__sent = window.__sent || []).push(m);
    if (m.type === 'RESUME_STATUS') { window.__polls++; setTimeout(() => cb({ ok: true, model: window.__polls < 3 ? ${JSON.stringify(generating)} : ${JSON.stringify(ready)} }), 10); }
  } } };`);
  await draw(page, generating);
  const g = await inPanel(page, (root) => ({ title: root.querySelector('[data-role="title"]').textContent, progress: !!root.querySelector('[data-role="progress"]'),
    actions: [...root.querySelectorAll(".acts button")].map(b => b.getAttribute("aria-label") || b.textContent), text: root.querySelector(".sc").textContent }));
  assert.equal(g.title, "Generating…");
  assert.equal(g.progress, true);
  assert.deepEqual(g.actions, ["Cancel"]);
  assert.match(g.text, /usually 10–20 seconds/);
  assert.match(g.text, /You can close the draft popup or go to the next step; it keeps going\./);
  // a Workday step change (the fixture's own go(), no navigation) — the panel stays and keeps polling
  await page.evaluate(() => window.__wd.go("myExperience"));
  await waitUntil(() => page.evaluate(() => document.getElementById("rm-resume-panel")?.dataset.state === "ready"), BUSY_MS);
  assert.equal(await page.evaluate(() => document.getElementById("rm-resume-panel")?.dataset.state), "ready", "the panel did not survive the step change");
  assert.ok(await page.evaluate(() => window.__polls) >= 3);
  assert.deepEqual([...new Set(await page.evaluate(() => window.__sent.map(m => m.type)))], ["RESUME_STATUS"], "the poll only ever asks for status");
  assert.equal(await page.evaluate(() => window.__sent.every(m => m.id === "erg_0123456789abcdef01234567")), true);
});

test("⛔ J6: Attach — a plain input is set and verified, Workday's drop zone is set and the page shows the name, a zone that shows nothing is NOT verified, a cover letter's box is never used", { skip: SKIP, timeout: 60000 }, async (t) => {
  const { browser, stage } = await fixturePage(t);
  const page = await browser.newPage();
  const file = { base64: Buffer.from("%PDF-1.4\n% synthetic\n%%EOF\n").toString("base64"), fileName: "Ada_Example_Zoom_Software_Engineer.pdf", mimeType: "application/pdf" };
  const run = (arg) => page.evaluate(`(${attachResumeFile.toString()})(${JSON.stringify(arg)})`);

  // (a) a plain, visible input — the browser draws the name itself
  await page.setContent(`<label for="cv">Resume</label> <input type="file" id="cv" accept=".pdf,application/pdf" onchange="window.__changed=(window.__changed||0)+1">`);
  const a = await run(file);
  assert.deepEqual([a.set, a.verified, a.how], [true, true, "native"], JSON.stringify(a));
  assert.equal(await page.$eval("#cv", el => el.files[0]?.name), file.fileName);
  assert.equal(await page.evaluate(() => window.__changed), 1, "the page's change handler ran");

  // (b) the Workday-shaped fixture: a hidden input in a drop zone that shows the name
  await page.goto(stage);
  await page.evaluate(() => window.__wd.go("myExperience"));
  const b = await run(file);
  assert.deepEqual([b.set, b.verified, b.how], [true, true, "page"], JSON.stringify(b));
  assert.match(await page.$eval("#ws-resume-status", el => el.textContent), /Ada_Example_Zoom_Software_Engineer\.pdf · Successfully Uploaded!/);

  // (c) a custom zone that hides the input and shows nothing (its own upload call, say) — NOT verified
  await page.setContent(`<div class="zone" aria-label="Upload your resume"><span>Drop your résumé here</span>
    <input type="file" name="resume" accept=".pdf" style="position:absolute;width:1px;height:1px;opacity:0"></div>`);
  const c = await run(file);
  assert.equal(c.verified, false, "an unconfirmed attach was reported as verified");
  assert.equal(c.reason, "not_shown");
  const fallback = resumePanelModel({ job: JOB, view: { id: ID, status: "ready", job: JOB }, attach: { outcome: "fallback", fileName: file.fileName, reason: c.reason, base64: file.base64 } });
  await page.evaluate(stubRuntime());
  await draw(page, fallback);
  const said = await inPanel(page, (root) => ({ text: root.querySelector(".sc").textContent, first: root.querySelector(".acts button").getAttribute("aria-label") }));
  assert.match(said.text, /draft could not put the file in this page's upload box — the page did not show its name\./);
  assert.match(said.text, /Download PDF — its name is copied for you — then drag it onto the upload box\./);
  assert.equal(said.first, "Download PDF");
  // Download PDF: a trusted press saves the file under its name and says what to do next
  const client = await page.target().createCDPSession();
  await client.send("Browser.setDownloadBehavior", { behavior: "deny" }).catch(() => {});
  await page.click("#rm-resume-panel >>> [data-role='download']");
  await waitUntil(() => page.evaluate(() => document.getElementById("rm-resume-panel").dataset.downloaded || null), BUSY_MS);
  assert.equal(await page.evaluate(() => document.getElementById("rm-resume-panel").dataset.downloaded), file.fileName);
  assert.match(await inPanel(page, (root) => root.querySelector('[data-role="say"]').textContent), /^Downloaded Ada_Example_Zoom_Software_Engineer\.pdf.*drag it onto the upload box\.$/);

  // (d) only a cover letter's upload — never used for the résumé
  await page.setContent(`<label for="cl">Cover letter</label><input type="file" id="cl" accept=".pdf">`);
  const d = await run(file);
  assert.deepEqual([d.target, d.set], [false, false]);
  assert.equal(await page.$eval("#cl", el => el.files.length), 0);
  // (e) an upload that takes no PDF is not a target
  await page.setContent(`<label for="ph">Resume photo</label><input type="file" id="ph" accept="image/*"><label for="r2">Resume</label><input type="file" id="r2" accept=".docx">`);
  assert.equal((await run({ probe: true })).target, false);
});
