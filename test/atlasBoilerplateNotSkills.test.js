import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { atlasTermsFor, formsOf } from "../services/atlas/atlasLinks.js";
import { postingMatcher, POSTING_MATCH, countedLines, headingKind } from "../services/atlas/postingMatcher.js";
import { linkSegments } from "../shared/atlasLinks.js";
import { COMMON_PHRASES } from "../shared/atlasCommonPhrases.js";

// ⭐ BUG 10-31 · BOILERPLATE COUNTS AS SKILLS — the one matcher (services/atlas/postingMatcher.js) reads a posting's
// skills without its company's boilerplate, from its requirements when it has them, short concepts in their exact case
// and no concept inside a common phrase. Synthetic companies and postings; an in-memory database from the migrations.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const node = (db, kind, name) => {
  const { id } = upsertNode(db, { kind, name, source: "registry" });
  setStatus(db, db.prepare(`SELECT slug FROM atlas_nodes WHERE id = ?`).pluck().get(id), "published");
  return id;
};
let seq = 0;
const post = (db, company, title, description) => {
  const id = `bp${++seq}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, is_active) VALUES (?,?,?,?,?,?,?,1)`)
    .run(id, "q", `h${id}`, title, company, `https://x.test/${id}`, description);
  return id;
};
const statOf = (db, name) => db.prepare(`SELECT s.postings FROM atlas_node_stats s JOIN atlas_nodes n ON n.id = s.node_id WHERE n.name = ?`).pluck().get(name);
const nodesOf = (db) => db.prepare(`SELECT id, kind, name, term FROM atlas_nodes`).all();
const askedNames = (db, p) => {
  const nodes = nodesOf(db);
  const byId = new Map(nodes.map(n => [n.id, n.name]));
  return postingMatcher(db, nodes).askedBy(p).map(id => byId.get(id)).sort();
};

const ABOUT = "Acme builds payment software on Kubernetes for millions of merchants around the world.";

test("BUG 10-31 · boilerplateStrippedPerCompany — a sentence in ≥ 30 % (and ≥ 3) of ONE company's postings is not matched; another company's single copy is", () => {
  const db = fixtureDb();
  node(db, "tool", "Kubernetes");
  node(db, "tool", "TypeScript");
  // Acme: the about-us sentence in 4 of 10 postings (40 %) — Acme's boilerplate. One posting also asks for it for real.
  for (let i = 0; i < 4; i++) post(db, "Acme", `Engineer ${i}`, `${ABOUT}\nYou will write TypeScript services.`);
  const real = post(db, "Acme", "Platform Engineer", "You will run Kubernetes clusters in production every day.");
  for (let i = 0; i < 5; i++) post(db, "Acme", `Designer ${i}`, "You will draw the checkout flows for our merchants.");
  // Beta: the same sentence once — one posting's sentence is never "repeated": it counts.
  post(db, "Beta", "Engineer", ABOUT);
  // Gamma: in 3 of 12 postings (25 %) — under the share, so it counts.
  for (let i = 0; i < 3; i++) post(db, "Gamma", `Engineer ${i}`, `${ABOUT.replace("Acme", "Gamma")}`);
  for (let i = 0; i < 9; i++) post(db, "Gamma", `Analyst ${i}`, "You will read the numbers every single week for the team.");

  computeAtlasStats(db);
  assert.equal(statOf(db, "Kubernetes"), 1 + 1 + 3, "Acme's 4 boilerplate copies are gone; its real one, Beta's and Gamma's count");
  assert.equal(statOf(db, "TypeScript"), 4, "the rest of a boilerplate posting still counts");
  assert.equal(POSTING_MATCH.BOILERPLATE_SHARE, 0.30);
  assert.equal(POSTING_MATCH.BOILERPLATE_MIN_POSTINGS, 3);

  // The same rule decides D114's links (the one matcher): Acme's boilerplate links nothing, Beta's copy links.
  const slugs = (job) => atlasTermsFor(db, job).map(t => t.slug);
  assert.deepEqual(slugs({ title: "Engineer", company: "Acme", description: ABOUT }), []);
  assert.deepEqual(slugs({ title: "Engineer", company: "Beta", description: ABOUT }), ["kubernetes"]);
  assert.ok(db.prepare(`SELECT 1 FROM scraped_jobs WHERE job_id = ?`).get(real));

  // Refreshed with the crawl: Acme's postings retire until the sentence is in fewer than 3 → it counts again.
  db.prepare(`UPDATE scraped_jobs SET is_active = 0 WHERE company = 'Acme' AND title IN ('Engineer 0', 'Engineer 1')`).run();
  assert.deepEqual(slugs({ title: "Engineer", company: "Acme", description: ABOUT }), ["kubernetes"], "the cache followed the board");
  computeAtlasStats(db);
  assert.equal(statOf(db, "Kubernetes"), 2 + 1 + 1 + 3);
});

