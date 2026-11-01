// routes/thumbs.js — ⭐ D119 · thumbnails (services/thumbs/resourceThumbs.js).
//   GET  /api/thumbs/learn            → { thumbs: { <item url>: { kind, src, title, attribution, note } } } for Learn's items
//   GET  /api/thumbs/:hash            → the stored picture's bytes (never hot-linked); 404 when absent or hidden
//   GET  /api/admin/thumbs/learn      → every Learn item with its picture's state (the admin list; search links first)
//   POST /api/admin/thumbs/pin        { url, watchUrl }   "Pin a video" for a YouTube search link
//   POST /api/admin/thumbs/hide       { url, hidden }     the takedown (hidden: false shows it again)
//   POST /api/admin/thumbs/refresh                        the refresh now (it also runs daily, each picture monthly)
import { Router } from "express";
import { learnContent } from "../services/learn/learnContent.js";
import { thumbIndex, storedThumb, pinVideo, hideThumb, refreshThumbs, thumbPlan } from "../services/thumbs/resourceThumbs.js";

/** Every Learn item (the tracker's, and D115 P5's live extras) as { id, k, u, t, s } — the resources Learn lists. */
export function learnItems(db) {
  const out = [];
  const walk = (o) => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== "object") return;
    if (typeof o.u === "string" && typeof o.k === "string") out.push({ id: o.id ?? null, k: o.k, u: o.u, t: o.t ?? "", s: o.s ?? "" });
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
  };
  try { walk(learnContent(db).PARTS); } catch { /* no content imported */ }
  try {
    for (const r of db.prepare(`SELECT id, k, u, t, s FROM learn_extra_items WHERE status = 'live'`).all()) out.push(r);
  } catch { /* before migration 202 */ }
  return out;
}

/** ⭐ D119 · every resource a page lists: Learn's items and the Atlas's resources (not the dead ones) — what the refresh fetches. */
export function resourceItems(db) {
  const out = learnItems(db);
  try {
    for (const r of db.prepare(`SELECT url, title, format FROM atlas_resources WHERE COALESCE(check_status, 'ok') != 'dead'`).all()) {
      out.push({ id: null, k: r.format ? r.format.charAt(0).toUpperCase() + r.format.slice(1) : "Article", u: r.url, t: r.title, s: "" });
    }
  } catch { /* before the Atlas */ }
  return out;
}

export function createThumbsRouter(db) {
  const router = Router();
  router.get("/learn", (_req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.json({ thumbs: thumbIndex(db, learnItems(db).map(i => i.u)) });
  });
  router.get("/:hash", (req, res) => {
    const t = storedThumb(db, req.params.hash);
    if (!t) return res.status(404).end();
    res.set({ "Content-Type": t.mime, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" });
    res.end(t.bytes);
  });
  return router;
}

export function createThumbsAdminRouter(db, { fetchImpl = globalThis.fetch } = {}) {
  const router = Router();
  const who = (req) => req.user?.username || req.admin?.email || "admin";
  router.get("/learn", (_req, res) => {
    const items = learnItems(db);
    const idx = thumbIndex(db, items.map(i => i.u));
    const rows = items.map(i => ({ ...i, plan: thumbPlan(i).kind, thumb: idx[i.u] || null }));
    const count = (k) => rows.filter(r => r.plan === k).length;
    res.json({ rows: rows.sort((a, b) => (a.plan === "youtube_search" ? 0 : 1) - (b.plan === "youtube_search" ? 0 : 1)),
      counts: { youtubeSearch: count("youtube_search"), youtubeWatch: count("youtube"), book: count("book"), site: count("site"),
        stored: rows.filter(r => r.thumb?.src).length, hidden: rows.filter(r => r.thumb?.hidden).length } });
  });
  router.post("/pin", async (req, res) => {
    const { url, watchUrl } = req.body || {};
    if (!url) return res.status(400).json({ ok: false, error: "no_url" });
    const item = learnItems(db).find(i => i.u === url) || null;
    const r = await pinVideo(db, url, watchUrl, { by: who(req), fetchImpl, item });
    res.status(r.ok ? 200 : 400).json(r);
  });
  router.post("/hide", (req, res) => {
    const { url, hidden = true } = req.body || {};
    res.json(hideThumb(db, String(url || ""), { hidden: hidden !== false, by: who(req) }));
  });
  router.post("/refresh", async (_req, res) => res.json(await refreshThumbs(db, resourceItems(db), { fetchImpl })));
  return router;
}
