// J4 · D96 §4–§7 IN A REAL CHROME. (1) The whole walk — the REAL extension (test build, with the lane's proposed
// router wiring appended) on the Workday-shaped fixture, J8's real routes, ONE theme (A232 R3): test-support/walks/
// panelLifecycle.mjs. (2) The panel itself, drawn on the fixture page: tokens per theme, no capsule, Collapse, Esc,
// Close. (3) The wizard's advance never presses a hidden button, nor anything on a page with a password box.
// (4) A Workday dropdown whose choices changed since the answer was remembered is a NEW question. (5) The Copy
// sheet shows where an answer came from. Skips, with its reason, where there is no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { findChrome, freePort, waitUntil } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";
import { renderOverlay, panelRowsForStep } from "../extension/review-overlay.js";
import { renderCopySheetPanel } from "../extension/copy-sheet-panel.js";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";
import * as gh from "../extension/gated-handoff.js";
import fs from "node:fs";
const DOCK_JS = fs.readFileSync("extension/dock.js", "utf8");

const chrome = await findChrome();
const SKIP = chrome.skip || false;

// ⭐ A232 R3 (46y, owner 11-19 "all four approved"): the walk runs ONE theme (light). panelLifecycle.mjs makes no
// theme-dependent check at all — its second (dark) walk repeated the same 3.8-min walk for nothing; the panel's tokens in
// BOTH schemes are the "panel in both themes" test below, and j9FullPass walks dark, so each scheme is still walked once.
for (const theme of ["light"]) {
  test(`⛔ J4 walk (${theme}): every field listed, Ready means ready, one tick remembers (eligibility too), a change is not stored, consent / signature / password untouched, dock / drag / Esc / Close`, { skip: SKIP, timeout: 600000 }, async () => {
    const lines = [];
    const r = await runScenario("panelLifecycle", { theme, log: (l) => lines.push(l) });
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

test("⛔ J4: the panel in both themes — painted from the tokens, no capsule, Collapse keeps the counts, Esc and Close close", { skip: SKIP, timeout: 120000 }, async (t) => {
  const { browser, stage } = await fixturePage(t);
  const rows = panelRowsForStep({
    stepName: "My Information",
    fields: [{ index: 0, type: "text", label: "First Name*", id: "ws-firstName", required: true, visible: true },
      { index: 1, type: "text", label: "Address Line 1*", id: "ws-addressLine1", required: true, visible: true }],
    plan: [{ index: 0, name: null, id: "ws-firstName", label: "First Name*", value: "Ada", provenance: "field_map_exact", matchedBy: "label_exact" }],
    filled: [{ field: "First Name*", name: null, index: 0 }],
  });
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
    await page.goto(stage);
    // ⭐ T17: the panel is the dock's Fill tab — dock.js first, as the service worker injects it (drawInDock)
    await page.addScriptTag({ content: DOCK_JS });
    await page.evaluate(`window.chrome = { runtime: { sendMessage(m, cb) { (window.__sent = window.__sent || []).push(m); cb && cb(null); }, lastError: null } };
      (${renderOverlay.toString()})(${JSON.stringify({ rows })}, ${JSON.stringify({ runId: `r-${scheme}`, theme: { light: C_LIGHT, dark: C_DARK } })})`);
    const facts = await page.evaluate(() => {
      const root = document.getElementById("rm-gate-review-overlay").shadowRoot;
      const p = root.getElementById("rm-gate-review-overlay");
      const radii = [...root.querySelectorAll("button, .rm-pill, .rm-row, .rm-edit, .rm-pb")].map(el => parseFloat(getComputedStyle(el).borderTopRightRadius) || 0);
      return { bg: getComputedStyle(p).backgroundColor, maxRadius: Math.max(...radii), state: root.querySelector('[data-role="state"]').textContent,
        progress: root.querySelector('[data-role="progress"]').textContent.trim(), labels: [...root.querySelectorAll('[data-role="label"]')].map(x => x.textContent) };
    });
    const hex = (rgb) => "#" + rgb.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
    const menu = (scheme === "dark" ? C_DARK : C_LIGHT).SURFACE_MENU;
    if (/^#/.test(menu)) assert.equal(hex(facts.bg), menu.toUpperCase().slice(0, 7), `${scheme}: painted from the ${scheme} tokens`);
    else assert.ok(facts.bg, `${scheme}: painted`);
    assert.ok(facts.maxRadius <= 10, `D60: no capsule (max radius ${facts.maxRadius}px)`);
    assert.equal(facts.state, "Not ready — 1 needs you.");
    assert.match(facts.progress, /^1 of 2 filled · 1 needs you · 0 to check/);
    assert.deepEqual(facts.labels, ["Address Line 1", "First Name"], "Needs you first; no asterisks");
    // Collapse → the slim bar still says what needs you (⭐ T17: the DOCK's collapse and slim bar, the panel's words)
    await page.click("#rm-draft-dock >>> [data-role='collapse']");
    assert.equal(await page.evaluate(() => document.getElementById("rm-draft-dock").shadowRoot.querySelector('[data-role="slim"]').textContent.trim()), "1 needs you · 1 of 2 filled");
    // Esc in a page FIELD belongs to the page (its dropdowns) — the panel stays; Esc with the panel focused closes it
    await page.focus("#ws-city");
    await page.keyboard.press("Escape");
    assert.ok(await page.$("#rm-gate-review-overlay"), "Esc in a page field is the page's");
    await page.focus("#rm-draft-dock >>> [data-role='expand']");
    await page.keyboard.press("Escape");
    assert.equal(await page.$("#rm-gate-review-overlay"), null, `${scheme}: Esc closes`);
    assert.equal(await page.$("#rm-draft-dock"), null, `${scheme}: …the dock with it`);
    // Close — on a fresh run id
    await page.evaluate(`(${renderOverlay.toString()})(${JSON.stringify({ rows })}, ${JSON.stringify({ runId: `c-${scheme}`, theme: { light: C_LIGHT, dark: C_DARK } })})`);
    await page.click("#rm-draft-dock >>> [data-role='close']");
    assert.equal(await page.$("#rm-gate-review-overlay"), null, `${scheme}: Close closes`);
    // ⛔ a page script's synthetic click is never a write: no message left the panel for it
    await page.evaluate(`(${renderOverlay.toString()})(${JSON.stringify({ rows })}, ${JSON.stringify({ runId: `s-${scheme}`, theme: { light: C_LIGHT, dark: C_DARK } })})`);
    const sentBefore = await page.evaluate(() => (window.__sent || []).filter(m => m.type === "GATE_REVIEW_EDIT" || m.type === "ANSWER_ACKNOWLEDGE").length);
    await page.evaluate(() => {
      const root = document.getElementById("rm-gate-review-overlay").shadowRoot;
      root.querySelector('[data-role="input"]').value = "planted by the page";
      root.querySelector('[data-role="use"]').click();
    });
    await new Promise(r => setTimeout(r, 200));
    assert.equal(await page.evaluate(() => (window.__sent || []).filter(m => m.type === "GATE_REVIEW_EDIT" || m.type === "ANSWER_ACKNOWLEDGE").length), sentBefore,
      "an untrusted click writes nothing to the page or the server");
    await page.close();
  }
});

test("⛔ J4 (J2 measured): Save and Continue is pressed only when VISIBLE and enabled — never on a page with a password box", { skip: SKIP, timeout: 60000 }, async (t) => {
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const src = gh.__advanceWizardSource;
  assert.ok(src, "advanceWizard's text is exported for this test");
  const run = () => page.evaluate(`(${src})()`);
  await page.setContent(`<input type="password" value="x"><button data-automation-id="bottom-navigation-next-button" hidden onclick="window.__p=1">Save and Continue</button>`);
  assert.equal((await run()).reason, "sign_in_page");
  await page.setContent(`<button data-automation-id="bottom-navigation-next-button" style="display:none" onclick="window.__p=1">Save and Continue</button>`);
  assert.equal((await run()).reason, "no_next_button", "a hidden Save and Continue is never pressed");
  await page.setContent(`<button data-automation-id="bottom-navigation-next-button" onclick="window.__p=1" disabled>Save and Continue</button>`);
  assert.equal((await run()).reason, "next_disabled");
  await page.setContent(`<button data-automation-id="bottom-navigation-next-button" onclick="window.__p=1">Submit</button>`);
  assert.equal((await run()).reason, "next_is_not_continue");
  assert.equal(await page.evaluate(() => window.__p || 0), 0, "nothing was pressed");
  await page.setContent(`<button data-automation-id="bottom-navigation-next-button" onclick="window.__p=1">Save and Continue</button>`);
  assert.equal((await run()).ok, true);
  assert.equal(await page.evaluate(() => window.__p || 0), 1);
});

test("⛔ J4 (D96 §4 safeguard 2 / §7): a Workday dropdown whose choices changed since the answer was remembered is ASKED, not filled", { skip: SKIP, timeout: 120000 }, async (t) => {
  const { browser, stage } = await fixturePage(t);
  const page = await browser.newPage();
  await page.goto(stage);
  const shape = await page.evaluate(`(${gh.__probeSource})()`);
  const state = shape.fields.find(f => f.id === "ws-state");
  assert.equal(state.widget, "dropdown");
  const step = (expectOptions) => ({ index: state.index, name: null, id: "ws-state", label: state.label, value: "Texas", provenance: "saved_answer",
    matchedBy: "saved_answer", exactOption: true, expectOptions });
  let r = await page.evaluate(`(${gh.__applyPlanSource})(${JSON.stringify([step(["california", "texas"])])}, null, { neverFillSource: ${JSON.stringify(gh.NEVER_FILL_SOURCE)} })`);
  assert.equal(r.filled.length, 0);
  assert.equal(r.skipped[0].reason, "options_changed", "different choices — a new question");
  assert.equal(await page.$eval("#ws-state", b => b.getAttribute("value")), "", "nothing was picked");
  r = await page.evaluate(`(${gh.__applyPlanSource})(${JSON.stringify([step(["california", "illinois", "massachusetts", "new york", "texas", "washington"])])}, null, { neverFillSource: ${JSON.stringify(gh.NEVER_FILL_SOURCE)} })`);
  assert.equal(r.filled.length, 1, JSON.stringify(r));
  assert.equal(await page.$eval("#ws-state", b => b.getAttribute("value")), "Texas", "read back: the page shows it");
  assert.deepEqual(r.filled[0].options.length, 6, "the choices it saw travel back, so an acknowledgement is keyed by them");
  // ⛔ and the consent box is never ticked, whatever the plan says
  await page.evaluate(() => window.__wd.go("voluntaryDisclosures"));
  const vd = await page.evaluate(`(${gh.__probeSource})()`);
  const consent = vd.fields.find(f => f.id === "ws-consent");
  r = await page.evaluate(`(${gh.__applyPlanSource})(${JSON.stringify([{ index: consent.index, name: null, id: "ws-consent", label: consent.label, value: "true" }])}, null, { neverFillSource: ${JSON.stringify(gh.NEVER_FILL_SOURCE)} })`);
  assert.equal(r.skipped[0].reason, "never_filled_yours_to_do");
  assert.equal(await page.$eval("#ws-consent", el => el.checked), false, "the page-side last line holds even if a plan asked");
});

test("⛔ J4 (D96 §6): the Copy sheet says where each answer came from, and an eligibility row that you are attesting to it", { skip: SKIP, timeout: 60000 }, async (t) => {
  const { browser, stage } = await fixturePage(t);
  const page = await browser.newPage();
  await page.goto(stage);
  const sheet = { source: "packet", job: { title: "Software Engineer", company: "Zoom" }, rows: [
    { label: "First Name", value: "Ada", provenance: "field_map_exact" },
    { label: "Are you legally authorized to work in the United States?", value: "Yes", eligibility: true, provenance: "saved_answer", source: "you_acknowledged", acknowledgedAt: "2026-10-11T10:00:00Z", attesting: true },
    { label: "Address Line 1", value: "1 Example Way", provenance: "saved_answer", source: "you_typed", acknowledgedAt: "2026-10-12T10:00:00Z" },
  ], unanswered: [{ label: "Phone Number" }] };
  await page.addScriptTag({ content: DOCK_JS });   // ⭐ T17: the Copy sheet is the dock's tab
  await page.evaluate(`window.chrome = { runtime: { sendMessage(m, cb) { cb && cb(null); }, lastError: null } };
    (${renderCopySheetPanel.toString()})(${JSON.stringify(sheet)}, ${JSON.stringify({ light: C_LIGHT, dark: C_DARK })})`);
  const rows = await page.evaluate(() => [...document.getElementById("rm-copy-sheet-panel").shadowRoot.querySelectorAll("li")].map(li => ({
    k: li.querySelector(".k").textContent, src: li.querySelector("[data-source]")?.textContent || null })));
  assert.equal(rows[0].src, "profile");
  assert.match(rows[1].k, /you are attesting to this/);
  assert.match(rows[1].src, /^you acknowledged · /);
  assert.match(rows[2].src, /^you typed · /);
  assert.equal(await page.evaluate(() => document.getElementById("rm-copy-sheet-panel").shadowRoot.querySelector("[data-unanswered]").dataset.unanswered), "1");
  // ⛔ D60: the source mark is a rectangle
  const radius = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("rm-copy-sheet-panel").shadowRoot.querySelector("[data-source]")).borderTopRightRadius));
  assert.ok(radius <= 6);
});
