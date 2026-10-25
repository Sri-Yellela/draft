// D55 decisions B and E (docs/AUTOFILL_TARGET.md §8.4, decided 10-07).
//   B — contextMenus: right-click "Save this page to draft" (THE capture) and "Save link to draft"
//       (the link's address only; the server refetches from the ATS's own listing or REFUSES).
//   E — "Report this form": the form page's HOST and field LABELS, never a value, never the path.
// Every person here is synthetic.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createImportJobRouter } from "../routes/importJob.js";
import { importJob, ImportInputError, linkRefetchability, LINK_REFUSALS } from "../services/jobs/importJob.js";
import {
  validateFormReport, recordFormReport, purgeExpiredFormReports, formReportHandler, FormReportError,
  FORM_REPORT_FIELDS, RATE,
} from "../services/formReports.js";
import {
  CONTEXT_MENUS, MENU_SAVE_PAGE, MENU_SAVE_LINK, saveableLink, reportHostOf, buildFormReport, collectFormLabels,
} from "../extension/formReport.js";
import { MERGE_PLAN, deleteAccount, exportAccount } from "../services/accountService.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(read("extension/manifest.json"));
const bg = read("extension/background.js");

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (7,'synthetic_ada','x'),(8,'synthetic_bo','x')").run();
  return db;
}

async function call(router, mount, path, userId, body) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = userId ? { id: userId } : undefined; next(); });
  app.use(mount, router);
  const server = app.listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${mount}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    return { code: r.status, body: await r.json() };
  } finally { server.close(); }
}

// ── B · the permission is declared, rationalised and reconciled ────────────────────────────────
test("⛔ D55 B: contextMenus is declared — and rationalised, reconciled, justified on the listing", () => {
  assert.ok(manifest.permissions.includes("contextMenus"));
  assert.match(read("extension/MANIFEST_RATIONALE.md"), /^\| `contextMenus` \|/m);
  assert.match(read("extension/submission/PRIVACY_RECONCILIATION.md"), /^\| `contextMenus` \|/m);
  assert.match(read("extension/submission/STORE_LISTING.md"), /\*\*`contextMenus`\*\*/);
  // It came with no host and no content script (the one content script since is D99 J11's bridge, on draft's origin).
  assert.deepEqual(manifest.host_permissions, ["https://jobsviadraft.com/*"]);
  assert.deepEqual(manifest.content_scripts, [{ matches: ["https://jobsviadraft.com/*"], js: ["boardBridge.js"], run_at: "document_start", all_frames: false }]);
});

test("D55 B: Save this page (pages) and Save link (http(s) links only) — and, since T22, Fill and the ATS report", () => {
  // ⭐ T22 (owner 10-15): the popup's fill and score tiles left; what they did stays one right-click away
  assert.deepEqual(CONTEXT_MENUS.map((m) => [m.id, m.title, [...m.contexts]]), [
    [MENU_SAVE_PAGE, "Save this page to draft", ["page"]],
    [MENU_SAVE_LINK, "Save link to draft", ["link"]],
    ["draft-fill-page", "Fill this application with draft", ["page"]],
    ["draft-ats-page", "Show draft's ATS report", ["page"]],
  ]);
  assert.deepEqual([...CONTEXT_MENUS[1].targetUrlPatterns], ["http://*/*", "https://*/*"]);
  assert.equal(saveableLink("javascript:alert(1)"), null);
  assert.equal(saveableLink("mailto:x@example.test"), null);
  assert.equal(saveableLink("https://jobs.lever.co/acme/0b1c2d3e-0000"), "https://jobs.lever.co/acme/0b1c2d3e-0000");
});

