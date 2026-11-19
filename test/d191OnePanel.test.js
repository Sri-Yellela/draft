// ⭐ D191 sketch 2 (owner 11-18: "alright go") · THE ONE PANEL — the dock's home tab, Tsenta's shape in draft's colours.
// https://claude.ai/artifact/4HugMVyxHnjysbCC23okZj (v2). The owner's answers: the fit is a PERCENTAGE, "Review before I
// submit" is a checkbox, the panel opens by itself on job boards; few words, no stack / ATS lines.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { panelModel, sponsorWords, jobOf } from "../extension/jobPanelModel.js";
import { relayFor, toolbarPress } from "../extension/toolbarPress.js";
import { normaliseSettings, defaultSettings } from "../extension/autoRead.js";

const page = { title: "Senior Backend Engineer", company: "Kestrel Payments", location: "Boston, MA" };
const ctx = (job = {}, extra = {}) => ({ job: { jobId: "j1", title: "Senior Backend Engineer", company: "Kestrel Payments", known: true, score: 86, ...job },
  company: { name: "Kestrel Payments", sponsorship: "Filed 41 certified LCAs in FY2025", openJobs: 37 }, prepared: false, ...extra });

test("D191 · a job draft knows: the match as a PERCENTAGE and sponsorship, ONE button — Draft this job", () => {
  const m = panelModel({ signedIn: true, page, ctx: ctx() });
  assert.equal(m.kind, "job");
  assert.equal(m.status.text, "86% match · sponsors visas");
  assert.equal(m.status.tone, "ok");
  assert.deepEqual(m.button, { label: "Draft this job", act: "draft", disabled: false });
  assert.equal(m.job.title, "Senior Backend Engineer");
  assert.equal(m.job.sub, "Kestrel Payments · Boston, MA");
  assert.equal(m.note, null);
});

test("D191 · few words: no stack, ATS, keyword or 'you've proven' line anywhere in the panel's words", () => {
  const words = JSON.stringify([panelModel({ signedIn: true, page, ctx: ctx() }), panelModel({ signedIn: true, page, ctx: ctx({ application: { state: "Drafted", sendFromHere: true } }) })]);
  for (const bad of [/works with/i, /\bATS\b/, /keyword/i, /proven/i, /\bstack\b/i]) assert.doesNotMatch(words, bad);
});

test("D191 · arriving: drawn from the page alone ('Checking draft…') before draft answers", () => {
  const m = panelModel({ signedIn: true, page, ctx: null, pending: true });
  assert.equal(m.kind, "arriving");
  assert.equal(m.status.text, "Checking draft…");
  assert.equal(m.job.title, "Senior Backend Engineer");
  assert.equal(m.job.sub, "Kestrel Payments · Boston, MA");
  assert.equal(m.button.label, "Draft this job");
});

test("D191 · the run's states: drafting · ready (Apply from here — fills, the person submits) · needs you · sent · failed", () => {
  const at = (state, sendFromHere = false) => panelModel({ signedIn: true, page, ctx: ctx({ application: { state, sendFromHere } }) });
  assert.equal(at("In progress").kind, "drafting");
  assert.equal(at("In progress").button.disabled, true);
  const ready = at("Drafted", true);
  assert.equal(ready.kind, "ready");
  assert.equal(ready.status.text, "Résumé ready · 86% match");
  assert.deepEqual(ready.button, { label: "Apply from here", act: "fill", disabled: false });
  assert.equal(ready.note.text, "Fills the form. You press Submit.");
  assert.equal(at("Drafted").kind, "drafted");
  assert.equal(at("Needs you").button.act, "open-needs");
  assert.equal(at("Sent").status.text, "Sent");
  assert.equal(at("Failed").kind, "failed");
});

