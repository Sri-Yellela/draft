// client/src/lib/atlasLinks.js — ⭐ D105 P5 · LINKS IN: a skill tag links to its Atlas page when a PUBLISHED one exists.
//
// Every skill tag on a posting (the legacy job card's chips, the ATS report's term boxes on the board, the deck and the
// tools page) and the Profile's skills ask here which of their terms have a page. One request per batch of new terms —
// GET /api/atlas/resolve?terms=a,b,c → { slugs: { term: slug } } — and the answer is CACHED FOR THE PAGE: a term asked
// once is never asked again, and a term with no published page is remembered as "none" too.
// ⛔ NEVER A DEAD LINK: the server answers only published nodes (by term or confirmed alias); anything absent from the
// answer, a failed request, or a request still in flight draws the plain tag — no link.
import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

export const ATLAS_BATCH = 100;
const cache = new Map();          // term → slug | null (null = asked, no published page)
const inflight = new Map();       // term → Promise
const keyOf = (t) => String(t ?? "").trim();

/** The Atlas page for a slug. In the app a signed-in reader is taken to /app/atlas by the public route. */
export const atlasHref = (slug) => `/atlas/${encodeURIComponent(slug)}`;

/** Resolve terms (cached per page). @returns {Promise<Record<string,string>>} term → slug, published only */
export async function resolveAtlasTerms(terms, { fetcher = api } = {}) {
  const keys = [...new Set((terms || []).map(keyOf).filter(Boolean))];
  const ask = keys.filter(k => !cache.has(k) && !inflight.has(k));
  for (let i = 0; i < ask.length; i += ATLAS_BATCH) {
    const batch = ask.slice(i, i + ATLAS_BATCH);
    const p = fetcher(`/api/atlas/resolve?terms=${encodeURIComponent(batch.join(","))}`)
      .then(r => { const slugs = r?.slugs || {}; for (const k of batch) cache.set(k, typeof slugs[k] === "string" ? slugs[k] : null); })
      .catch(() => { /* no answer → no link; asked again on a later page load */ })
      .finally(() => { for (const k of batch) inflight.delete(k); });
    for (const k of batch) inflight.set(k, p);
  }
  await Promise.all(keys.map(k => inflight.get(k)).filter(Boolean));
  const out = {};
  for (const k of keys) { const s = cache.get(k); if (s) out[k] = s; }
  return out;
}

/** React: the slugs for these terms — {} until the answer lands, then only the terms that have a published page. */
export function useAtlasSlugs(terms) {
  const sig = useMemo(() => [...new Set((terms || []).map(keyOf).filter(Boolean))].sort().join("\u0001"), [terms]);
  const [slugs, setSlugs] = useState(() => fromCache(sig));
  useEffect(() => {
    let live = true;
    const list = sig ? sig.split("\u0001") : [];
    setSlugs(fromCache(sig));
    if (list.length) resolveAtlasTerms(list).then(s => { if (live) setSlugs(s); });
    return () => { live = false; };
  }, [sig]);
  return slugs;
}

function fromCache(sig) {
  const out = {};
  for (const k of sig ? sig.split("\u0001") : []) { const s = cache.get(k); if (s) out[k] = s; }
  return out;
}

/** Test seam: forget the page's cache. */
export function _resetAtlasCache() { cache.clear(); inflight.clear(); }
