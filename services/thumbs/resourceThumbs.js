// services/thumbs/resourceThumbs.js — ⭐ D119 · THUMBNAILS: every resource shows what it is before you open it (owner 10-31:
// "there are links all over for books, videos etc., but no thumbnails, mere text").
//
// ONE RESOLVER, used by Learn's items (D115 / D117), and by the same tile wherever a resource is listed. No model (D17).
//   P1 · where each picture comes from, by the URL and the item's kind:
//        a YouTube WATCH url (youtube.com/watch?v=, youtu.be/)  → YouTube's own thumbnail for that video id, with its title
//                                                                 and channel from YouTube oEmbed
//        a YouTube SEARCH url (the tracker's yt() helper)       → ⛔ there is no single video, so NO picture is invented: a
//                                                                 "YouTube · search: <query>" tile; Admin → Learn "Pin a
//                                                                 video" pastes a watch URL → the real thumbnail
//        a Book                                                 → Open Library's search API (title + author) → its cover
//                                                                 id → the cover, said "Cover: Open Library"; no match → a
//                                                                 typographic book tile
//        anything else (article, course, sandbox, game …)       → the page's own og:image (else twitter:image), fetched
//                                                                 server-side: a descriptive User-Agent, a 5 s timeout,
//                                                                 ≤ 2 MB, robots.txt honoured; none → the site's tile
//   P2 · STORED, NOT HOT-LINKED: fetched once, kept in resource_thumbs (migration 204) keyed by the URL's hash, served by
//        GET /api/thumbs/:hash; refreshed monthly with the dead-link check; a failed fetch keeps the fallback tile. Admin
//        can hide any picture (the takedown path). ⛔ Pictures never go into a document (résumé, PDF, cover letter) —
//        nothing on those paths imports this file (d119NeverInDocuments).
//   ⚠ RESIZING (P2 "≤ 480 px wide, WebP") is NOT done here: draft has no image library (no sharp / jimp — a native
//        dependency is the owner's call), so the bytes are stored as fetched, capped at 2 MB, and the tile scales them.
import crypto from "node:crypto";
import { sniffImage } from "../jobs/companyLogoStore.js";

export const THUMB_UA = "draft-thumbnails/1.0 (https://jobsviadraft.com; https://jobsviadraft.com/contact)";
export const THUMBS = Object.freeze({
  TIMEOUT_MS: 5000,
  MAX_BYTES: 2 * 1024 * 1024,
  /** how much of a page is read to find its share image */
  MAX_HTML: 512 * 1024,
  /** refreshed monthly, with the dead-link check */
  MAX_AGE_DAYS: 30,
  /** a run's cap and its pause between requests (polite, one at a time) */
  PER_RUN: 60,
  PAUSE_MS: 400,
});
export const THUMB_ROUTE = "/api/thumbs/";
export const urlHash = (url) => crypto.createHash("sha256").update(String(url)).digest("hex");
export const thumbPath = (url) => `${THUMB_ROUTE}${urlHash(url)}`;

const parse = (u) => { try { return new URL(String(u)); } catch { return null; } };

/** A YouTube video id from a watch URL, else null. */
export function youtubeId(url) {
  const u = parse(url);
  if (!u) return null;
  const h = u.hostname.replace(/^www\.|^m\./, "");
  if (h === "youtu.be") return /^[\w-]{11}$/.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null;
  if (h === "youtube.com" && u.pathname === "/watch") { const v = u.searchParams.get("v"); return /^[\w-]{11}$/.test(v || "") ? v : null; }
  return null;
}

