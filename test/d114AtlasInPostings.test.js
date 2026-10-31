// ⭐ D114 · ATLAS TERMS IN THE POSTINGS (owner 10-31) — a published term in a job description is a quiet link; hovering
// shows what it is and that it leads to learning. Synthetic nodes and postings; the server through its real router in
// memory; the client components RENDERED (esbuild + react-dom/server), and the interaction handlers read from source
// (this suite has no live DOM — the event wiring is pinned by its source, the markup by rendering).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus, addAlias } from "../services/atlas/atlasStore.js";
import { atlasTermsFor, formsOf, peekNode, countLinkEvent } from "../services/atlas/atlasLinks.js";
import { createAtlasRouter } from "../routes/atlas.js";
import { linkSegments } from "../shared/atlasLinks.js";
import { LAYOUT_OPTION_IDS } from "../shared/appearance.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const publish = (db, kind, name, extra = {}) => {
  const n = upsertNode(db, { kind, name, source: "registry", ...extra });
  setStatus(db, n.slug ?? db.prepare(`SELECT slug FROM atlas_nodes WHERE id = ?`).pluck().get(n.id), "published");
  return db.prepare(`SELECT slug FROM atlas_nodes WHERE id = ?`).pluck().get(n.id);
};
const slugsOf = (terms) => terms.map(t => t.slug).sort();
const linked = (segs) => segs.filter(s => s.slug).map(s => [s.text, s.slug]);
const joined = (segs) => segs.map(s => s.text).join("");

// ── the client, rendered ──────────────────────────────────────────────────────────────────────────────
const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
let ui;
async function loadUi() {
  if (ui) return ui;
  const esbuild = requireClient("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement as h } from "react";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import { AtlasText, AtlasTerm, OPEN_DELAY_MS } from ${abs("components/AtlasTerm.jsx")};
        export { OPEN_DELAY_MS };
        export const text = (text, terms) => renderToStaticMarkup(h("p", null, h(AtlasText, { text, terms, used: new Set() })));
        export const term = (slug, name) => renderToStaticMarkup(h(AtlasTerm, { slug, name }, name));`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d114-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

async function api(db, user = null) {
  const app = express();
  app.use(express.json());
  if (user) app.use((req, _res, next) => { req.user = user; next(); });
  app.use("/api/atlas", createAtlasRouter(db));
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return { get: (p) => fetch(base + p), post: (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }),
    close: () => new Promise(r => srv.close(r)) };
}

test("D114 · d114OnlyPublishedNodes — a draft node is never linked; the terms route answers only published ones", async () => {
  const db = fixtureDb();
  publish(db, "tool", "Kubernetes");
  upsertNode(db, { kind: "tool", name: "Terraform", source: "registry" });   // a draft
  const job = { title: "Platform Engineer", description: "We run Kubernetes and Terraform in production." };
  assert.deepEqual(slugsOf(atlasTermsFor(db, job)), ["kubernetes"]);
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, description, is_active) VALUES ('job-1', 'q', 'h1', ?, 'Example Co', ?, 1)`).run(job.title, job.description);
  const s = await api(db);
  try {
    const r = await s.get("/api/atlas/terms/job-1");
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).terms.map(t => t.slug), ["kubernetes"]);
    assert.equal((await s.get("/api/atlas/terms/no-such-job")).status, 404);
    assert.equal((await s.get("/api/atlas/peek/terraform")).status, 404, "a draft has no peek");
  } finally { await s.close(); }
});

