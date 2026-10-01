// The deck's geometry preference (queue 38), persisted PER USER — with the account, as the theme is
// (GET/PUT /api/settings/deck-geometry, migration 114) — and cached on the device so the first paint
// does not draw the standard fan and then jump. The account's value wins once it arrives.
//
// ⛔ This hook only holds the CHOICE. What the fan draws goes through fanGeometry.js · geometryFor,
// which fits a custom combination to the layout and lets prefers-reduced-motion override it.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { normaliseDeckPreference } from "../../../shared/deckGeometry.js";

export const DECK_GEOMETRY_STORAGE_KEY = "draft-deck-geometry";
const SAVE_DEBOUNCE_MS = 400;   // a slider drag is many changes; the account gets the one it ends on

function readCache() {
  try { return normaliseDeckPreference(JSON.parse(localStorage.getItem(DECK_GEOMETRY_STORAGE_KEY) || "null")); }
  catch { return null; }
}
function writeCache(pref) {
  try { localStorage.setItem(DECK_GEOMETRY_STORAGE_KEY, JSON.stringify(pref)); } catch {}
}

export function useDeckGeometry() {
  const [pref, setPref] = useState(readCache);
  const timer = useRef(null);
  const pending = useRef(null);
  const touched = useRef(false);   // a change made before the account answered is not overwritten by it

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const p = pending.current;
    pending.current = null;
    if (p) api("/api/settings/deck-geometry", { method: "PUT", body: JSON.stringify({ preference: p }) }).catch(() => {});
  }, []);

  useEffect(() => {
    let live = true;
    api("/api/settings/deck-geometry")
      .then(r => {
        const p = normaliseDeckPreference(r?.preference);
        if (live && p && !touched.current) { setPref(p); writeCache(p); }
      })
      .catch(() => {});
    // Leaving Today mid-drag still saves the value it ended on.
    return () => { live = false; flush(); };
  }, [flush]);

  const choose = useCallback((next) => {
    const p = normaliseDeckPreference(next);
    if (!p) return;
    touched.current = true;
    setPref(p);
    writeCache(p);
    pending.current = p;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [flush]);

  return [pref, choose];
}
