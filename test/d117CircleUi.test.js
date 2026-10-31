// ⭐ D117 C3 / C4 / C5 / C6 / C8 · THE CIRCLE AS DRAWN — LearnCircle.jsx rendered by esbuild + react-dom/server (as the tree's
// and d105's pages are), its pure half (learnModel.js), its stylesheet. Built on the owner's real tracker and the real
// D117 data file, imported into an in-memory database; earned progress written through the real services. Synthetic users.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { learnContent } from "../services/learn/learnContent.js";
import { seedCircleData, circleOf, checkExtraItems } from "../services/learn/learnCircle.js";
import { reviewPiece } from "../services/learn/learnCircleReview.js";
import { recordOpened, saveExplanation, saveBuild, earnedMarks } from "../services/learn/learnEarned.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { learnStepPath } from "../services/learn/learnLinks.js";
import { at } from "../test-support/sourceAnchors.js";
import {
  piecesOf, routesFor, entryFromHash, unlockLine, pasteVerdict, circleState, stepState, circleLayout, OWN_WORDS, barLine,
} from "../client/src/pages/atlas/learnModel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
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
        import LearnCircle from ${abs("pages/atlas/LearnCircle.jsx")};
        export const circle = (props) => renderToStaticMarkup(h(LearnCircle, props));`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d117-circle-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

const OWN = "A container packages an application with its libraries so it runs the same anywhere, and the orchestrator schedules many of them across machines, restarts failures and spreads load for me.";
async function world() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare(`INSERT INTO users (id, username, password_hash) VALUES (7, 'learner@example.test', 'x')`).run();
  for (const n of ["Kubernetes", "Docker"]) { upsertNode(db, { kind: "tool", name: n, source: "registry" }); setStatus(db, n.toLowerCase(), "published"); }
  seedCircleData(db);
  await checkExtraItems(db, { fetchImpl: async () => ({ status: 200 }), pauseMs: 0 });
  return db;
}
const props = (db, extra = {}) => {
  const learn = learnContent(db), circle = circleOf(db, learn);
  const marks = earnedMarks(db, 7);
  return { learn, circle, pieces: piecesOf(learn, circle), earned: { marks, explanations: {}, builds: {} }, signedIn: true, ...extra };
};
const finishO4 = (db) => {
  for (const id of ["o4-vm", "o4-docker", "o4-k8s"]) recordOpened(db, 7, id);
  for (const c of [0, 1, 2]) saveExplanation(db, 7, `o4#c${c}`, OWN);
  return saveBuild(db, 7, "o4", { url: "https://github.com/example-learner/k8s-lab" });
};
const between = (html, a, b) => html.slice(at(html, a), at(html, b, at(html, a)));

