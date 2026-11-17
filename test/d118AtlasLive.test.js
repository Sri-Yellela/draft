// ⭐ D118 P2 · CONTENT CHANGES WITHOUT A DEPLOY — the Learn content lives in the database (learn_content, migration 198);
// Admin → Atlas → Import content validates the extracted JSON, diffs it by id and applies it on Apply; the server never
// evaluates an upload; progress keyed on ids survives; content/learn/*.json seeds the table only while it is empty.
// (b) the curator's tools (node editor, Find on Wikipedia, Draft definitions, publish / unpublish) act on the next read.
// Synthetic users and nodes only; every network call goes through an injected fetcher.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { learnContent, LEARN_FILE } from "../services/learn/learnContent.js";
import { seedLearnContentIfEmpty, validateLearnContent } from "../services/learn/learnImport.js";
import { setMark, readProgress } from "../services/learn/learnProgress.js";
import { createLearnRouter } from "../routes/learn.js";
import { createLearnAdminRouter } from "../routes/learnAdmin.js";
import { createAtlasRouter, createAtlasAdminRouter } from "../routes/atlas.js";
import { upsertNode } from "../services/atlas/atlasStore.js";
import vm from "node:vm";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import { buildLearnFile } from "../scripts/learn/extractTracker.mjs";
import { learnFileFromUpload, SANDBOX_CSP } from "../client/src/panels/adminLearnSandbox.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const FILE = JSON.parse(fs.readFileSync(LEARN_FILE, "utf8"));
const clone = () => structuredClone(FILE);
const stepOf = (c, id) => c.PARTS.flatMap(p => p.phases).flatMap(ph => ph.steps).find(s => s.id === id);
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare(`INSERT INTO users (id, username, password_hash) VALUES (7, 'learner@example.test', 'x')`).run();
  return db;
}