const REQ_POSTING = [
  "Acme is a fast-growing company. Our stack: Python everywhere.",
  "",
  "Responsibilities:",
  "- Run Kubernetes clusters",
  "",
  "What you'll bring",
  "- 3+ years of TypeScript",
  "",
  "Preferred Qualifications:",
  "- GraphQL in production",
].join("\n");

test("BUG 10-31 · requirementsSectionCounted — with a requirements heading, skills come from requirements + responsibilities; the text before them does not count", () => {
  const db = fixtureDb();
  for (const n of ["Python", "Kubernetes", "TypeScript", "GraphQL"]) node(db, "tool", n);
  assert.deepEqual(askedNames(db, { title: "Engineer", company: "Solo", text: REQ_POSTING }), ["GraphQL", "Kubernetes", "TypeScript"]);
  // No requirements heading → the whole text counts (the boilerplate rule only).
  const flat = REQ_POSTING.replace("What you'll bring", "Also").replace("Preferred Qualifications:", "More");
  assert.deepEqual(askedNames(db, { title: "Engineer", company: "Solo", text: flat }), ["GraphQL", "Kubernetes", "Python", "TypeScript"]);
  // The headings the BUG row names are read as requirements.
  for (const h of ["Requirements", "Qualifications:", "Minimum qualifications", "What you'll bring:", "What You’ll Bring", "You have:", "**Requirements**", "## Qualifications", "Ideally you'd have:", "Preferred skills"])
    assert.equal(headingKind(h), "requirements", h);
  for (const h of ["Responsibilities", "What you'll do:", "In this role, you will:"]) assert.equal(headingKind(h), "responsibilities", h);
  assert.equal(headingKind("- Requirements gathering with customers"), null, "a bullet is never a heading");
  assert.equal(headingKind("We are looking for strong requirements."), null, "a sentence is never a heading");
});

test("BUG 10-31 · benefitsAndEeoNotCounted — benefits, EEO and about-us sections after the requirements are not counted", () => {
  const db = fixtureDb();
  for (const n of ["Python", "Kubernetes", "TypeScript", "React"]) node(db, "tool", n);
  const text = [
    "Requirements:",
    "- TypeScript",
    "Benefits",
    "- A Python learning stipend",
    "Equal Opportunity Employer:",
    "Acme is an equal opportunity employer; see our React-based careers site.",
    "About Acme",
    "We run Kubernetes everywhere.",
  ].join("\n");
  assert.deepEqual(askedNames(db, { title: "Engineer", company: "Solo", text }), ["TypeScript"]);
  const lines = countedLines(text);
  assert.ok(!lines.some(l => /stipend|equal opportunity|Kubernetes/.test(l)), "none of the three sections is read");
  for (const h of ["Benefits", "Perks & Benefits", "Equal Employment Opportunity", "EEO Statement", "About us", "About Acme", "Compensation"])
    assert.equal(headingKind(h), "skip", h);
});

test("BUG 10-31 · shortConceptExactCase — a concept shorter than 5 characters matches only whole, in its exact casing", () => {
  const db = fixtureDb();
  node(db, "concept", "CDN");
  node(db, "concept", "Firmware");
  const asks = (text) => askedNames(db, { title: "Engineer", company: "Solo", text });
  assert.deepEqual(asks("Read our policy at https://cdn.acme.com/policies/eeo.pdf."), [], "a host name is not the concept");
  assert.deepEqual(asks("We cache at the cdn layer."), [], "lower case is not the concept");
  assert.deepEqual(asks("Load the CDN.js bundle."), [], "a dotted name is not the concept");
  assert.deepEqual(asks("We run our own CDN."), ["CDN"]);
  assert.deepEqual(asks("Experience with CDNs and caching."), ["CDN"], "its plural is the concept");
  assert.deepEqual(asks("Low-level firmware for sensors."), ["Firmware"], "five characters or more: any case, as before");
  // D114 draws it the same way: every form exact-case, no short lowercase alias.
  const forms = formsOf({ kind: "concept", name: "CDN", term: "cdn" }, ["edge", "content delivery network"]);
  assert.ok(forms.some(f => f.text === "CDN") && forms.filter(f => f.text.length < 5).every(f => f.exactCase), JSON.stringify(forms));
  assert.ok(!forms.some(f => f.text === "edge"), "a short lowercase alias has no case to match: left out");
  assert.ok(forms.some(f => f.text === "content delivery network"), "a long alias still links");
  const segs = linkSegments("see cdn.acme.com, then our CDNs", [{ slug: "cdn", kind: "concept", forms }]);
  assert.deepEqual(segs.filter(s => s.slug).map(s => s.text), ["CDNs"]);
});

