// routes/atlasCompete.js — ⭐ D172 (4) / A154 (45s) · Atlas → Compete: this week's league and the challenges, each behind its
// OWN switch (OFF by default). While a switch is off its routes answer 404 { error: "not_available" } — the feature does not
// exist for anyone until the owner turns it on (owner 11-08: "build league and challenges, can merge them later").
//
// GET    /api/atlas/compete                       { league, challenges, liveCount } — which switches are on (the nav asks)
// GET    /api/atlas/league                        the join card, or the pod: podium, rows, gap, feed      (league switch)
// POST   /api/atlas/league/join                   { handle } — opt-in                                     (league switch)
// DELETE /api/atlas/league                        leave, any time                                         (league switch)
// GET    /api/atlas/challenges                    kept audits + share links, time attack's best, the duel (challenges switch)
// POST   /api/atlas/challenges/time-attack        { role, mode } → the first question                     (challenges switch)
// POST   /api/atlas/challenges/duel               { mode } → the first question (league members, Fri–Sun) (both switches)
// POST   /api/atlas/challenges/:runId/answer      { questionId, chosen } → in time? the next, or the score (challenges switch)
// POST   /api/atlas/challenges/bar/:token/share   → { shareCode } for a KEPT audit                        (challenges switch)
// GET    /api/atlas/bar/:code                     PUBLIC — the shared score line only, nothing about who  (challenges switch)
// GET    /api/admin/atlas-compete                 { league, challenges, liveCount, counts }                (admin)
// PUT    /api/admin/atlas-compete                 { league?, challenges?, liveCount? } — audited           (admin)
import { leagueEnabled, liveCountEnabled, LEAGUE_SETTING, LIVE_COUNT_SETTING, myLeague, joinLeague, leaveLeague } from "../services/atlas/league.js";
import { challengesEnabled, CHALLENGES_SETTING, myChallenges, startTimeAttack, startDuel, answerRun, shareBar, sharedBar }
  from "../services/atlas/challenges.js";
import { setSetting } from "../services/appSettings.js";
import { auditActorColumns } from "../services/actor.js";

export default function atlasCompeteRoutes(app, db, { requireAuth, requireAdmin }) {
  const off = (res) => res.status(404).json({ error: "not_available", message: "This isn't available yet." });
  const league = (req, res, next) => (leagueEnabled(db) ? next() : off(res));
  const challenges = (req, res, next) => (challengesEnabled(db) ? next() : off(res));
  const fail = (res, e) => res.status(e.status || 500).json({ error: e.code || "compete_failed", message: e.message });
  const priv = (res) => res.set("Cache-Control", "private, no-store");

  app.get("/api/atlas/compete", requireAuth, (_req, res) => {
    priv(res).json({ league: leagueEnabled(db), challenges: challengesEnabled(db), liveCount: liveCountEnabled(db) });
  });

  app.get("/api/atlas/league", requireAuth, league, (req, res) => {
    try { priv(res).json(myLeague(db, req.user.id)); } catch (e) { fail(res, e); }
  });
  app.post("/api/atlas/league/join", requireAuth, league, (req, res) => {
    try { joinLeague(db, req.user.id, { handle: req.body?.handle }); priv(res).json(myLeague(db, req.user.id)); } catch (e) { fail(res, e); }
  });
  app.delete("/api/atlas/league", requireAuth, league, (req, res) => {
    try { priv(res).json(leaveLeague(db, req.user.id)); } catch (e) { fail(res, e); }
  });

  app.get("/api/atlas/challenges", requireAuth, challenges, (req, res) => {
    try { priv(res).json(myChallenges(db, req.user.id)); } catch (e) { fail(res, e); }
  });
  app.post("/api/atlas/challenges/time-attack", requireAuth, challenges, (req, res) => {
    try { priv(res).json(startTimeAttack(db, req.user.id, { role: req.body?.role, mode: req.body?.mode || "timed" })); } catch (e) { fail(res, e); }
  });
  app.post("/api/atlas/challenges/duel", requireAuth, challenges, league, (req, res) => {
    try { priv(res).json(startDuel(db, req.user.id, { mode: req.body?.mode || "timed" })); } catch (e) { fail(res, e); }
  });
  app.post("/api/atlas/challenges/:runId/answer", requireAuth, challenges, (req, res) => {
    try { priv(res).json(answerRun(db, req.user.id, req.params.runId, { questionId: req.body?.questionId, chosen: req.body?.chosen })); }
    catch (e) { fail(res, e); }
  });
  app.post("/api/atlas/challenges/bar/:token/share", requireAuth, challenges, (req, res) => {
    try { priv(res).json(shareBar(db, req.user.id, req.params.token)); } catch (e) { fail(res, e); }
  });
  app.get("/api/atlas/bar/:code", challenges, (req, res) => {
    const s = sharedBar(db, req.params.code);
    if (!s) return res.status(404).json({ error: "not_found", message: "That link doesn't open a score." });
    res.set("Cache-Control", "public, max-age=300").json(s);
  });

  // ── Admin: the three switches (audited, like the network's) ───────────────────────────────────────────────────────
  const audit = (req, key, on) => {
    const a = auditActorColumns(req.user?.id ?? null);
    db.prepare(`INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(a.admin_user_id, a.actor_kind, a.actor, "atlas_compete_switch", key, null, JSON.stringify({ enabled: on }));
  };
  const state = () => {
    const one = (sql) => { try { return db.prepare(sql).pluck().get(); } catch { return null; } };
    return { league: leagueEnabled(db), challenges: challengesEnabled(db), liveCount: liveCountEnabled(db), counts: {
      members: one(`SELECT COUNT(*) FROM league_members`),
      pods: one(`SELECT COUNT(DISTINCT pod_key || '#' || tier) FROM league_members`),
      challengesFinished: one(`SELECT COUNT(*) FROM challenge_runs WHERE finished_at IS NOT NULL AND kind != 'beat_the_bar'`),
      barsShared: one(`SELECT COUNT(*) FROM challenge_runs WHERE kind = 'beat_the_bar'`),
    } };
  };
  app.get("/api/admin/atlas-compete", requireAdmin, (_req, res) => res.json(state()));
  app.put("/api/admin/atlas-compete", requireAdmin, (req, res) => {
    const pairs = [["league", LEAGUE_SETTING], ["challenges", CHALLENGES_SETTING], ["liveCount", LIVE_COUNT_SETTING]];
    for (const [k, key] of pairs) {
      if (typeof req.body?.[k] !== "boolean") continue;
      setSetting(db, key, req.body[k]);
      try { audit(req, key, req.body[k]); } catch { /* the switch is set either way */ }
    }
    res.json(state());
  });
}