/** P1 · what a resource's picture is and where it would come from. Pure. item = { k (kind), u (url), t (title), s (source) } */
export function thumbPlan(item, pinnedUrl = null) {
  const url = String(item?.u || "");
  const id = youtubeId(pinnedUrl || url);
  if (id) return { kind: "youtube", videoId: id, watchUrl: pinnedUrl || url,
    image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, oembed: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}` };
  const u = parse(url);
  if (u && /(^|\.)youtube\.com$/.test(u.hostname) && u.pathname === "/results") {
    return { kind: "youtube_search", query: u.searchParams.get("search_query") || "" };
  }
  if (item?.k === "Book") {
    const title = String(item.t || "").split(":")[0].trim(), author = String(item.s || "").split(/,| and /)[0].trim();
    return { kind: "book", title, author,
      api: `https://openlibrary.org/search.json?limit=1&fields=cover_i,title,author_name&title=${encodeURIComponent(title)}${author ? `&author=${encodeURIComponent(author)}` : ""}` };
  }
  return u ? { kind: "site", page: url, host: u.hostname.replace(/^www\./, "") } : { kind: "none" };
}

async function get(fetchImpl, url, max, accept = "*/*") {
  const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(THUMBS.TIMEOUT_MS), headers: { "user-agent": THUMB_UA, accept } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > max) throw new Error(`too large (${buf.length} bytes)`);
  return { buf, url: res.url || url };
}

/** The share image a page declares (og:image, else twitter:image), absolute, or null. Pure. */
export function shareImageOf(html, baseUrl) {
  const metas = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  const attr = (tag, name) => { const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag); return m ? (m[1] ?? m[2]) : null; };
  const find = (key) => metas.map(m => ({ k: (attr(m, "property") || attr(m, "name") || "").toLowerCase(), v: attr(m, "content") })).find(x => x.k === key && x.v)?.v;
  const raw = find("og:image") || find("og:image:url") || find("twitter:image") || find("twitter:image:src");
  if (!raw) return null;
  try { const abs = new URL(raw.replace(/&amp;/g, "&"), baseUrl); return abs.protocol === "https:" || abs.protocol === "http:" ? abs.href : null; } catch { return null; }
}

