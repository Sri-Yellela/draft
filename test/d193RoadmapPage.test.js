// ⭐ D193-5 (47c, owner 11-23: "GO AHEAD") · the data-engineering roadmap — the guided route inside the course (migration
// 281, data like the routes seeded in 202) and the public page /learn/data-engineering-roadmap, with D194 P4's preview.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { renderRoadmapPage, roadmapData, STATIONS, ROADMAP_PATH, ROADMAP_TITLE } from "../services/learn/roadmapPage.js";
import { approvedDecks } from "../services/learn/learnDecks.js";

const fresh = () => { const db = new Database(":memory:"); for (const m of MIGRATIONS) db.exec(m.sql); return db; };

test("d193RoadmapRoute: migration 281 adds the route over the circle's pieces, in station order, and never overwrites an Admin edit", () => {
  const db = fresh();
  const r = db.prepare("SELECT name, targets, position FROM learn_routes WHERE id = 'data-engineering'").get();
  assert.equal(r.name, "Data engineering roadmap");
  assert.deepEqual(JSON.parse(r.targets), ["b1", "c3", "c5", "lx1", "b2", "o4", "x2"]);
  const pieces = JSON.stringify(JSON.parse(fs.readFileSync("content/learn/silicon-to-software.json", "utf8")));
  for (const id of JSON.parse(r.targets)) assert.ok(pieces.includes(`"id":"${id}"`), `${id} is a course piece`);
  // an edit made in Admin survives a re-run of the migration (INSERT OR IGNORE)
  db.prepare("UPDATE learn_routes SET name = 'Edited' WHERE id = 'data-engineering'").run();
  db.exec(MIGRATIONS.find(m => m.id === "281_learn_route_data_engineering").sql);
  assert.equal(db.prepare("SELECT name FROM learn_routes WHERE id = 'data-engineering'").pluck().get(), "Edited");
});

test("d193RoadmapPage: the stations in order, each linking only APPROVED decks; Databricks folded into Spark", () => {
  const served = new Set(approvedDecks().map(d => d.id));
  const { stations } = roadmapData();
  assert.deepEqual(stations.map(s => s.n), STATIONS.map((_, i) => i + 1));
  assert.equal(stations[0].name, "SQL"); assert.equal(stations.at(-1).name, "End-to-end projects");
  for (const s of stations) for (const d of s.decks) assert.ok(served.has(d.id), `${d.id} served`);
  assert.ok(!stations.some(s => /databricks/i.test(s.name)), "no Databricks station");
  assert.match(stations.find(s => s.name === "Spark").line, /Databricks/);
  // a deck that is not approved is never linked
  const { stations: thin } = roadmapData(approvedDecks().filter(d => d.id !== "da-f-03"));
  assert.deepEqual(thin.find(s => s.name === "Python").decks, []);
});

test("d193RoadmapPage: the public page — title, canonical, ItemList of the linked decks, no script but the JSON-LD", () => {
  const { status, html } = renderRoadmapPage({ base: "https://jobsviadraft.com" });
  assert.equal(status, 200);
  assert.match(html, new RegExp(`<title>${ROADMAP_TITLE} \\| draft</title>`));
  assert.match(html, /<link rel="canonical" href="https:\/\/jobsviadraft\.com\/learn\/data-engineering-roadmap">/);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld["@type"], "ItemList");
  assert.equal(ld.numberOfItems, roadmapData().deckCount);
  assert.ok(ld.itemListElement.every(i => /^https:\/\/jobsviadraft\.com\/atlas\/library\/[a-z]+-[a-z]+-\d+$/.test(i.url)));
  assert.equal((html.match(/<script/g) || []).length, 1, "only the JSON-LD");
  for (const s of STATIONS) assert.ok(html.includes(`data-station="${s.n}"`), `station ${s.n}`);
});

test("d194P4LandingPreview: the first deck's first three points, one at a time, CSS only, instant under reduced motion, then sign up", () => {
  const { html } = renderRoadmapPage({ base: "https://x.test" });
  const { preview } = roadmapData();
  assert.equal(preview.points.length, 3);
  const sec = (html.match(/data-roadmap-preview="[^"]+"[\s\S]*?<\/section>/) || [""])[0];
  assert.ok(sec.length > 0, "the preview section");
  assert.equal((sec.match(/class="pt"/g) || []).length, 3);
  assert.match(sec, /Sign up to keep learning/);
  assert.match(html, /@media \(prefers-reduced-motion:reduce\)\{\.preview \.pt,\.preview \.after\{animation:none;opacity:1\}\}/);
  assert.ok(!/<audio|<video|speechSynthesis/i.test(html), "never sound");
});

test("d193RoadmapWired: server.js serves the page and lists it in /sitemap.xml", () => {
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /import \{ renderRoadmapPage, ROADMAP_PATH \} from "\.\/services\/learn\/roadmapPage\.js";/);
  assert.match(src, /app\.get\(ROADMAP_PATH, \(req, res\) => \{\r?\n  const page = renderRoadmapPage\(\{ base: appBaseUrl\(req\) \}\);/);
  assert.match(src, /\{ path: ROADMAP_PATH, changefreq: "monthly", priority: "0\.7" \}/);
  assert.equal(ROADMAP_PATH, "/learn/data-engineering-roadmap");
});
