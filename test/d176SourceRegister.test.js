// ⛔ D176 [T3] · THE LEARNING-CENTRE SOURCE REGISTER (content/sources/registry.json, services/sourceRegistry.js).
// The register is the gate on what Atlas may do with another publisher's text: open-reuse / share-alike may be adapted
// (with attribution), everything else is our own summary + a link, and a source whose licence has not been read yet is
// link-only. These pin the register's shape, that rule, and the monthly link check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadRegistry, validateRegistry, registrySummary, effectiveClass, mayAdapt, checkLinks, LICENCE_CLASSES,
  runRegisterLinkCheck, lastLinkCheck }
  from "../services/atlas/sourceRegistry.js";

const reg = loadRegistry();

test("d176SourceRegister: the committed register is valid — unique ids, https, a known class, a date for every checked licence", () => {
  const v = validateRegistry(reg);
  assert.deepEqual(v.problems, []);
  assert.ok(reg.sources.length >= 39, "the CS register (39) at least");
  for (const c of LICENCE_CLASSES) assert.ok(reg.licenceClasses[c], `the class "${c}" is explained in the file`);
});

test("d176LinkOnlyNeverCopied: only open-reuse / share-alike may be adapted; to-verify is link-only until read", () => {
  assert.equal(effectiveClass({ licenceClass: "to-verify" }), "link-only");
  assert.equal(mayAdapt({ licenceClass: "to-verify" }), false);
  assert.equal(mayAdapt({ licenceClass: "link-only" }), false);
  assert.equal(mayAdapt({ licenceClass: "gated" }), false);
  assert.equal(mayAdapt({ licenceClass: "open-reuse" }), true);
  assert.equal(mayAdapt({ licenceClass: "share-alike" }), true);
  for (const s of reg.sources.filter(x => mayAdapt(x))) {
    // 45n D176-1 hand read (4b09edf0) recorded three repositories' licence as "MIT" — a real licence name of three
    // letters; the guard's length floor was one too high (moved on purpose).
    assert.ok(s.licence && s.licence.trim().length >= 3, `${s.id}: an adaptable source names its licence`);
  }
});

test("d176SourceRegister: a broken row is reported, never silently accepted", () => {
  const bad = { licenceClasses: reg.licenceClasses, sources: [
    { id: "dup", publisher: "P", name: "N", url: "https://a.example", licenceClass: "open-reuse", verified: "2026-11-07", pathways: ["data"], vendorNeutral: true },
    { id: "dup", publisher: "P", name: "N", url: "http://b.example", licenceClass: "free", pathways: [], vendorNeutral: "yes" },
  ] };
  const v = validateRegistry(bad);
  assert.equal(v.ok, false);
  for (const want of ["duplicate id", "url must be https", "unknown licenceClass", "at least one pathway", "vendorNeutral", "verified"]) {
    assert.ok(v.problems.some(p => p.includes(want)), `reported: ${want}`);
  }
});

test("d176SourceRegister: the summary counts classes and names what still needs its licence read", () => {
  const s = registrySummary(reg);
  assert.equal(s.total, reg.sources.length);
  assert.equal(Object.values(s.byClass).reduce((a, b) => a + b, 0), reg.sources.length);
  assert.deepEqual(s.toVerify, reg.sources.filter(x => x.licenceClass === "to-verify").map(x => x.id));
  assert.ok(s.byPathway.data.sources > 0 && s.byPathway.software.sources > 0);
  assert.equal(s.validation.ok, true);
});

