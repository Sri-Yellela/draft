// ⭐ T11 (field report 10-14) · THE APPLICATION FORM IS IN AN ATS'S FRAME.
//
// Measured on the live page (scripts/t11FrameProbe.mjs): Stripe's application page holds 2 controls of its own and the
// application — 46 controls — inside an iframe from https://job-boards.greenhouse.io/embed/job_app?…&token=<id>. These
// tests pin the fix: the REAL extension handoff (extension/gated-handoff.js) against the REAL routes (routes/apply.js)
// on the full schema, with chrome.* stubbed at executeScript — which here answers allFrames the way Chrome does
// ([{ frameId, result }]) for a two-frame page. Synthetic people only; nothing reaches an employer.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { APPLY_ORIGIN_FAMILIES, familyOfBoardJobId, pageMatchesPacket } from "../services/applyOrigins.js";
import { packetAddressing } from "../services/manualHandoff.js";
import {
  runGatedHandoff, atsSiteOf, chooseFormFrame, atsFramesOf, framePermissionResult,
} from "../extension/gated-handoff.js";

const GH = APPLY_ORIGIN_FAMILIES.find(f => f.ats === "greenhouse");
const TOP = "https://careers.acme.test/careers/apply/software-engineer-backend/8198280";
const FRAME = "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=8198280";
const OTHER_FRAME = "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=7777777";
const JOB = "greenhouse::8198280";

// ── pure helpers ──────────────────────────────────────────────────────────────────────────────────
test("atsSiteOf names the known ATS sites and nothing else", () => {
  assert.equal(atsSiteOf(FRAME)?.id, "greenhouse");
  assert.equal(atsSiteOf("https://boards.greenhouse.io/acme/jobs/1")?.id, "greenhouse");
  assert.equal(atsSiteOf("https://jobs.lever.co/acme/x")?.id, "lever");
  assert.equal(atsSiteOf("https://acme.wd5.myworkdayjobs.com/x")?.id, "workday");
  assert.equal(atsSiteOf("https://careers.acme.test/x"), null);
  assert.equal(atsSiteOf("https://greenhouse.io.evil.example/x"), null, "a look-alike host is not the site");
  assert.equal(atsSiteOf("javascript:alert(1)"), null);
  assert.equal(atsSiteOf("not a url"), null);
});

const shapeOf = (url, n, extra = {}) => ({ hasForm: true, url, origin: new URL(url).origin, fields: Array.from({ length: n }, (_, i) => ({ index: i })), ...extra });
test("chooseFormFrame: the most controls wins, the top on a tie, a foreign non-ATS frame never counts, no form → null", () => {
  const topOrigin = new URL(TOP).origin;
  assert.equal(chooseFormFrame([{ frameId: 0, result: shapeOf(TOP, 2) }, { frameId: 5, result: shapeOf(FRAME, 46) }], topOrigin).frameId, 5);
  assert.equal(chooseFormFrame([{ frameId: 0, result: shapeOf(TOP, 4) }, { frameId: 5, result: shapeOf(FRAME, 4) }], topOrigin).frameId, 0, "tie → top");
  assert.equal(chooseFormFrame([{ frameId: 0, result: shapeOf(TOP, 2) }, { frameId: 9, result: shapeOf("https://ads.example/x", 80) }], topOrigin).frameId, 0,
    "an ad or widget frame on another origin is never the form");
  assert.equal(chooseFormFrame([{ frameId: 0, result: shapeOf(TOP, 1) }, { frameId: 3, result: shapeOf(`${topOrigin}/inner`, 9) }], topOrigin).frameId, 3,
    "a same-origin frame counts");
  assert.equal(chooseFormFrame([{ frameId: 0, result: { hasForm: false, url: TOP, origin: topOrigin, fields: [] } }], topOrigin), null);
  assert.equal(chooseFormFrame([{ frameId: 5, result: shapeOf(FRAME, 0) }], topOrigin), null, "a form with no controls is not a form");
  assert.equal(chooseFormFrame([], topOrigin), null);
});

