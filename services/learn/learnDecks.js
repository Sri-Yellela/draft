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