test("d176DeadLinkHidden: the link check marks a dead or unreachable source, and retries a refused HEAD as GET", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(`${init.method} ${url}`);
    if (url.includes("dead")) return { status: 404 };
    if (url.includes("nohead")) return { status: init.method === "HEAD" ? 405 : 200 };
    if (url.includes("down")) throw new Error("ECONNREFUSED");
    return { status: 200 };
  };
  const r = await checkLinks({ sources: [
    { id: "ok", url: "https://ok.example" }, { id: "dead", url: "https://dead.example" },
    { id: "nohead", url: "https://nohead.example" }, { id: "down", url: "https://down.example" },
  ] }, { fetchImpl });
  const by = Object.fromEntries(r.map(x => [x.id, x]));
  assert.equal(by.ok.ok, true);
  assert.deepEqual([by.dead.ok, by.dead.status], [false, 404]);
  assert.equal(by.nohead.ok, true);
  assert.ok(calls.includes("GET https://nohead.example"));
  assert.equal(by.down.ok, false);
  assert.match(by.down.error, /ECONNREFUSED/);
});

test("d176SourceRegister: Admin → Atlas reads it (the route and the panel)", () => {
  const routes = fs.readFileSync(new URL("../routes/atlas.js", import.meta.url), "utf8");
  assert.match(routes, /router\.get\("\/sources"/, "GET /api/admin/atlas/sources (createAtlasAdminRouter)");
  assert.match(routes, /router\.post\("\/sources\/check"/, "POST /api/admin/atlas/sources/check — the link check, now");
  const panel = fs.readFileSync(new URL("../client/src/panels/adminAtlas.jsx", import.meta.url), "utf8");
  assert.match(panel, /\/api\/admin\/atlas\/sources/);
  assert.match(panel, /data-admin-atlas-sources/);
});

test("d176DeadLinkHidden: the register's check runs monthly (forced from Admin), and its results are kept for Admin", async () => {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(":memory:");
  db.exec("CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)");
  const reg2 = { sources: [{ id: "a", url: "https://a.example" }, { id: "b", url: "https://dead.example" }] };
  const fetchImpl = async (url) => ({ status: url.includes("dead") ? 410 : 200 });
  const t0 = 1_800_000_000;
  const first = await runRegisterLinkCheck(db, { reg: reg2, fetchImpl, nowSec: t0 });
  assert.deepEqual(first, { ran: true, checked: 2, dead: ["b"] });
  assert.deepEqual(lastLinkCheck(db).results.map(r => [r.id, r.ok]), [["a", true], ["b", false]]);
  assert.equal((await runRegisterLinkCheck(db, { reg: reg2, fetchImpl, nowSec: t0 + 86400 })).ran, false, "not again within the month");
  assert.equal((await runRegisterLinkCheck(db, { reg: reg2, fetchImpl, nowSec: t0 + 86400, force: true })).ran, true, "Admin's button forces it");
  assert.equal((await runRegisterLinkCheck(db, { reg: reg2, fetchImpl, nowSec: t0 + 31 * 86400 })).ran, true, "and a month later it runs");
  db.close();
});

test("d176RestrictedSourceNeverSentToModel: a restricted or unknown source is refused before any model is called", async () => {
  const { blockedForModel, aiRestricted } = await import("../services/atlas/sourceRegistry.js");
  const restricted = reg.sources.filter(s => aiRestricted(s));
  assert.ok(restricted.length >= 1, "the register records at least one source whose AI terms forbid model use (OpenStax)");
  const open = reg.sources.find(s => !aiRestricted(s));
  assert.deepEqual(blockedForModel([open.id]), []);
  assert.deepEqual(blockedForModel([restricted[0].id]).map(b => b.id), [restricted[0].id]);
  assert.match(blockedForModel(["no-such-source"])[0].why, /not in the source register/);

  const { callTask } = await import("../services/modelGateway.js");
  let called = 0;
  const anthropic = { messages: { create: async () => { called++; return { content: [{ type: "text", text: "x" }], usage: {} }; } } };
  await assert.rejects(callTask({ task: "cover_letter.write", anthropic, db: null, sources: [restricted[0].id], messages: [] }),
    (e) => e.code === "restricted_source" && e.status === 422);
  assert.equal(called, 0, "nothing was sent");
  const gw = fs.readFileSync(new URL("../services/modelGateway.js", import.meta.url), "utf8");
  assert.match(gw, /const blocked = blockedForModel\(sources\);/);
});
