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
import { questions, servedQuestion, importQuestions } from "./learnQuestions.js";
import { resolveTerms } from "../atlas/atlasStore.js";

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
  if (!plan) return { pathways: [], written: 0, drafted: 0, planned: 0 };
  const live = new Set(approvedDecks(dir).map(d => d.id));
  let written = 0, drafted = 0, planned = 0;
  // ⭐ D154 P8 (45n) · each stage's BUILDS (content/decks/builds-v1.json) — served only when approved; a drafted one is counted.
  const builds = safe(() => JSON.parse(fs.readFileSync(path.join(dir, "builds-v1.json"), "utf8")).builds, []) || [];
  const buildsDrafted = builds.filter(b => b.status !== "approved").length;
  const buildsFor = (p, s) => builds.filter(b => b.status === "approved" && b.pathway === p && b.stage === s)
    .map(b => ({ id: b.id, title: b.title, brief: b.brief, steps: b.steps || [], show: b.show, skills: b.skills || [],
      decks: (b.decks || []).filter(d => live.has(d)) }));
  // A topic whose deck is drafted (in a decks file, not yet approved) says so — never linked, never served as a lesson.
  const pathways = (plan.pathways || []).map(p => ({ id: p.id, title: p.title, later: !!p.later, stages: p.stages.map(s => ({ id: s.id, title: s.title,
    builds: buildsFor(p.id, s.id),
    topics: s.topics.map(t => {
      const deck = t.deck && live.has(t.deck) ? t.deck : null;
      const isDraft = !deck && !!t.deck && t.status === "draft";
      if (deck) written++; else if (isDraft) drafted++; else planned++;
      return isDraft ? { title: t.title, deck: null, drafted: true } : { title: t.title, deck };
    }) })) }));
  return { pathways, written, drafted, planned, buildsDrafted };
}

export function guides({ dir } = {}) {
  // ⭐ D155 (11-08): the ladder is the SOFTWARE career ladder (decks-v1's levels) — with every pathway approved, a stage
  // alone would mix software, data and mechanical Foundations in one guide. Other pathways are reached through the plan.
  const decks = approvedDecks(dir).filter(d => (d.pathway || "software") === "software");
  return LADDER.map(l => {
    const own = decks.filter(d => d.stage === l.stage);
    return { ...l, written: own.length > 0, lessons: own.map(d => ({ id: d.id, title: d.title, skills: d.skills || [], slides: (d.slides || []).length })) };
  });
}

/**
 * ⭐ A154 (45o, the D172 sketch's "How it works — each idea drawn as one picture: a coloured card per concept with an icon
 * tile and its flow"). Each APPROVED deck's flow is read from its own "Core ideas" slide title, which names its parts in
 * order ("Stack, heap, process, thread"; "Producer, topic, consumer group, offsets") — nothing is written for it. A deck
 * whose title doesn't split into 2–6 parts is left out (no flow invented). Same order as the plan (pathway, then file).
 */
export function flowOf(deck) {
  const core = (deck?.slides || []).find(s => /core ideas/i.test(String(s.tag || "")));
  const t = String(core?.title || "").trim();
  if (!t) return null;
  const parts = t.split(/\s*(?:→|->|,|;|\band\b|\bthen\b)\s*/i).map(x => x.trim()).filter(Boolean);
  return parts.length >= 2 && parts.length <= 6 && parts.every(p => p.length <= 40) ? parts : null;
}
export function howItWorks({ dir } = {}) {
  return approvedDecks(dir).map(d => ({ id: d.id, title: d.title, pathway: d.pathway || "software", stage: d.stage || null, flow: flowOf(d) }))
    .filter(d => d.flow);
}