async function serve(db, { user = { id: 7 }, fetchImpl } = {}) {
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  const requireAuth = (req, res, next) => (user ? (req.user = user, next()) : res.status(401).json({ error: "unauthorized" }));
  app.use((req, _r, n) => { req.admin = { email: "curator@example.test" }; n(); });   // the admin guard is mounted in server.js
  app.use("/api/learn", createLearnRouter(db, { requireAuth }));
  app.use("/api/admin/learn", createLearnAdminRouter(db));
  app.use("/api/atlas", createAtlasRouter(db));
  app.use("/api/admin/atlas", createAtlasAdminRouter(db, { fetchImpl: fetchImpl || (async () => { throw new Error("no network in tests"); }), wikiPauseMs: 0, linkPauseMs: 0 }));
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (method, p, body, raw) => {
    const r = await fetch(base + p, { method, headers: { "content-type": "application/json" }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  return { call, close: () => new Promise(r => srv.close(r)) };
}

/** An edited tracker: s1 renamed and given a new item, s2's first item removed, the last pattern removed, a definition
 *  changed, a concept added, s3's last checkpoint dropped. */
function edited() {
  const c = clone();
  const s1 = stepOf(c, "s1"), s2 = stepOf(c, "s2"), s3 = stepOf(c, "s3");
  s1.t = `${s1.t} (revised)`;
  s1.items.push({ id: "s1-new", k: "Video", t: "A new talk", s: "Example", u: "https://example.test/talk", n: "Added by the owner." });
  const removedItem = s2.items.shift().id;
  const removedCheckpoint = `s3#c${s3.c.length - 1}`;
  s3.c.pop();
  const removedPattern = c.ATLAS.pop().id;
  c.INDEX[0].def = `${c.INDEX[0].def} Revised.`;
  c.INDEX.push({ term: "Zeta concept", def: "A synthetic concept added by an import.", st: "s1" });
  return { content: c, removedItem, removedCheckpoint, removedPattern, changedTerm: c.INDEX[0].term };
}

test("D118 P2 · d118ImportValidatesAndDiffs — refused against the schema with the place named; a valid file is diffed by id, written only on Apply, served at once", async () => {
  const db = fixtureDb();
  const s = await serve(db);
  try {
    const refused = async (content, at, reason) => {
      const r = await s.call("POST", "/api/admin/learn/import/preview", { content });
      assert.equal(r.status, 400, `refused: ${at}`);
      assert.ok(r.json.errors.some(e => e.at.startsWith(at) && reason.test(e.reason)), `${at} ${reason} — got ${JSON.stringify(r.json.errors.slice(0, 3))}`);
    };
    await refused({ PARTS: "x", ATLAS: [], INDEX: [] }, "file.PARTS", /must be a list/);
    await refused({ ATLAS: [], INDEX: [] }, "file.PARTS", /is required/);
    const dup = clone(); stepOf(dup, "s2").items[0].id = stepOf(dup, "s1").items[0].id;
    await refused(dup, "PARTS[0]", /is used twice/);
    const js = clone(); stepOf(js, "s1").items[0].u = "javascript:alert(1)";
    await refused(js, "file.PARTS[0].phases[0].steps[0].items[0].u", /links only/);
    const dangling = clone(); dangling.INDEX[0].st = "s9999";
    await refused(dangling, "INDEX[0].st", /does not exist/);
    const extra = clone(); stepOf(extra, "s1").extra = "x";
    await refused(extra, "file.PARTS[0].phases[0].steps[0].extra", /not a field/);
    const badPractice = clone(); badPractice.ATLAS[0].pr[0] = ["Two Sum", "../../etc"];
    await refused(badPractice, "file.ATLAS[0].pr[0]", /leetcode-slug/);
    assert.equal(db.prepare(`SELECT COUNT(*) FROM learn_content`).pluck().get(), 0, "a refusal writes nothing");

    // The live file, unchanged → nothing to apply.
    const same = await s.call("POST", "/api/admin/learn/import/preview", { content: clone() });
    assert.equal(same.status, 200);
    assert.equal(same.json.diff.same, true);

    const e = edited();
    const p = await s.call("POST", "/api/admin/learn/import/preview", { content: e.content });
    assert.equal(p.status, 200, JSON.stringify(p.json?.errors));
    const d = p.json.diff;
    assert.deepEqual(d.items, { added: ["s1-new"], changed: [], removed: [e.removedItem] });
    assert.deepEqual(d.steps.changed.sort(), ["s1", "s2", "s3"], "s1 renamed + an item, s2 lost one, s3 a checkpoint");
    assert.deepEqual([d.steps.added, d.steps.removed], [[], []]);
    assert.deepEqual(d.patterns, { added: [], changed: [], removed: [e.removedPattern] });
    assert.deepEqual(d.concepts, { added: ["Zeta concept"], changed: [e.changedTerm], removed: [] });
    assert.equal(d.same, false);
    assert.equal(p.json.base, 0, "made against the first-install content (no row yet)");
    assert.equal(p.json.counts.items, 373, "373 + 1 − 1");
    assert.equal(db.prepare(`SELECT COUNT(*) FROM learn_content`).pluck().get(), 0, "a PREVIEW writes nothing");
    assert.equal((await s.call("GET", "/api/learn/")).json.PARTS[0].phases[0].steps[0].t, stepOf(FILE, "s1").t, "the public page is unchanged");

    assert.equal((await s.call("POST", "/api/admin/learn/import/apply", { content: e.content })).status, 400, "Apply needs the preview's base");
    const a = await s.call("POST", "/api/admin/learn/import/apply", { content: e.content, base: p.json.base });
    assert.equal(a.status, 200, JSON.stringify(a.json));
    assert.equal(a.json.version, 1);
    assert.deepEqual(a.json.diff.items.added, ["s1-new"]);
    assert.ok(a.json.atlas.conceptsAdded >= 1, "the new concept reaches the Atlas");
    // Live: the very next read serves it — no restart, no deploy.
    const pub = await s.call("GET", "/api/learn/");
    assert.equal(pub.json.PARTS[0].phases[0].steps[0].t, stepOf(e.content, "s1").t);
    assert.equal(pub.json.INDEX.length, 386);
    assert.equal(pub.json.ATLAS.length, 27);
    assert.match(read("routes/learn.js"), /export const LEARN_CACHE = "public, max-age=60";/, "a browser has it within a minute (was an hour)");
    assert.equal(db.prepare(`SELECT definition FROM atlas_nodes WHERE slug = 'zeta-concept'`).pluck().get(), "A synthetic concept added by an import.");
    assert.equal((await s.call("GET", "/api/admin/learn/content")).json.version, 1);
    // A preview made before that Apply is stale now.
    const stale = await s.call("POST", "/api/admin/learn/import/apply", { content: clone(), base: 0 });
    assert.equal(stale.status, 409);
    assert.equal(stale.json.version, 1);
  } finally { await s.close(); }
});

test("D118 P2 · d118ServerNeverEvaluatesUpload — only JSON is accepted; code in its text stays text; no key outside the schema is assigned; nothing server-side can run a script", async () => {
  const db = fixtureDb();
  const s = await serve(db);
  delete globalThis.__d118Ran;
  try {
    const html = read("docs/From silicon to software_ progress tracker.html");
    for (const body of [{ html }, { content: html }, { content: [1, 2] }, { content: "globalThis.__d118Ran = 1" }]) {
      const r = await s.call("POST", "/api/admin/learn/import/preview", body);
      assert.equal(r.status, 400);
      assert.equal(r.json.error, "not_extracted");
      assert.match(r.json.message, /never runs a script/);
    }
    // Code inside the owner's text is TEXT: stored and served verbatim, never run.
    const c = clone();
    const payload = "\"); globalThis.__d118Ran = 1; (\"${globalThis.__d118Ran = 1}</script><script>globalThis.__d118Ran = 1</script>";
    stepOf(c, "s1").g = payload;
    const p = await s.call("POST", "/api/admin/learn/import/preview", { content: c });
    assert.equal(p.status, 200);
    const a = await s.call("POST", "/api/admin/learn/import/apply", { content: c, base: p.json.base });
    assert.equal(a.status, 200);
    assert.equal((await s.call("GET", "/api/learn/")).json.PARTS[0].phases[0].steps[0].g, payload);
    assert.equal(globalThis.__d118Ran, undefined, "nothing in the upload ran");
    // A key the schema does not name is refused — `__proto__` included (express.json keeps it as an own key).
    const raw = JSON.stringify({ content: clone() }).replace('{"content":{', '{"content":{"__proto__":{"d118Polluted":1},');
    const proto = await s.call("POST", "/api/admin/learn/import/preview", null, raw);
    assert.equal(proto.status, 400);
    assert.ok(proto.json.errors.some(e => e.at === "file.__proto__" && /not a field/.test(e.reason)));
    assert.equal(({}).d118Polluted, undefined);
    assert.ok(validateLearnContent({ ...clone(), constructor: { prototype: { x: 1 } } }).errors.some(e => e.at === "file.constructor"));
  } finally { await s.close(); }
  // The server side holds no evaluator: no vm, eval, Function, or the extractor's data-block runner (comments aside).
  const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const f of ["routes/learnAdmin.js", "services/learn/learnImport.js", "services/learn/learnContent.js", "routes/learn.js", "shared/learnTracker.js"]) {
    const src = code(f);
    assert.doesNotMatch(src, /\bvm\b|node:vm|\beval\s*\(|\bFunction\s*\(|runInNewContext|extractTracker|import\(/, `${f} evaluates nothing`);
  }
  assert.doesNotMatch(code("routes/learnAdmin.js"), /dataBlockOf|req\.body\?\.html|req\.body\.html/, "the route never takes a page");
  // The browser extractor: the SAME shared code, run in an origin-less sandbox with no network; only JSON is sent.
  const sandbox = read("client/src/panels/adminLearnSandbox.js");
  assert.match(sandbox, /import \{ dataBlockOf, DATA_RESULT, plainData, assembleLearnFile \} from "\.\.\/\.\.\/\.\.\/shared\/learnTracker\.js";/);
  assert.match(sandbox, /frame\.setAttribute\("sandbox", "allow-scripts"\);/);
  assert.doesNotMatch(code("client/src/panels/adminLearnSandbox.js"), /allow-same-origin/, "no origin: no cookies, no storage, no reach into the admin page");
  assert.equal(SANDBOX_CSP, "default-src 'none'; script-src 'unsafe-inline'", "no network from the sandbox");
  assert.match(read("client/src/panels/adminLearnImport.jsx"), /body: JSON\.stringify\(\{ content \}\)/);
  assert.match(read("scripts/learn/extractTracker.mjs"), /from "\.\.\/\.\.\/shared\/learnTracker\.js";/, "the script uses the same extractor");
});

test("D118 P2 · d118BrowserExtractsPage — the owner's browser extracts the page — the sandbox's document, run, gives EXACTLY the script's file", async () => {
  const html = read("docs/From silicon to software_ progress tracker.html");
  // A stand-in for the browser: appending the iframe runs its document's one script with a `parent` that can only
  // receive a message (what an origin-less sandbox can do), delivered with the frame as its source.
  const listeners = new Set();
  const win = { addEventListener: (_t, f) => listeners.add(f), removeEventListener: (_t, f) => listeners.delete(f) };
  let seenDoc = null, attrs = {};
  const doc = {
    createElement: () => ({ style: {}, contentWindow: {}, setAttribute(k, v) { attrs[k] = v; }, remove() {} }),
    body: { appendChild(frame) {
      seenDoc = frame.srcdoc;
      const script = seenDoc.slice(at(seenDoc, "<script>") + 8, lastAt(seenDoc, "</script>"));
      const parent = { postMessage: (data) => setTimeout(() => { for (const f of [...listeners]) f({ source: frame.contentWindow, data }); }, 0) };
      vm.runInNewContext(script, { parent }, { timeout: 4000 });
    } },
  };
  const fromBrowser = await learnFileFromUpload({ name: "From silicon to software_ progress tracker.html", text: async () => html }, { doc, win, at: "2026-10-31" });
  assert.deepEqual(fromBrowser, buildLearnFile(html, { at: "2026-10-31" }), "the browser's extraction = the script's");
  assert.equal(attrs.sandbox, "allow-scripts");
  assert.match(seenDoc, /^<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'"><script>/);
  assert.equal(listeners.size, 0, "the listener is removed once answered");
  // A .json is parsed, never run.
  const json = await learnFileFromUpload({ name: "x.json", text: async () => JSON.stringify({ PARTS: [], ATLAS: [], INDEX: [] }) }, { doc: null, win: null });
  assert.deepEqual(json, { PARTS: [], ATLAS: [], INDEX: [] });
});

test("D118 P2 · d118ImportKeepsProgress — marks keyed on ids survive an import; new ids take marks at once; a mark on a removed id is kept, not deleted", async () => {
  const db = fixtureDb();
  const removedItem = stepOf(FILE, "s2").items[0].id;
  const s3 = stepOf(FILE, "s3");
  const removedCheckpoint = `s3#c${s3.c.length - 1}`;
  for (const [id, at] of [["s1-code", 100], ["s1#c0", 200], [removedItem, 300], [removedCheckpoint, 400]]) assert.equal(setMark(db, 7, id, true, { now: at }), true, id);
  const before = readProgress(db, 7);
  const s = await serve(db);
  try {
    const e = edited();
    assert.equal(e.removedItem, removedItem);
    const p = await s.call("POST", "/api/admin/learn/import/preview", { content: e.content });
    assert.deepEqual(p.json.progress, { marks: 4, learners: 1, stillPlaced: 2, onRemovedIds: 2 });
    assert.equal((await s.call("POST", "/api/admin/learn/import/apply", { content: e.content, base: p.json.base })).status, 200);
    assert.deepEqual(readProgress(db, 7), before, "every mark — and its date — survives the import");
    // ⭐ D117 C8 (changed on purpose): progress is EARNED — the new item counts when it is opened from draft, at once.
    assert.equal((await s.call("POST", "/api/learn/opened", { id: "s1-new" })).status, 200, "the new item takes an opening at once (no restart)");
    assert.equal((await s.call("POST", "/api/learn/opened", { id: removedItem })).status, 404, "a removed id takes no NEW opening");
    assert.equal(setMark(db, 7, "s1-new", true), true, "the old tick store knows the new id too (kept, never counted)");
    assert.equal((await s.call("GET", "/api/learn/progress")).json.marks.length, 5);
    // The removed item comes back → its old mark (and date) counts again.
    const back = await s.call("POST", "/api/admin/learn/import/preview", { content: clone() });
    assert.deepEqual(back.json.progress, { marks: 5, learners: 1, stillPlaced: 4, onRemovedIds: 1 }, "s1-new is the one now off the page");
    assert.equal((await s.call("POST", "/api/admin/learn/import/apply", { content: clone(), base: back.json.base })).status, 200);
    assert.equal(readProgress(db, 7).find(m => m.id === removedItem).at, 300);
    assert.equal(readProgress(db, 7).length, 5);
  } finally { await s.close(); }
});

test("D118 P2 · d118BootImportOnlyWhenEmpty — content/learn/*.json fills an EMPTY table (a first install) and never runs over newer database content", async () => {
  const db = fixtureDb();
  const first = seedLearnContentIfEmpty(db, { now: 1000 });
  assert.deepEqual(first, { seeded: ["silicon-to-software.json"], skipped: [], kept: 0 });
  const row = db.prepare(`SELECT * FROM learn_content`).get();
  assert.deepEqual([row.id, row.version, row.imported_by], ["silicon-to-software", 1, "seed:content/learn/silicon-to-software.json"]);
  const stored = JSON.parse(row.data);
  assert.deepEqual({ copy: stored.copy, PARTS: stored.PARTS, ATLAS: stored.ATLAS, INDEX: stored.INDEX },
    { copy: FILE.copy, PARTS: FILE.PARTS, ATLAS: FILE.ATLAS, INDEX: FILE.INDEX }, "the file, as is");
  assert.deepEqual(seedLearnContentIfEmpty(db), { seeded: [], skipped: [], kept: 1 }, "a second boot does nothing");

  // The owner imports newer content; a boot after it leaves it alone — even with a different file on disk.
  const s = await serve(db);
  try {
    const e = edited();
    const p = await s.call("POST", "/api/admin/learn/import/preview", { content: e.content });
    assert.equal(p.json.base, 1);
    assert.equal((await s.call("POST", "/api/admin/learn/import/apply", { content: e.content, base: 1 })).json.version, 2);
  } finally { await s.close(); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d118-learn-"));
  try {
    const onDisk = clone(); stepOf(onDisk, "s1").t = "From the file on disk";
    fs.writeFileSync(path.join(dir, "silicon-to-software.json"), JSON.stringify(onDisk));
    fs.writeFileSync(path.join(dir, "another-course.json"), JSON.stringify(onDisk));
    assert.deepEqual(seedLearnContentIfEmpty(db, { dir }), { seeded: [], skipped: [], kept: 1 });
    assert.equal(stepOf(learnContent(db), "s1").t, stepOf(edited().content, "s1").t, "the database's newer content stands");
    assert.equal(db.prepare(`SELECT version FROM learn_content`).pluck().get(), 2);
    assert.equal(db.prepare(`SELECT COUNT(*) FROM learn_content`).pluck().get(), 1, "no other file was read in over a non-empty table");
    // A first install from that directory: every valid file goes in; an invalid one is reported, never written.
    fs.writeFileSync(path.join(dir, "broken.json"), JSON.stringify({ PARTS: [] }));
    const fresh = fixtureDb();
    const r = seedLearnContentIfEmpty(fresh, { dir });
    assert.deepEqual(r.seeded, ["another-course.json", "silicon-to-software.json"]);
    assert.deepEqual(r.skipped.map(k => k.file), ["broken.json"]);
    assert.equal(stepOf(learnContent(fresh), "s1").t, "From the file on disk");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  // At boot: the seed runs before the D115 imports, and those read the DATABASE's content.
  const server = read("server.js");
  assert.ok(at(server, "const s = seedLearnContentIfEmpty(db);") < at(server, "const r = importLearnConcepts(db, learnContent(db));"),
    "the boot seed runs before the Atlas imports");
  assert.match(server, /app\.use\("\/api\/admin\/learn", requireAdmin, createLearnAdminRouter\(db\)\);/);
  assert.match(server, /id: "198_learn_content",/);
});

test("D118 P2 (b) · d118CuratorToolsLive — the curator's tools act on the next read — node editor, Find on Wikipedia, Draft definitions, publish / unpublish; nothing waits for a restart", async () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Zorblex", source: "registry" });
  upsertNode(db, { kind: "tool", name: "Quuxdb", source: "registry" });
  const s = await serve(db);
  try {
    assert.equal((await s.call("GET", "/api/atlas/node/zorblex")).status, 404, "a draft is not public");
    assert.equal((await s.call("POST", "/api/admin/atlas/zorblex/status", { status: "published" })).status, 200);
    assert.equal((await s.call("GET", "/api/atlas/node/zorblex")).status, 200, "published: public on the next read");
    assert.deepEqual((await s.call("GET", "/api/atlas/resolve?terms=zorblex")).json.slugs, { zorblex: "zorblex" });
    // The node editor: the new definition is on the page and in the search at once.
    assert.equal((await s.call("PATCH", "/api/admin/atlas/node/zorblex", { definition: "A synthetic frobnicating scheduler." })).status, 200);
    assert.equal((await s.call("GET", "/api/atlas/node/zorblex")).json.definition, "A synthetic frobnicating scheduler.");
    assert.ok((await s.call("GET", "/api/atlas/search?q=frobnicating")).json.results.some(r => r.slug === "zorblex"), "searchable by its new words");
    // Find on Wikipedia: the pick is stored at once (the summary itself is read by Refresh Wikipedia / the nightly run).
    assert.equal((await s.call("POST", "/api/admin/atlas/node/zorblex/wiki-pick", { title: "Zorblex (software)", wikidataId: "Q42" })).status, 200);
    assert.deepEqual(db.prepare(`SELECT wiki_title, wikidata_id FROM atlas_nodes WHERE slug = 'zorblex'`).get(), { wiki_title: "Zorblex_(software)", wikidata_id: "Q42" });
    // Draft definitions: ⭐ 46f (on purpose) — owner 11-10 approval (3), a40c8689: an imported definition that passes the
    // rules PUBLISHES on the next read (no Accept loop; Recently published + Unpublish is the net — d105AtlasDefinitions).
    assert.equal((await s.call("POST", "/api/admin/atlas/quuxdb/status", { status: "published" })).status, 200);
    const imp = await s.call("POST", "/api/admin/atlas/definitions/import", { text: JSON.stringify({ definitions: [{ slug: "quuxdb", definition: "A synthetic database used only in tests." }] }) });
    assert.equal(imp.status, 200, JSON.stringify(imp.json));
    assert.equal((await s.call("GET", "/api/atlas/node/quuxdb")).json.definition, "A synthetic database used only in tests.", "imported → public on the next read");
    // Unpublish: gone on the next read, from the page, the links and the search.
    assert.equal((await s.call("POST", "/api/admin/atlas/zorblex/status", { status: "draft" })).status, 200);
    assert.equal((await s.call("GET", "/api/atlas/node/zorblex")).status, 404);
    assert.deepEqual((await s.call("GET", "/api/atlas/resolve?terms=zorblex")).json.slugs, {});
    assert.deepEqual((await s.call("GET", "/api/atlas/search?q=zorblex")).json.results, []);
  } finally { await s.close(); }
});