test("BUG 10-31 · commonPhraseNotLinked — no concept is counted or linked inside a common phrase of the one list", () => {
  const db = fixtureDb();
  node(db, "concept", "Attention");
  node(db, "skill", "detail");   // not a concept: the phrase rule is for concepts only
  const asks = (text) => askedNames(db, { title: "Engineer", company: "Solo", text });
  assert.deepEqual(asks("Strong attention to detail and a fast-paced mindset."), ["detail"]);
  assert.deepEqual(asks("Pay attention to tolerances."), []);
  assert.deepEqual(asks("Implement Flash Attention kernels and the attention mechanism."), ["Attention"]);
  assert.ok(COMMON_PHRASES.includes("attention to detail") && COMMON_PHRASES.includes("data-driven") && COMMON_PHRASES.includes("fast-paced"));
  assert.ok(COMMON_PHRASES.every(p => /[\s-]/.test(p)), "only phrases: a single word would silence a concept everywhere");

  // Linked: never inside the phrase, and the server does not offer it when that is its only use.
  node(db, "skill", "Kubernetes");
  const job = { title: "Engineer", company: "Solo", description: "Attention to detail. Kubernetes daily." };
  assert.deepEqual(atlasTermsFor(db, job).map(t => t.slug).sort(), ["detail", "kubernetes"], "the skill, not the concept");
  const terms = [{ slug: "attention", kind: "concept", forms: [{ text: "Attention", exactCase: true }] }];
  assert.deepEqual(linkSegments("Attention to detail, and self-attention: Attention is all you need", terms).filter(s => s.slug).map(s => s.text),
    ["Attention"]);
  assert.equal(linkSegments("Attention to detail matters", terms).filter(s => s.slug).length, 0);

  // ONE file: no other Atlas source spells a phrase of the list.
  const dirs = ["services/atlas", "shared", "client/src/components"];
  for (const d of dirs) for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (!/\.(m?js|jsx)$/.test(f) || p.replace(/\\/g, "/") === "shared/atlasCommonPhrases.js") continue;
    const code = read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");   // comments may NAME a phrase
    assert.ok(!["attention to detail", "fast-paced", "data-driven"].some(ph => new RegExp(`["'\`]${ph}["'\`]`, "i").test(code)),
      `${p} lists a common phrase — the list is shared/atlasCommonPhrases.js`);
  }
});

test("BUG 10-31 · matcherOneCopy — the board stats, Your map and D114's links all match through postingMatcher.js, and nothing else matches", () => {
  const files = ["services/atlas/atlasStats.js", "services/atlas/atlasMe.js", "services/atlas/atlasLinks.js"];
  for (const f of files) assert.match(read(f), /import \{[^}]*\bpostingMatcher\b[^}]*\} from "\.\/(postingMatcher|atlasStats)\.js";/, `${f} imports the one matcher`);
  assert.match(read("services/atlas/atlasStats.js"), /import \{[^}]*postingMatcher[^}]*\} from "\.\/postingMatcher\.js";/);
  // No second copy: no other server file builds word runs of a posting or reads its skill list for the Atlas.
  const roots = ["services", "routes", "shared"];
  const offenders = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(m?js)$/.test(e.name)) continue;
    const rel = p.split(path.sep).join("/");
    if (rel === "services/atlas/postingMatcher.js") continue;
    const s = read(p);
    if (/function (postingMatcher|gramsOf|addGrams|skillKeysOf|countedLines|companyBoilerplate)\b/.test(s)) offenders.push(rel);
  } };
  roots.forEach(walk);
  assert.deepEqual(offenders, [], "a second matcher");

  // And they agree: the posting the stats count is the posting D114 links (no skills list on either).
  const db = fixtureDb();
  node(db, "tool", "Kubernetes");
  node(db, "concept", "CDN");
  for (let i = 0; i < 3; i++) post(db, "Acme", `Engineer ${i}`, `${ABOUT}\nSee https://cdn.acme.com/eeo.pdf.`);
  post(db, "Acme", "Edge Engineer", "Requirements:\n- Our own CDN on Kubernetes");
  computeAtlasStats(db);
  const linked = db.prepare(`SELECT title, company, description FROM scraped_jobs`).all()
    .map(j => atlasTermsFor(db, j).map(t => t.slug).sort().join(","));
  assert.deepEqual(linked, ["", "", "", "cdn,kubernetes"]);
  assert.equal(statOf(db, "Kubernetes"), 1);
  assert.equal(statOf(db, "CDN"), 1);
});
