// routes/notify.js — ⭐ D112 item 8 · the person's notification doors (services/notify.js holds the rules).
//
//   GET    /api/notify/settings     which channels exist (push only with the three VAPID variables; email only with Resend),
//                                  every event with its two switches, how many browsers get pushes
//   PUT    /api/notify/prefs        { event, channel: 'push'|'email', on } — one switch
//   POST   /api/push/subscribe      { endpoint, keys: { p256dh, auth } } — this browser (404 when push is not offered)
//   POST   /api/push/unsubscribe    { endpoint } — this browser stops
//   POST   /api/push/test           one test push to the person's browsers (so they can see it works)
import { NOTIFY_EVENTS, channelsOffered, readPrefs, setPref, saveSubscription, removeSubscription, subscriptionCount, pushToUser } from "../services/notify.js";
import { vapidConfig } from "../services/webPush.js";

export default function notifyRoutes(app, db, requireAuth, { env = process.env, fetchImpl = fetch } = {}) {
  const settings = (userId) => {
    const offered = channelsOffered(env);
    const prefs = readPrefs(db, userId);
    return {
      push: { offered: offered.push, publicKey: offered.publicKey, devices: offered.push ? subscriptionCount(db, userId) : 0 },
      email: { offered: offered.email },
      events: Object.entries(NOTIFY_EVENTS).map(([key, e]) => ({ key, label: e.label, what: e.what, ...prefs[key] })),
    };
  };
  const fail = (res, e) => res.status(e.status || 500).json({ error: e.code || "failed", message: e.status ? e.message : "Could not save that." });

  app.get("/api/notify/settings", requireAuth, (req, res) => res.json(settings(req.user.id)));

  app.put("/api/notify/prefs", requireAuth, (req, res) => {
    try {
      const { event, channel, on } = req.body || {};
      setPref(db, req.user.id, String(event || ""), String(channel || ""), on === true);
      res.json(settings(req.user.id));
    } catch (e) { fail(res, e); }
  });

  app.post("/api/push/subscribe", requireAuth, (req, res) => {
    if (!vapidConfig(env)) return res.status(404).json({ error: "not_configured" });
    try {
      saveSubscription(db, req.user.id, req.body || {}, req.get("user-agent"));
      res.json(settings(req.user.id));
    } catch (e) { fail(res, e); }
  });

  app.post("/api/push/unsubscribe", requireAuth, (req, res) => {
    removeSubscription(db, req.user.id, req.body?.endpoint);
    res.json(settings(req.user.id));
  });

  app.post("/api/push/test", requireAuth, async (req, res) => {
    const vapid = vapidConfig(env);
    if (!vapid) return res.status(404).json({ error: "not_configured" });
    const r = await pushToUser(db, req.user.id, { title: "draft", body: "Notifications are on for this browser.", url: "/app/account", tag: "test" },
      { vapid, fetchImpl });
    res.json(r);
  });
}
