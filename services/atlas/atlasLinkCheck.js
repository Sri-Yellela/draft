// services/atlas/atlasLinkCheck.js — ⭐ D105 P6 · THE DEAD-LINK CHECKER for the Atlas's resources.
//
// Daily (server.js cron, after the 04:00 crawl's work) and on the curator's button (POST /api/admin/atlas/links/check).
// Each resource URL is asked with HEAD, falling back to GET when HEAD fails or is refused (many sites answer HEAD with
// 403 / 405), under a timeout. `checked_at` is stamped every time; `check_status`:
//   'ok'      — the last check succeeded (a 2xx, after redirects)
//   'failing' — ONE failure: still shown; a flaky night does not hide a good resource
//   'dead'    — TWO CONSECUTIVE failures: the public page hides it (atlasStore.readNode); a later success brings it back
// (d105DeadLinkFlagged). ⛔ POLITE: one request at a time with a pause between them, a User-Agent that names draft and
// where to read about it, and a per-run cap (the least recently checked go first, so a large list is covered over
// several days). ⛔ The fetcher is injectable — the tests never touch the network.

export const LINK_CHECK_UA = "draft-atlas-linkcheck/1.0 (+https://jobsviadraft.com/atlas)";
export const LINK_CHECK_DEFAULTS = Object.freeze({ timeoutMs: 10_000, cap: 150, pauseMs: 750 });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** One URL: true when it answers 2xx (redirects followed). Never throws. */
export async function probeUrl(url, { fetchImpl = globalThis.fetch, timeoutMs = LINK_CHECK_DEFAULTS.timeoutMs, userAgent = LINK_CHECK_UA } = {}) {
  const ask = async (method) => {
    const res = await fetchImpl(url, { method, redirect: "follow", signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml,*/*;q=0.8" } });
    try { await res.body?.cancel?.(); } catch { /* the body is not wanted */ }
    return res.status;
  };
  let status = null;
  try { status = await ask("HEAD"); } catch { status = null; }
  if (status != null && status >= 200 && status < 300) return { ok: true, status, method: "HEAD" };
  try { status = await ask("GET"); } catch (e) { return { ok: false, status: null, method: "GET", error: e?.name || "error" }; }
  return { ok: status >= 200 && status < 300, status, method: "GET" };
}

/** The status after one check, from the one before it: two failures in a row are dead; any success resets. */
export function nextCheckStatus(prev, ok) {
  if (ok) return "ok";
  return prev === "failing" || prev === "dead" ? "dead" : "failing";
}

const RUNNING = new WeakMap();   // one run per database at a time — the button pressed during the daily run is told "busy"

/**
 * Check up to `cap` resources, least recently checked first, one at a time.
 * @returns {{ checked, ok, failing, dead, newlyDead: number[], busy? }} — `busy` when a run is already going
 */
export async function checkAtlasLinks(db, opts = {}) {
  if (RUNNING.has(db)) return { busy: true, checked: 0, ok: 0, failing: 0, dead: 0, newlyDead: [] };
  const run = runCheck(db, opts);
  RUNNING.set(db, run);
  try { return await run; } finally { RUNNING.delete(db); }
}

async function runCheck(db, { fetchImpl = globalThis.fetch, cap = LINK_CHECK_DEFAULTS.cap, timeoutMs = LINK_CHECK_DEFAULTS.timeoutMs,
  pauseMs = LINK_CHECK_DEFAULTS.pauseMs, userAgent = LINK_CHECK_UA, now = () => Math.floor(Date.now() / 1000), pause = sleep } = {}) {
  const rows = db.prepare(`SELECT id, url, check_status FROM atlas_resources ORDER BY COALESCE(checked_at, 0), id LIMIT ?`)
    .all(Math.max(0, Math.min(Number(cap) || 0, 1000)));
  const save = db.prepare(`UPDATE atlas_resources SET checked_at = ?, check_status = ? WHERE id = ?`);
  const out = { checked: 0, ok: 0, failing: 0, dead: 0, newlyDead: [] };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (i > 0 && pauseMs > 0) await pause(pauseMs);
    const { ok } = await probeUrl(r.url, { fetchImpl, timeoutMs, userAgent });
    const next = nextCheckStatus(r.check_status, ok);
    save.run(now(), next, r.id);
    out.checked++; out[next]++;
    if (next === "dead" && r.check_status !== "dead") out.newlyDead.push(r.id);
  }
  return out;
}