test("D114 · d114OnlyPostingsOwnSkills — with the scorer's skill list, a term in the text but not on the list is not linked", () => {
  const db = fixtureDb();
  publish(db, "tool", "React"); publish(db, "tool", "Kubernetes");
  const text = "Engineers react to incidents quickly. We use Kubernetes daily.";
  const listed = atlasTermsFor(db, { title: "SRE", description: text, skills_json: JSON.stringify([{ skill: "kubernetes" }]) });
  assert.deepEqual(slugsOf(listed), ["kubernetes"], "react is in the text, not in the posting's skills");
  // With no list, the Atlas's own rule: the words in the text…
  const unlisted = atlasTermsFor(db, { title: "SRE", description: text });
  assert.deepEqual(slugsOf(unlisted), ["kubernetes", "react"]);
  // …and the drawn text links "React" only in its own case, so the verb stays plain.
  assert.deepEqual(linked(linkSegments(text, unlisted)), [["Kubernetes", "kubernetes"]]);
  assert.deepEqual(linked(linkSegments("Built with React and Node.", unlisted)), [["React", "react"]]);
});

test("D114 · d114AmbiguousNeedsExactCase — \"Go\" links, \"go\" does not; an ambiguous word links only when the posting lists it", () => {
  const db = fixtureDb();
  publish(db, "tool", "Go");
  const skills = JSON.stringify([{ skill: "go" }]);
  const terms = atlasTermsFor(db, { title: "Backend Engineer", description: "Services in Go. We go to market fast.", skills_json: skills });
  assert.deepEqual(slugsOf(terms), ["go"]);
  assert.deepEqual(formsOf({ name: "Go", term: "go" }), [{ text: "Go", exactCase: true }], "a two-letter ambiguous word: exact case, no lowercase alias");
  assert.deepEqual(linked(linkSegments("We go to market fast. Services in Go.", terms)), [["Go", "go"]]);
  assert.deepEqual(linked(linkSegments("Experience at Google.", terms)), [], "whole words only — the right edge");
  assert.deepEqual(linked(linkSegments("We deploy with ArGo daily.", terms)), [], "whole words only — the left edge");
  assert.deepEqual(atlasTermsFor(db, { title: "Marketer", description: "We go to market with Go." }), [], "no list: an ambiguous word never links");
});

test("D114 · d114LongestMatchFirst — \"machine learning engineer\" claims its words before \"machine learning\"; Node is not in Node.js", () => {
  const terms = [
    { slug: "machine-learning", forms: [{ text: "machine learning", exactCase: false }] },
    { slug: "machine-learning-engineer", forms: [{ text: "Machine Learning Engineer", exactCase: false }] },
    { slug: "node-js", forms: [{ text: "Node.js", exactCase: false }] },
    { slug: "node", forms: [{ text: "Node", exactCase: true }] },
    { slug: "java", forms: [{ text: "Java", exactCase: true }] },
  ];
  const segs = linkSegments("Our Machine Learning Engineer ships Node.js and JavaScript.", terms);
  assert.deepEqual(linked(segs), [["Machine Learning Engineer", "machine-learning-engineer"], ["Node.js", "node-js"]]);
});

test("D114 · d114FirstOccurrenceOnly — each term links once per posting, across all of its blocks", () => {
  const terms = [{ slug: "kubernetes", forms: [{ text: "Kubernetes", exactCase: true }] }, { slug: "sql", forms: [{ text: "SQL", exactCase: true }] }];
  const used = new Set();
  const a = linkSegments("Kubernetes, then more Kubernetes.", terms, used);
  const b = linkSegments("You know Kubernetes and SQL. SQL again.", terms, used);
  assert.deepEqual(linked(a), [["Kubernetes", "kubernetes"]]);
  assert.deepEqual(linked(b), [["SQL", "sql"]], "Kubernetes linked in the first block already");
  assert.equal(a.filter(s => s.slug).length + b.filter(s => s.slug).length, 2);
  const body = read("client/src/components/PostingPanel.jsx");
  const pb = body.slice(at(body, "export function PostingBody"), at(body, "export default function PostingPanel"));
  assert.match(pb, /const used = new Set\(\);   \/\/ one posting, top to bottom: a term links once/);
  assert.match(pb, /<AtlasText text=\{s\} terms=\{terms\} used=\{used\} render=\{lit\} \/>/);
});