/** robots.txt, honoured: is `url` disallowed for every agent ("User-agent: *") or for ours? Pure over the file's text. */
export function robotsAllows(robotsTxt, url) {
  const u = parse(url);
  if (!u) return false;
  const path = u.pathname + u.search;
  let applies = false, sawAgent = false;
  const rules = [];
  for (const line of String(robotsTxt || "").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*(#.*)?$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2];
    if (k === "user-agent") { if (!sawAgent) applies = false; sawAgent = true; if (v === "*" || /draft-thumbnails/i.test(v)) applies = true; continue; }
    sawAgent = false;
    if (applies && (k === "disallow" || k === "allow") && v) rules.push({ allow: k === "allow", p: v });
  }
  // the longest matching rule wins (allow on a tie), as robots.txt is read by the big crawlers
  let best = null;
  for (const r of rules) if (path.startsWith(r.p) && (!best || r.p.length > best.p.length || (r.p.length === best.p.length && r.allow))) best = r;
  return !best || best.allow;
}

async function robotsFor(fetchImpl, url, cache) {
  const u = parse(url);
  const key = u?.origin;
  if (!key) return "";
  if (!cache.has(key)) {
    let txt = "";
    try { const r = await get(fetchImpl, `${key}/robots.txt`, 256 * 1024, "text/plain"); txt = r.buf.toString("utf8"); } catch { txt = ""; }
    cache.set(key, txt);
  }
  return cache.get(key);
}

async function fetchImage(fetchImpl, url) {
  const { buf } = await get(fetchImpl, url, THUMBS.MAX_BYTES, "image/*");
  const mime = sniffImage(buf);
  if (!mime || mime === "image/x-icon") throw new Error("not a picture");
  return { bytes: buf, mime };
}

/**
 * P1 · resolve ONE resource's picture and store it. Never throws; a failure is stored as `failed` (the fallback tile).
 * @returns the stored row's public shape (thumbOut)
 */
export async function resolveThumb(db, item, { fetchImpl = globalThis.fetch, robots = new Map(), now = Math.floor(Date.now() / 1000) } = {}) {
  const url = String(item.u);
  const hash = urlHash(url);
  const prev = db.prepare(`SELECT pinned_url FROM resource_thumbs WHERE url_hash = ?`).get(hash);
  const plan = thumbPlan(item, prev?.pinned_url || null);
  const row = { kind: plan.kind, status: "none", bytes: null, content_type: null, title: null, attribution: null, note: null };
  try {
    if (plan.kind === "youtube") {
      const img = await fetchImage(fetchImpl, plan.image);
      Object.assign(row, { status: "ok", bytes: img.bytes, content_type: img.mime, attribution: "YouTube" });
      try {
        const o = JSON.parse((await get(fetchImpl, plan.oembed, 64 * 1024, "application/json")).buf.toString("utf8"));
        row.title = String(o.title || "").slice(0, 200) || null;
        row.attribution = o.author_name ? `YouTube · ${String(o.author_name).slice(0, 80)}` : "YouTube";
      } catch { /* the picture stands without its title */ }
    } else if (plan.kind === "youtube_search") {
      row.note = `search: ${plan.query}`.slice(0, 200);   // ⛔ no picture invented for a search
    } else if (plan.kind === "book") {
      const r = JSON.parse((await get(fetchImpl, plan.api, 256 * 1024, "application/json")).buf.toString("utf8"));
      const cover = r?.docs?.[0]?.cover_i;
      if (cover) {
        const img = await fetchImage(fetchImpl, `https://covers.openlibrary.org/b/id/${encodeURIComponent(cover)}-M.jpg`);
        Object.assign(row, { status: "ok", bytes: img.bytes, content_type: img.mime, attribution: "Cover: Open Library" });
      } else row.note = "no cover on Open Library";
    } else if (plan.kind === "site") {
      if (!robotsAllows(await robotsFor(fetchImpl, url, robots), url)) row.note = "robots.txt disallows";
      else {
        const page = await get(fetchImpl, url, THUMBS.MAX_BYTES, "text/html");
        const img = shareImageOf(page.buf.subarray(0, THUMBS.MAX_HTML).toString("utf8"), page.url);
        if (img && robotsAllows(await robotsFor(fetchImpl, img, robots), img)) {
          const got = await fetchImage(fetchImpl, img);
          Object.assign(row, { status: "ok", bytes: got.bytes, content_type: got.mime, attribution: plan.host });
        } else row.note = img ? "robots.txt disallows the image" : "no share image";
      }
    }
  } catch (e) {
    Object.assign(row, { status: "failed", bytes: null, content_type: null, note: String(e.message || e).slice(0, 200) });
  }
  db.prepare(`INSERT INTO resource_thumbs (url_hash, url, kind, status, bytes, content_type, title, attribution, note, fetched_at, updated_at)
      VALUES (@hash, @url, @kind, @status, @bytes, @content_type, @title, @attribution, @note, @now, @now)
    ON CONFLICT(url_hash) DO UPDATE SET kind = excluded.kind, status = excluded.status, bytes = excluded.bytes, content_type = excluded.content_type,
      title = excluded.title, attribution = excluded.attribution, note = excluded.note, fetched_at = excluded.fetched_at, updated_at = excluded.updated_at`)
    .run({ hash, url, now, ...row });
  return thumbOut(db.prepare(`SELECT * FROM resource_thumbs WHERE url_hash = ?`).get(hash));
}

/** P2 · the refresh: every resource not fetched in MAX_AGE_DAYS (or never), one at a time, capped per run. Hidden ones are skipped. */
export async function refreshThumbs(db, items, { fetchImpl = globalThis.fetch, now = Math.floor(Date.now() / 1000), limit = THUMBS.PER_RUN, pauseMs = THUMBS.PAUSE_MS } = {}) {
  const robots = new Map();
  const seen = new Set();
  const out = { checked: 0, ok: 0, failed: 0, none: 0, byKind: {} };
  const due = db.prepare(`SELECT fetched_at, hidden_at FROM resource_thumbs WHERE url_hash = ?`);
  for (const it of items) {
    if (!it?.u || seen.has(it.u)) continue;
    seen.add(it.u);
    const r = due.get(urlHash(it.u));
    if (r?.hidden_at || (r?.fetched_at && now - r.fetched_at < THUMBS.MAX_AGE_DAYS * 86400)) continue;
    if (out.checked >= limit) break;
    if (out.checked && pauseMs) await new Promise(ok => setTimeout(ok, pauseMs));
    const t = await resolveThumb(db, it, { fetchImpl, robots, now });
    out.checked++;
    out[t.status] = (out[t.status] || 0) + 1;
    out.byKind[t.kind] = (out.byKind[t.kind] || 0) + 1;
  }
  return out;
}

/** Admin → Learn "Pin a video": a watch URL for a search link. The next refresh (or this call's resolve) fetches it. */
export async function pinVideo(db, url, watchUrl, { by = "admin", fetchImpl = globalThis.fetch, item = null } = {}) {
  if (!youtubeId(watchUrl)) return { ok: false, error: "not_a_watch_url", message: "Paste a YouTube watch link (youtube.com/watch?v=… or youtu.be/…)." };
  const hash = urlHash(url);
  db.prepare(`INSERT INTO resource_thumbs (url_hash, url, kind, pinned_url, pinned_by) VALUES (?, ?, 'youtube', ?, ?)
    ON CONFLICT(url_hash) DO UPDATE SET pinned_url = excluded.pinned_url, pinned_by = excluded.pinned_by, fetched_at = NULL, updated_at = unixepoch()`)
    .run(hash, String(url), String(watchUrl), String(by));
  const thumb = await resolveThumb(db, item || { u: url, k: "Video" }, { fetchImpl });
  return { ok: true, thumb };
}

/** Admin: hide (or show again) a picture — the takedown path. */
export function hideThumb(db, url, { hidden = true, by = "admin" } = {}) {
  const r = db.prepare(`UPDATE resource_thumbs SET hidden_at = ?, hidden_by = ?, updated_at = unixepoch() WHERE url_hash = ?`)
    .run(hidden ? Math.floor(Date.now() / 1000) : null, hidden ? String(by) : null, urlHash(url));
  return { ok: r.changes > 0 };
}

/** The public shape of a row — no bytes; `src` only when a stored picture may be shown. */
export function thumbOut(r) {
  if (!r) return null;
  const shown = r.status === "ok" && r.bytes && !r.hidden_at;
  return { kind: r.kind, src: shown ? `${THUMB_ROUTE}${r.url_hash}` : null, title: r.title || null, attribution: shown ? r.attribution : null,
    note: r.kind === "youtube_search" ? r.note : null, hidden: !!r.hidden_at, pinned: !!r.pinned_url };
}

/** url → thumbOut, for a list of URLs (missing ones are absent: the tile falls back). */
export function thumbIndex(db, urls) {
  const out = {};
  const q = db.prepare(`SELECT url_hash, url, kind, status, bytes IS NOT NULL AS bytes, title, attribution, note, pinned_url, hidden_at FROM resource_thumbs WHERE url_hash = ?`);
  for (const u of new Set(urls)) { const r = q.get(urlHash(u)); if (r) out[u] = thumbOut(r); }
  return out;
}

/** The stored picture for GET /api/thumbs/:hash — null when absent, not a picture, or hidden. */
export function storedThumb(db, hash) {
  if (!/^[0-9a-f]{64}$/.test(String(hash))) return null;
  const r = db.prepare(`SELECT bytes, content_type, hidden_at, status FROM resource_thumbs WHERE url_hash = ?`).get(String(hash));
  return r && r.status === "ok" && r.bytes && !r.hidden_at ? { bytes: r.bytes, mime: r.content_type } : null;
}
