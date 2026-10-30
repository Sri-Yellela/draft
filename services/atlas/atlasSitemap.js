// services/atlas/atlasSitemap.js — ⭐ D105 · the Atlas's entries in /sitemap.xml (server.js).
//
// /atlas itself, and one entry per PUBLISHED node — a draft is the curator's and is never advertised to a crawler
// (d105SitemapPublishedOnly). `lastmod` is the node's own updated_at, so a crawler re-reads a page when it changed.

export const ATLAS_SITEMAP_MAX = 5000;

/** @returns {Array<{ path, changefreq, priority, lastmod? }>} */
export function atlasSitemapRoutes(db, { max = ATLAS_SITEMAP_MAX } = {}) {
  const routes = [{ path: "/atlas", changefreq: "weekly", priority: "0.6" }];
  let rows = [];
  try {
    rows = db.prepare(`SELECT slug, COALESCE(updated_at, published_at) AS t FROM atlas_nodes WHERE status = 'published'
      ORDER BY slug LIMIT ?`).all(max);
  } catch { rows = []; }
  for (const r of rows) {
    routes.push({ path: `/atlas/${encodeURIComponent(r.slug)}`, changefreq: "weekly", priority: "0.5",
      ...(r.t ? { lastmod: new Date(r.t * 1000).toISOString().slice(0, 10) } : {}) });
  }
  return routes;
}