test("atsFramesOf: one per site, the page's own site excluded, non-ATS frames ignored", () => {
  const f = atsFramesOf([FRAME, OTHER_FRAME, "https://www.recaptcha.net/anchor", "https://jobs.lever.co/acme/x"], TOP);
  assert.deepEqual(f.map(x => x.site.id), ["greenhouse", "lever"]);
  assert.equal(f[0].origin, "https://job-boards.greenhouse.io");
  assert.deepEqual(atsFramesOf([FRAME], "https://job-boards.greenhouse.io/acme/jobs/8198280"), [],
    "a Greenhouse page nests Greenhouse frames of its own — not an embedded ATS");
  assert.deepEqual(atsFramesOf(undefined, TOP), []);
});

test("framePermissionResult names the site and asks for exactly its origins", () => {
  const r = framePermissionResult(atsFramesOf([FRAME], TOP)[0]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "frame_needs_permission");
  assert.equal(r.message, "This application form is inside a Greenhouse frame. Allow draft on Greenhouse to fill it.");
  assert.deepEqual(r.site, { id: "greenhouse", name: "Greenhouse", origins: ["https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*"] });
});

// ── server: the board's own id names the ATS ──────────────────────────────────────────────────────
test("familyOfBoardJobId: a feed job's id names its family; anything else names nothing", () => {
  const g = familyOfBoardJobId(JOB);
  assert.equal(g.family, GH);
  assert.equal(g.id, "8198280");
  assert.equal(familyOfBoardJobId("lever::D28A3DE6-CD04-483A-9AED-5BA1D2F8C57C").id, "d28a3de6-cd04-483a-9aed-5ba1d2f8c57c", "lever ids are lower-cased");
  assert.equal(familyOfBoardJobId("jobo::8198280"), null, "a source that is not a family adds nothing");
  assert.equal(familyOfBoardJobId("gh-zoom-1"), null);
  assert.equal(familyOfBoardJobId("greenhouse::"), null);
  assert.equal(familyOfBoardJobId("greenhouse::81 98"), null);
  assert.equal(familyOfBoardJobId(null), null);
});

test("packetAddressing: a greenhouse:: job whose URLs are all on the employer's site gains Greenhouse's origins and its id", () => {
  const a = packetAddressing({ job_id: JOB, expected_origin: "https://careers.acme.test",
    apply_url: "https://careers.acme.test/jobs/search?gh_jid=8198280", sj_url: "https://careers.acme.test/jobs/search?gh_jid=8198280" });
  assert.deepEqual(a.origins, ["https://careers.acme.test", ...GH.origins]);
  assert.ok(a.jobIds.includes("8198280"));
  assert.equal(pageMatchesPacket({ url: FRAME, ...a }).ok, true, "the embedded form is this job's address");
  assert.equal(pageMatchesPacket({ url: OTHER_FRAME, ...a }).reason, "other_job", "another job's embedded form is not");
  // a non-family job id adds nothing
  const b = packetAddressing({ job_id: "two::44", expected_origin: "https://careers.acme.test", apply_url: "https://careers.acme.test/x" });
  assert.deepEqual(b.origins, ["https://careers.acme.test"]);
  assert.deepEqual(b.jobIds, []);
});

