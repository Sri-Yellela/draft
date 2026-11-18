// ⭐ D190 P1 · TINY (the PDF-tools site) + ASK DRAFT (draft): ONE ENGINE, ONE VOCABULARY, NO MODEL FOR ANYTHING THE SITE HOLDS.
// The owner's rule (11-14): "[the PDF-tools site] and draft both are supposed to not call for any task that is within the site's
// premise in terms of data or function." The end-to-end walks are scripts/d190Walk.mjs (draft, real Chrome) and
// scripts/d190TinyWalk.mjs (the PDF-tools site, real Chrome); these are the spec's unit tests.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { createAssistant, compileCommands, parse, parseCompound, correctFirstWord, checkExamples, normalise, TIER_LABEL } from "../shared/assistantEngine.js";
import { createDraftHandlers, sentenceToFilters, PLACES } from "../client/src/lib/assistantDraft.js";
import { lookup, LOOKUP_INTENTS } from "../services/assistant/assistant.js";
import { at } from "../test-support/sourceAnchors.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const COMMANDS = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "assistant", "commands-v1.json"), "utf8"));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

test("d190VocabularyExamplesPass — every row's examples parse to that row with those arguments, on both sites", () => {
  for (const site of ["rm", "draft"]) assert.deepEqual(checkExamples(COMMANDS, site), [], `site ${site}`);
  // every row has a known tier, a handler name (or an ask-back reply) and at least one pattern
  for (const r of COMMANDS.commands) {
    assert.ok(["T1", "T2", "T3", "ask"].includes(r.tier), r.intent);
    assert.ok(["rm", "draft", "both"].includes(r.site), r.intent);
    assert.ok(r.tier === "ask" ? r.reply : r.calls, r.intent);
    assert.ok(r.patterns?.length, r.intent);
  }
});

test("d190T1NoNetwork — the engine has no network, no imports, no DOM; T1 runs with fetch removed", async () => {
  const src = read("shared/assistantEngine.js");
  assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|\bimport\s|require\(|document\.|window\./);
  const real = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("T1 made a request"); };
  try {
    const calls = [];
    const bot = createAssistant({ commands: COMMANDS, site: "rm", handlers: {
      replaceText: (a) => { calls.push(a); return { text: "Replaced." }; }, goToPage: () => ({ text: "Page 5." }) } });
    const m = await bot.handle("replace 10,700,942 with 10,800,000 on line 3");
    assert.equal(m.tier, "T1"); assert.equal(m.label, TIER_LABEL.T1);
    assert.deepEqual(calls[0], { old: "10,700,942", new: "10,800,000", line: 3 });
    assert.equal((await bot.handle("go to page 5")).text, "Page 5.");
  } finally { globalThis.fetch = real; }
  // Tiny's bot fetches only two static files of its own site: the vocabulary and (46n, the floating bot) its FAQ
  const tinyPath = path.join(ROOT, "..", "resume-master", "public", "assistant", "tiny.js");
  if (!fs.existsSync(tinyPath)) return;   // resume-master not checked out beside draft
  const tiny = fs.readFileSync(tinyPath, "utf8");
  assert.deepEqual([...tiny.matchAll(/fetch\(([^)]*)\)/g)].map(m => m[1]), ['"/assistant/commands-v1.json"', '"/assistant/faq-rm.json"']);
});