test("D55 B: Save this page IS the capture — the same captureActiveTab(), no fourth implementation", () => {
  const onClicked = bg.slice(at(bg, "chrome.contextMenus.onClicked.addListener"), at(bg, "async function saveLinkToDraft"));
  assert.match(onClicked, /MENU_SAVE_PAGE\) \{ void captureActiveTab\(tab\); return; \}/);
  assert.equal((bg.match(/async function captureActiveTab/g) || []).length, 1);
  const save = bg.slice(at(bg, "async function saveLinkToDraft"), at(bg, "// \"Report this form\", from the popup"));
  assert.match(save, /'\/api\/import\/link'/);
  assert.match(save, /JSON\.stringify\(\{ url \}\)/, "Save link sends the link's address and nothing else");
  assert.doesNotMatch(save, /executeScript\(\{[^}]*func: extractJobPayload/, "Save link reads no page");
  assert.doesNotMatch(save, /chrome\.storage\.(local|session)\.set/, "no new storage key — reportCapture's lastCapture");
  // The menu is created on install, not on every service-worker start (duplicate ids throw).
  assert.match(bg, /chrome\.runtime\.onInstalled\?\.addListener\(\(\) => \{\s*chrome\.contextMenus\.removeAll/);
});

// ── B · Save link refuses what the server cannot refetch ──────────────────────────────────────
test("⛔ D55 B: linkRefetchability — only a known-ATS posting link is accepted", () => {
  const db = freshDb();
  const ok = (u) => linkRefetchability(db, u);
  assert.deepEqual(ok("https://job-boards.greenhouse.io/northwind/jobs/101"), { ok: true, ats: "greenhouse" });
  assert.deepEqual(ok("https://jobs.lever.co/fabrikam/0b1c2d3e-0000"), { ok: true, ats: "lever" });
  assert.deepEqual(ok("https://jobs.ashbyhq.com/contoso/11111111-2222"), { ok: true, ats: "ashby" });
  for (const [u, reason] of [
    ["https://www.linkedin.com/jobs/view/123", "login_walled"],
    ["https://careers.example.test/jobs/42", "not_refetchable"],     // an employer's own page
    ["https://job-boards.greenhouse.io/northwind", "not_refetchable"], // a board, not a posting
    ["https://acme.recruitee.com/", "not_refetchable"],
    ["https://acme.wd5.myworkdayjobs.com/en-US/External/job/X_R1", "workday_unknown"],
    ["ftp://jobs.lever.co/x/0b1c2d3e-0000", "not_a_link"],
    ["not a url", "not_a_link"],
  ]) {
    const v = ok(u);
    assert.equal(v.ok, false, u);
    assert.equal(v.reason, reason, u);
    assert.equal(v.message, LINK_REFUSALS[reason]);
  }
  // A Workday tenant draft does know is accepted.
  db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug) VALUES ('Acme','workday','5|acme|External')").run();
  assert.deepEqual(ok("https://acme.wd5.myworkdayjobs.com/en-US/External/job/X_R1"), { ok: true, ats: "workday" });
});

test("⛔ D55 B: POST /api/import/link refuses a non-refetchable link with 422 — before any fetch, nothing stored", async () => {
  const db = freshDb();
  const before = db.prepare("SELECT (SELECT COUNT(*) FROM scraped_jobs)+(SELECT COUNT(*) FROM user_jobs)+(SELECT COUNT(*) FROM job_captures) n").get().n;
  const realFetch = globalThis.fetch;
  for (const url of ["https://careers.example.test/jobs/42", "https://www.linkedin.com/jobs/view/1", ""]) {
    const r = await call(createImportJobRouter(db, null), "/api/import", "/link", 7, { url });
    assert.equal(r.code, 422, url);
    assert.equal(r.body.refused, true);
    assert.match(r.body.error, /Save this page to draft|not a web link/);
    assert.match(r.body.kind, /^link_/);
  }
  assert.equal(globalThis.fetch, realFetch);
  const after = db.prepare("SELECT (SELECT COUNT(*) FROM scraped_jobs)+(SELECT COUNT(*) FROM user_jobs)+(SELECT COUNT(*) FROM job_captures) n").get().n;
  assert.equal(after, before, "a refused link wrote a row");
  // The route consults the refusal BEFORE importJob, and passes refetchOnly.
  const route = read("routes/importJob.js");
  const link = route.slice(at(route, 'router.post("/link"'), at(route, "// D13 — THE COMPANION"));
  assert.ok(link.indexOf("linkRefetchability(db, url)") < link.indexOf("await importJob("));
  assert.match(link, /refetchOnly: true/);
});

test("⛔ D55 B: refetchOnly never falls back to the generic page fetch", async () => {
  const db = freshDb();
  // Without refetchOnly this URL would be fetched generically (DNS, then the page); with it, refused.
  await assert.rejects(
    importJob({ url: "https://careers.example.test/jobs/42" }, { db, userId: 7, refetchOnly: true }),
    (e) => e instanceof ImportInputError && /current listings/.test(e.message));
});

// ── E · Report this form — host + labels, never values ─────────────────────────────────────────
function el(tag, attrs = {}, children = [], text = "") {
  const node = {
    tagName: tag.toUpperCase(), attrs, children: [], text, parent: null,
    get type() { return attrs.type || (tag === "select" ? "select-one" : tag === "textarea" ? "textarea" : ""); },
    get id() { return attrs.id || ""; },
    get value() { throw new Error(`value read on ${tag}`); },
    get checked() { throw new Error(`checked read on ${tag}`); },
    getAttribute(n) { return n in attrs ? attrs[n] : null; },
    get textContent() { return node.text + node.children.map((c) => c.textContent).join(""); },
    closest(sel) { let n = node; while (n) { if (n.tagName === sel.toUpperCase()) return n; n = n.parent; } return null; },
    remove() { if (node.parent) node.parent.children = node.parent.children.filter((c) => c !== node); },
    cloneNode() { return el(tag, { ...attrs }, node.children.map((c) => c.cloneNode(true)), node.text); },
    querySelectorAll(list) {
      const sels = list.split(",").map((s) => s.trim().match(/^([a-z]*)(?:\[([a-z-]+)(?:="([^"]*)")?\])?$/));
      const hit = (n) => sels.some(([, t, a, v]) => (!t || n.tagName === t.toUpperCase()) &&
        (!a || (a in n.attrs && (v === undefined || n.attrs[a] === v))));
      const out = [];
      const walk = (n) => { for (const c of n.children) { if (hit(c)) out.push(c); walk(c); } };
      walk(node);
      return out;
    },
  };
  for (const c of children) { c.parent = node; node.children.push(c); }
  return node;
}

test("⛔ D55 E: collectFormLabels reads label text with every control removed — no value is ever read", () => {
  const form = el("form", {}, [
    el("label", { for: "fn" }, [], "First name"),
    el("input", { id: "fn", type: "text" }),
    el("label", {}, [el("textarea", {}, [], "SENTINEL-TYPED-ANSWER")], "Why this role? "),
    el("label", {}, [el("select", {}, [el("option", {}, [], "SENTINEL-OPTION")])], "Country"),
    el("label", {}, [el("div", { contenteditable: "true" }, [], "SENTINEL-EDITABLE")], "Cover note"),
    el("input", { type: "password", "aria-label": "Password" }),
    el("input", { type: "hidden", "aria-label": "csrf" }),
    el("input", { type: "email", "aria-label": "Email address" }),
  ]);
  const root = el("html", {}, [el("body", {}, [form])]);
  const saved = { document: globalThis.document, CSS: globalThis.CSS };
  globalThis.document = { querySelector: (s) => root.querySelectorAll(s)[0] || null };
  globalThis.CSS = { escape: (s) => s };
  try {
    const out = collectFormLabels();
    assert.deepEqual(out.labels, ["First name", "Why this role?", "Country", "Cover note", "Email address"]);
    assert.equal(out.fieldCount, 5, "password and hidden fields are not counted");
    assert.doesNotMatch(JSON.stringify(out), /SENTINEL/);
  } finally { Object.assign(globalThis, saved); }
  // And by source: the collector touches no value-bearing property.
  const src = read("extension/formReport.js");
  const fn = src.slice(at(src, "export function collectFormLabels"));
  assert.doesNotMatch(fn, /\.value\b|\.checked\b|selectedIndex|selectedOptions|innerText|innerHTML|location/);
});

test("⛔ D55 E: the extension sends host + labels only — the hostname, never the path or query", () => {
  assert.equal(reportHostOf("https://Acme.wd5.myworkdayjobs.com/en-US/External/job/X_R1/apply?token=abc&email=a@b.test#s"),
    "acme.wd5.myworkdayjobs.com");
  assert.equal(reportHostOf("chrome://extensions"), null);
  const body = buildFormReport({ host: "acme.example.test", collected: { labels: ["First  name", 3, { value: "x" }, ""], fieldCount: 4, values: ["SENTINEL"] }, version: "1.4.1" });
  assert.deepEqual(Object.keys(body).sort(), [...FORM_REPORT_FIELDS].sort());
  assert.deepEqual(body.labels, ["First name"]);
  assert.doesNotMatch(JSON.stringify(body), /SENTINEL/);
  // The background handler posts exactly that body — and re-reads the page on send.
  const h = bg.slice(at(bg, "if (msg?.type !== 'REPORT_FORM') return false;"));
  assert.match(h, /buildFormReport\(\{ host, collected, version:/);
  assert.match(h, /'\/api\/form-reports'[\s\S]*body: JSON\.stringify\(report\)/);
  assert.match(h, /const host = reportHostOf\(tab\?\.url\)/);
});

test("⛔ D55 E: the server REFUSES any key but the four, a host with a path, and a non-string label", () => {
  const ok = { host: "acme.example.test", labels: ["First name"], fieldCount: 1, extensionVersion: "1.4.1" };
  assert.deepEqual(validateFormReport(ok), ok);
  const refused = (b) => { try { validateFormReport(b); } catch (e) { assert.ok(e instanceof FormReportError); return e.code; } return null; };
  assert.equal(refused({ ...ok, values: ["Ada Synthetic"] }), "report_field_refused");
  assert.equal(refused({ ...ok, answers: {} }), "report_field_refused");
  assert.equal(refused({ ...ok, url: "https://acme.example.test/apply" }), "report_field_refused");
  assert.equal(refused({ ...ok, labels: [{ label: "x", value: "y" }] }), "report_field_refused");
  for (const host of ["https://acme.example.test", "acme.example.test/apply", "acme.example.test?x=1",
    "acme.example.test:443", "user@acme.example.test", "localhost", ""]) {
    assert.equal(refused({ ...ok, host }), "report_host_refused", host);
  }
  // A portal that echoes the typed value into a label is scrubbed.
  const s = validateFormReport({ ...ok, labels: ["Email: sentinel.d55@example.test", "Phone +1 555 0100 777", "Req 12345678"] });
  assert.deepEqual(s.labels, ["Email: [email]", "Phone [number]", "Req [number]"]);
});

test("⛔ D55 E: a report is stored against its reporter, rate-limited, purged at 30 days, deleted with the account", async () => {
  const db = freshDb();
  const r = await call(express.Router().post("/", formReportHandler(db)), "/api/form-reports", "", 7,
    { host: "acme.example.test", labels: ["First name", "Last name"], fieldCount: 2, extensionVersion: "1.4.1" });
  assert.equal(r.code, 202);
  assert.equal(r.body.labelCount, 2);
  const row = db.prepare("SELECT * FROM form_reports").get();
  assert.deepEqual([row.user_id, row.host, JSON.parse(row.labels_json)], [7, "acme.example.test", ["First name", "Last name"]]);
  assert.equal(row.expires_at - row.received_at, 30 * 86400);
  const bad = await call(express.Router().post("/", formReportHandler(db)), "/api/form-reports", "", 7,
    { host: "acme.example.test", labels: [], values: ["x"] });
  assert.equal(bad.code, 400);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM form_reports").get().n, 1, "a refused report was stored");
  // Rate limit.
  const now = Math.floor(Date.now() / 1000);
  for (let i = 1; i < RATE.perHour; i++) recordFormReport(db, 7, { host: "a.example.test", labels: ["x"] }, { now });
  assert.throws(() => recordFormReport(db, 7, { host: "a.example.test", labels: ["x"] }, { now }), (e) => e.code === "report_rate");
  recordFormReport(db, 8, { host: "a.example.test", labels: ["x"] }, { now });    // another user is not limited
  // Purge past 30 days.
  assert.equal(purgeExpiredFormReports(db, now + 30 * 86400 + 1), RATE.perHour + 1);
  // Account plumbing.
  recordFormReport(db, 8, { host: "b.example.test", labels: ["x"] }, { now });
  assert.equal(MERGE_PLAN.form_reports, "move");
  assert.equal(exportAccount(db, 8).data.form_reports.length, 1);
  deleteAccount(db, 8);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM form_reports").get().n, 0);
});

test("⛔ D55 E: what would be sent is shown BEFORE it is sent — two clicks (⭐ T31: on the page, when a form is not recognised)", () => {
  // the retired popup's Report form → the fill's popup on a form draft did not recognise (toolbarPress.js fillRelay):
  // Report → the question naming the host and the label count, "Never your answers" → Send
  const tp = read("extension/toolbarPress.js");
  assert.match(tp, /if \(result\?\.reason === 'form_not_recognised'\) \{[\s\S]{0,400}actions: \[\{ id: 'report', label: 'Report this form to draft', word: 'Report' \}\]/);
  const acts = bg.slice(at(bg, "const DOCK_ACTS = Object.freeze({"), at(bg, "if (msg?.type !== 'DOCK_ACT') return false;"));
  assert.match(acts, /report: async \(tab\) => \{\n\s+const r = await reportForm\(tab, 'preview'\);/);
  assert.match(acts, /Never your answers\./);
  assert.match(acts, /'report-send': async \(tab\) => \{\n\s+const r = await reportForm\(tab, 'send'\);/);
  const h = bg.slice(at(bg, "async function reportForm(tab, phase) {"));
  assert.ok(h.indexOf("phase !== 'send'") < h.indexOf("'/api/form-reports'"), "the preview must return before any post");
});

test("D55 E: the privacy page carries the disclosure; the reconciliation carries the row", () => {
  const policy = read("client/src/pages/marketing/PrivacyPage.jsx").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/<[^>]+>/g, " ").replace(/\{" "\}/g, " ").replace(/\s+/g, " ");
  assert.match(policy, /Reporting a Form That Isn't Recognised/);
  assert.match(policy, /host name .*never the rest of the page address.* field labels, never your answers/);
  assert.match(policy, /deleted after 30 days/);
  assert.match(policy, /Save link to draft .*sends only that link's address/);
  const recon = read("extension/submission/PRIVACY_RECONCILIATION.md");
  assert.match(recon, /^\| \*\*Report this form\*\*/m);
  assert.match(recon, /^\| A right-clicked \*\*link\*\*/m);
});

test("⛔ D56's full-URL transmission is disclosed, while the code still sends it", () => {
  // The handoff, Prepare, the Copy sheet and "I submitted" post the tab's WHOLE href (path and query).
  const gh = read("extension/gated-handoff.js");
  const sendsFull = /JSON\.stringify\(\{ url: tab\.url \}\)/.test(gh) && /return \/\^https\?:\$\/\.test\(u\.protocol\) \? u\.href : null/.test(gh);
  if (!sendsFull) return;                          // narrowed to the origin? then the line can narrow too
  const policy = read("client/src/pages/marketing/PrivacyPage.jsx").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/<[^>]+>/g, " ").replace(/\{" "\}/g, " ").replace(/\s+/g, " ");
  assert.match(policy, /sends that page's full address \(including its path and any query\)/);
  assert.match(policy, /used for that check and not kept/);
  assert.match(policy, /I submitted , that address is kept with the application's record/);
  assert.match(read("extension/submission/PRIVACY_RECONCILIATION.md"), /^\| The application page's \*\*full URL\*\*/m);
});