test("D117 C7 · d117CircleStatesFilled — every piece on the ring follows its bar: filled (finished) · half (started) · open (nothing yet); 108 pieces, 8 part arcs", async () => {
  const { circle } = await loadUi();
  const db = await world();
  for (const id of ["s1-code", "s1-cc", "s1-iol"]) recordOpened(db, 7, id);
  for (const c of [0, 1, 2]) saveExplanation(db, 7, `s1#c${c}`, OWN);
  recordOpened(db, 7, "s2-p5-1");   // an extra only: the bar stays 0 — open
  recordOpened(db, 7, props(db).pieces.find(p => p.id === "s1b").items.find(i => !i.o && i.u).id);
  const html = circle(props(db));
  const state = (id) => (new RegExp(`data-learn-piece="${id}" data-state="(\\w+)"`).exec(html) || [])[1];
  assert.deepEqual([state("s1"), state("s1b"), state("s2"), state("o4")], ["filled", "half", "open", "open"]);
  assert.equal((html.match(/data-learn-piece="/g) || []).length, 108);
  assert.equal((html.match(/data-learn-part="/g) || []).length, 8);
  const tick = (id) => between(html, `data-learn-piece="${id}"`, "</g>");
  assert.match(tick("s1"), /class="lrc__fill"[^>]*width="10"/);
  assert.match(tick("s1b"), /class="lrc__fill"[^>]*width="5"/);
  assert.match(tick("s2"), /class="lrc__fill"[^>]*width="0"/);
  assert.match(html, /<b>1<\/b> finished · <b>1<\/b> started · 106 to go/);
  assert.equal(circleState({ complete: false, started: false }), "open");
  // The layout: Step 1 at the top, every piece once, the parts in order.
  const lay = circleLayout(props(db).pieces);
  assert.equal(lay.angle.size, 108);
  assert.ok(Math.abs(lay.angle.get("s1") + Math.PI / 2) < 0.1, "Step 1 is one place on the ring (the top)");
});

test("D117 C7 · d117EntryOpensPiece — an entry from anywhere lands on #step-<id> and THAT piece opens (never Step 1)", async () => {
  const { circle } = await loadUi();
  const db = await world();
  assert.equal(entryFromHash("#step-o4"), "o4");
  assert.equal(entryFromHash(`#step-${encodeURIComponent("x-2")}`), "x-2");
  assert.equal(entryFromHash("#nothing"), null);
  const html = circle(props(db, { initialSel: "o4" }));
  assert.match(html, /data-learn-selected="o4"/);
  assert.match(html, /Part 4 · [^·]+ · [^·]+ · one piece of the whole · <b>Piece \d+ of 108<\/b>/);
  assert.match(html, /aria-pressed="true" data-learn-piece="o4"/);
  // Every way in points at the piece: the Atlas page, D114's popup, Your map's tree and its "Learn next", the server's path.
  assert.equal(learnStepPath("o4"), "/learn#step-o4");
  assert.match(read("client/src/pages/atlas/AtlasPage.jsx"), /\/learn#step-\$\{encodeURIComponent\(node\.learn\.stepId\)\}/);
  assert.match(read("client/src/components/AtlasTerm.jsx"), /#step-\$\{encodeURIComponent\(p\.learnStep\.stepId\)\}/);
  assert.match(read("client/src/pages/atlas/AtlasTree.jsx"), /\/learn#step-\$\{encodeURIComponent\(n\.courseStep\.stepId\)\}/);
  assert.match(read("client/src/pages/atlas/YourMap.jsx"), /\/learn#step-\$\{encodeURIComponent\(c\.step\)\}/);
  const view = read("client/src/pages/atlas/LearnView.jsx");
  assert.match(view, /const \[entry, setEntry\] = useState\(\(\) => entryFromHash\(location\.hash\)\);/);
  assert.match(view, /const jump = useCallback\(\(id\) => \{ setEntry\(id\); setTab\("circle"\); \}, \[\]\);/);
  assert.match(view, /<LearnCircle key=\{entry \|\| "start"\}[^>]*initialSel=\{entry \|\| next\?\.id\}/);
  assert.match(view, /const \[tab, setTab\] = useState\("circle"\);/, "the circle is the default view");
});

test("D117 C7 · d117UnlockToastAndMap — the write that finishes a piece names what it unlocked; the toast says it; the piece's chips fill (D116 M8 colours the map)", async () => {
  const { circle } = await loadUi();
  const db = await world();
  let html = circle(props(db, { initialSel: "o4" }));
  assert.match(html, /data-learn-unlocks="todo"/);
  assert.match(html, /Finishing this unlocks on your map/);
  assert.ok(!html.includes("lrc__chip is-on"));
  const r = finishO4(db);
  assert.equal(r.finished, true);
  assert.ok(r.unlocked.some(u => u.slug === "kubernetes"));
  const line = unlockLine(r.unlocked);
  assert.match(line, /^Piece finished\. Unlocked on your map: .*Kubernetes/);
  assert.equal(unlockLine([]), "Piece finished.");
  html = circle(props(db, { initialSel: "o4", notice: line }));
  assert.match(html, /<p class="lrc__toast" role="status" data-learn-toast="">Piece finished\. Unlocked on your map: /);
  assert.match(html, /data-learn-unlocks="done"/);
  assert.match(html, /<h3 class="lrc__box-h">Unlocked on your map<\/h3>/);
  assert.match(html, /class="lrc__chip is-on" data-learn-teaches="kubernetes"/);
  assert.match(html, /They go on your Profile only if you add them\./);
  assert.match(read("client/src/pages/atlas/LearnView.jsx"), /if \(!r\?\.finished\) return;\n    setNotice\(unlockLine\(r\.unlocked\)\);/);
});

test("D117 C7 · d117DraftedNeedsNotLiveUntilAccepted — a drafted link is used (the routes close over it) but labelled 'draft' everywhere until accepted; a rejected one is not drawn", async () => {
  const { circle } = await loadUi();
  const db = await world();
  const x2 = circleOf(db).pieces.x2.needs;
  let html = circle(props(db, { initialSel: "x2" }));
  assert.equal((html.match(/data-learn-draft="/g) || []).length, x2.length, "each drafted link labelled");
  assert.equal((html.match(/lrc__chord lrc__chord--before is-draft/g) || []).length, x2.length, "its chord dashed");
  const routes = routesFor(circleOf(db), props(db).pieces, null);
  assert.equal(routes.find(r => r.id === "k8s").list.length, 11, "the routes use the drafted links from day one");
  reviewPiece(db, "x2", "accept");
  html = circle(props(db, { initialSel: "x2" }));
  assert.equal((html.match(/data-learn-draft="/g) || []).length, 0, "accepted: no label");
  assert.equal((html.match(/data-chord-before="/g) || []).length, x2.length);
  reviewPiece(db, "o4", "reject");
  html = circle(props(db, { initialSel: "o4" }));
  assert.equal((html.match(/data-chord-before="/g) || []).length, 0, "rejected: not a link");
  assert.match(html, /Nothing: you can start here\./);
});

test("D117 C8 · d117NoSelfCompleteControl — no checkbox, no 'done' / 'I explained it' / 'complete' button anywhere in the circle or the piece; items are links; the page never calls the tick endpoint", async () => {
  const { circle } = await loadUi();
  const db = await world();
  for (const sel of ["o4", "s1", "w4"]) {
    const html = circle(props(db, { initialSel: sel }));
    assert.doesNotMatch(html, /type="checkbox"/, sel);
    const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1].replace(/<[^>]+>/g, ""));
    assert.ok(buttons.length > 5);
    for (const b of buttons) assert.doesNotMatch(b, /\bdone\b|complete|I explained it|mark (it|as)|finished/i, b);
    const items = [...html.matchAll(/data-learn-item="([^"]+)"/g)].length;
    assert.ok(items > 0 && (html.match(/data-learn-open="/g) || []).length > 0);
    assert.match(html, /role="progressbar"/);
  }
  const src = ["pages/atlas/LearnCircle.jsx", "pages/atlas/LearnView.jsx", "pages/atlas/learnModel.js"].map(f => read(`client/src/${f}`).replace(/^\s*\/\/.*$/gm, "")).join("\n");
  assert.doesNotMatch(src, /\/api\/learn\/progress|type="checkbox"[^/]*data-learn-item|I explained it/);
  // The page's half of d117OpenedOnlyFromDraftClick: the item's own link click is what records the opening.
  assert.match(read("client/src/pages/atlas/LearnCircle.jsx"), /<a className="atl__link" href=\{it\.u\} target="_blank" rel="noopener noreferrer" data-learn-open=\{it\.id\} onClick=\{\(\) => onOpen\?\.\(it, piece\)\}>/);
  assert.match(read("client/src/pages/atlas/LearnView.jsx"), /api\("\/api\/learn\/opened", \{ method: "POST", body: JSON\.stringify\(\{ id: it\.id \}\), keepalive: true \}\)/);
  // The page's half of d117ExplainedNeedsOwnWords: a paste of 25+ words never lands.
  assert.deepEqual(pasteVerdict(OWN), { words: 30, refused: true, message: OWN_WORDS });
  assert.equal(pasteVerdict("Kubernetes").refused, false);
  assert.match(read("client/src/pages/atlas/LearnCircle.jsx"), /if \(v\.refused\) \{ e\.preventDefault\(\); setSay\(v\.message\); \}/);
  // "opened", never "done".
  const st = stepState(props(db).pieces.find(p => p.id === "o4"), { "o4-vm": 1 });
  assert.equal(barLine(st), "1 of 3 opened · 0 of 3 explained · build not linked yet");
});

test("D117 C7 · d117ReducedMotion — the route's ink stroke and the toast animate only when motion is welcome; reduced motion draws them at once", () => {
  const css = read("client/src/pages/atlas/LearnCircle.css");
  const block = css.slice(at(css, "@media (prefers-reduced-motion: no-preference) {"));
  const inside = block.slice(0, at(block, "\n}\n") + 2);
  assert.match(inside, /\.lrc:not\(\.lrc--still\) \.lrc__ink \{ stroke-dasharray: 1200; stroke-dashoffset: 1200; animation: lrc-ink/);
  assert.match(inside, /\.lrc:not\(\.lrc--still\) \.lrc__toast \{ animation: lrc-rise/);
  const outside = css.replace(inside, "");
  assert.doesNotMatch(outside, /animation|transition|@keyframes/, "no motion outside the no-preference block");
  const jsx = read("client/src/pages/atlas/LearnCircle.jsx");
  assert.match(jsx, /matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(jsx, /className=\{`lrc\$\{reduced \? " lrc--still" : ""\}`\}/);
});

test("D117 C7 · d117FourThemes — the circle draws in draft's tokens only (Paper Light, Charcoal Dark, both Contrast); rounded squares, never capsules; phone width", async () => {
  const css = read("client/src/pages/atlas/LearnCircle.css");
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "no colour literal");
  assert.doesNotMatch(css, /999px|border-radius:\s*50%/, "no capsule");
  for (const tok of ["--c-violet", "--c-teal", "--c-info", "--c-warning", "--c-danger", "--c-accent", "--c-success", "--c-band-strong", "--c-ink", "--c-border", "--c-surface-solid"]) {
    assert.ok(css.includes(`var(${tok})`), tok);
  }
  for (let i = 1; i <= 8; i++) assert.match(css, new RegExp(`\\.lrc__part--${i} \\{ --lrc-c: var\\(--lrc-p${i}\\); \\}`));
  assert.match(css, /\[data-contrast="aaa"\] \.lrc__toast/);
  assert.match(css, /@media \(max-width: 980px\) \{ \.lrc__main \{ grid-template-columns: minmax\(0, 1fr\); \}/, "phone: the piece drops under the circle");
  assert.match(css, /@media \(max-width: 560px\) \{ \.lrc__twin \{ grid-template-columns: minmax\(0, 1fr\); \} \}/);
  assert.match(css, /\.lrc__toast \{\n  position: fixed;[^}]*max-width: calc\(100vw - 32px\)/);
  const { circle } = await loadUi();
  const html = circle(props(await world(), { initialSel: "o4" }));
  assert.match(html, /<rect class="lrc__sq"[^>]* rx="3.2"/, "the pieces are rounded squares");
  assert.doesNotMatch(html, /style="[^"]*(#[0-9a-f]{3,8}|rgb)/i, "no inline colour");
});
