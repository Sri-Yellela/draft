// ⭐ D148 (owner 11-03, docs/sketches/settings-declutter.html) — AUTO-APPLY SETTINGS, RESTYLED AND DECLUTTERED.
// The same drawer (the tracker's Settings), the same settings and saves: the mode first as two choices; folds, each ONE
// line with its current value, one open at a time, in D145's type; the internal limits behind Details.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const drawer = read("client/src/components/AutoSettingsDrawer.jsx");
const panel = read("client/src/panels/AutoApplyPanel.jsx");
const css = read("client/src/components/DraftHouse.css");
const fold = (id) => {
  const from = at(drawer, `<Fold id="${id}"`);
  const next = drawer.indexOf("<Fold id=", from + 5);
  return drawer.slice(from, next > from ? next : undefined);
};

const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
let mod;
async function load() {
  if (mod) return mod;
  const esbuild = requireClient("esbuild");
  const abs = JSON.stringify(path.join(CLIENT, "src", "components", "AutoSettingsDrawer.jsx").split(path.sep).join("/"));
  const r = await esbuild.build({
    stdin: { contents: `export { foldValues, zoneWords } from ${abs};`, resolveDir: CLIENT, loader: "jsx" },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d148-"));
  const f = path.join(dir, "m.mjs");
  fs.writeFileSync(f, r.outputFiles[0].text);
  try { mod = await import(pathToFileURL(f).href); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return mod;
}

const S = { dailyCap: 10, runTimes: ["09:00", "18:00"], timeZone: "America/New_York", pauseCompanyAfterReply: true, filters: {},
  profileId: null, agreeToTerms: false, staleReposts: 3, staleOpenDays: 90, showFormBeforeSending: true, onlySponsorRecord: true,
  perCompanyLimit30d: null };

test("d148ModeTwoChoices · the mode first, as two choices — the header switch's own handlers and lock", () => {
  const m = drawer.slice(at(drawer, '<div className="dh-mode2" role="group" aria-label="Mode"'), at(drawer, '<Fold id="when"'));
  assert.match(m, /<b>Ask me first<\/b><span>nothing is sent until you approve<\/span>/);
  assert.match(m, /<b>Apply for me<\/b><span>\{mode\.selectable \? "good matches are sent on their own" : `locked: \$\{mode\.reason\}`\}<\/span>/);
  assert.match(m, /aria-pressed=\{!mode\.fullAuto\}/);
  assert.match(m, /disabled=\{modeBusy \|\| !mode\.selectable \|\| !onAuto\}/, "locked stays locked");
  assert.ok(at(drawer, 'data-settings-mode=""') < at(drawer, '<Fold id="when"'), "the mode comes first");
  assert.match(panel, /mode=\{\{ fullAuto, selectable: mode\.selectable, reason: mode\.reason \}\} onAsk=\{runBar \? chooseAsk : null\}/);
  assert.match(panel, /onAuto=\{mode\.selectable \? \(\) => setApplyMode\?\.\("auto"\) : null\}/);
  // D149 (11-03) changed this on purpose: the sketch draws the current choice with an OUTLINE (1.5px, the accent), not a
  // border — the mode buttons have no border at all (test/fidelitySettings.test.js measures it).
  assert.match(css, /\.dh-mode2 button\[aria-pressed="true"\] \{ outline: 1\.5px solid var\(--c-accent\); \}/, "the current one outlined in the accent");
  assert.match(drawer, /<h2 id="dh-settings-title">Auto-apply<\/h2>/);
});

test("d148GroupsFoldToOneLineWithValue · each fold is ONE line with its current value", async () => {
  const { foldValues, zoneWords } = await load();
  assert.equal(zoneWords("America/New_York"), "New York time");
  const v = foldValues(S, { notify: { events: [{ key: "picks", email: true, push: true }] }, accounts: 2 });
  assert.equal(v.when, "9 AM and 6 PM, New York time");
  assert.equal(v.howmany, "up to 10 a day");
  assert.equal(v.jobs, "sponsors only · skips stale posts");
  assert.equal(v.before, "show me the form");
  assert.equal(v.tell, "by email and notification");
  assert.equal(v.pausing, "pause after an interview");
  assert.equal(v.accounts, "2 connected");
  assert.equal(foldValues({ ...S, staleReposts: null, staleOpenDays: null, onlySponsorRecord: false }).jobs, "every match");
  assert.equal(foldValues(S, { held: true }).pausing, "paused now · pause after an interview");
  assert.equal(foldValues(S, { notify: { events: [{ key: "picks", email: false, push: false }] } }).tell, "off");
  // The line: the title, then the value; the open body hides it and shows the eyebrow + headline + Done.
  assert.match(drawer, /<b>\{title\}<\/b><span data-fold-value="">\{value\}<\/span>/);
  // 45n D182 (bb297b05): the open body's eyebrow (the title again) was removed — the headline leads it (pin moved on purpose).
  assert.doesNotMatch(drawer, /dh-fold2__eyebrow/);
  assert.match(drawer, /<div className="dh-fold2__body" id=\{`dh-fb-\$\{id\}`\}>\s*<h3 className="dh-fold2__h">\{headline\}<\/h3>/);
  assert.match(css, /\.dh-fold2\[data-open="true"\] \.dh-fold2__top \{ display: none; \}/);
});

test("d148OneGroupOpenAtATime · pressing a fold opens only it; Done folds it back", () => {
  assert.match(drawer, /const fp = \(id\) => \(\{ open: fold === id, onOpen: \(\) => setFold\(f => \(f === id \? null : id\)\), onDone: \(\) => setFold\(null\) \}\);/);
  assert.match(drawer, /\{open && \(\s*<div className="dh-fold2__body"/);
  assert.match(drawer, /setMsg\(""\); setSaved\(""\); setFold\(group \|\| null\);/, "a deep link (openSettings('jobs')) opens its fold");
  assert.match(panel, /openSettings\("jobs", e\?\.currentTarget\)/);
});

test("d148EverySettingPresent · every setting has its fold (the row's map)", () => {
  const map = {
    when: ["s.runTimes.map", 'aria-label="A run time to add"', "Add a time", "s.timeZone"],
    howmany: ["dailyCap: Math.max(CAP_MIN, s.dailyCap - 1)", "dailyCap: Math.min(CAP_MAX, s.dailyCap + 1)", "Anything over waits for tomorrow"],
    jobs: ["onlySponsorRecord: !s.onlySponsorRecord", "staleReposts: 3, staleOpenDays: 90", "set({ filters: board })", "perCompanyLimit30d", "profileId", "Never sent automatically"],
    before: ["showFormBeforeSending: !s.showFormBeforeSending", "agreeToTerms: !s.agreeToTerms"],
    tell: ['setPick("email"', 'setPick("push"'],
    pausing: ["pauseCompanyAfterReply: !s.pauseCompanyAfterReply", "Pause everything now"],
    accounts: ["<Accounts onState={setAcct} />"],
    view: ['data-list-view="table"', 'data-list-view="sheet"'],
  };
  for (const [id, needles] of Object.entries(map)) for (const n of needles) assert.ok(fold(id).includes(n), `${id}: ${n}`);
  // "Tell me" writes the SAME preference Account → Notifications writes.
  assert.match(drawer, /api\("\/api\/notify\/prefs", \{ method: "PUT", body: JSON\.stringify\(\{ event: "picks", channel, on \}\) \}\)/);
  // Accounts: a fold only when there is anything in it.
  assert.match(drawer, /\{acct\?\.anything && \(\s*<Fold id="accounts"/);
  assert.match(drawer, /anything: live\.length \+ accounts\.length > 0 \|\| !!d\.worker \|\| !!g\?\.available/);
});

test("d148LimitsBehindDetails · the internal limits are one quiet line; the full limits behind Details", () => {
  const d = drawer.slice(at(drawer, '<details className="dh-limits" data-caps-used="">'), at(drawer, "</details>"));
  // D149 (11-03) changed this on purpose: the sketch's line is "Today: 4 sent of 10." with Details under it (its p.detail).
  assert.match(d, /<summary>\{sent \? `Today: \$\{sent\.used\} sent of \$\{Math\.min\(sent\.limit, s\.dailyCap\)\}\.` : "Today's limits\."\} <span className="dh-limits__more">Details<\/span><\/summary>/);
  assert.match(d, /caps\.map\(c => `\$\{c\.label\} \$\{capUsage\(c\) \?\? "—"\}`\)/);
  assert.ok(at(drawer, '<Fold id="view"') < at(drawer, '<details className="dh-limits"'), "after the folds, not on the first lines");
  assert.match(drawer, /const sent = caps\.find\(c => c\.id === "submission"\);/);
});

test("d148PauseNowExplains · Pause everything now says what it does and does not do", () => {
  const p = fold("pausing");
  assert.match(p, /onClick=\{\(\) => onPauseNow\(!held\)\}>\{held \? "Resume" : "Pause everything now"\}<\/button>/);
  assert.match(p, /data-stop-says="" title="Stop everything" items=\{STOP_ITEMS\} \/>/);   // A233 (46v): a ✓ / ✕ checklist, every clause kept (STOP_ITEMS) — changed on purpose
  assert.match(panel, /held=\{held\} onPauseNow=\{setStopEverything\}/, "the timeline's own Pause handler");
});

test("d148SettingsBehaviourUnchanged · the same load, the same whole-object save, the same refusal handling", () => {
  assert.match(drawer, /api\("\/api\/apply\/auto-settings"\)\.then\(r => \{ if \(live\) \{ lastSaved\.current = r\.settings; setS\(r\.settings\); \} \}\)/);
  assert.match(drawer, /api\("\/api\/apply\/auto-settings", \{ method: "PUT", body: JSON\.stringify\(\{ settings: next \}\) \}\)/);
  assert.match(drawer, /if \(lastSaved\.current\) setS\(lastSaved\.current\);/);
  assert.match(drawer, /timer\.current = setTimeout\(flush, SAVE_AFTER_MS\);/);
  assert.match(drawer, /const close = async \(\) => \{ await flush\(\); onClose\?\.\(\); \};/);
  assert.match(drawer, /const CAP_MAX = 150, MAX_TIMES = 4, CAP_MIN = 1;/, "the same bounds the server validates");
});
