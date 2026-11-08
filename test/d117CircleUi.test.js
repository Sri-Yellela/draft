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
  // ⚠ CHANGED ON PURPOSE (D117 C10 + C12): the ring of squares became ONE deck of portrait cards round the wheel; a
  // card's BACK shows its state — filled · half · outlined — the same three the squares drew.
  const card = (id) => (new RegExp(`class="lwh__card lwh__card--(\\w+) lrc__part--\\d+[^"]*"[^>]*data-learn-piece="${id}"`).exec(html) || [])[1];
  assert.deepEqual([card("s1"), card("s1b"), card("s2")], ["filled", "half", "open"]);
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
  // ⭐ D178 (changed on purpose): Learn is the circle only (its tabs retired), so an entry just selects the piece.
  assert.match(view, /useEffect\(\(\) => \{ const id = entryFromHash\(location\.hash\); if \(id\) setEntry\(id\); \}, \[location\.hash\]\);/);
  assert.match(view, /<LearnCircle key=\{entry \|\| "start"\}[^>]*initialSel=\{entry \|\| next\?\.id\}/);
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
  // D119: the item is a ResourceTile — the whole tile is the link, and its press records the opening.
  assert.match(read("client/src/pages/atlas/LearnCircle.jsx"), /<ResourceTile item=\{it\} thumb=\{thumbs\[it\.u\] \|\| null\} opened=\{!!marks\[it\.id\]\} onOpen=\{\(\) => onOpen\?\.\(it, piece\)\}/);
  assert.match(read("client/src/components/ResourceTile.jsx"), /<a className="rt" href=\{item\.u\} target="_blank" rel="noopener noreferrer" data-resource-tile=\{item\.id \|\| ""\} data-learn-open=\{item\.id\}\s+onClick=\{\(\) => onOpen\?\.\(item\)\}>/);
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
  assert.match(css, /@container \(max-width: 560px\) \{ \.lrc__twin \{ grid-template-columns: minmax\(0, 1fr\); \} \}/, "the twin boxes stack by the PANEL's width (a container query), not the window's");
  assert.match(css, /\.lrc__toast \{\n  position: fixed;[^}]*max-width: calc\(100vw - 32px\)/);
  const { circle } = await loadUi();
  const html = circle(props(await world(), { initialSel: "o4" }));
  // ⚠ CHANGED ON PURPOSE (C10 + C12): the pieces are rounded portrait CARDS (never capsules), in the wheel's own sheet.
  const wheelCss = read("client/src/pages/atlas/LearnWheel.css");
  assert.match(wheelCss, /\.lwh__card \{ position: absolute; width: 300px; height: 390px; left: -150px; border-radius: 26px;/, "rounded portrait cards");
  assert.doesNotMatch(wheelCss, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "no colour literal in the wheel");
  assert.doesNotMatch(wheelCss, /999px|border-radius:\s*50%/, "no capsule in the wheel");
  assert.match(html, /data-learn-wheel=""/);
  assert.doesNotMatch(html, /style="[^"]*(#[0-9a-f]{3,8}|rgb)/i, "no inline colour");
});

test("D115 P5 · the 26 games / exercises / practice links (riding on D117 C9): after the link check each shows on its piece as an OPTIONAL item of its kind, marked new; Exercise and Game sit after the tracker's kinds; opening one is an extra, never toward finishing", async () => {
  const { circle } = await loadUi();
  const db = await world();
  const w4 = props(db).pieces.find(p => p.id === "w4");
  const p5 = w4.items.filter(i => i.p5);
  assert.deepEqual(p5.map(i => i.k).sort(), ["Exercise", "Game", "Game", "Game", "Game"]);
  const html = circle(props(db, { initialSel: "w4" }));
  for (const it of p5) {
    const li = between(html, `data-learn-item="${it.id}"`, "</li>");
    assert.ok(li.includes(`href="${it.u}"`), it.id);
    assert.match(li, /optional/);
    assert.match(li, new RegExp(`data-learn-p5="${it.id}">new<`));
  }
  const kinds = [...html.matchAll(/<h4 class="lrc__kind-h">([^<]+)<\/h4>/g)].map(m => m[1]);
  assert.ok(kinds.indexOf("Game") > kinds.indexOf("Exercise") && kinds.indexOf("Exercise") > kinds.indexOf("Build"), kinds.join(","));
  const before = stepState(w4, earnedMarks(db, 7));
  recordOpened(db, 7, p5[0].id);
  const after = stepState(w4, earnedMarks(db, 7));
  assert.deepEqual([after.bar, after.extras], [before.bar, before.extras + 1]);
  assert.ok(after.extrasTotal >= 5);
});

