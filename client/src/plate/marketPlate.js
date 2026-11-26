// ⛔ 47j R3 (w1-retire): THE SWITCH IS RETIRED. D196 P1's `?plate=1` / `?plate=0` switch (`useMarketPlate`,
// `MARKET_PLATE_DEFAULT`, the remembered `draft.plate.market` value) governed the market until R2 and Home (the ledger) and the
// company page (the survey sheet) until R3; both are always plates now and their classic faces are deleted. A `?plate=` left
// in an address is read by nothing. What stays here: the sector palette and the deck's published front / best card.
import { useSyncExternalStore } from "react";

// ⭐ Sector → region palette (D196: "Software engineering → IV navy · Data and AI → VIII · Project management → VII ·
// Business and finance → V · Design → VI — clay is never a sector colour"). Unknown or missing → IV (R2: a sector with no
// ramp falls back to IV's).
const SECTOR_REGION = [
  [/software|engineering|developer|devops|infrastructure/i, "IV"],
  [/data|machine learning|\bai\b|analytics/i, "VIII"],
  [/project|program|product management/i, "VII"],
  [/business|finance|accounting|sales|operations/i, "V"],
  [/design|ux|ui\b/i, "VI"],
];
export function sectorRegion(name) {
  if (!name) return "IV";
  for (const [re, r] of SECTOR_REGION) if (re.test(String(name))) return r;
  return "IV";
}

// ⭐ D196 P1 · THE FRONT CARD, for the field card beside the deck. DeckView owns the deck; when the plate market is on it
// publishes the card on top here (only its job id, the card's frozen `why` and `report`) and the field card reads it.
// One value, no history; null when the deck is empty or finished.
let front = null;
const frontListeners = new Set();
export function publishFrontCard(card) {
  const next = card?.job?.id ? { jobId: card.job.id, company: card.job.company || null, why: card.why || null, report: card.report || null } : null;
  if ((front?.jobId ?? null) === (next?.jobId ?? null)) return;
  front = next;
  frontListeners.forEach((f) => f());
}
export function useFrontCard() {
  return useSyncExternalStore((f) => { frontListeners.add(f); return () => frontListeners.delete(f); }, () => front, () => front);   // the same value on a static render (the gallery, the tests)
}

// ⭐ 47h (47f's gap 4 (d)) · THE BEST MATCH, for the hero's pin and route. Of today's undecided cards, the one best bets ranks
// highest (its `bestBet.score`, the deck's own "best match first" reading; the ATS score breaks a tie or stands in when no
// card has one). Published by DeckView like the front card; null when nothing is left — the hero then draws no pin (R2).
/** Pure: the best undecided card of a deck → { jobId, match: "91%" | null, company, title } | null. */
export function bestOfDeck(cards = []) {
  const open = cards.filter((c) => c?.job?.id && !c.decision);
  if (!open.length) return null;
  const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : -1);
  const top = open.reduce((a, c) => (num(c.bestBet?.score) > num(a.bestBet?.score) || (num(c.bestBet?.score) === num(a.bestBet?.score) && num(c.score) > num(a.score)) ? c : a));
  const pct = top.score != null && Number.isFinite(Number(top.score)) ? Math.max(0, Math.min(100, Math.round(Number(top.score)))) : null;   // the ticket's own figure (deckCardFacts)
  return { jobId: top.job.id, match: pct == null ? null : `${pct}%`, company: top.job.company || null, title: top.job.title || null };
}
let best = null;
const bestListeners = new Set();
export function publishBestCard(next) {
  if ((best?.jobId ?? null) === (next?.jobId ?? null) && (best?.match ?? null) === (next?.match ?? null)) return;
  best = next || null;
  bestListeners.forEach((f) => f());
}
export function useBestCard() {
  return useSyncExternalStore((f) => { bestListeners.add(f); return () => bestListeners.delete(f); }, () => best, () => best);
}

// ⭐ D199 C3 (owner 11-25: "let it replace") · ON THE PLATE MARKET THE DECK PAGES THROUGH THE BOARD'S LIST — the page the
// board holds (JobsPanel publishes it, JobBoardContext.boardPager) dealt as cards, in the board's own order, instead of the
// daily deal. A card is the board's job as the deal stores it (services/dailyDraft.js deckSnapshot: the $Job shape), its
// score the board's stored ATS score (the ticket's figure).
/** Pure: the board's page → the deck's cards. */
export function boardPageCards(jobs = []) {
  const seen = new Set();
  const out = [];
  for (const j of jobs || []) {
    const id = j?.id ?? j?.jobId;
    if (id == null || seen.has(String(id))) continue;
    seen.add(String(id));
    const score = Number.isFinite(Number(j.baseAtsScore ?? j.matchScore)) && (j.baseAtsScore ?? j.matchScore) != null ? Number(j.baseAtsScore ?? j.matchScore) : null;
    out.push({ job: { ...j, id }, score, band: null });
  }
  return out;
}
/** Pure: a fresh page's deck state keeps the decisions already made on its cards and stays on the card you were on. */
export function carryDeck(next, prev) {
  if (!prev?.cards?.length) return next;
  const decided = new Map(prev.cards.filter((c) => c.decision).map((c) => [String(c.job.id), c]));
  const cards = next.cards.map((c) => { const d = decided.get(String(c.job.id)); return d ? { ...c, decision: d.decision, runId: d.runId } : c; });
  const onId = prev.cards[prev.index]?.job?.id;
  const at = cards.findIndex((c) => String(c.job.id) === String(onId) && !c.decision);
  const first = cards.findIndex((c) => !c.decision);
  return { ...next, cards, index: at >= 0 ? at : first >= 0 ? first : cards.length };
}
/** Pure: the plate deck's position line — "25 OF 11,247 · PAGE 2" (the place in the whole list, not in the page). */
export function deckPagePosition({ index = 0, page = 1, pageSize = 50, total = null } = {}) {
  const at = (Math.max(1, page) - 1) * pageSize + index + 1;
  const f = (n) => Number(n).toLocaleString("en-US");
  return `${f(at)} OF ${Number.isFinite(total) ? f(total) : "—"} · PAGE ${f(Math.max(1, page))}`;
}