// ── the routes and the extension, end to end ──────────────────────────────────────────────────────
const PAYLOAD = {
  field_map: { first_name: "Ada", last_name: "Example", email: "ada@example.test", phone: "555-0100" },
  handler_map: {}, custom_answers: {},
};
function mount() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Example','ada@example.test')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,discovered_at)
              VALUES (?,?,?,?,?,'t','h-t11',unixepoch()-86400)`)
    .run(JOB, "Software Engineer, Backend", "Acme", "https://careers.acme.test/jobs/search?gh_jid=8198280", "https://careers.acme.test/jobs/search?gh_jid=8198280");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const hooks = applyRoutes(app, db, (q, r, n) => n(), () => PAYLOAD, async () => ({ error: "no model in tests" }),
    async () => Buffer.from("%PDF-1.4 synthetic"), async () => ({}), () => null, {});
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const requests = [];
  return { db, hooks, base, requests, stop: () => { server.close(); db.close(); } };
}
const post = (base, path, body) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("routes: /handoff/match with frameUrl names only packets that fill the page AND the frame; a bad frameUrl is 400", async () => {
  const t = mount();
  try {
    const { packetId } = t.hooks.prepareManualPacket({ userId: 1, jobId: JOB });
    const ids = async (frameUrl) => ((await (await post(t.base, "/api/apply/handoff/match", { url: TOP, frameUrl })).json()).packets || []).map(p => p.packetId);
    assert.deepEqual(await ids(FRAME), [packetId], "the embedded form of the same job");
    assert.deepEqual(await ids(null), [packetId], "no frame: the page alone, as before");
    assert.deepEqual(await ids(OTHER_FRAME), [], "another job's embedded form");
    assert.deepEqual(await ids("https://jobs.lever.co/acme/d28a3de6-cd04-483a-9aed-5ba1d2f8c57c"), [], "a frame outside the origin list");
    const bad = await post(t.base, "/api/apply/handoff/match", { url: TOP, frameUrl: "javascript:alert(1)" });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error, "bad_frame_url");
  } finally { t.stop(); }
});

test("routes: the mint refuses a frame outside the application — 409 not_this_address, before any token exists", async () => {
  const t = mount();
  try {
    const { packetId } = t.hooks.prepareManualPacket({ userId: 1, jobId: JOB });
    const mint = (frameUrl) => post(t.base, `/api/apply/gate-packets/${packetId}/token`, { url: TOP, frameUrl });
    const other = await mint(OTHER_FRAME);
    assert.equal(other.status, 409);
    const ob = await other.json();
    assert.equal(ob.error, "not_this_address");
    assert.equal(ob.reason, "frame_other_job");
    const foreign = await mint("https://jobs.lever.co/acme/d28a3de6-cd04-483a-9aed-5ba1d2f8c57c");
    assert.equal(foreign.status, 409);
    assert.equal((await foreign.json()).reason, "frame_origin_not_listed");
    const bad = await mint("ftp://x.example/");
    assert.equal(bad.status, 400);
    assert.equal(t.db.prepare("SELECT token_hash LIKE 'unminted:%' FROM apply_gate_packets WHERE id=?").pluck().get(packetId), 1, "no token was minted");
  } finally { t.stop(); }
});

// chrome.*, stubbed at executeScript — a two-frame page: the employer's own small form at the top, the application in
// a Greenhouse frame (frameId 5) that is readable only when `frameReadable`.
const TOP_SHAPE = { hasForm: true, url: TOP, origin: new URL(TOP).origin, frames: [FRAME, "https://www.recaptcha.net/recaptcha/anchor"],
  fields: [{ index: 0, name: "q", id: "q", type: "search", label: "Search jobs", required: false, options: null },
           { index: 1, name: "email", id: "news", type: "email", label: "Email me new jobs", required: false, options: null }] };
const frameShape = (url) => ({ hasForm: true, url, origin: new URL(url).origin, frames: [],
  fields: ["first_name", "last_name", "email", "phone"].map((n, index) => ({ index, name: n, id: n, type: n === "email" ? "email" : "text",
    label: { first_name: "First Name", last_name: "Last Name", email: "Email", phone: "Phone" }[n], required: true, options: null })) });
let currentTab = null;
let stores = null;   // chrome.storage survives a re-stub within one test (keepStorage), as it survives in Chrome
function fakeChrome({ frameReadable = true, frameUrl = FRAME, granted = false, keepStorage = false } = {}) {
  if (!keepStorage || !stores) stores = { local: new Map([["authToken", "t"]]), session: new Map() };
  const area = (m) => ({
    get: async (k) => (k == null ? Object.fromEntries(m) : typeof k === "string" ? (m.has(k) ? { [k]: m.get(k) } : {}) : {}),
    set: async (o) => { for (const [k, v] of Object.entries(o)) m.set(k, v); },
    remove: async (k) => { for (const x of [].concat(k)) m.delete(x); },
  });
  const calls = { applyPlan: [], targets: [], permissionAsks: [] };
  const FS = frameShape(frameUrl);
  globalThis.chrome = {
    storage: { local: area(stores.local), session: area(stores.session) },
    runtime: { getURL: (p) => `chrome-extension://test/${p}` },
    permissions: { contains: async (q) => { calls.permissionAsks.push(q); return granted; } },
    scripting: {
      async executeScript({ target, func, args = [] }) {
        calls.targets.push({ func: func.name, target });
        const inFrame = Array.isArray(target.frameIds) && target.frameIds.includes(5);
        if (func.name === "probeFormShape") {
          if (target.allFrames) return [{ frameId: 0, result: TOP_SHAPE }, ...(frameReadable ? [{ frameId: 5, result: FS }] : [])];
          return [{ result: inFrame ? FS : TOP_SHAPE }];
        }
        if (func.name === "applyPlan") {
          calls.applyPlan.push({ target, plan: args[0] });
          return [{ result: { filled: args[0].map(s => ({ field: s.label, name: s.name, provenance: s.provenance, verified: true })), skipped: [], resume: null } }];
        }
        return [{ result: { ok: true } }];
      },
    },
  };
  return calls;
}
const onTab = (url, id = 7) => (currentTab = { id, url });

