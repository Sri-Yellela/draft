// ⭐ 47o (owner 11-27, approved: docs/ATLAS_WIKI_PLAN_47o.md) · THE ATLAS AS A WIKI — one entry per meaning, linked from
// every Atlas text the same way; a word with several meanings resolved by the five rules or sent to its disambiguation
// page; the curated file (hubs, senses, merges, renames) imported idempotently. Synthetic nodes; the real router in memory.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus, aliasesOf } from "../services/atlas/atlasStore.js";
import { importCurated } from "../services/atlas/atlasCurated.js";
import { atlasTextData, wordPage, senseWordOf, redirectOf } from "../services/atlas/atlasSenses.js";
import { linkAtlasText, resolveSense, windowWords } from "../shared/atlasText.js";
import { createAtlasRouter } from "../routes/atlas.js";

function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const publish = (db, kind, name, extra = {}) => {
  const n = upsertNode(db, { kind, name, source: "registry", ...extra });
  const slug = db.prepare(`SELECT slug FROM atlas_nodes WHERE id = ?`).pluck().get(n.id);
  setStatus(db, slug, "published");
  return slug;
};
const linked = (segs) => segs.filter(s => s.slug).map(s => [s.text, s.slug, !!s.disambiguation]);
const joined = (segs) => segs.map(s => s.text).join("");

const CURATED = {
  entries: [
    { name: "CPU", kind: "concept", family: "systems", aliases: ["central processing unit"], definition: "The general-purpose processor." },
    { name: "Kernel (operating system)", kind: "concept", family: "systems", aliases: ["OS kernel"], definition: "The core of an operating system.",
      sense: { word: "kernel", cues: ["operating system", "linux", "syscall"], domains: ["systems"] } },
    { name: "Compute kernel", kind: "concept", family: "ml", aliases: ["CUDA kernel"], definition: "A function a GPU runs on many threads.",
      sense: { word: "kernel", cues: ["gpu", "threads", "cuda"], domains: ["game_graphics"] } },
    { name: "Kernel method", kind: "concept", family: "ml", aliases: ["kernel trick"], definition: "A way of comparing data points.",
      sense: { word: "kernel", cues: ["svm", "rbf"], domains: ["research_science"] } },
  ],
  senses: [{ slug: "go", word: "Go", cues: ["golang", "programming", "python"] }],
  renames: [{ slug: "cloud-computing-aws-azure-google-cloud", name: "Cloud computing", redirectFrom: ["cloud-computing"] }],
  merges: [{ winner: "financial-models", loser: "financial-modelling" }],
  edges: [{ from: "cpu-core", type: "part_of", to: "cpu" }],
};

function seeded() {
  const db = fixtureDb();
  publish(db, "tool", "Python");
  publish(db, "concept", "GPU");
  publish(db, "concept", "CPU core");
  publish(db, "tool", "Go");
  publish(db, "concept", "Cloud computing (AWS, Azure, Google Cloud)");
  publish(db, "skill", "financial models");
  publish(db, "skill", "financial modelling");
  return db;
}

test("atlasWiki47o: migration 284 adds the sense columns, the mentions and the redirects", () => {
  const db = fixtureDb();
  const cols = db.prepare(`PRAGMA table_info(atlas_nodes)`).all().map(c => c.name);
  for (const c of ["sense_of", "sense_cues", "sense_domains"]) assert.ok(cols.includes(c), c);
  assert.ok(db.prepare(`SELECT 1 FROM sqlite_master WHERE name = 'atlas_mentions'`).get());
  assert.ok(db.prepare(`SELECT 1 FROM sqlite_master WHERE name = 'atlas_redirects'`).get());
});

