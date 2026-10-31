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

// ⭐ D114 · ATLAS TERMS IN THE POSTINGS — the same links, inside a posting's text (components/AtlasTerm.jsx):
//   useAtlasTerms(jobId) — ONE posting's linkable terms (GET /api/atlas/terms/:jobId), once per posting per page load
//   peekAtlas(slug)      — the popup's read (GET /api/atlas/peek/:slug), on the FIRST hover / focus only, never preloaded
//   atlasLinkEvent(e)    — "open" | "visit", a count with nothing else in it (P5)
const termsCache = new Map();   // jobId → Promise<terms[]>
const peekCache = new Map();    // slug → Promise<peek>

export function loadAtlasTerms(jobId) {
  const key = String(jobId);
  if (!termsCache.has(key)) {
    termsCache.set(key, api(`/api/atlas/terms/${encodeURIComponent(key)}`).then(r => (Array.isArray(r?.terms) ? r.terms : [])).catch(() => []));
  }
  return termsCache.get(key);
}

/** [] until the answer arrives (the text is drawn at once, the links join it), and for a posting with none. */
export function useAtlasTerms(jobId) {
  const [terms, setTerms] = useState([]);
  useEffect(() => {
    if (jobId == null || jobId === "") { setTerms([]); return undefined; }
    let live = true;
    loadAtlasTerms(jobId).then(t => { if (live) setTerms(t); });
    return () => { live = false; };
  }, [jobId]);
  return terms;
}

// ⭐ D118 P1: the popup's count moves with the board — a read is kept at most a minute (the server's cap), not the page's life.
export const PEEK_KEEP_MS = 60_000;
export function peekAtlas(slug, now = Date.now()) {
  const hit = peekCache.get(slug);
  if (!hit || now - hit.at >= PEEK_KEEP_MS) {
    const p = api(`/api/atlas/peek/${encodeURIComponent(slug)}`);
    p.catch(() => peekCache.delete(slug));   // a failed read is asked again on the next hover
    peekCache.set(slug, { at: now, p });
  }
  return peekCache.get(slug).p;
}

export function atlasLinkEvent(event) {
  try {
    // Through api() like every client call (the tab's auth context); keepalive so a visit's count survives the navigation.
    api("/api/atlas/link-event", { method: "POST", keepalive: true, body: JSON.stringify({ event }) }).catch(() => {});
  } catch { /* a count never gets in the way */ }
}
