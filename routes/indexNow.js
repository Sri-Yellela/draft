// routes/indexNow.js — ⭐ D128 P2 (46y) · the IndexNow key file at the site root, and the pinger's timer.
//
// IndexNow proves a site owns the URLs it submits by fetching https://<host>/<key>.txt and reading the key back.
// ⛔ OFF until INDEXNOW_KEY is set: no route is added (the path 404s like any other) and no timer starts — production
//    is unchanged. The pinger itself (services/seo/indexNow.js) also refuses staging and `node --test`.
// Mounted BEFORE A157's /<company> catch-all (server.js mounts it beside robots.txt).
import { indexNowConfig, startIndexNow } from "../services/seo/indexNow.js";

/**
 * @returns {{ keyServed: boolean, stop: null | (() => void) }}
 */
export function mountIndexNow(app, db, { env = process.env, fetchImpl = globalThis.fetch, log = console, start = true } = {}) {
  const config = indexNowConfig(env);
  if (!config.key) return { keyServed: false, stop: null };
  app.get(`/${config.key}.txt`, (_req, res) => {
    res.set("Cache-Control", "public, max-age=86400").type("text/plain; charset=utf-8").send(config.key);
  });
  const stop = start ? startIndexNow(db, { config, fetchImpl, log }) : null;
  return { keyServed: true, stop };
}