test("d190T2NoModel — the server's lookup answers from draft's own data with a template; it takes no model and calls none", () => {
  const src = read("services/assistant/assistant.js");
  const body = src.slice(at(src, "export function lookup("), at(src, "/** The person pressed Confirm"));
  assert.ok(body.length > 200);
  assert.doesNotMatch(body, /callTask|anthropic|gateway|messages\.create/);
  const server = read("server.js");
  const route = server.slice(at(server, 'app.post("/api/assistant/lookup"'), at(server, 'app.post("/api/assistant/actions/:id/confirm"'));
  assert.ok(route.includes("assistantLookup(") && !/callTask|anthropic/.test(route), "the route calls lookup, never the gateway");
  // on a real database: drafted today, skills, a company with no record, a help question
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, run_id INTEGER, user_id INTEGER, job_id TEXT, status TEXT, created_at INTEGER DEFAULT (unixepoch()));
    INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (1, 7, 'a', 'submitted'), (1, 7, 'b', 'needs_you'), (1, 8, 'c', 'submitted');`);
  assert.match(lookup(db, 7, { intent: "drafted_today" }).text, /drafted 2 jobs; 1 of them has been sent/);
  assert.match(lookup(db, 7, { intent: "sponsorship", args: { company: "Nowhere Corp" } }).text, /no H-1B filing record/);
  assert.equal(lookup(db, 7, { intent: "sponsorship", args: {} }).tier, "ask");
  const help = lookup(db, 7, { intent: "question", question: "how does ask me first work?" });
  assert.equal(help.tier, "T2"); assert.match(help.text, /Ask me first/);
  assert.equal(lookup(db, 7, { intent: "question", question: "zzqx wibble" }), null, "nothing covers it → null, never a model");
  assert.deepEqual([...LOOKUP_INTENTS].sort(), ["drafted_today", "my_skills", "question", "sponsorship"]);
});

test("A219 (46r) · a question draft's help answers gets the help alone — no Atlas card on a word inside it", async () => {
  const { MIGRATIONS } = await import("../scripts/migrations.js");
  const { upsertNode, setStatus } = await import("../services/atlas/atlasStore.js");
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const publish = (kind, name, definition) => {
    const n = upsertNode(db, { kind, name, source: "registry", definition });
    setStatus(db, db.prepare(`SELECT slug FROM atlas_nodes WHERE id = ?`).pluck().get(n.id), "published");
  };
  publish("skill", "Work", "Synthetic: a node any question with 'work' in it finds.");
  publish("tool", "Kafka", "Synthetic: streams events between services.");
  const faq = lookup(db, 7, { intent: "question", question: "how does ask me first work?" });
  assert.match(faq.text, /^Ask me first: /);
  assert.doesNotMatch(faq.text, /Atlas —/, "the FAQ answer carries no Atlas card");
  assert.deepEqual(faq.lessons, []);
  assert.deepEqual(faq.links.map(l => l.title), ["Ask me first"]);
  // a question help does NOT cover still gets Atlas
  const atlas = lookup(db, 7, { intent: "question", question: "what is kafka?" });
  assert.match(atlas.text, /^Atlas — Kafka: Synthetic: streams events/);
  assert.deepEqual(atlas.lessons.map(l => l.slug), ["kafka"]);
});

test("d190T3OnlyWhenAsked — nothing that fails to match reaches T3; the T3 handler runs only for a new-writing row", async () => {
  let t3 = 0;
  const bot = createAssistant({ commands: COMMANDS, site: "draft", handlers: { t3: () => { t3++; return { text: "written" }; } } });
  for (const s of ["what's the weather in Paris", "tell me a joke", "zzqx", "how do I negotiate salary?"]) {
    const m = await bot.handle(s);
    assert.notEqual(m.tier, "T3", s);
  }
  assert.equal(t3, 0);
  assert.equal((await bot.handle("rewrite this bullet to highlight Kafka")).tier, "T3");
  assert.equal(t3, 1);
  // draft's T3 handler: switched off → nothing is sent
  const sent = [];
  const h = createDraftHandlers({ navigate() {}, api: async (p) => { sent.push(p); return {}; }, action: () => null, t3Available: () => false });
  const r = await h.t3({}, { said: "rewrite this" });
  assert.ok(r.ask); assert.deepEqual(sent, []);
});

test("d190T3LabelledWrittenByAssistant — a T3 answer carries “written by the assistant”", async () => {
  const sent = [];
  const h = createDraftHandlers({ navigate() {}, api: async (p, o) => { sent.push([p, JSON.parse(o.body)]); return { ok: true, answer: "A new bullet.", lessons: [] }; }, action: () => null, t3Available: () => true });
  const bot = createAssistant({ commands: COMMANDS, site: "draft", handlers: h });
  const m = await bot.handle("rewrite this bullet to highlight Kafka");
  assert.equal(m.tier, "T3"); assert.equal(m.label, "T3 • written by the assistant"); assert.equal(m.text, "A new bullet.");
  assert.deepEqual(sent, [["/api/assistant/ask", { question: "rewrite this bullet to highlight Kafka" }]]);
});

test("d190DestructiveAsksConfirmation — delete asks first; nothing runs until yes; no cancels", async () => {
  let deleted = 0;
  const bot = createAssistant({ commands: COMMANDS, site: "rm", handlers: { deletePage: () => { deleted++; return { text: "Page 2 deleted." }; }, deleteAllPages: () => { deleted++; return { text: "x" }; } } });
  let m = await bot.handle("delete page 2");
  assert.equal(m.tier, "ask"); assert.ok(m.confirm); assert.match(m.text, /Delete page 2\?/); assert.equal(deleted, 0);
  m = await bot.handle("yes");
  assert.equal(m.text, "Page 2 deleted."); assert.equal(deleted, 1);
  m = await bot.handle("delete all pages");
  assert.match(m.text, /Are you sure/);
  m = await bot.handle("no");
  assert.match(m.text, /Cancelled — nothing changed/); assert.equal(deleted, 1);
  // something else typed instead of yes / no drops the question and is handled on its own
  await bot.handle("delete page 3");
  m = await bot.decide(false);
  assert.match(m.text, /Cancelled/); assert.equal(deleted, 1);
});

test("d190AmbiguousAsksBack — “fix this” asks what to change; no handler runs", async () => {
  let ran = 0;
  const handlers = new Proxy({}, { get: () => () => { ran++; return { text: "ran" }; } });
  const bot = createAssistant({ commands: COMMANDS, site: "rm", handlers });
  for (const s of ["fix this", "make it better", "change it", "edit"]) {
    const m = await bot.handle(s);
    assert.equal(m.tier, "ask", s); assert.match(m.text, /What should I change/);
  }
  assert.equal(ran, 0);
});

test("d190UndoLinkWorks — a T1 change carries an Undo that reverses exactly it", async () => {
  const doc = { line3: "Revenue grew to 10,700,942" };
  const bot = createAssistant({ commands: COMMANDS, site: "rm", handlers: {
    replaceText: (a) => { const was = doc.line3; doc.line3 = was.replace(a.old, a.new); return { text: "Replaced.", undo: () => { doc.line3 = was; return { text: "Back." }; } }; } } });
  const m = await bot.handle("replace 10,700,942 with 10,800,000 on line 3");
  assert.equal(doc.line3, "Revenue grew to 10,800,000");
  assert.equal(typeof m.undo, "function");
  assert.equal((await m.undo()).text, "Back.");
  assert.equal(doc.line3, "Revenue grew to 10,700,942");
});

test("d190AddCommandOneRow — a new command is one row: it parses and routes with no engine change", async () => {
  const more = { ...COMMANDS, commands: [...COMMANDS.commands, { intent: "count_words", site: "rm", tier: "T2", calls: "countWords",
    patterns: ["how many words[ on page {page:int}]", "how many words are there"], examples: [{ say: "how many words on page 2", args: { page: 2 } }] }] };
  assert.deepEqual(checkExamples(more, "rm"), []);
  const bot = createAssistant({ commands: more, site: "rm", handlers: { countWords: (a) => ({ text: `412 words on page ${a.page}.` }) } });
  const m = await bot.handle("how many words on page 2?");
  assert.equal(m.tier, "T2"); assert.equal(m.text, "412 words on page 2.");
  assert.throws(() => compileCommands({ commands: [...more.commands, more.commands.at(-1)] }, "rm"), /duplicate intent/);
});

test("d190SessionClearedOnSignOut — the conversation lives in this tab's session and the one sign-out clears it", async () => {
  const app = read("client/src/App.jsx");
  const logout = app.slice(at(app, "const handleLogout = useCallback"), at(app, "const handleLogout = useCallback") + 600);
  assert.match(logout, /clearAskDraftSession\(\)/);
  const store = new Map([["draft-ask:turns", "[1]"]]);
  const events = [];
  globalThis.sessionStorage = { removeItem: (k) => store.delete(k), getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  globalThis.window = { dispatchEvent: (e) => events.push(e.type) };
  try {
    const { clearAskDraftSession, ASK_SESSION_KEY, ASK_CLEAR_EVENT } = await import("../client/src/lib/assistantBridge.js");
    clearAskDraftSession();
    assert.equal(store.has(ASK_SESSION_KEY), false);
    assert.deepEqual(events, [ASK_CLEAR_EVENT]);
  } finally { delete globalThis.sessionStorage; delete globalThis.window; }
  // the panel keeps it in sessionStorage (never the server) and listens for the clear
  const nav = read("client/src/components/AppNav.jsx");
  assert.match(nav, /sessionStorage\.setItem\(ASK_SESSION_KEY/);
  assert.match(nav, /addEventListener\(ASK_CLEAR_EVENT/);
});

test("d190SiteDataNeverCallsModel — every T1 / T2 row and every unmatched question is answered without /api/assistant/ask", async () => {
  // no T1 / T2 / ask row is routed to the T3 handler
  for (const r of COMMANDS.commands) if (r.tier !== "T3") assert.notEqual(r.calls, "t3", r.intent);
  // drive every draft row's examples through draft's real handlers; record every request
  const sent = [];
  const job = { jobId: "j1", company: "Kestrel", title: "Data Engineer", baseAtsScore: 81 };
  const actions = { currentJob: () => job, boardDecide: async () => "done", boardUndo: async () => {}, getFilters: () => ({}), setFilters: () => {}, cancelDraft: async () => {} };
  const h = createDraftHandlers({ navigate() {}, action: (n) => actions[n] || null, t3Available: () => true,
    counts: () => ({ needsYou: 2, questions: 1, ready: 1, other: 0 }), pending: () => [{ jobId: "j9", company: "Ostara", questions: [{ question: "q" }] }],
    api: async (p, o) => { sent.push([p, o?.body ? JSON.parse(o.body) : null]); return p === "/api/assistant/lookup" ? { found: true, tier: "T2", text: "from draft's data" } : { ok: true, answer: "x" }; } });
  const bot = createAssistant({ commands: COMMANDS, site: "draft", handlers: h, fallback: h.fallback });
  for (const r of COMMANDS.commands.filter(x => (x.site === "draft" || x.site === "both") && x.tier !== "T3")) {
    for (const ex of r.examples) {
      const m = await bot.handle(ex.say);
      if (m.confirm) await bot.handle("no");
      assert.notEqual(m.tier, "T3", ex.say);
    }
  }
  // site questions no row matches (Atlas, help) → the lookup, never the model
  for (const q of ["what is Spark?", "how does saved answers work", "what should I learn for a data analyst role?"]) {
    const m = await bot.handle(q);
    assert.equal(m.tier, "T2", q);
  }
  assert.ok(sent.length > 0);
  assert.deepEqual(sent.filter(([p]) => p === "/api/assistant/ask"), [], "no T1 / T2 request reached the model route");
  assert.ok(sent.every(([p, b]) => p !== "/api/assistant/lookup" || ["drafted_today", "sponsorship", "my_skills", "question"].includes(b.intent)));
});

test("d190 · the engine is mirrored byte-identical into the PDF-tools repo (line endings aside), with the vocabulary", (t) => {
  const rm = path.join(ROOT, "..", "resume-master", "public", "assistant");
  if (!fs.existsSync(rm)) return t.skip("resume-master is not checked out beside draft");
  const norm = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  assert.equal(norm(path.join(rm, "assistantEngine.js")), norm(path.join(ROOT, "shared", "assistantEngine.js")), "change both copies of the engine");
  assert.equal(norm(path.join(rm, "commands-v1.json")), norm(path.join(ROOT, "content", "assistant", "commands-v1.json")), "change both copies of the vocabulary");
});

test("d190 · parsing: politeness, quotes and trailing punctuation don't change the command; rows are tried in order", () => {
  const c = compileCommands(COMMANDS, "rm");
  assert.equal(normalise("Please, replace 2019 with 2020."), "replace 2019 with 2020");
  assert.deepEqual(parse("can you change “Senior Analyst” to 'Lead Analyst'?", c).args, { old: "Senior Analyst", new: "Lead Analyst" });
  assert.equal(parse("download as Word", c).row.intent, "convert");   // before "download"
  assert.equal(parse("download", c).row.intent, "download");
  assert.equal(parse("save", c).row.intent, "download");
  const d = compileCommands(COMMANDS, "draft");
  assert.equal(parse("save", d).row.intent, "save_job");               // the same word, the site's own meaning
  assert.equal(parse("draft this job", d).row.intent, "draft_job");    // "draft" is not stripped as a greeting
  assert.equal(parse("show me the board", d).args.place, "board");
});

test("d190 · draft: the filter sentence in the board's own words, and the dock's places", () => {
  assert.deepEqual(sentenceToFilters("backend senior in Boston"), { experience_levels: ["senior"], work_models: [], places: ["metro:boston"], search: "backend" });
  assert.deepEqual(sentenceToFilters("remote junior data analyst jobs"), { experience_levels: ["entry"], work_models: ["remote"], places: [], search: "data analyst" });
  assert.equal(PLACES.home, "/app/auto-apply");   // D167: the dock's Home is the house
  assert.equal(PLACES.board, "/app");             // and "draft" is the jobs page
  assert.equal(PLACES.profile, "/app/profile/about");
  assert.equal(PLACES.settings, "/app/profile/account");
});

test("d190 P4 · voice: the browser's recogniser, on this device when it can; the note never claims no server when there is one", async () => {
  const { voiceSupported, listenOnce, voiceNote, VOICE_ERRORS } = await import("../shared/assistantVoice.js");
  assert.equal(voiceSupported({}), false);
  let made = null;
  class SR { static async available(o) { SR.asked = o; return SR.state; } start() { made = this; } stop() { this.onend?.(); } }
  for (const [state, local] of [["available", true], ["downloadable", false]]) {
    SR.state = state;
    const heard = [], ended = [];
    const h = await listenOnce({ w: { webkitSpeechRecognition: SR, navigator: { language: "en-GB" } }, onText: (t) => heard.push(t), onEnd: (c) => ended.push(c) });
    assert.equal(h.local, local); assert.equal(made.processLocally === true, local); assert.equal(made.lang, "en-GB");
    assert.deepEqual(SR.asked, { langs: ["en-GB"], processLocally: true });
    made.onresult({ results: [[{ transcript: " delete page 2 " }]] }); made.onend();
    assert.deepEqual(heard, ["delete page 2"]); assert.deepEqual(ended, [null]);
  }
  assert.match(voiceNote(true), /on this device/);
  assert.match(voiceNote(false), /browser's speech service/);
  assert.ok(VOICE_ERRORS["not-allowed"]);
  await assert.rejects(listenOnce({ w: {} }), /no speech input/);
  // the voice file is mirrored too
  const rm = path.join(ROOT, "..", "resume-master", "public", "assistant", "assistantVoice.js");
  if (fs.existsSync(rm)) assert.equal(fs.readFileSync(rm, "utf8").replace(/\r\n/g, "\n"), read("shared/assistantVoice.js"), "change both copies of the voice helper");
});

test("d190 P2 · draft: missing keywords come from the card's own scorer reading; a posting without them says where to look", () => {
  const job = { jobId: "j1", company: "Halcyon", why: { matched: ["Python", "SQL"], missing: ["Kafka", "Airflow"], matchedTotal: 9, missingTotal: 2 } };
  const h = createDraftHandlers({ navigate() {}, api: async () => { throw new Error("no request"); }, action: (n) => (n === "currentJob" ? () => job : null) });
  assert.match(h.missingKeywords().text, /missing 2 keywords: Kafka, Airflow\. It matches 9/);
  const bare = createDraftHandlers({ navigate() {}, api: async () => ({}), action: (n) => (n === "currentJob" ? () => ({ jobId: "x", company: "Quanta" }) : null) });
  assert.match(bare.missingKeywords().text, /Open Quanta's ATS score/);
});

test("d190 · a bare | outside ( ) fails loudly (it once silently never matched “does Kestrel sponsor h1b”)", () => {
  assert.throws(() => compileCommands({ commands: [{ intent: "x", site: "rm", tier: "T1", calls: "x", patterns: ["sponsor[ visas| h1b]"], examples: [] }] }, "rm"), /a \| outside \( \)/);
  const c = compileCommands(COMMANDS, "draft");
  assert.deepEqual(parse("does Kestrel sponsor h1b", c).args, { company: "Kestrel" });
  assert.deepEqual(parse("does this company sponsor?", c).args, {}, "“this company” is the open posting's, never a company called that");
});

// ── 46n (owner 11-15: "rewrute letter as page and boston as NYC" failed; "make tiny a floating bot … give it a cute logo
// animal … the same for [the PDF-tools site] too") ──

test("46n · Tiny's fox is drawn once: shared/tinyMascot.js mirrored byte-identical into the extension and the PDF-tools repo (line endings aside)", async (t) => {
  const mine = read("shared/tinyMascot.js");
  assert.equal(read("extension/tinyMascot.js"), mine, "change both copies of the mascot (extension/tinyMascot.js)");
  const { tinySvg, TINY_NAME } = await import("../shared/tinyMascot.js");
  assert.equal(TINY_NAME, "draft");   // 46v 0c (owner 11-18): Tiny retired — changed on purpose
  assert.match(tinySvg({ size: 30 }), /^<svg [^>]*width="30" height="30" aria-hidden="true" focusable="false">/, "decorative without a title");
  assert.match(tinySvg({ title: "Tiny" }), /role="img"[^>]*><title>Tiny<\/title>/);
  assert.doesNotMatch(mine, /\bfetch\(|XMLHttpRequest|\bimport\s|document\.|window\./, "pure: a string, no DOM");
  const rm = path.join(ROOT, "..", "resume-master", "public", "assistant", "tinyMascot.js");
  if (!fs.existsSync(rm)) return t.skip("resume-master is not checked out beside draft");
  assert.equal(fs.readFileSync(rm, "utf8").replace(/\r\n/g, "\n"), mine, "change both copies of the mascot (resume-master)");
});

test("46n · a typo in the first word is corrected to the nearest command word: “rewrute letter as page” → replace_text", () => {
  const c = compileCommands(COMMANDS, "rm");
  const p = parse("rewrute letter as page", c);
  assert.equal(p.row.intent, "replace_text");
  assert.deepEqual(p.args, { old: "letter", new: "page" });
  assert.equal(p.corrected, "rewrite letter as page");
  assert.equal(correctFirstWord("rewrite letter as page", c), null, "a real command word is left alone");
  assert.equal(correctFirstWord("xyz letter", c), null, "a short word is never guessed");
  assert.equal(correctFirstWord("qwertyuiop letter as page", c), null, "nothing near → no guess");
  assert.equal(parse("replace 2023 with 2024", c).corrected, undefined, "a command that matched as typed carries no correction");
});

test("46n · 'X as Y' and 'into' are replacements; 'rewrite … to …' stays new writing (T3)", () => {
  const c = compileCommands(COMMANDS, "rm");
  for (const [s, args] of [["rewrite letter as page", { old: "letter", new: "page" }], ["turn 2023 into 2024", { old: "2023", new: "2024" }]]) {
    const p = parse(s, c);
    assert.equal(p.row.intent, "replace_text", s); assert.deepEqual(p.args, args, s);
  }
  const t3 = parse("rewrite this bullet to highlight Kafka", c);
  assert.equal(t3.row.intent, "write_new"); assert.equal(t3.row.tier, "T3");
  assert.equal(parseCompound("rewrite this bullet to highlight Kafka", c), null);
});

test("46n · compound requests: the owner's “rewrute letter as page and boston as NYC” → two replaceText calls; ONE Undo reverts both, in reverse", async () => {
  const c = compileCommands(COMMANDS, "rm");
  const parts = parseCompound("rewrute letter as page and boston as NYC", c);
  assert.deepEqual(parts.map(h => [h.row.intent, h.args]), [["replace_text", { old: "letter", new: "page" }], ["replace_text", { old: "boston", new: "NYC" }]]);
  assert.deepEqual(parseCompound("replace a with b and c with d", c).map(h => h.args), [{ old: "a", new: "b" }, { old: "c", new: "d" }]);
  assert.equal(parseCompound("delete page 2 and replace a with b", c), null, "a part that confirms first makes the whole request a single one");
  let doc = "Dear letter, from boston.";
  const calls = [], undone = [];
  const bot = createAssistant({ commands: COMMANDS, site: "rm", handlers: {
    replaceText: (a) => { const was = doc; calls.push(a); doc = doc.replace(a.old, a.new); return { text: `Replaced ${a.old}.`, undo: () => { undone.push(a.old); doc = was; return { text: `Back: ${a.old}.` }; } }; } } });
  const m = await bot.handle("rewrute letter as page and boston as NYC");
  assert.deepEqual(calls, [{ old: "letter", new: "page" }, { old: "boston", new: "NYC" }]);
  assert.equal(doc, "Dear page, from NYC.");
  assert.equal(m.tier, "T1"); assert.equal(m.steps, 2); assert.equal(m.intent, "replace_text+replace_text");
  assert.equal(typeof m.undo, "function");
  const u = await m.undo();
  assert.deepEqual(undone, ["boston", "letter"], "reverse order");
  assert.equal(doc, "Dear letter, from boston.");
  assert.equal(u.text, "Back: boston. Back: letter.");
});

test("46n · “replace Q&A with questions and answers” stays ONE replacement (the 'and' is the new text's)", async () => {
  const c = compileCommands(COMMANDS, "rm");
  assert.equal(parseCompound("replace Q&A with questions and answers", c), null);
  assert.deepEqual(parse("replace Q&A with questions and answers", c).args, { old: "Q&A", new: "questions and answers" });
  const calls = [];
  const bot = createAssistant({ commands: COMMANDS, site: "rm", handlers: { replaceText: (a) => { calls.push(a); return { text: "Replaced." }; } } });
  await bot.handle("replace Q&A with questions and answers");
  assert.deepEqual(calls, [{ old: "Q&A", new: "questions and answers" }]);
});

test("46n · a command this page can't run answers through `unavailable` BEFORE any “Are you sure?” — and keeps its links", async () => {
  const ledger = [];
  const bot = createAssistant({ commands: COMMANDS, site: "rm", handlers: {}, ledger,
    unavailable: (row) => ({ ask: `“${row.intent}” works on an open document.`, extra: { links: [{ title: "Open the workspace", href: "/workspace/" }] } }) });
  const m = await bot.handle("delete page 2");
  assert.equal(m.tier, "ask"); assert.ok(!m.confirm, "no confirm for something that cannot happen");
  assert.equal(m.text, "“delete_page” works on an open document.");
  assert.deepEqual(m.links, [{ title: "Open the workspace", href: "/workspace/" }]);
  assert.equal(m.failed, true);
  assert.equal(bot.pending, null, "nothing waits for a yes");
  assert.notEqual((await bot.handle("yes")).confirm, true);
  // without the hook: a plain line, still no confirm
  const plain = createAssistant({ commands: COMMANDS, site: "rm", handlers: {} });
  const p = await plain.handle("delete page 2");
  assert.equal(p.text, "That isn't available on this page."); assert.ok(!p.confirm);
  assert.ok(ledger.every(e => e.tier !== "T3"));
});