test("D191 · on the form with prepared answers: Fill this form, then the employer's Submit (D36: draft never submits)", () => {
  const m = panelModel({ signedIn: true, page, ctx: ctx({}, { prepared: true }) });
  assert.equal(m.kind, "form");
  assert.equal(m.button.act, "fill");
  assert.match(m.note.text, /employer's Submit/);
  for (const s of ["job", "arriving", "ready", "form", "drafting", "sent"]) assert.notEqual(s, "submit");
});

test("D191 (5) · signed out: the employer's public facts and the way in — no How I apply", () => {
  const m = panelModel({ signedIn: false, page, ctx: { company: { name: "Kestrel Payments", sponsorship: "Filed 41 certified LCAs", openJobs: 37 } } });
  assert.equal(m.kind, "signed-out");
  assert.equal(m.status.text, "sponsors visas · 37 open jobs");
  assert.deepEqual(m.button, { label: "Sign in to see your match", act: "sign-in", disabled: false });
  assert.equal(m.note.act, "sign-up");
  assert.equal(m.how, null);
});

test("D191 · How I apply: Review before I submit and Open by itself — both on unless switched off, kept in the autoRead record", () => {
  assert.deepEqual(panelModel({ signedIn: true, page, ctx: ctx() }).how, { review: true, reviewLocked: false, autoOpen: true, resume: null });
  // ⭐ 46x (owner 11-19: "unlock apply for me"): Review before I submit IS the account's mode — a stored panel setting never decides it
  assert.deepEqual(panelModel({ signedIn: true, page, ctx: ctx(), settings: { review: false, autoOpen: false } }).how, { review: true, reviewLocked: false, autoOpen: false, resume: null });
  assert.equal(panelModel({ signedIn: true, page, ctx: ctx(), applyMode: { current: "auto", locked: false } }).how.review, false, "Apply for me: off");
  assert.equal(panelModel({ signedIn: true, page, ctx: ctx(), applyMode: { current: "semi", locked: false } }).how.review, true, "Ask me first: on");
  assert.equal(panelModel({ signedIn: true, page, ctx: ctx(), applyMode: { current: "semi", locked: true } }).how.reviewLocked, true, "the operator paused sending");
  assert.equal(panelModel({ signedIn: true, page, ctx: ctx(), profile: { id: 3, name: "Backend engineer", active: true } }).how.resume, "Backend engineer");
  assert.deepEqual(defaultSettings().panel, { review: true, autoOpen: true });
  assert.deepEqual(normaliseSettings({ panel: { review: false, autoOpen: "yes", junk: 1 } }).panel, { review: false, autoOpen: true });
});

test("D191 · sponsorship is said only when draft's record shows it; never a guess", () => {
  assert.equal(sponsorWords({ sponsorship: "Filed 41 certified LCAs in FY2025" }), "sponsors visas");
  assert.equal(sponsorWords({ sponsorship: "No sponsorship on record" }), "");
  assert.equal(sponsorWords({}), "");
  assert.equal(jobOf(null, null), null);
  assert.equal(jobOf(null, { company: { logo: "http://x/logo.png", name: "K" } }).logo, null, "only an https logo");
});

test("D191 · the press draws the panel from the page FIRST, before draft is asked anything", async () => {
  const calls = [];
  const deps = {
    state: async () => ({ exists: false }), collapse: async () => {}, openDock: async () => ({ ok: true }), openBoard: async () => {},
    identity: async () => { calls.push("identity"); return { authenticated: true }; },
    panel: async (_t, o) => { calls.push(o.pending ? "panel:pending" : "panel"); return { ok: true }; },
    context: async () => { calls.push("context"); return { identity: { action: "capture" }, prepared: true, company: { name: "K", sponsorship: "x" } }; },
    relay: async (_t, specs) => { calls.push(`relay:${specs.length}`); },
  };
  await toolbarPress({ id: 7, url: "https://job-boards.greenhouse.io/k/jobs/1" }, deps);
  assert.deepEqual(calls.slice(0, 4), ["identity", "panel:pending", "context", "panel"]);
  assert.ok(!calls.some(c => /^relay:[1-9]/.test(c)), "the panel says it — no toast repeats the job, 'add this job' or 'answers ready'");
});

test("D191 · with the panel drawn, relayFor drops what the panel says and keeps the rest", () => {
  const c = { identity: { action: "capture" }, prepared: true, notice: "You applied here 28 Sep", company: { name: "K", sponsorship: "x" } };
  const ids = (o) => relayFor(o).map(s => `${s.id}:${s.actions?.[0]?.id || ""}`);
  assert.deepEqual(ids({ identity: { authenticated: false }, panel: true }), []);
  const withPanel = ids({ identity: { authenticated: true }, ctx: c, panel: true });
  assert.ok(withPanel.includes("draft-notice:"), "the company notice stays a toast");
  assert.ok(!withPanel.some(x => /^draft-relay:capture|^draft-company/.test(x)));
  const without = ids({ identity: { authenticated: true }, ctx: c });
  assert.ok(without.includes("draft-relay:capture"), "without the panel, the press still asks as before");
});

test("D191 · the dock's home is the panel: `draft` is the first tab and the default; the tab row hides while it is alone", () => {
  const src = readFileSync(new URL("../extension/dock.js", import.meta.url), "utf8");
  assert.match(src, /Object\.freeze\(\{ id: 'draft', label: 'This job', icon: 'home' \}\),\s*\r?\n\s*Object\.freeze\(\{ id: 'fill'/);
  assert.match(src, /p\.tab : 'draft', pops/);
  assert.match(src, /const tabs = kind === 'dock' && \(f\.others \|\| f\.active !== 'draft'\)/);
  const view = readFileSync(new URL("../extension/jobPanel.js", import.meta.url), "utf8");
  assert.doesNotMatch(view, /#[0-9a-f]{3,8}\b|rgba?\(/i, "colours only from the theme tokens");
  assert.doesNotMatch(view, /999px|rounded-full/, "no capsule (D60)");
  assert.equal((view.match(/border-radius:\s*50%/g) || []).length, 1, "only the 7 px status dot is round (a perfect circle)");
  assert.match(view, /if \(!ev\.isTrusted\) return;/, "only the person's own click acts");
  assert.doesNotMatch(view, /requestSubmit|\.submit\(/, "D36: the panel never submits a form");
});

// ── B2 · the panel opens BY ITSELF on the six board families (owner 11-18: "Ask at install") ──────────────────────────
test("D191 B2 · panelArrive.js reads NOTHING from the page and sends only 'a page loaded' — top frame, once per address", () => {
  const src = readFileSync(new URL("../extension/panelArrive.js", import.meta.url), "utf8");
  const code = src.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /querySelector|textContent|innerText|innerHTML|document\.title|getElementsBy|cookie|localStorage|fetch\(/, "it reads nothing");
  assert.match(code, /chrome\.runtime\.sendMessage\(\{ type: 'PANEL_ARRIVE' \}/, "the one message carries no address and no text");
  assert.match(code, /if \(window\.top !== window \|\| globalThis\.__draftPanelArrive\) return;/, "the top frame only, once");
  assert.match(code, /if \(here === last\) return;/, "once per address");
});

test("D191 B2 · the worker draws by itself only on a posting, never an apply step, only with Open by itself on and the kill switch off", () => {
  const bg = readFileSync(new URL("../extension/background.js", import.meta.url), "utf8");
  const fn = bg.slice(at(bg, "async function panelArrive(tab) {"), at(bg, "if (msg?.type !== 'PANEL_ARRIVE') return false;"));
  assert.ok(fn.length > 200, "panelArrive() is there");
  assert.ok(fn.includes(String.raw`!boardOf(url) || /\/apply(?:\/|$)/i.test(new URL(url).pathname)`), "a preset board, never …/apply");
  assert.match(fn, /settings\.kill \|\| settings\.panel\?\.autoOpen === false\) return \{ ok: false, why: 'off' \}/, "the switch and the kill switch");
  assert.match(fn, /hasPostingUrlShape\(url\) \|\| \(boardOf\(url\)\?\.id === 'workday' && !!\(page\?\.title && page\?\.company\)\)/, "a posting, by shape or Workday's JobPosting");
  assert.ok(at(fn, "pending: !!known?.authenticated") < at(fn, "popupContext(tab)"), "d191CollapsedNoApiWait: the page's own frame before draft is asked");
  assert.match(fn, /const expand = !meta\?\.place\?\.collapsed;/, "closed on this site → the /d square, not the panel");
  const handler = bg.slice(at(bg, "if (msg?.type !== 'PANEL_ARRIVE') return false;"));
  assert.match(handler.slice(0, 300), /sender\?\.frameId !== 0 \|\| !sender\?\.tab\?\.id \|\| sender\.id !== chrome\.runtime\.id/, "this extension's top-frame script only");
});

test("D191 B2 · the manifest: the six board families at install, the arrival script on exactly those, never LinkedIn / Indeed / Glassdoor", async () => {
  const m = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  const { D191_HOSTS, D191_CONTENT_SCRIPTS } = await import("../test-support/d191Manifest.mjs");
  assert.deepEqual(m.host_permissions, [...D191_HOSTS]);
  assert.deepEqual(m.content_scripts, D191_CONTENT_SCRIPTS);
  assert.doesNotMatch(JSON.stringify(m.host_permissions), /linkedin|indeed|glassdoor|<all_urls>|https:\/\/\*\/\*"/i);
});

// ── B3 · ONE panel: Chrome's side panel retired; the day and Ask draft live in the panel's other-page view ─────────────
test("D191 B3 · any other page: the day (three counts that open draft), the runner line, and ONE box — no big button", () => {
  const m = panelModel({ signedIn: true, page: null, ctx: null, home: { newMatches: 2, needsYou: 1, drafted: 3, toSend: 0 } });
  assert.equal(m.kind, "other");
  assert.equal(m.button, null);
  assert.equal(m.ask, true);
  assert.deepEqual(m.day.map(d => [d.n, d.label, d.act]), [[2, "new matches", "open-draft"], [1, "need you", "open-needs"], [3, "drafted", "open-needs"]]);
  assert.equal(m.note, null);
  assert.equal(panelModel({ signedIn: true, other: true, page, ctx: ctx() }).kind, "other", "the shortcut / Ask draft… opens it on a posting too");
});

test("D191 B3 · Ask draft in the worker: the site's engine, T2 from the day, a sentence it does not know is a search, no model", async () => {
  const { createPanelAsk, PLACES } = await import("../extension/panelAsk.js");
  const commands = JSON.parse(readFileSync(new URL("../extension/commands-v1.json", import.meta.url), "utf8"));
  const opened = [], fetched = [];
  const a = createPanelAsk({ commands, act: async () => ({ ok: true }), open: (p) => opened.push(p), context: () => null,
    home: async () => ({ needsYou: 2, drafted: 1, sent: 0 }), fetchJson: async (path) => { fetched.push(path); return null; } });
  assert.equal((await a.handle(1, "how many need me?")).text, "2 applications need you.");
  const s = await a.handle(1, "backend jobs in Boston");
  assert.equal(s.intent, "search");
  assert.equal(opened.at(-1), "/app/jobs?search=backend%20jobs%20in%20Boston");
  assert.match((await a.handle(1, "rewrite this bullet to highlight Kafka")).text, /isn't offered in the extension/);
  assert.equal(PLACES.home, "/app/auto-apply");
  assert.ok(!fetched.some(p => /assistant\/ask|messages|anthropic/.test(p)), "no model route");
});

test("D191 B3 · d191OneUiNotTwo — no side panel, no ask window, and a page identify calls no job has no job in the panel", () => {
  const m = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.equal(m.side_panel, undefined);
  assert.ok(!m.permissions.includes("sidePanel"));
  const bg = readFileSync(new URL("../extension/background.js", import.meta.url), "utf8");
  assert.doesNotMatch(bg, /chrome\.sidePanel|openAskWindow|getURL\('ask\.html/);
  assert.match(bg, /const notAJob = \['not_a_job', 'unread'\]\.includes\(c\.identity\?\.outcome\) && !c\.posting\?\.known;/,
    "the import context sends a posting record for EVERY address — a news page must not read as a job (found by the 46w walk)");
  assert.match(bg, /'open-ask': async \(tab\) => openPanelHere\(tab\),/);
});

// ── B4 · How I apply: the résumé (the active job profile) and Review before I submit ─────────────────────────────────
test("D191 B4 · Résumé ▾ lists the job profiles on the person's click and switches with the site's own activate; Review before I submit is the account's mode (46x)", () => {
  const bg = readFileSync(new URL("../extension/background.js", import.meta.url), "utf8");
  assert.match(bg, /const r = await authedFetch\(RESUME_MASTER_URL, '\/api\/domain-profiles'\)\.catch\(\(\) => null\);/, "the profiles: the site's own list");
  assert.match(bg, /authedFetch\(RESUME_MASTER_URL, `\/api\/domain-profiles\/\$\{id\}\/activate`, \{ method: 'POST' \}\)/, "a pick: the site's own switch");
  assert.match(bg, /if \(!\(await panelProfiles\(\)\)\?\.some\(p => p\.id === id\)\) return \{ ok: false, say: 'That profile is not yours\.' \};/, "only one of the person's own profiles");
  // ⭐ 46x: the switch writes the account's mode (the run bar's POST /api/apply/mode), never a local setting; 46w's refusal is gone
  assert.match(bg, /if \(msg\.key === 'review'\) \{\s+setApplyMode\(msg\.value \? 'semi' : 'auto'\)/);
  assert.match(bg, /authedFetch\(RESUME_MASTER_URL, '\/api\/apply\/mode', \{ method: 'POST'/);
  assert.doesNotMatch(bg, /draft does not send one without your review yet/);
  const view = readFileSync(new URL("../extension/jobPanel.js", import.meta.url), "utf8");
  assert.match(view, /send\(\{ type: 'PANEL_PROFILES', trigger: 'click' \}\)/);
  assert.match(view, /set\.setAttribute\('aria-checked', String\(!on\)\);/, "a refused switch goes back");
});