test("atlasWiki47o: the curated import adds and publishes the hubs and senses, merges, renames — and a second run writes nothing", () => {
  const db = seeded();
  const r = importCurated(db, CURATED);
  assert.deepEqual(r.created.sort(), ["compute-kernel", "cpu", "kernel-method", "kernel-operating-system"]);
  assert.equal(r.senses, 4);
  assert.deepEqual(r.renamed, ["cloud-computing-aws-azure-google-cloud"]);
  assert.deepEqual(r.merged, ["financial-modelling → financial-models"]);
  assert.equal(r.edges, 1);
  assert.deepEqual(r.refused, []);
  const st = (s) => db.prepare(`SELECT status, unpublished_by, name FROM atlas_nodes WHERE slug = ?`).get(s);
  assert.equal(st("cpu").status, "published");
  assert.equal(st("financial-modelling").status, "draft");
  assert.ok(st("financial-modelling").unpublished_by, "the loser's un-publish sticks against the auto-publisher");
  assert.equal(st("cloud-computing-aws-azure-google-cloud").name, "Cloud computing");
  assert.equal(redirectOf(db, "financial-modelling"), "financial-models");
  assert.equal(redirectOf(db, "cloud-computing"), "cloud-computing-aws-azure-google-cloud");
  const winnerTerm = db.prepare(`SELECT term FROM atlas_nodes WHERE slug = 'financial-models'`).pluck().get();
  assert.ok(aliasesOf(db, winnerTerm).includes("financial modelling"), "the loser's term finds the winner");
  const before = db.prepare(`SELECT COALESCE(MAX(updated_at), 0) || ':' || COUNT(*) FROM atlas_nodes`).pluck().get();
  const changes = db.prepare(`SELECT total_changes()`).pluck().get();
  const again = importCurated(db, CURATED, { now: 9_999_999_999 });
  assert.deepEqual([again.created, again.published, again.senses, again.aliases, again.renamed, again.merged, again.edges], [[], [], 0, 0, [], [], 0]);
  assert.equal(db.prepare(`SELECT COALESCE(MAX(updated_at), 0) || ':' || COUNT(*) FROM atlas_nodes`).pluck().get(), before, "nothing touched");
  assert.equal(db.prepare(`SELECT total_changes()`).pluck().get(), changes, "no write at all on a steady boot");
});

