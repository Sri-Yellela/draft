// ⭐ 47c (owner 11-24: "implement proposed fixes … do d194") · the card's Role when the résumé has no role placed, and D194 P4's
// two embeds: a deck shared in the feed plays inline, and the extension's card carries the lesson for its biggest gain.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import "../extension/atsReport.js";
import { atsCardView } from "../shared/contextualView.js";
import { cardOf } from "../extension/boardJob.js";
import { handlersFor } from "../extension/resumePanel.js";
import { lessonFor, reportOf } from "../routes/extensionJob.js";
import { approvedDecks } from "../services/learn/learnDecks.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const report = { score: 52, tier1_matched: ["sql"], tier1_missing: ["kafka"] };
const unplaced = { score: 50, parts: {
  skill_match: { score: 52, status: "ok" },
  role_fit: { score: null, status: "no_data", reason: "resume_not_placed" },
  responsibility_overlap: { score: 40, status: "ok", phrases: 5, matched: ["a", "b"], missing: ["c"] },
  tech_stack: { score: null, status: "no_data" } }, dissimilarities: [] };

test("atsCard47c: a résumé with no role placed keeps Role on the card — no number, the one step that gives it one", () => {
  const v = atsCardView({ report, contextual: unplaced });
  const role = v.parts.find(p => p.id === "role_fit");
  assert.ok(role, "Role stays");
  assert.equal(role.score, null);
  assert.equal(role.pending, true);
  assert.equal(role.line, "Pick your role in Your profile to compare");
  assert.equal(v.score, 50, "the score is the block's own — the pending part never counts");
  // a posting not placed is not the person's step: nothing is said
  const p2 = atsCardView({ report, contextual: { ...unplaced, parts: { ...unplaced.parts, role_fit: { score: null, status: "no_data", reason: "posting_not_placed" } } } });
  assert.ok(!p2.parts.some(p => p.id === "role_fit"));
});

test("atsCard47c: the web card draws it with no bar and a dash, its line always shown; the extension keeps and draws it the same", () => {
  const web = read("client/src/components/AtsCard.jsx");
  assert.match(web, /\{p\.score != null && <div style=\{\{ height: 6, width: `\$\{p\.score\}%`/);
  assert.match(web, /\{\(detail \|\| p\.pending\) && p\.line && <div data-ats-card-line=\{p\.id\}/);
  assert.match(web, /\{p\.score \?\? "—"\}/);
  const c = cardOf({ report, contextual: unplaced });
  const role = c.parts.find(p => p.id === "role_fit");
  assert.ok(role && role.pending === true && role.score === null);
  const panel = read("extension/resumePanel.js");
  assert.match(panel, /\$\{p\.pending \? ' data-pending=""' : ' data-detail-line=""'\}/, "the pending line shows in the short view too");
  assert.match(panel, /\$\{p\.score == null \? '—' : esc\(p\.score\)\}/);
});

test("d194P4Extension47c: the lesson is the approved deck teaching the biggest gain — the stack gap first, else the first missing skill", () => {
  const kafka = approvedDecks().find(d => (d.skills || []).includes("kafka"));
  assert.ok(kafka, "an approved Kafka deck exists");
  const l = lessonFor({ contextual: { dissimilarities: [{ kind: "stack_gap", tech: "Kafka" }] }, report: { tier1_missing: ["sql"] } });
  assert.equal(l.id, kafka.id);
  assert.equal(l.points.length, 3);
  assert.equal(lessonFor({ report: { tier1_missing: ["kafka"] } }).id, kafka.id);
  assert.equal(lessonFor({ report: { tier1_missing: ["no-such-skill"] } }), null);
  assert.equal(lessonFor(null), null);
  assert.deepEqual(reportOf({ score: 1, report: { tier1_missing: ["kafka"] } }).lesson.id, kafka.id);
  // the extension keeps only a deck id's shape and three points
  const c = cardOf({ report, contextual: unplaced, lesson: { id: kafka.id, title: kafka.title, points: ["a", "b", "c", "d"], extra: 1 } });
  assert.deepEqual(c.lesson, { id: kafka.id, title: kafka.title, points: ["a", "b", "c"] });
  assert.equal(cardOf({ report, contextual: unplaced, lesson: { id: "../../x", points: ["a"] } }).lesson, null);
});

test("d194P4Extension47c: the panel plays the three points (CSS only, instant under reduced motion) and opens the lesson only from the press", async () => {
  const panel = read("extension/resumePanel.js");
  assert.match(panel, /data-role="ats-card-lesson" data-deck="\$\{esc\(ac\.lesson\.id\)\}" data-detail-line=""/, "in the expanded view");
  assert.match(panel, /@media \(prefers-reduced-motion: reduce\) \{ \.ac \.ls \.lp \{ animation: none; opacity: 1; \} \}/);
  assert.ok(!/speechSynthesis/.test(panel), "never sound");
  const h = handlersFor("https://draft.test");
  const sender = { tab: { id: 7, url: "https://jobs.example.org/x" } };
  assert.equal((await h.RESUME_OPEN_LESSON({ deck: "da-b-06" }, sender)).ok, false, "not without the press");
  assert.equal((await h.RESUME_OPEN_LESSON({ trigger: "click", deck: "javascript:alert(1)" }, sender)).ok, false);
  const opened = [];
  globalThis.chrome = { tabs: { create: async (o) => { opened.push(o.url); return {}; } } };
  try {
    assert.equal((await h.RESUME_OPEN_LESSON({ trigger: "click", deck: "da-b-06" }, sender)).ok, true);
    assert.deepEqual(opened, ["https://draft.test/app/atlas/library/da-b-06"]);
  } finally { delete globalThis.chrome; }
});

test("d194P4Feed47c: a post whose link is a Library deck plays it inline — Read first, the check left in the Library", async () => {
  const src = read("client/src/pages/network/FeedDeck.jsx");
  const m = src.match(/export function deckIdFromLink\(link\) \{\n([\s\S]*?)\n\}/);
  assert.ok(m, "deckIdFromLink");
  const deckIdFromLink = new Function("link", m[1]);
  assert.equal(deckIdFromLink("https://jobsviadraft.com/atlas/library/da-b-06"), "da-b-06");
  assert.equal(deckIdFromLink("/app/atlas/library/ml-ai-08?x=1"), "ml-ai-08");
  assert.equal(deckIdFromLink("/atlas/library/silicon-to-software"), null, "a course, not a deck");
  assert.equal(deckIdFromLink("https://example.org/"), null);
  assert.match(src, /const \[mode, setMode\] = useState\("read"\);/, "starts in Read — captions, no sound");
  assert.match(src, /<DeckPlay deck=\{deck\}/);
  assert.match(read("client/src/pages/network/FeedPane.jsx"), /\{deckIdFromLink\(post\.link\) && <FeedDeck id=\{deckIdFromLink\(post\.link\)\} \/>\}/);
});