test("D114 · d114TextUnchanged — the segments are the text exactly; the description stored is never touched", async () => {
  const terms = [{ slug: "c-plus-plus", forms: [{ text: "C++", exactCase: true }] }, { slug: "ci-cd", forms: [{ text: "CI/CD", exactCase: false }] },
    { slug: "kubernetes", forms: [{ text: "Kubernetes", exactCase: true }, { text: "k8s", exactCase: false }] }];
  for (const s of ["Write C++ and run CI/CD on K8S clusters.\n\n• Kubernetes too", "", "No terms here at all.", "C++C++ CI/CDs"]) {
    assert.equal(joined(linkSegments(s, terms)), s, JSON.stringify(s));
  }
  assert.deepEqual(linked(linkSegments("Write C++ and run CI/CD on K8S clusters.", terms)), [["C++", "c-plus-plus"], ["CI/CD", "ci-cd"], ["K8S", "kubernetes"]]);
  const { text } = await loadUi();
  const html = text("We deploy with Kubernetes every day.", [{ slug: "kubernetes", name: "Kubernetes", forms: [{ text: "Kubernetes", exactCase: true }] }]);
  assert.equal(html.replace(/<[^>]+>/g, ""), "We deploy with Kubernetes every day.");
  assert.doesNotMatch(read("services/atlas/atlasLinks.js"), /UPDATE scraped_jobs|description\s*=/, "nothing writes a posting");
});

test("D114 · d114NeverInDocuments — only the posting surfaces mount the links; never a résumé, cover letter or PDF", () => {
  const users = [];
  const walk = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p); else if (/\.(jsx?|mjs)$/.test(f.name) && /^import [^\n]* from "[^"]*AtlasTerm\.jsx";$/m.test(read(p))) users.push(p.split(path.sep).join("/"));
  } };
  walk("client/src");
  assert.deepEqual(users.sort(), ["client/src/components/JobCard.jsx", "client/src/components/PostingPanel.jsx", "client/src/panels/JobWorkspacePanel.jsx"]);
  for (const doc of ["client/src/components/CoverLetterModal.jsx", "services/pdfRender.js", "services/resumeRender.js"]) {
    if (fs.existsSync(doc)) assert.doesNotMatch(read(doc), /AtlasTerm|AtlasText|atlasTerms|linkSegments/, doc);
  }
  assert.doesNotMatch(read("extension/manifest.json"), /atlas/i, "the extension does not rewrite third-party pages");
});

