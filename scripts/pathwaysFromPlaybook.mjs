#!/usr/bin/env node
// ⭐ D155 Part C (approved 11-05) · THE PATHWAYS AS DATA — content/decks/pathways-v1.json, generated from
// docs/research/PLAYBOOK.md's Part C, so the plan the owner approved and the plan the Library shows are one text.
// Each topic is "planned" until a deck covers it; a deck covers a topic when its pathway and stage match and its
// position in the stage (sw-f-01 = the first Foundations topic) is the topic's. Re-run after Part C or a deck batch changes:
//   node scripts/pathwaysFromPlaybook.mjs            (writes the file)
//   node scripts/pathwaysFromPlaybook.mjs --check    (exit 1 when the file is stale — test/d178PathwaysPlan.test.js runs it)
import fs from "node:fs";

export const PATHWAY_IDS = Object.freeze({
  "C.1": "software", "C.2": "data", "C.3": "ml-ai", "C.4": "cloud", "C.5": "security", "C.6": "embedded", "C.7": "qa",
  "C.8": "management", "C.9": "beyond",
});
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Part C → [{ id, title, later, stages: [{ id, title, topics: [title] }] }]. Pure over the playbook's text. */
export function pathwaysFrom(md) {
  const text = md.replace(/\r\n/g, "\n");
  const a = text.indexOf("## Part C");
  if (a < 0) throw new Error("PLAYBOOK.md has no Part C");
  const z = text.indexOf("\n## Part", a + 5);
  const part = text.slice(a, z < 0 ? undefined : z);
  const out = [];
  let cur = null;
  for (const line of part.split("\n")) {
    const h = line.match(/^### (C\.\d+) (.+)$/);
    if (h) {
      const id = PATHWAY_IDS[h[1]];
      if (!id) throw new Error(`unknown pathway ${h[1]}`);
      cur = { id, title: h[2].replace(/\s*\(D\d+.*\)\s*$/, "").trim(), later: /once those fields are live/i.test(h[2]), stages: [] };
      out.push(cur);
      continue;
    }
    const s = cur && line.match(/^- \*\*(.+?):\*\* (.+)$/);
    if (s) {
      const title = s[1].trim();
      cur.stages.push({ id: slug(title), title, topics: s[2].split(" · ").map(t => t.trim()).filter(Boolean) });
    }
  }
  return out;
}

/** Mark each topic with the deck that covers it (pathway + stage + position), from the deck files' own fields. */
export function withDecks(pathways, decks) {
  const byKey = new Map();
  for (const d of decks) {
    const m = String(d.id || "").match(/-(\d+)$/);
    if (m) byKey.set(`${d.pathway}|${d.stage}|${Number(m[1])}`, d);
  }
  return pathways.map(p => ({ ...p, stages: p.stages.map(s => ({ ...s, topics: s.topics.map((t, i) => {
    const d = byKey.get(`${p.id}|${s.id}|${i + 1}`);
    return d ? { title: t, deck: d.id, status: d.status } : { title: t, deck: null, status: "planned" };
  }) })) }));
}

export function buildPlan(root = ".") {
  const md = fs.readFileSync(`${root}/docs/research/PLAYBOOK.md`, "utf8");
  const decks = fs.readdirSync(`${root}/content/decks`).filter(f => /^decks-v\d+\.json$/.test(f)).sort()
    .flatMap(f => JSON.parse(fs.readFileSync(`${root}/content/decks/${f}`, "utf8")).decks || []);
  return { version: 1, source: "docs/research/PLAYBOOK.md Part C (approved by the owner 2026-11-05)", pathways: withDecks(pathwaysFrom(md), decks) };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/").replace(/^\//, "")}` || process.argv[1]?.endsWith("pathwaysFromPlaybook.mjs")) {
  const plan = JSON.stringify(buildPlan(), null, 2) + "\n";
  const file = "content/decks/pathways-v1.json";
  if (process.argv.includes("--check")) {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
    if (cur !== plan) { console.error(`${file} is stale — run node scripts/pathwaysFromPlaybook.mjs`); process.exit(1); }
    console.log("pathways plan current");
  } else {
    fs.writeFileSync(file, plan);
    const p = JSON.parse(plan).pathways;
    const topics = p.flatMap(x => x.stages.flatMap(s => s.topics));
    console.log(`${p.length} pathways · ${p.reduce((a, x) => a + x.stages.length, 0)} stages · ${topics.length} topics · ${topics.filter(t => t.deck).length} written`);
  }
}