test("⭐ the fill goes INTO the Greenhouse frame — every step targets frameId 5 — and fills the application's fields", async () => {
  const t = mount(); const calls = fakeChrome({ frameReadable: true });
  try {
    t.hooks.prepareManualPacket({ userId: 1, jobId: JOB });
    const r = await runGatedHandoff({ serverUrl: t.base, tab: onTab(TOP) });
    assert.equal(r.ok, true, r.message);
    assert.equal(calls.applyPlan.length, 1);
    assert.deepEqual(calls.applyPlan[0].target, { tabId: 7, frameIds: [5] }, "the fill is injected into the frame, not the page");
    assert.deepEqual(calls.applyPlan[0].plan.map(s => s.name).sort(), ["email", "first_name", "last_name", "phone"]);
    const after = calls.targets.filter(c => !c.target.allFrames);
    assert.ok(after.length >= 3);
    for (const c of after) assert.deepEqual(c.target, { tabId: 7, frameIds: [5] }, `${c.func} went to the frame`);
  } finally { t.stop(); }
});

test("⭐ an unreadable Greenhouse frame → 'Allow draft on Greenhouse', and the page's own small form is NOT filled", async () => {
  const t = mount(); const calls = fakeChrome({ frameReadable: false, granted: false });
  try {
    t.hooks.prepareManualPacket({ userId: 1, jobId: JOB });
    const r = await runGatedHandoff({ serverUrl: t.base, tab: onTab(TOP) });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "frame_needs_permission");
    assert.equal(r.site.name, "Greenhouse");
    assert.deepEqual(calls.permissionAsks, [{ origins: ["https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*"] }]);
    assert.equal(calls.applyPlan.length, 0, "the employer's newsletter box is never mistaken for the application");
    assert.equal(t.db.prepare("SELECT token_hash LIKE 'unminted:%' FROM apply_gate_packets").pluck().get(), 1, "nothing was released");
  } finally { t.stop(); }
});

test("⛔ a frame holding ANOTHER job's form is never filled, and nothing is released", async () => {
  const t = mount(); const calls = fakeChrome({ frameReadable: true, frameUrl: OTHER_FRAME });
  try {
    t.hooks.prepareManualPacket({ userId: 1, jobId: JOB });
    const r = await runGatedHandoff({ serverUrl: t.base, tab: onTab(TOP) });
    assert.equal(r.ok, false);
    assert.equal(calls.applyPlan.length, 0);
    assert.equal(t.db.prepare("SELECT token_hash LIKE 'unminted:%' FROM apply_gate_packets").pluck().get(), 1);
  } finally { t.stop(); }
});

test("⛔ a packet already released into the tab is reused only in the frame it was released for — never another job's", async () => {
  const t = mount(); const first = fakeChrome({ frameReadable: true });
  try {
    t.hooks.prepareManualPacket({ userId: 1, jobId: JOB });
    assert.equal((await runGatedHandoff({ serverUrl: t.base, tab: onTab(TOP, 11) })).ok, true);
    assert.equal(first.applyPlan.length, 1);
    // The same tab, the same frame (a re-press): the cached packet is reused, no second token.
    const same = fakeChrome({ frameReadable: true, keepStorage: true });
    const reused = await runGatedHandoff({ serverUrl: t.base, tab: onTab(TOP, 11) });
    assert.equal(reused.ok, true, reused.message);
    assert.equal(reused.reused, true);
    assert.equal(same.applyPlan.length, 1);
    // The same tab, the frame now ANOTHER job's: the cached packet's origins include Greenhouse, but it is never
    // reused there — and the server has nothing to release for that job.
    const other = fakeChrome({ frameReadable: true, frameUrl: OTHER_FRAME, keepStorage: true });
    const r = await runGatedHandoff({ serverUrl: t.base, tab: onTab(TOP, 11) });
    assert.equal(r.ok, false);
    assert.equal(other.applyPlan.length, 0, "a packet was filled into another job's embedded form");
  } finally { t.stop(); }
});
