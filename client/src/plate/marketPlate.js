// ⭐ D196 P1 · THE MARKET IN PLATES — the switch. P1 is gated on the owner's look at the side-by-sides (D196's phases), so
// the plate market is OFF by default and nothing on the live market changes until the owner says "ok". A viewer turns it
// on for themselves with `?plate=1` (remembered in this browser) and off with `?plate=0`. When the owner approves, the
// default flips here — one line — and the old face is retired in the same change.
// localStorage can be missing or throw (private windows, blocked storage): every read and write is guarded, and a failure
// reads as "off".
import { useSyncExternalStore } from "react";

export const MARKET_PLATE_KEY = "draft.plate.market";
// ⭐ 47f (owner 11-24, after the P1 FIX: "looked and approved") — ON for everyone; `?plate=0` still turns it off for one browser
// until the classic market is retired (after the browser tier and the first signed-in walk — the 47g order).
export const MARKET_PLATE_DEFAULT = true;
const listeners = new Set();

function readParam(search) {
  try {
    const v = new URLSearchParams(search || "").get("plate");
    return v === "1" ? true : v === "0" ? false : null;
  } catch { return null; }
}

/** Pure: is the plate market on, given the address's query string and the stored value ("1" / "0" / null)? */
export function marketPlateOn(search, stored) {
  const p = readParam(search);
  if (p != null) return p;
  if (stored === "1") return true;
  if (stored === "0") return false;
  return MARKET_PLATE_DEFAULT;
}

function stored() {
  try { return globalThis.localStorage?.getItem(MARKET_PLATE_KEY) ?? null; } catch { return null; }
}

/** Read the switch now; an address with ?plate=1 / ?plate=0 also remembers the choice. */
export function isMarketPlate() {
  const search = globalThis.location?.search || "";
  const p = readParam(search);
  if (p != null) { try { globalThis.localStorage?.setItem(MARKET_PLATE_KEY, p ? "1" : "0"); } catch { /* not remembered */ } }
  return marketPlateOn(search, stored());
}

export function setMarketPlate(on) {
  try { globalThis.localStorage?.setItem(MARKET_PLATE_KEY, on ? "1" : "0"); } catch { /* not remembered */ }
  listeners.forEach((f) => f());
}

const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };

/** The hook every P1 piece reads, so the face, the bearing and the page switch together. */
export function useMarketPlate() {
  return useSyncExternalStore(subscribe, isMarketPlate, () => MARKET_PLATE_DEFAULT);
}

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
