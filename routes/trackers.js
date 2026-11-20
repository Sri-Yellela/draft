// routes/trackers.js — ⭐ D159 T2–T4 (46y) · TRACKERS (services/trackers.js). Every read and write is the signed-in person's own.
//
//   GET    /api/trackers                        → { searches[], companies[], pages[] } each feed with `newCount` since last seen
//   POST   /api/trackers/pages                  { url }  → follow a careers page / board (T3 / T4)
//   DELETE /api/trackers/pages/:id              → stop tracking a page that has not resolved yet
//   POST   /api/trackers/companies/:id/seen     → a followed company's feed read (its count goes to 0)
//   POST   /api/trackers/searches/:profileId/seen → a saved search's feed read
//
// (Following / unfollowing a company stays POST /api/companies/:slug/follow — D159 T1.)
// ⛔ The counts are read on the read workers (A126): `countSearch` is the board's own statement (boardPageResponse's
// measure, injected by server.js); companyNewCounts is one statement.
import { Router } from "express";
import { listTrackers, resolvePending, companyNewCounts, trackPage, untrackPage, markCompanySeen, markSearchSeen }
  from "../services/trackers.js";

export const MAX_COUNTED_SEARCHES = 10;

const fail = (res, e, code = "trackers_failed") => res.status(e.status || 500).json({ error: e.code || code, message: e.message });
const send = (res, fn) => {
  res.set("Cache-Control", "private, no-store");
  try { res.json(fn()); } catch (e) { fail(res, e); }
};

export function createTrackersRouter(db, { read, countSearch = null } = {}) {
  const router = Router();
  router.get("/", async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      try { resolvePending(db, req.user.id); } catch { /* the list still answers */ }
      const t = listTrackers(db, req.user.id);
      let counts = new Map();
      try { if (t.companies.length) counts = await companyNewCounts(read, req.user.id); } catch { counts = null; }
      const companies = t.companies.map((c) => ({ ...c, newCount: counts ? (counts.get(c.companyId) || 0) : null }));
      const searches = [];
      for (const [i, s] of t.searches.entries()) {
        let newCount = null;
        if (countSearch && i < MAX_COUNTED_SEARCHES) {
          try { newCount = await countSearch(req.user, s.profileId, s.params, s.lastSeenAt ?? 0); } catch { newCount = null; }
        }
        searches.push({ ...s, newCount });
      }
      res.json({ searches, companies, pages: t.pages });
    } catch (e) { fail(res, e); }
  });
  router.post("/pages", (req, res) => send(res, () => trackPage(db, req.user.id, req.body?.url)));
  router.delete("/pages/:id", (req, res) => send(res, () => untrackPage(db, req.user.id, req.params.id)));
  router.post("/companies/:id/seen", (req, res) => send(res, () => markCompanySeen(db, req.user.id, req.params.id)));
  router.post("/searches/:profileId/seen", (req, res) => send(res, () => markSearchSeen(db, req.user.id, req.params.profileId)));
  return router;
}