/** One deck with its slides; its check is the bank question, served only when live. */
export function deckOf(db, id, { dir } = {}) {
  const d = approvedDecks(dir).find(x => x.id === id);
  if (!d) return null;
  const live = db ? safe(() => questions(db, { ids: d.questions || [] }), []).filter(q => Array.isArray(q.choices)) : [];
  const level = (d.pathway || "software") === "software" ? (LADDER.find(l => l.stage === d.stage) || null) : null;
  // ⭐ D195 (47a): a deck written under the content rule keeps its layers, its named real case and its Try step — layer 3
  // is what the learner sees last, so dropping them here would leave the rule's deck without its real world.
  const httpsLink = (o) => (o && /^https:\/\//.test(String(o.url || "")) ? o : null);
  return { id: d.id, title: d.title, skills: d.skills || [], guide: level ? { id: level.id, name: level.name, level: level.level } : null,
    slides: (d.slides || []).map(s => ({ tag: s.tag, title: s.title, points: s.points || [], ...(s.layer ? { layer: s.layer } : {}) })),
    realWorld: httpsLink(d.realWorld) ? { name: String(d.realWorld.name), url: d.realWorld.url } : null,
    try: httpsLink(d.try) ? { label: String(d.try.label || d.try.source), url: d.try.url, source: d.try.source || null } : null,
    market: db ? marketOf(db, d.skills || []) : [],
    check: live.length ? { question: servedQuestion(live[0]) } : { waiting: (d.questions || []).length > 0 } };
}

/**
 * ⭐ D195 (3) (47a) · "and here's where you'll see this" from the board: each of the deck's skills that has a PUBLISHED
 * Atlas page, with the live "asked for in N open postings" (atlas_node_stats — moved per posting by atlasLive.js, never
 * recounted here). One indexed read per skill (a deck names ≤ 6) — no board scan on the request path (D151). A skill
 * with no page or no postings is left out; nothing is invented.
 */
export function marketOf(db, skills) {
  try {
    const slugs = resolveTerms(db, (skills || []).slice(0, 6));
    const stat = db.prepare(`SELECT n.name, s.postings FROM atlas_nodes n JOIN atlas_node_stats s ON s.node_id = n.id WHERE n.slug = ?`);
    const seen = new Set();
    return Object.entries(slugs).flatMap(([skill, slug]) => {
      if (seen.has(slug)) return [];
      seen.add(slug);
      const r = stat.get(slug);
      return r && r.postings > 0 ? [{ skill, name: r.name, slug, postings: r.postings }] : [];
    }).sort((a, b) => b.postings - a.postings);
  } catch { return []; }   // a database without the Atlas tables: the deck still opens
}

/**
 * ⭐ D155 (11-08) · A DECK BATCH'S CHECK QUESTIONS INTO THE BANK — every decks-vN.json's `newQuestions`, through the bank's
 * own importer (validated, idempotent; new items arrive as drafts). For a batch the owner approved
 * (content/decks/approvals.json) each question still UNTOUCHED since its first import (version 1, never reviewed) goes live,
 * reviewed by the owner on the approval's date — the questions were in the batch's review copy with every answer and its
 * why. An edited or re-imported question (version > 1) or one already reviewed is never flipped: it stays on the desk.
 */
export function importDeckQuestions(db, { dir = DECKS_DIR, now = Math.floor(Date.now() / 1000) } = {}) {
  const approvals = safe(() => JSON.parse(fs.readFileSync(path.join(dir, "approvals.json"), "utf8")).approved || {}, {});
  const files = safe(() => fs.readdirSync(dir).filter(f => /^decks-v\d+\.json$/.test(f)).sort(), []);
  const out = [];
  for (const f of files) {
    const b = safe(() => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), null);
    const items = (b?.newQuestions || []).map(({ status, ...q }) => q);
    if (!items.length) continue;
    try {
      const r = importQuestions(db, { version: b.version, note: `content/decks/${f}`, items }, { apply: true, from: `content/decks/${f}`, now });
      let live = 0;
      const ok = approvals[String(b.version)];
      if (ok && !r.refused.length) {
        const at = Math.floor(Date.parse(`${ok.at}T12:00:00Z`) / 1000) || now;
        const flip = db.prepare(`UPDATE learn_questions SET status = 'live', reviewed_by = ?, reviewed_at = ?, updated_at = ?
          WHERE id = ? AND status = 'draft' AND reviewed_at IS NULL AND version = 1`);
        db.transaction(() => { for (const q of items) live += flip.run(`${ok.by} (decks-v${b.version} review)`, at, now, q.id).changes; })();
      }
      out.push({ file: f, ...r, live });
    } catch (e) { out.push({ file: f, error: e.message }); }
  }
  return out;
}

/** Tests: forget the cached files. */
export const _resetDecks = () => { cache = null; };
