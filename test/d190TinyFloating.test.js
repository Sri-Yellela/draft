// ⭐ D190 · TINY, FLOATING (owner 11-15: "make tiny a floating bot on the site rather than a panel button. give it a cute logo
// animal, and then for capabilities it should be able to put filters into the search and show results on the page in draft
// amongst other functions, answer faqs"; the owner chose: Tiny REPLACES Ask draft on draft).
//   1. the dock has no Ask item; a fox bubble fixed at the bottom-right opens the same panel as a card OVER the page
//   2. a filter said where no board is mounted opens the board (/app), waits for it to register, then applies — and a plain
//      search ("find data analyst jobs", "search for product manager") is the board's text search; all T1, no model
//   3. FAQs: draft's help (content/assistant/help.json) covers the main features, every href a real route
// The real-Chrome walk is scripts/d190Walk.mjs (the bubble, the floating card, the filter from Home / Interview, the FAQ).
import { at } from "../test-support/sourceAnchors.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createAssistant } from "../shared/assistantEngine.js";
import { createDraftHandlers, jobSearchSentence, looksLikeJobSearch, BOARD_WAIT_MS, mergeFilters } from "../client/src/lib/assistantDraft.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const COMMANDS = JSON.parse(read("content/assistant/commands-v1.json"));
const NAV = read("client/src/components/AppNav.jsx");
const CSS = read("client/src/components/AppNav.css");

// a board that mounts `mountAfter` polls after navigate("/app") — the bridge's setFilters appears only then
function harness({ mounted = false, mountAfter = 3 } = {}) {
  const st = { mounted, navs: [], applied: [], polls: 0, sent: [] };
  const actions = { setFilters: (f) => st.applied.push(f), getFilters: () => ({ experience_levels: [], work_models: [], places: [], search: "" }) };
  const h = createDraftHandlers({
    navigate: (to) => st.navs.push(to),
    api: async (p, o) => { st.sent.push([p, o?.body ? JSON.parse(o.body) : null]); return p === "/api/assistant/lookup" ? { found: true, tier: "T2", text: "from draft's help" } : {}; },
    action: (n) => (st.mounted ? actions[n] || null : null),
    sleep: async () => { st.polls++; if (st.navs.length && st.polls >= mountAfter) st.mounted = true; },
  });
  const bot = createAssistant({ commands: COMMANDS, site: "draft", handlers: h, fallback: h.fallback });
  return { st, h, bot };
}

test("d190TinyFilterOpensBoard — “show me senior remote jobs in Boston” from a page with no board: opens /app, waits, applies", async () => {
  const { st, bot } = harness();
  const m = await bot.handle("show me senior remote jobs in Boston");
  assert.deepEqual(st.navs, ["/app"], "the board is opened");
  assert.equal(st.applied.length, 1);
  assert.deepEqual(st.applied[0], { experience_levels: ["senior"], work_models: ["remote"], places: ["metro:boston"], search: "" });
  assert.equal(m.tier, "T1"); assert.match(m.text, /senior remote jobs in Boston\. I opened the board for you\./);
  assert.equal(typeof m.undo, "function", "Undo restores the filters");
  assert.deepEqual(st.sent, [], "no request at all — T1");
});

test("d190TinyFilterOnBoard — the board already mounted: no navigation, applied at once", async () => {
  const { st, bot } = harness({ mounted: true });
  const m = await bot.handle("set my filter to backend senior in Boston");
  assert.deepEqual(st.navs, []); assert.equal(st.polls, 0);
  assert.equal(st.applied[0].search, "backend"); assert.doesNotMatch(m.text, /opened the board/);
});

test("a213TinyKeepsUnnamedClauses — a sentence replaces only the clauses it names (the career level survives)", async () => {
  const st = { applied: [], cur: { experience_levels: ["senior"], work_models: [], places: ["metro:boston"], search: "" } };
  const actions = { setFilters: (f) => { st.applied.push(f); st.cur = f; }, getFilters: () => st.cur };
  const h = createDraftHandlers({ navigate: () => {}, api: async () => ({}), action: (n) => actions[n] || null, sleep: async () => {} });
  const bot = createAssistant({ commands: COMMANDS, site: "draft", handlers: h, fallback: h.fallback });
  const m = await bot.handle("show me remote data engineer jobs in Boston");
  assert.deepEqual(st.applied.at(-1), { experience_levels: ["senior"], work_models: ["remote"], places: ["metro:boston"], search: "data engineer" }, "senior is kept");
  assert.match(m.text, /senior remote “data engineer” jobs in Boston/);
  await m.undo();
  assert.deepEqual(st.cur.experience_levels, ["senior"]); assert.deepEqual(st.cur.work_models, [], "Undo restores the board as it was");
  assert.deepEqual(mergeFilters({ experience_levels: ["mid"], work_models: ["hybrid"], places: [], search: "x" }, { experience_levels: ["lead"], work_models: [], places: [], search: "" }),
    { experience_levels: ["lead"], work_models: ["hybrid"], places: [], search: "x" });
  assert.deepEqual(mergeFilters(null, { experience_levels: [], work_models: ["remote"], places: [], search: "" }), { experience_levels: [], work_models: ["remote"], places: [], search: "" });
});