// ── D117 C12 (owner 10-31, final): no watch face; the scroll wheel turns over a card and zooms elsewhere; the deck uses the stage ──
test("D117 C12 · d117NoWatchFace · d117PlainLineOnlyZoomedIn — no face, ticks, hands or centre button; one plain line, seen only zoomed in", async () => {
  const { circle } = await loadUi();
  const html = circle(props(await world(), { initialSel: "o4" }));
  const jsx = read("client/src/pages/atlas/LearnWheel.jsx");
  assert.doesNotMatch(html, /class="[^"]*(clock|hand|hub|tick|crown)[^"]*"/i, "no watch face, no crown");
  assert.match(html, /class="lwh__line" aria-hidden="true"/, "the one plain line");
  assert.match(jsx, /lineRef\.current\.style\.opacity = \(e \* 0\.7\)\.toFixed\(2\)/, "its opacity follows the zoom: 0 zoomed out");
  assert.doesNotMatch(html, />(Back|Forward|Zoom out|Previous card|Next card)</, "no nav buttons on the wheel");
});

test("D117 C12 · d117ScrollOverCardTurns · d117ScrollElsewhereZooms · d117ZoomSettles — the wheel's two jobs, by where it is", () => {
  const jsx = read("client/src/pages/atlas/LearnWheel.jsx");
  const wheel = jsx.slice(at(jsx, "const onWheel = (ev) => {"), at(jsx, 'el.addEventListener("wheel", onWheel, { passive: false });'));
  assert.match(wheel, /if \(!\(ev\.target\?\.closest && ev\.target\.closest\("\.lwh__card"\)\)\) \{/, "off a card: zoom");
  assert.match(wheel, /a\.zt = Math\.max\(0, Math\.min\(1, a\.zt - ev\.deltaY \* 0\.0025\)\)/);
  assert.match(wheel, /a\.snap = setTimeout\(\(\) => \{ a\.zt = a\.zt > 0\.5 \? 1 : 0; kick\(\); \}, 240\);/, "settles to the nearer end");
  assert.match(wheel, /while \(Math\.abs\(a\.wacc\) >= 60\) \{ const k = a\.wacc > 0 \? 1 : -1; a\.wacc -= k \* 60; turnRef\.current\(k\); \}/, "over a card: one card a notch");
  assert.match(jsx, /\{ passive: false \}/, "non-passive, so the page does not scroll under it");
});

test("D117 C12 · d117FrontCardUsesStage · d117ZoomToRightOfArc — the front card ≥ 60 % of the stage at 1280 × 800; zoomed in it sits at 3 o'clock", async () => {
  const { WHEEL, frontCardHeight, frameAt, wheelSlots } = await import("../client/src/pages/atlas/learnWheel.js");
  // 1280 × 800: the stage is min(84vh, 880) = 672 tall and ≈ 690 wide beside the panel (1.35fr : 1fr of ≈ 1200).
  const W = 690, H = 672;
  assert.ok(frontCardHeight(W, H) / H >= 0.6, `front card ${frontCardHeight(W, H)} of ${H}`);
  assert.equal(WHEEL.FRONT_MAX, 1.4);
  const pieces = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, partIndex: 1 + Math.floor(i / 4) }));
  const slots = wheelSlots(pieces);
  const fr = frameAt({ W, H, e: 1, f: 5, pieces, slots });
  const front = fr.cards.find(c => c.id === "p5");
  assert.ok(Math.abs(((fr.wheel.rot + front.ang) % 360 + 360) % 360 - 90) < 0.5, "the front card's spoke points at 3 o'clock");
  assert.equal(front.op, 1);
  const out = frameAt({ W, H, e: 0, f: 5, pieces, slots });
  assert.equal(out.wheel.rot, 0, "zoomed out the wheel is upright");
  assert.ok(out.cards.every(c => c.op === 1 && c.blur === 0), "zoomed out every card is plain");
  const css = read("client/src/pages/atlas/LearnWheel.css");
  assert.match(css, /\.lwh \{\n  position: relative; height: min\(84vh, 880px\); min-height: 640px;/, "the stage uses the space");
});