test("D114 · d114NoMarkAtRest — at rest the word is plain text; the dotted line only on hover / focus, or with Learning links: shown", async () => {
  const css = read("client/src/components/AtlasTerm.css");
  const rest = css.slice(at(css, ".atl-term {"), at(css, ".atl-term:hover,"));
  assert.match(rest, /color: inherit;/);
  assert.match(rest, /text-decoration: var\(--atl-term-rest, none\);/);
  assert.match(css, /\[data-learning-links="quiet"\] \{ --atl-term-rest: none; \}/);
  assert.match(css, /\[data-learning-links="shown"\] \{ --atl-term-rest: underline dotted 1px; \}/);
  assert.match(css, /\.atl-term:hover,\n\.atl-term:focus-visible,\n\.atl-term\[aria-expanded="true"\] \{\n  text-decoration: underline dotted 1px;/);
  assert.deepEqual(LAYOUT_OPTION_IDS.learning, { attribute: "data-learning-links", values: ["quiet", "shown"], default: "quiet" }, "off by default");
  assert.doesNotMatch(rest, /border-radius|background/, "no box, no pill");
  const { term } = await loadUi();
  assert.equal(term("kubernetes", "Kubernetes"), `<a class="atl-term" href="/atlas/kubernetes" data-atlas-term="kubernetes" aria-expanded="false">Kubernetes</a>`);
});

test("D114 · d114KeyboardFocusOpens — each term is a real link in the tab order; focus opens the popup at once; Escape closes and returns focus", async () => {
  const { term, OPEN_DELAY_MS } = await loadUi();
  const html = term("kubernetes", "Kubernetes");
  assert.match(html, /^<a [^>]*href="\/atlas\/kubernetes"/);
  assert.doesNotMatch(html, /tabindex="-1"/);
  assert.equal(OPEN_DELAY_MS, 300, "hover waits 300 ms");
  const src = read("client/src/components/AtlasTerm.jsx");
  assert.match(src, /onFocus=\{\(\) => open\(\)\}/, "focus opens with no delay");
  assert.match(src, /onMouseEnter=\{\(\) => \{ if \(lastPointer\.current !== "touch"\) later\(open, OPEN_DELAY_MS\); \}\}/);
  assert.match(src, /if \(e\.key === "Escape"\) \{ close\(\); ref\.current\?\.focus\(\); \}/);
  assert.match(src, /if \(closeOpen && closeOpen !== close\) closeOpen\(\);/, "one popup at a time");
});

test("D114 · d114TapOpensNotNavigates — a tap opens the popup and does not follow the link; the popup's own link navigates", () => {
  const src = read("client/src/components/AtlasTerm.jsx");
  const click = src.slice(at(src, "onClick={(e) => {"), at(src, "{children}"));
  assert.match(click, /if \(lastPointer\.current === "touch"\) \{ e\.preventDefault\(\); if \(pos\) close\(\); else open\(\); return; \}/);
  assert.match(src, /onPointerDown=\{\(e\) => \{ lastPointer\.current = e\.pointerType \|\| "mouse"; \}\}/);
  // D115 P4(d): to the step that teaches it when the owner's path has one, else the term's page.
  assert.match(src, /<a className="atl-term__learn" href=\{p\.learnStep \? `\$\{atlasHref\("learn"\)\}#step-\$\{encodeURIComponent\(p\.learnStep\.stepId\)\}` : atlasHref\(slug\)\}\n\s+onClick=\{\(\) => atlasLinkEvent\("visit"\)\} data-atlas-pop-learn=""/);
  assert.match(src, /Learn it in the Atlas →/);
});

test("D114 · d114WikipediaAttributed — with no definition the meaning is Wikipedia's first sentence, marked and linked; a definition is draft's own", async () => {
  const db = fixtureDb();
  const k = publish(db, "tool", "Kubernetes");
  const t = publish(db, "tool", "Terraform", { definition: "Describes cloud infrastructure as code." });
  const id = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = ?`).pluck().get(k);
  db.prepare(`INSERT INTO atlas_wiki_cache (node_id, title, extract, page_url, fetched_at) VALUES (?, 'Kubernetes', 'Kubernetes is an orchestration system. It was designed by Google.', 'https://en.wikipedia.org/wiki/Kubernetes', 1)`).run(id);
  db.prepare(`INSERT INTO atlas_node_stats (node_id, postings, computed_at) VALUES (?, 312, 1)`).run(id);
  const p = peekNode(db, k);
  assert.deepEqual([p.meaning, p.fromWikipedia, p.wikipediaUrl, p.postings], ["Kubernetes is an orchestration system.", true, "https://en.wikipedia.org/wiki/Kubernetes", 312]);
  const own = peekNode(db, t);
  assert.deepEqual([own.meaning, own.fromWikipedia, own.wikipediaUrl], ["Describes cloud infrastructure as code.", false, null]);
  assert.equal(own.you, undefined, "signed out: nothing about a profile");
  const src = read("client/src/components/AtlasTerm.jsx");
  assert.match(src, /\{p\.fromWikipedia && <span className="atl-term__src"> — From <a href=\{p\.wikipediaUrl \|\| "https:\/\/en\.wikipedia\.org"\} target="_blank" rel="noopener noreferrer">Wikipedia<\/a> \(CC BY-SA\)<\/span>\}/);
});

test("D114 · d114PeekLazy — the popup is read on the first hover / focus only, once per term; nothing is preloaded for the posting", async () => {
  const lib = read("client/src/lib/atlasLinks.js");
  const peek = lib.slice(at(lib, "export function peekAtlas"), at(lib, "export function atlasLinkEvent"));
  // ⭐ D118 P1 (changed on purpose): once per term per MINUTE — the count moves with the board.
  assert.match(peek, /if \(!hit \|\| now - hit\.at >= PEEK_KEEP_MS\)/);
  const src = read("client/src/components/AtlasTerm.jsx");
  assert.ok(at(src, "peekAtlas(slug)") > at(src, "function Popup("), "only the open Popup reads it");
  assert.ok(at(src, "peekAtlas(slug)") < at(src, "export function AtlasTerm("));
  assert.doesNotMatch(src.slice(at(src, "export function AtlasText")), /peekAtlas/, "the text never asks");
  // The peek itself: public and cached for a minute signed out (D118 P1; was an hour), private when it says something about the reader.
  const db = fixtureDb();
  const k = publish(db, "tool", "Kubernetes");
  const s = await api(db);
  try {
    const r = await s.get(`/api/atlas/peek/${k}`);
    assert.equal(r.headers.get("cache-control"), "public, max-age=60");
    // learnStep (D115 P4(d)): Kubernetes is taught by a step of the owner's path.
    assert.deepEqual(Object.keys(await r.json()).sort(), ["firstResource", "fromWikipedia", "kind", "learnStep", "meaning", "name", "postings", "slug", "wikipediaUrl"]);
    // P5: a count, nothing else.
    assert.equal((await s.post("/api/atlas/link-event", { event: "open" })).status, 204);
    assert.equal((await s.post("/api/atlas/link-event", { event: "kubernetes" })).status, 400);
    assert.deepEqual(db.prepare(`SELECT event, n FROM atlas_link_counts`).all(), [{ event: "open", n: 1 }]);
    assert.deepEqual(db.prepare(`PRAGMA table_info(atlas_link_counts)`).all().map(c => c.name), ["day", "event", "n"], "no user, no term, no posting");
  } finally { await s.close(); }
  assert.equal(countLinkEvent(db, "visit", new Date("2026-10-31T12:00:00Z")), true);
});

test("D114 · d114UnpublishRemovesSpans — unpublishing a node removes its links at once (the cached list is rebuilt); an alias links too", () => {
  const db = fixtureDb();
  const k = publish(db, "tool", "Kubernetes");
  const job = { title: "SRE", description: "We run k8s clusters." };
  assert.deepEqual(slugsOf(atlasTermsFor(db, job)), []);
  addAlias(db, db.prepare(`SELECT id FROM atlas_nodes WHERE slug = ?`).pluck().get(k), "k8s", "curator@example.test");
  assert.deepEqual(slugsOf(atlasTermsFor(db, job)), ["kubernetes"], "a confirmed alias links (the cache saw the new alias)");
  assert.deepEqual(linked(linkSegments(job.description, atlasTermsFor(db, job))), [["k8s", "kubernetes"]]);
  setStatus(db, k, "draft", "curator@example.test");
  assert.deepEqual(atlasTermsFor(db, job), [], "unpublished: gone on the next read");
});

test("D114 · d114FourThemes — the popup is drawn only in theme tokens, so all four themes draw it; it is never clipped by the viewport", () => {
  const css = read("client/src/components/AtlasTerm.css");
  const pop = css.slice(at(css, ".atl-term__pop {"), at(css, ".atl-term__head"));
  for (const tok of ["--c-surface-solid", "--c-border", "--c-depth-rest", "--c-ink"]) assert.ok(pop.includes(`var(${tok})`), tok);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i, "no colour literal — tokens only");
  assert.match(pop, /position: fixed;/);
  assert.match(pop, /max-width: calc\(100vw - 24px\);/);
  const src = read("client/src/components/AtlasTerm.jsx");
  assert.match(src, /const width = Math\.min\(WIDTH, vw - 2 \* GUTTER\);/);
  assert.match(src, /const left = Math\.max\(GUTTER, Math\.min\(r\.left, vw - width - GUTTER\)\);/);
  assert.match(src, /createPortal\(/, "drawn at the page's top, so no card's overflow can cut it");
});
