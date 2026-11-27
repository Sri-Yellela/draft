// ⭐ D197 Wave 2 #12 (47m, lane practice) · ASK DRAFT'S ROUTE CARD — "Save to my routes" (the approved board AskRoute: a
// saved answer joins Routes, flagged "made from a question"). The caller's OWN rows only (req.user.id); no model reads or
// writes them (D190). Migration 283_atlas_question_routes.
// GET    /api/atlas/question-routes        { routes: [{ id, question, stops: [{ slug, name }], createdAt }] } newest first
// POST   /api/atlas/question-routes        { question, stops: [{ slug, name }] } — 2 or 3 stops (one entry stays a link; more
//                                          than three point to an existing route, so neither is saved); the same question
//                                          and stops saved again returns the kept row
// DELETE /api/atlas/question-routes/:id
const MAX_PER_USER = 200;
const SLUG = /^[a-z0-9][a-z0-9._/-]{0,119}$/i;

const clean = (s, cap) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, cap);

/** The body's stops, or a reason it is refused. Pure (the tests read it). */
export function questionRouteStops(stops) {
  if (!Array.isArray(stops)) return { error: "stops_required" };
  const out = [];
  for (const s of stops) {
    const slug = clean(s?.slug, 120), name = clean(s?.name, 120);
    if (!SLUG.test(slug) || !name) return { error: "bad_stop" };
    if (!out.some((x) => x.slug === slug)) out.push({ slug, name });
  }
  if (out.length < 2 || out.length > 3) return { error: "two_or_three_stops" };
  return { stops: out };
}

const rowOut = (r) => ({ id: r.id, question: r.question, stops: (() => { try { return JSON.parse(r.stops_json); } catch { return []; } })(), createdAt: r.created_at });

export default function atlasQuestionRoutes(app, db, requireAuth) {
  app.get("/api/atlas/question-routes", requireAuth, (req, res) => {
    try {
      const rows = db.prepare("SELECT id, question, stops_json, created_at FROM atlas_question_routes WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
        .all(req.user.id, MAX_PER_USER);
      res.json({ routes: rows.map(rowOut) });
    } catch (e) { res.status(500).json({ error: "read_failed", message: "Your saved routes could not be read." }); }
  });
  app.post("/api/atlas/question-routes", requireAuth, (req, res) => {
    const question = clean(req.body?.question, 300);
    if (!question) return res.status(400).json({ error: "question_required", message: "A saved route keeps the question it was made from." });
    const st = questionRouteStops(req.body?.stops);
    if (st.error) return res.status(400).json({ error: st.error, message: "A route made from a question has two or three stops." });
    const json = JSON.stringify(st.stops);
    try {
      const kept = db.prepare("SELECT id, question, stops_json, created_at FROM atlas_question_routes WHERE user_id = ? AND question = ? AND stops_json = ?")
        .get(req.user.id, question, json);
      if (kept) return res.json({ route: rowOut(kept), kept: true });
      const n = db.prepare("SELECT COUNT(*) FROM atlas_question_routes WHERE user_id = ?").pluck().get(req.user.id);
      if (n >= MAX_PER_USER) return res.status(409).json({ error: "too_many", message: `You can keep ${MAX_PER_USER} routes made from questions — remove one first.` });
      const now = Math.floor(Date.now() / 1000);
      const id = db.prepare("INSERT INTO atlas_question_routes (user_id, question, stops_json, created_at) VALUES (?, ?, ?, ?)")
        .run(req.user.id, question, json, now).lastInsertRowid;
      res.json({ route: { id: Number(id), question, stops: st.stops, createdAt: now } });
    } catch (e) { res.status(500).json({ error: "save_failed", message: "That route was not saved." }); }
  });
  app.delete("/api/atlas/question-routes/:id", requireAuth, (req, res) => {
    if (!/^\d+$/.test(String(req.params.id))) return res.status(400).json({ error: "bad_id" });
    try {
      const changes = db.prepare("DELETE FROM atlas_question_routes WHERE id = ? AND user_id = ?").run(Number(req.params.id), req.user.id).changes;
      if (!changes) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "delete_failed", message: "That route was not removed." }); }
  });
}