test("atlasWiki47o: a sense word's page is never an entry's address (refused, not overwritten)", () => {
  const db = seeded();
  publish(db, "concept", "kernel");
  const r = importCurated(db, { entries: [CURATED.entries[1]] });
  assert.equal(r.created.length, 0);
  assert.match(r.refused[0], /kernel is an entry's address/);
});

test("atlasWiki47o: the text terms — senses grouped, the bare word only through the resolver, ambiguous words without senses left out", () => {
  const db = seeded();
  publish(db, "tool", "Rust");   // on the ambiguous list, no sense data
  importCurated(db, CURATED);
  const d = atlasTextData(db);
  const slugs = d.terms.map(t => t.slug);
  assert.ok(slugs.includes("python") && slugs.includes("gpu") && slugs.includes("cpu"));
  assert.ok(!slugs.includes("rust"), "an ambiguous word with no sense data is never linked in Atlas text");
  assert.ok(!slugs.includes("go"), "Go's only form is its sense word");
  const kernel = d.senses.find(g => g.word === "kernel");
  assert.deepEqual(kernel.senses.map(s => s.slug).sort(), ["compute-kernel", "kernel-method", "kernel-operating-system"]);
  assert.equal(kernel.slug, "kernel");
  const ck = d.terms.find(t => t.slug === "compute-kernel");
  assert.ok(ck.forms.some(f => /cuda kernel/i.test(f.text)), "the phrase stays a straight link");
  assert.ok(!ck.forms.some(f => f.text.toLowerCase() === "kernel"), "the bare word is the resolver's");
});

test("atlasWiki47o: the five rules — phrase, neighbours, domain, one meaning, else the disambiguation page", () => {
  const db = seeded();
  importCurated(db, CURATED);
  const d = atlasTextData(db);
  // 1. a phrase with its own entry wins
  assert.deepEqual(linked(linkAtlasText("Each CUDA kernel runs on thousands of threads.", d)), [["CUDA kernel", "compute-kernel", false]]);
  // 2. the words next to it
  assert.deepEqual(linked(linkAtlasText("The Linux kernel schedules work.", d)).find(x => x[0] === "kernel"), ["kernel", "kernel-operating-system", false]);
  assert.deepEqual(linked(linkAtlasText("An SVM with an RBF kernel separates curved data.", d)), [["kernel", "kernel-method", false]]);
  // 3. the page's domain
  assert.deepEqual(linked(linkAtlasText("The driver hands each kernel to the hardware.", d, { domain: ["game_graphics"] })), [["kernel", "compute-kernel", false]]);
  // 5. nothing settles it → the disambiguation page, never a guess
  assert.deepEqual(linked(linkAtlasText("A kernel is small.", d)), [["kernel", "kernel", true]]);
  // 4. one meaning that is everyday English: only beside its cues
  assert.deepEqual(linked(linkAtlasText("Go to the next step.", d)), []);
  assert.deepEqual(linked(linkAtlasText("Write services in Go and Python.", d)), [["Go", "go", false], ["Python", "python", false]]);
  // one meaning, no sense: straight
  assert.deepEqual(linked(linkAtlasText("A GPU beats a CPU at matrix math.", d)), [["GPU", "gpu", false], ["CPU", "cpu", false]]);
});

test("atlasWiki47o: the text is never changed; self is never linked; max caps the links; first occurrence only", () => {
  const db = seeded();
  importCurated(db, CURATED);
  const d = atlasTextData(db);
  const t = "A GPU and a CPU; the GPU again, and Python.";
  assert.equal(joined(linkAtlasText(t, d)), t);
  assert.deepEqual(linked(linkAtlasText(t, d, { self: "gpu" })).map(x => x[1]), ["cpu", "python"]);
  assert.equal(linked(linkAtlasText(t, d, { max: 1 })).length, 1);
  assert.equal(linked(linkAtlasText(t, d)).filter(x => x[1] === "gpu").length, 1);
  const used = new Set();
  linkAtlasText("A GPU.", d, { used });
  assert.deepEqual(linked(linkAtlasText("Another GPU.", d, { used })), [], "carried across one page's blocks");
});

test("atlasWiki47o: the window and the resolver, pure", () => {
  assert.deepEqual(windowWords("one two three KERNEL four five", 14, 20, 2), ["two", "three", "four", "five"]);
  const g = { slug: "kernel", senses: [{ slug: "a", cues: ["x"], domains: ["d1"] }, { slug: "b", cues: ["y"], domains: ["d2"] }] };
  assert.deepEqual(resolveSense(g, "x kernel", 2, 8), { slug: "a" });
  assert.deepEqual(resolveSense(g, "a kernel", 2, 8, { domain: ["d2"] }), { slug: "b" });
  assert.deepEqual(resolveSense(g, "a kernel", 2, 8), { slug: "kernel", disambiguation: true });
  assert.equal(resolveSense({ slug: "go", senses: [{ slug: "go", cues: ["golang"] }] }, "go home", 0, 2, { domain: ["d1"] }), null);
});

test("atlasWiki47o: the router — text-terms (ETag), the word page, resolve and search send a bare word to its page, the old address answers", async () => {
  const db = seeded();
  importCurated(db, CURATED);
  const app = express();
  app.use("/api/atlas", createAtlasRouter(db));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/atlas`;
  try {
    const tt = await fetch(`${base}/text-terms`);
    assert.equal(tt.status, 200);
    const body = await tt.json();
    assert.ok(body.terms.length && body.senses.length);
    assert.equal((await fetch(`${base}/text-terms`, { headers: { "If-None-Match": tt.headers.get("etag") } })).status, 304);
    const w = await (await fetch(`${base}/word/kernel`)).json();
    assert.equal(w.word, "kernel");
    assert.equal(w.senses.length, 3);
    assert.ok(w.senses.every(s => s.meaning));
    assert.equal((await fetch(`${base}/word/go`)).status, 404, "one meaning: no disambiguation page");
    assert.deepEqual((await (await fetch(`${base}/resolve?terms=kernel,CPU`)).json()).slugs, { kernel: "kernel", CPU: "cpu" });
    const s = await (await fetch(`${base}/search?q=kernel`)).json();
    assert.deepEqual([s.results[0].kind, s.results[0].slug, s.results[0].meanings], ["word", "kernel", 3]);
    const old = await (await fetch(`${base}/node/financial-modelling`)).json();
    assert.deepEqual([old.slug, old.redirectedFrom], ["financial-models", "financial-modelling"]);
    const miss = await fetch(`${base}/node/kernel`);
    assert.equal(miss.status, 404);
    assert.equal((await miss.json()).word, "kernel", "the node 404 names the word page");
    assert.equal(senseWordOf(db, "Kernel"), "kernel");
    assert.equal(wordPage(db, "nothing"), null);
  } finally { server.close(); }
});

test("atlasWiki47o: W3 \"Linked from\" — rebuilt from the entries' meanings and the lessons, grouped by domain; skipped when nothing moved", async () => {
  const { rebuildMentions, linkedFrom, mentionsFingerprint } = await import("../services/atlas/atlasMentions.js");
  const db = seeded();
  importCurated(db, CURATED);
  const def = (slug, text, family) => db.prepare(`UPDATE atlas_nodes SET definition = ?, family = ? WHERE slug = ?`).run(text, family, slug);
  publish(db, "concept", "Option pricing"); def("option-pricing", "Pricing an option, often by Monte Carlo on a GPU.", "quant");
  publish(db, "concept", "Transformer"); def("transformer", "A model trained on a GPU with Python.", "ml");
  def("cpu-core", "One core of a CPU; a GPU has thousands.", "systems");
  const r = await rebuildMentions(db, { slice: 2 });
  assert.ok(r.rows > 0 && r.sources > 0);
  const gpu = linkedFrom(db, "gpu");
  assert.ok(gpu.total >= 3, `GPU is linked from the three meanings (+ any lesson): ${gpu.total}`);
  const keys = gpu.groups.map(g => g.key);
  for (const k of ["quant", "ml", "systems"]) assert.ok(keys.includes(k), k);
  assert.ok(gpu.groups.find(g => g.key === "quant").items.some(i => i.kind === "entry" && i.ref === "option-pricing"));
  assert.equal(linkedFrom(db, "option-pricing").groups.find(g => g.key === "quant"), undefined, "an entry never links itself");
  assert.deepEqual(await rebuildMentions(db), { skipped: true }, "the same fingerprint → nothing to do");
  def("transformer", "A model trained with Python.", "ml");
  assert.notEqual(mentionsFingerprint(db), db.prepare(`SELECT v FROM atlas_live_state WHERE k = 'mentions_fp'`).pluck().get());
  await rebuildMentions(db);
  assert.ok(!linkedFrom(db, "gpu").groups.some(g => g.items.some(i => i.ref === "transformer")), "a meaning that stops linking drops out");
});

test("atlasWiki47o: W5 the empty families — placed when unset or machine-set; a curator's family never moves; quiet on a second run", () => {
  const db = seeded();
  publish(db, "tool", "Selenium");
  publish(db, "tool", "React");
  publish(db, "concept", "Rootkit");
  db.prepare(`UPDATE atlas_nodes SET family = 'backend', family_by = 'seed' WHERE slug = 'react'`).run();
  db.prepare(`UPDATE atlas_nodes SET family = 'systems', family_by = 'owner@example.test' WHERE slug = 'rootkit'`).run();
  const data = { families: { qa: ["selenium"], frontend: ["react"], security: ["rootkit"], nonsense: ["x"] } };
  const r = importCurated(db, data);
  assert.equal(r.placed, 2);
  assert.match(r.refused.join(";"), /nonsense \(no such family\)/);
  const fam = (s) => db.prepare(`SELECT family, family_by FROM atlas_nodes WHERE slug = ?`).get(s);
  assert.deepEqual(fam("selenium"), { family: "qa", family_by: "curated" });
  assert.deepEqual(fam("react"), { family: "frontend", family_by: "curated" });
  assert.deepEqual(fam("rootkit"), { family: "systems", family_by: "owner@example.test" }, "the curator wins");
  assert.equal(importCurated(db, data).placed, 0);
});

test("atlasWiki47o: the shipped curated file is well-formed — every family real, every sense word free, the kernel's three meanings", async () => {
  const { readCurated } = await import("../services/atlas/atlasCurated.js");
  const { isFamily } = await import("../shared/atlasFamilies.js");
  const c = readCurated();
  for (const e of c.entries) { assert.ok(isFamily(e.family), e.name); assert.ok(e.definition && e.definition.length < 240, e.name); }
  for (const f of Object.keys(c.families)) assert.ok(isFamily(f), f);
  assert.equal(c.entries.filter(e => e.sense?.word === "kernel").length, 3);
  const db = fixtureDb();
  for (const s of ["cpu-core", "cpu-cache", "kernel-module", "linux-kernel", "cuda", "gpu"]) publish(db, "concept", s.replace(/-/g, " "));
  const r = importCurated(db, c);
  assert.ok(r.created.includes("monte-carlo-method") && r.created.includes("kernel-operating-system"));
  assert.ok(!r.refused.some(x => /address/.test(x)), r.refused.join("; "));
});