test("d190TinyFilterGivesUp — a board that never registers: waits ≤ 3 s of polls, then says so (never a silent no-op)", async () => {
  const { st, bot } = harness({ mountAfter: Infinity });
  const m = await bot.handle("find remote jobs");
  assert.equal(BOARD_WAIT_MS, 3000);
  assert.equal(st.polls, 30, "100 ms polls for 3 s");
  assert.equal(st.applied.length, 0); assert.equal(m.failed, true); assert.match(m.text, /didn't open in time/);
});

test("d190TinyPlainSearch — plain searches are the board's text search; questions stay FAQs (the lookup)", async () => {
  for (const [said, search] of [["find data analyst jobs", "data analyst"], ["search for product manager", "product manager"], ["look for product manager jobs", "product manager"], ["data analyst jobs in Boston", "data analyst"]]) {
    const { st, bot } = harness();
    const m = await bot.handle(said);
    assert.equal(m.tier, "T1", said); assert.equal(st.applied[0]?.search, search, said); assert.deepEqual(st.navs, ["/app"], said);
    assert.deepEqual(st.sent, [], `${said}: no lookup, no model`);
  }
  for (const q of ["what should I learn for a data analyst role?", "how does ask me first work?", "what is Spark?", "how do saved answers work"]) {
    const { st, bot } = harness();
    const m = await bot.handle(q);
    assert.equal(m.tier, "T2", q); assert.deepEqual(st.applied, [], q); assert.deepEqual(st.navs, [], q);
    assert.deepEqual(st.sent.map(([p, b]) => [p, b.intent]), [["/api/assistant/lookup", "question"]], `${q}: draft's help, never the model`);
  }
  assert.equal(jobSearchSentence("show me the money"), null, "“show me …” is the navigate row's, not a search");
  assert.equal(looksLikeJobSearch("my profile"), false);
});

test("d190TinyFloats — the fox bubble opens the panel as a floating card; tokens only (D197 #1: the rail's Ask draft opens it too)", () => {
  assert.match(NAV, /export const DOCK_PLACES = Object\.freeze\(\["today", "auto-apply", "atlas", "interview", "profile"\]\);/);
  // ⭐ D197 #1 (the Shell board, changed on purpose): the rail draws Ask draft after its rule, and it opens THIS Tiny (the
  // same pressAsk as the bubble) — never a second panel; the phone's bar has none (Tiny's bubble there).
  assert.match(NAV, /const ask = bar \? null : \{ onPress: pressAsk, attrs: \{ "data-nav-item": "ask", "aria-expanded": !!askOpen, "aria-controls": "appnav-ask"/);
  assert.doesNotMatch(NAV, /AskItem/);
  assert.match(NAV, /const TINY_FACE = \{ __html: tinySvg\(\{ size: 40 \}\) \};/, "the fox from shared/tinyMascot.js");
  assert.match(NAV, /data-tiny-launch="" data-open=\{open \? "true" : "false"\}/);
  assert.match(NAV, /<AskDraftCard name=\{TINY_NAME\}/, "the card is named Tiny (D197 #12: the plate card draws the name)");
  assert.match(NAV, /aria-label=\{TINY_NAME\} data-ask-draft="" data-tiny-card=""/, "the data-ask-* hooks stay");
  assert.doesNotMatch(NAV.slice(at(NAV, "export function AskDraftPanel("), at(NAV, "export default function AppNav(")), />Ask draft<|"Ask draft"|Ask draft couldn't/, "no visible “Ask draft” left in the panel");
  assert.match(NAV, /sessionStorage\.getItem\(TINY_OPEN_KEY\) === "1"/, "open state remembered for the tab's session");
  // held questions still open Tiny with the thread
  assert.match(NAV, /window\.addEventListener\("draft:open-questions", open\)/);
  assert.match(NAV, /window\.addEventListener\("draft:open-questions", onOpen\)/);
  // the card floats: nothing pads the page for it
  assert.doesNotMatch(CSS, /\[data-ask-open="true"\][^{]*\[data-app-(shell|chrome)\]/);
  const tiny = CSS.slice(at(CSS, "/* ⭐ D190 · TINY"), at(CSS, "/* Reduced motion"));
  assert.ok(tiny.length > 500);
  assert.doesNotMatch(tiny, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "colours only from theme tokens (the fox's own live in shared/tinyMascot.js)");
  assert.doesNotMatch(tiny, /999px/, "no capsules (D60)");
});

test("d190TinyFaqs — draft's help covers the main features, and every href is a real route", () => {
  const help = JSON.parse(read("content/assistant/help.json")).entries;
  const ids = help.map(e => e.id);
  for (const id of ["tiny", "h1b-sponsorship", "home-applications", "profile", "extension", "jobs", "atlas", "interview", "saved-answers", "privacy"]) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  const panels = ["about", "answers", "autoapply", "connections", "appearance", "notifications", "privacy", "account"];
  for (const e of help) {
    assert.ok(e.title && e.text && e.keywords?.length, e.id);
    const h = e.href;
    const ok = h === "/app" || /^\/app\/(jobs|auto-apply|interview|atlas)$/.test(h) || h === "/atlas" || h === "/extension"
      || (/^\/app\/profile\/([a-z]+)$/.test(h) && panels.includes(h.split("/").pop()));
    assert.ok(ok, `${e.id}: ${h} is a real in-app address`);
  }
});
