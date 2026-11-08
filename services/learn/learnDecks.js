// services/learn/learnDecks.js — ⭐ D172 (2b) (atlas-redesign-sketch.html → Library → the level ladder of guides) · THE GUIDES.
// The approved decks (content/decks/*.json — decks-v1 approved by the owner 11-07: eight five-slide software Foundations
// decks) ARE the Level 1 guide, "Foundations": the sketch's own list (How a program runs · Data and algorithms · Git and
// testing · The web, end to end) is their titles. A guide is a level; its lessons are decks; a deck is its slides, and
// its last slide is the check — the bank question the deck names, served ONLY when that question is live in the bank
// (learn_questions, reviewed on the desk); until then the check says it is waiting for review. Nothing invented: a level
// with no approved decks is "not written yet", never a clickable "Soon".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { questions, servedQuestion } from "./learnQuestions.js";

export const DECKS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content/decks");
/** The ladder (the Library's levels — the same names as Your run's levels, services/atlas/points.js LEVELS). */
export const LADDER = Object.freeze([
  { level: 1, id: "foundations", name: "Foundations", stage: "foundations" },
  { level: 2, id: "building-blocks", name: "Building blocks", stage: "building-blocks" },
  { level: 3, id: "grow-past-senior", name: "Grow past senior", stage: "grow-past-senior" },
  { level: 4, id: "lead", name: "Lead", stage: "lead" },
]);
const safe = (fn, d) => { try { return fn(); } catch { return d; } };

let cache = null;
/** Every APPROVED deck in content/decks/*.json (a file's decks count once the owner approved them: status "approved"). */
export function approvedDecks(dir = DECKS_DIR) {
  if (cache && cache.dir === dir) return cache.decks;
  const files = safe(() => fs.readdirSync(dir).filter(f => /^decks-v\d+\.json$/.test(f)).sort(), []);
  const decks = files.flatMap(f => safe(() => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).decks || [], []))
    .filter(d => d.status === "approved");
  cache = { dir, decks };
  return decks;
}

/** The ladder: each level with its decks (titles only) — or none, "not written yet". */
/**
 * ⭐ D155 Part C · THE WHOLE PLAN — every approved pathway (software, data, ML and AI, cloud, security, embedded, QA,
 * management; the fields beyond computing marked "later"), its stages and their topics, from content/decks/pathways-v1.json
 * (generated from PLAYBOOK.md Part C — scripts/pathwaysFromPlaybook.mjs). A topic links to its deck only when that deck
 * is APPROVED and served; every other topic reads as planned. Nothing invented: the topics are the approved list.
 */
export function pathwaysPlan({ dir = DECKS_DIR } = {}) {
  const plan = safe(() => JSON.parse(fs.readFileSync(path.join(dir, "pathways-v1.json"), "utf8")), null);
  if (!plan) return { pathways: [], written: 0, planned: 0 };
  const live = new Set(approvedDecks(dir).map(d => d.id));
  let written = 0, planned = 0;
  const pathways = (plan.pathways || []).map(p => ({ id: p.id, title: p.title, later: !!p.later, stages: p.stages.map(s => ({ id: s.id, title: s.title,
    topics: s.topics.map(t => { const deck = t.deck && live.has(t.deck) ? t.deck : null; if (deck) written++; else planned++; return { title: t.title, deck }; }) })) }));
  return { pathways, written, planned };
}

export function guides({ dir } = {}) {
  const decks = approvedDecks(dir);
  return LADDER.map(l => {
    const own = decks.filter(d => d.stage === l.stage);
    return { ...l, written: own.length > 0, lessons: own.map(d => ({ id: d.id, title: d.title, skills: d.skills || [], slides: (d.slides || []).length })) };
  });
}

/** One deck with its slides; its check is the bank question, served only when live. */
export function deckOf(db, id, { dir } = {}) {
  const d = approvedDecks(dir).find(x => x.id === id);
  if (!d) return null;
  const live = db ? safe(() => questions(db, { ids: d.questions || [] }), []) : [];
  const level = LADDER.find(l => l.stage === d.stage) || null;
  return { id: d.id, title: d.title, skills: d.skills || [], guide: level ? { id: level.id, name: level.name, level: level.level } : null,
    slides: (d.slides || []).map(s => ({ tag: s.tag, title: s.title, points: s.points || [] })),
    check: live.length ? { question: servedQuestion(live[0]) } : { waiting: (d.questions || []).length > 0 } };
}

/** Tests: forget the cached files. */
export const _resetDecks = () => { cache = null; };
